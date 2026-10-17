const { WebSocketServer } = require('ws');
const http = require('http');
const db = require('./db');
const rs = require('./raspiSync');
const ae = require('./alertEngine');
const rm = require('./readingModel');
const { buildLimits } = require('./limitsModel');

// serial -> ws (dipakai trafoModel untuk status online) dan serial -> meta registrasi
const raspiClients = new Map();
const raspiMeta = new Map();
const cooldown = new ae.Cooldown();
let subscriptionsRef = new Map();

// Dependensi yang bisa disuntik test (tanpa MySQL/WhatsApp). trafoModel dan alertSender
// di-require lazy karena trafoModel meng-require modul ini (raspiClients).
const _deps = {
  getMasterDb: () => db.getMasterDb(),
  getDbConnection: (name) => db.getDbConnection(name),
  getStatusRow: (conn, trafoId) => require('./trafoModel').getStatusRow(conn, trafoId),
  getTransformerData: (conn, trafoId) => require('./trafoModel').getTransformerData(conn, trafoId),
  sendAlertMessage: (dbName, trafoId, alerts) => require('./alertSender').sendAlertMessage(dbName, trafoId, alerts),
};

const INTERVALS = { realtime: 5_000, harmonic: 60_000, status: 60_000, sync: 10 * 60_000 };
const HEARTBEAT_MS = 30_000;          // ping dari server; tanpa pong sampai ping berikutnya = mati
const REGISTER_TIMEOUT_MS = 30_000;   // tanpa createConnection dalam 30 s = tutup

// Murni: permintaan apa yang harus dikirim sekarang.
function dueRequests(state, now, hasWatchers) {
  // last = 0 berarti belum pernah diminta: langsung jatuh tempo.
  const due = (last, interval) => !last || now - last >= interval;
  const out = [];
  if (hasWatchers && due(state.lastRealtime, INTERVALS.realtime)) out.push('requestReadingDataRealTime');
  if (hasWatchers && due(state.lastHarmonic, INTERVALS.harmonic)) out.push('requestCurrentHarmonicRealTime', 'requestVoltageHarmonicRealTime');
  if (due(state.lastStatus, INTERVALS.status)) out.push('requestSyncUpdateStatusTransformer', 'requestTapPositionRealTime');
  if (due(state.lastSync, INTERVALS.sync)) out.push('requestSyncDataReading', 'requestSyncDataFailureLog');
  return out;
}

// Murni: 'dead' (tidak membalas ping), 'unregistered' (tidak pernah createConnection), atau 'ping'.
function heartbeatVerdict(conn, now) {
  if (!conn.isAlive) return 'dead';
  if (!conn.meta && now - (conn.openedAt || 0) >= REGISTER_TIMEOUT_MS) return 'unregistered';
  return 'ping';
}

function hasWatchers(meta) {
  if (!meta) return false;
  return subscriptionsRef.has(`trafo_${meta.dbName}_${meta.trafoId}`);
}

function send(ws, payload) {
  if (ws && ws.readyState === 1) { ws.send(JSON.stringify(payload)); return true; }
  return false;
}

async function getSettings(conn, trafoId) {
  const [rows] = await conn.execute('SELECT * FROM transformer_settings WHERE trafoId = ? LIMIT 1', [trafoId]);
  return rows[0] || null;
}

// Alert setelah status baru diterima: bandingkan dengan baris lama, nilai terakhir, dan limits.
async function alertOnStatus(conn, meta, beforeRow, afterRow) {
  const changes = ae.diffStatus(beforeRow, afterRow);
  if (changes.length === 0) return;
  const [latest, td, settings] = await Promise.all([
    rm.getLatest(conn, meta.trafoId),
    _deps.getTransformerData(conn, meta.trafoId),
    getSettings(conn, meta.trafoId),
  ]);
  const point = latest ? rm.computeDerived(latest, td) : {};
  const sent = await ae.processStatusChange({
    dbName: meta.dbName, trafoId: meta.trafoId, before: beforeRow, after: afterRow, point,
    limits: buildLimits(settings, td), cooldown, send: _deps.sendAlertMessage,
  });
}

function logRaspiReceivedData(payload) {
  if (!payload) return;
  const list = Array.isArray(payload) ? payload : [payload];
  if (list.length === 0) return;
  const items = list.length > 3 ? list.slice(-1) : list;
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const rawTime = item.timestamp || item.TIMESTAMP || item.timestamp_string || item.time_start || new Date();
    const timeStr = rawTime instanceof Date
      ? rawTime.toISOString().slice(0, 19).replace('T', ' ')
      : String(rawTime);
    console.log(`time : ${timeStr}`);
    for (const [k, v] of Object.entries(item)) {
      if (['timestamp', 'TIMESTAMP', 'timestamp_string', 'data_id', 'time_start'].includes(k)) continue;
      if (v !== null && v !== undefined && typeof v !== 'object') {
        console.log(`${k} : ${v}`);
      }
    }
  }
}

function closeConn(conn) {
  send(conn.ws, { type: 'terminateConnection' });
  try { conn.ws.close(); } catch (e) {}
}

async function handleCreateConnection(conn, msg) {
  const { ws } = conn;
  const serialWanted = String(msg.raspiSerialNo || '').trim();
  const master = await _deps.getMasterDb();
  const [[companyRow] = []] = await master.execute('SELECT database_name FROM company WHERE company_key = ? LIMIT 1', [String(msg.companyKey || '')]);
  if (companyRow && !canRegister(serialWanted, companyRow.database_name)) {
    return closeConn(conn, `serial ${serialWanted} sedang aktif untuk perusahaan lain, koneksi ditolak`);
  }
  // Status lama dibaca sebelum registrasi menimpanya, supaya trafo yang memburuk saat offline tetap memicu alert.
  let before = null;
  if (companyRow && serialWanted) {
    try {
      const cdb = await _deps.getDbConnection(companyRow.database_name);
      const [rows] = await cdb.execute('SELECT trafoId FROM transformer_data WHERE raspiSerialNo = ? LIMIT 1', [serialWanted]);
      if (rows[0]) before = await _deps.getStatusRow(cdb, rows[0].trafoId);
    } catch (e) { /* ditangani oleh registerConnection di bawah */ }
  }
  const reg = await rs.registerConnection(master, _deps.getDbConnection, msg);
  if (!reg) return closeConn(conn, `companyKey tidak dikenal atau serial kosong (${msg.raspiSerialNo || '-'}), koneksi ditutup`);

  conn.state = { lastRealtime: 0, lastHarmonic: 0, lastStatus: 0, lastSync: 0 };
  conn.serial = serialWanted;
  conn.meta = reg;
  raspiClients.set(conn.serial, ws);
  raspiMeta.set(conn.serial, reg);
  await rs.touchLastConnection(master, conn.serial);
  const after = rs.first(msg.transformerStatus);
  if (after) {
    try { await alertOnStatus(await _deps.getDbConnection(reg.dbName), reg, before, after); }
    catch (e) {}
  }
  await tick(conn);
}

async function handleMessage(conn, msg) {
  const { ws } = conn;
  if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') return;
  if (msg.type === 'createConnection') {
    try {
      await handleCreateConnection(conn, msg);
    } catch (e) {
      closeConn(conn);
    }
    return;
  }
  if (!conn.meta) {
    if (msg.type === 'ping_ws') send(ws, { type: 'pong_server' });
    return;
  }
  const meta = conn.meta;
  const cdb = await _deps.getDbConnection(meta.dbName);
  switch (msg.type) {
    case 'ping_ws':
      await rs.touchLastConnection(await _deps.getMasterDb(), conn.serial);
      send(ws, { type: 'pong_server' });
      break;
    case 'getReadingDataRealTimeReceived':
      logRaspiReceivedData(msg.readingData);
      await rs.handleReadingRealtime(cdb, meta.trafoId, msg.readingData);
      break;
    case 'receivedRequestCurrentHarmonicRealTime':
      logRaspiReceivedData(msg.data);
      await rs.handleHarmonic(cdb, meta.trafoId, 'current', msg.data);
      break;
    case 'receivedRequestVoltageHarmonicRealTime':
      logRaspiReceivedData(msg.data);
      await rs.handleHarmonic(cdb, meta.trafoId, 'voltage', msg.data);
      break;
    case 'receivedSyncUpdateStatusTransformer': {
      const before = await _deps.getStatusRow(cdb, meta.trafoId);
      const after = rs.first(msg.transformerStatus);
      logRaspiReceivedData(msg.transformerStatus);
      logRaspiReceivedData(msg.tripStatus);
      await rs.handleStatusSync(cdb, meta.trafoId, after, rs.first(msg.tripStatus));
      if (after) await alertOnStatus(cdb, meta, before, after);
      break;
    }
    case 'getTapPositionRealTimeReceived':
      logRaspiReceivedData(msg.transformerData);
      await rs.handleTapPosition(cdb, meta.trafoId, rs.first(msg.transformerData));
      break;
    case 'receivedSyncDataReading': {
      logRaspiReceivedData(msg.data);
      const n = await rs.handleSyncReading(cdb, meta.trafoId, msg.data);
      send(ws, { type: 'successSyncDataReading' });
      break;
    }
    case 'receivedSyncDataFailureLog': {
      logRaspiReceivedData(msg.data);
      await rs.handleSyncFailureLog(cdb, meta.trafoId, msg.data);
      break;
    }
    case 'updateSyncTransformerSettingsFromClient':
      await rs.handleSettingsFromClient(cdb, meta.trafoId, msg.data);
      break;
    case 'updateSyncTripSettingsFromClient':
      await rs.handleTripSettingsFromClient(cdb, meta.trafoId, msg.data);
      break;
    case 'updateSyncTransformerDataFromClient':
      await rs.handleTransformerDataFromClient(cdb, meta.trafoId, msg.data);
      break;
    default:
      break;
  }
}

async function tick(conn) {
  if (!conn.meta || !conn.state || !conn.ws || conn.ws.readyState !== 1) return;
  if (conn.inFlight) return;
  const now = Date.now();
  const due = dueRequests(conn.state, now, hasWatchers(conn.meta));
  if (due.length === 0) return;
  // Stempel dulu supaya kegagalan DB tidak membuat permintaan dikirim ulang tiap detik.
  if (due.includes('requestReadingDataRealTime')) conn.state.lastRealtime = now;
  if (due.includes('requestCurrentHarmonicRealTime')) conn.state.lastHarmonic = now;
  if (due.includes('requestSyncUpdateStatusTransformer')) conn.state.lastStatus = now;
  if (due.includes('requestSyncDataReading')) conn.state.lastSync = now;
  conn.inFlight = true;
  try {
    const cdb = await _deps.getDbConnection(conn.meta.dbName);
    for (const type of due) {
      if (type === 'requestSyncDataReading') {
        send(conn.ws, { type, timestampRange: await rs.recentTimestamps(cdb, conn.meta.trafoId) });
      } else if (type === 'requestSyncDataFailureLog') {
        send(conn.ws, { type, failureLogRange: await rs.knownFailureIds(cdb, conn.meta.trafoId) });
      } else {
        send(conn.ws, { type });
      }
    }
  } finally {
    conn.inFlight = false;
  }
}

function handleRaspiConnection(ws) {
  const conn = { ws, serial: null, meta: null, state: null, openedAt: Date.now(), isAlive: true, inFlight: false };
  const timer = setInterval(() => { tick(conn).catch(() => {}); }, 1000);
  const heartbeat = setInterval(() => {
    const verdict = heartbeatVerdict(conn, Date.now());
    if (verdict === 'dead') { return ws.terminate(); }
    if (verdict === 'unregistered') { return ws.close(); }
    conn.isAlive = false;
    try { ws.ping(); } catch (e) {}
  }, HEARTBEAT_MS);

  ws.on('pong', () => { conn.isAlive = true; });
  ws.on('message', async (data) => {
    let msg;
    try { msg = JSON.parse(data.toString()); } catch (e) { return; }
    try { await handleMessage(conn, msg); } catch (e) {}
  });
  ws.on('close', () => {
    clearInterval(timer);
    clearInterval(heartbeat);
    if (conn.serial && raspiClients.get(conn.serial) === ws) { raspiClients.delete(conn.serial); raspiMeta.delete(conn.serial); }
  });
  ws.on('error', () => {});
}

function initRaspiWebSocket(server, { activeSubscriptions } = {}) {
  if (activeSubscriptions) subscriptionsRef = activeSubscriptions;
  const wss = new WebSocketServer({ noServer: true });
  server.on('upgrade', (request, socket, head) => {
    let pathname = '/';
    try { pathname = new URL(request.url, `http://${request.headers.host || 'localhost'}`).pathname; } catch (e) { pathname = request.url.split('?')[0]; }
    if (pathname === '/bd-iot-socket') wss.handleUpgrade(request, socket, head, (ws) => wss.emit('connection', ws, request));
  });
  wss.on('connection', handleRaspiConnection);

  const dedicatedPort = process.env.RASPI_WS_PORT || process.env.WEBSOCKET_PORT || 2083;
  try {
    const standalone = http.createServer();
    const standaloneWss = new WebSocketServer({ server: standalone, path: '/bd-iot-socket' });
    standaloneWss.on('connection', handleRaspiConnection);
    standalone.on('error', () => {});
    standalone.listen(dedicatedPort, () => {});
  } catch (err) {}
  return { wss, raspiClients };
}

// Serial boleh didaftarkan kalau belum ada koneksi hidup untuk serial itu dari perusahaan lain.
function canRegister(serialNo, dbName) {
  const meta = raspiMeta.get(serialNo);
  const ws = raspiClients.get(serialNo);
  if (!meta || !ws || ws.readyState !== 1) return true;
  return meta.dbName === dbName;
}

// dbName (opsional) memastikan dorongan dari route perusahaan A tidak sampai ke Raspi perusahaan B.
function sendToRaspi(serialNo, payload, dbName) {
  const meta = raspiMeta.get(serialNo);
  if (dbName && meta && meta.dbName !== dbName) return false;
  return send(raspiClients.get(serialNo), payload);
}

module.exports = {
  initRaspiWebSocket, sendToRaspi, canRegister, raspiClients, raspiMeta,
  dueRequests, heartbeatVerdict, handleMessage, INTERVALS, HEARTBEAT_MS, REGISTER_TIMEOUT_MS, _deps,
};
