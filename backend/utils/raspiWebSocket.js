const { WebSocketServer } = require('ws');
const http = require('http');
const { getMasterDb, getDbConnection } = require('./db');
const rs = require('./raspiSync');
const ae = require('./alertEngine');
const rm = require('./readingModel');
const { buildLimits } = require('./limitsModel');
// trafoModel meng-require modul ini (raspiClients), jadi di-require lazy untuk menghindari import melingkar.
const tm = () => require('./trafoModel');

// serial -> ws (dipakai trafoModel untuk status online) dan serial -> meta registrasi
const raspiClients = new Map();
const raspiMeta = new Map();
const cooldown = new ae.Cooldown();
let subscriptionsRef = new Map();

const INTERVALS = { realtime: 5_000, harmonic: 60_000, status: 60_000, sync: 10 * 60_000 };

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

function hasWatchers(meta) {
  if (!meta) return false;
  return subscriptionsRef.has(`trafo_${meta.dbName}_${meta.trafoId}`);
}

function send(ws, payload) {
  if (ws && ws.readyState === 1) { ws.send(JSON.stringify(payload)); return true; }
  return false;
}

async function getSettings(db, trafoId) {
  const [rows] = await db.execute('SELECT * FROM transformer_settings WHERE trafoId = ? LIMIT 1', [trafoId]);
  return rows[0] || null;
}

// Alert setelah status baru diterima: bandingkan dengan baris lama, nilai terakhir, dan limits.
async function alertOnStatus(db, meta, beforeRow, afterRow) {
  const { sendAlertMessage } = require('./alertSender');
  const changes = ae.diffStatus(beforeRow, afterRow);
  if (changes.length === 0) return;
  const [latest, td, settings] = await Promise.all([rm.getLatest(db, meta.trafoId), tm().getTransformerData(db, meta.trafoId), getSettings(db, meta.trafoId)]);
  const point = latest ? rm.computeDerived(latest, td) : {};
  const sent = await ae.processStatusChange({
    dbName: meta.dbName, trafoId: meta.trafoId, before: beforeRow, after: afterRow, point,
    limits: buildLimits(settings, td), cooldown, send: sendAlertMessage,
  });
  if (sent.length > 0) console.log(`[Raspi WS] alert ${meta.dbName}/trafo ${meta.trafoId}: ${sent.map((a) => `${a.name} ${a.sub}`).join(', ')}`);
}

async function handleMessage(conn, msg) {
  const { ws } = conn;
  if (msg.type === 'createConnection') {
    const master = await getMasterDb();
    const reg = await rs.registerConnection(master, getDbConnection, msg);
    if (!reg) {
      console.warn(`[Raspi WS] companyKey tidak dikenal atau serial kosong (${msg.raspiSerialNo || '-'}), koneksi ditutup`);
      send(ws, { type: 'terminateConnection' });
      ws.close();
      return;
    }
    conn.serial = String(msg.raspiSerialNo).trim();
    conn.meta = reg;
    raspiClients.set(conn.serial, ws);
    raspiMeta.set(conn.serial, reg);
    await rs.touchLastConnection(master, conn.serial);
    console.log(`[Raspi WS] terdaftar: serial ${conn.serial} -> ${reg.dbName} trafo ${reg.trafoId} (v${reg.tmuVersion})`);
    conn.state = { lastRealtime: 0, lastHarmonic: 0, lastStatus: 0, lastSync: 0 };
    await tick(conn);
    return;
  }
  if (!conn.meta) {
    if (msg.type === 'ping_ws') send(ws, { type: 'pong_server' });
    return;
  }
  const meta = conn.meta;
  const db = await getDbConnection(meta.dbName);
  switch (msg.type) {
    case 'ping_ws':
      await rs.touchLastConnection(await getMasterDb(), conn.serial);
      send(ws, { type: 'pong_server' });
      break;
    case 'getReadingDataRealTimeReceived':
      await rs.handleReadingRealtime(db, meta.trafoId, msg.readingData);
      break;
    case 'receivedRequestCurrentHarmonicRealTime':
      await rs.handleHarmonic(db, meta.trafoId, 'current', msg.data);
      break;
    case 'receivedRequestVoltageHarmonicRealTime':
      await rs.handleHarmonic(db, meta.trafoId, 'voltage', msg.data);
      break;
    case 'receivedSyncUpdateStatusTransformer': {
      const before = await tm().getStatusRow(db, meta.trafoId);
      const after = rs.first(msg.transformerStatus);
      await rs.handleStatusSync(db, meta.trafoId, after, rs.first(msg.tripStatus));
      if (after) await alertOnStatus(db, meta, before, after);
      break;
    }
    case 'getTapPositionRealTimeReceived':
      await rs.handleTapPosition(db, meta.trafoId, rs.first(msg.transformerData));
      break;
    case 'receivedSyncDataReading': {
      const n = await rs.handleSyncReading(db, meta.trafoId, msg.data);
      send(ws, { type: 'successSyncDataReading' });
      if (n > 0) console.log(`[Raspi WS] sync reading ${conn.serial}: ${n} baris`);
      break;
    }
    case 'receivedSyncDataFailureLog': {
      const n = await rs.handleSyncFailureLog(db, meta.trafoId, msg.data);
      if (n > 0) console.log(`[Raspi WS] sync failure log ${conn.serial}: ${n} baris`);
      break;
    }
    default:
      console.log(`[Raspi WS] pesan tidak ditangani (${msg.type}) dari ${conn.serial}`);
  }
}

// Kirim permintaan yang jatuh tempo; dipanggil tiap detik per koneksi.
async function tick(conn) {
  if (!conn.meta || !conn.ws || conn.ws.readyState !== 1) return;
  const now = Date.now();
  const due = dueRequests(conn.state, now, hasWatchers(conn.meta));
  if (due.length === 0) return;
  const db = await getDbConnection(conn.meta.dbName);
  for (const type of due) {
    if (type === 'requestSyncDataReading') {
      send(conn.ws, { type, timestampRange: await rs.recentTimestamps(db, conn.meta.trafoId, 24) });
    } else if (type === 'requestSyncDataFailureLog') {
      send(conn.ws, { type, failureLogRange: await rs.knownFailureIds(db, conn.meta.trafoId) });
    } else {
      send(conn.ws, { type });
    }
  }
  if (due.includes('requestReadingDataRealTime')) conn.state.lastRealtime = now;
  if (due.includes('requestCurrentHarmonicRealTime')) conn.state.lastHarmonic = now;
  if (due.includes('requestSyncUpdateStatusTransformer')) conn.state.lastStatus = now;
  if (due.includes('requestSyncDataReading')) conn.state.lastSync = now;
}

function handleRaspiConnection(ws, req) {
  const conn = { ws, serial: null, meta: null, state: null };
  console.log(`[Raspi WS] koneksi masuk dari ${req.socket.remoteAddress}`);
  const timer = setInterval(() => { tick(conn).catch((e) => console.error('[Raspi WS] tick error:', e.message)); }, 1000);

  ws.on('message', async (data) => {
    let msg;
    try { msg = JSON.parse(data.toString()); } catch (e) { console.error('[Raspi WS] JSON tidak valid:', e.message); return; }
    try { await handleMessage(conn, msg); } catch (e) { console.error(`[Raspi WS] gagal menangani ${msg.type} dari ${conn.serial || '-'}:`, e.message); }
  });
  ws.on('close', () => {
    clearInterval(timer);
    if (conn.serial && raspiClients.get(conn.serial) === ws) { raspiClients.delete(conn.serial); raspiMeta.delete(conn.serial); }
    console.log(`[Raspi WS] koneksi putus: ${conn.serial || '-'}`);
  });
  ws.on('error', (err) => console.error(`[Raspi WS] error socket (${conn.serial || '-'}):`, err.message));
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

  // Port khusus 2083 seperti deployment lama (opsional; gagal bind hanya peringatan).
  const dedicatedPort = process.env.RASPI_WS_PORT || process.env.WEBSOCKET_PORT || 2083;
  try {
    const standalone = http.createServer();
    const standaloneWss = new WebSocketServer({ server: standalone, path: '/bd-iot-socket' });
    standaloneWss.on('connection', handleRaspiConnection);
    standalone.on('error', (err) => console.warn(`[Raspi WS] port ${dedicatedPort} tidak dipakai (${err.message}); hanya /bd-iot-socket di server utama`));
    standalone.listen(dedicatedPort, () => console.log(`[Raspi WS] standalone aktif di port ${dedicatedPort} (/bd-iot-socket)`));
  } catch (err) {
    console.warn(`[Raspi WS] standalone dilewati: ${err.message}`);
  }
  console.log('[Raspi WS] handler aktif di /bd-iot-socket');
  return { wss, raspiClients };
}

function sendToRaspi(serialNo, payload) {
  return send(raspiClients.get(serialNo), payload);
}

module.exports = { initRaspiWebSocket, sendToRaspi, raspiClients, raspiMeta, dueRequests, INTERVALS };
