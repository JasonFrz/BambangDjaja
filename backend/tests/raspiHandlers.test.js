const test = require('node:test');
const assert = require('node:assert/strict');
const { makeFakeDb } = require('./helpers/fakeDb');
const w = require('../utils/raspiWebSocket');
const rs = require('../utils/raspiSync');

function fakeWs() {
  const sent = [];
  return { readyState: 1, sent, closed: false, pinged: 0, send(s) { sent.push(JSON.parse(s)); }, close() { this.closed = true; }, terminate() { this.closed = true; }, ping() { this.pinged++; } };
}
const newConn = (ws) => ({ ws, serial: null, meta: null, state: null, openedAt: Date.now(), isAlive: true });
const masterWith = (rows) => async () => makeFakeDb(() => rows);

test('createConnection: registrasi gagal (DB perusahaan tidak ada) -> socket ditutup, meta tetap kosong', async () => {
  const ws = fakeWs(); const conn = newConn(ws);
  w._deps.getMasterDb = masterWith([{ company_id: 1, database_name: 'db_hilang', tmu_version: 2 }]);
  w._deps.getDbConnection = async () => { throw Object.assign(new Error('Unknown database'), { code: 'ER_BAD_DB_ERROR' }); };
  await w.handleMessage(conn, { type: 'createConnection', companyKey: 'k', raspiSerialNo: 'S9' });
  assert.equal(ws.closed, true);
  assert.equal(conn.meta, null);
});

test('createConnection: status memburuk selama offline -> alert dikirim saat reconnect', async () => {
  const ws = fakeWs(); const conn = newConn(ws);
  const company = makeFakeDb((sql) =>
    /FROM transformer_data WHERE raspiSerialNo/.test(sql) ? [{ trafoId: 1 }]
    : /FROM transformer_status/.test(sql) ? [{ OilTemp: 3, Vab: 3 }]
    : []);
  w._deps.getMasterDb = masterWith([{ company_id: 1, database_name: 'db_x', tmu_version: 2 }]);
  w._deps.getDbConnection = async () => company;
  const sent = [];
  w._deps.sendAlertMessage = async (dbName, trafoId, alerts) => sent.push({ dbName, trafoId, alerts });
  await w.handleMessage(conn, { type: 'createConnection', companyKey: 'k', raspiSerialNo: 'S8', version: 2, transformerStatus: [{ OilTemp: 5, Vab: 3 }], tripStatus: [{}] });
  assert.equal(conn.meta && conn.meta.trafoId, 1);
  assert.equal(conn.state && typeof conn.state.lastStatus, 'number');
  assert.equal(sent.length, 1);
  assert.equal(sent[0].dbName, 'db_x');
  assert.equal(sent[0].alerts[0].name, 'OilTemp');
  assert.equal(sent[0].alerts[0].type, 'TRIP');
  w.raspiClients.delete('S8'); w.raspiMeta.delete('S8');
});

test('pesan *FromClient memperbarui settings, trip settings, dan transformer_data', async () => {
  const db = makeFakeDb();
  await rs.handleSettingsFromClient(db, 1, { voltageLowAlarmTreshold: 6, asing: 1 });
  assert.match(db.calls[0].sql, /^INSERT INTO `transformer_settings` \(`trafoId`, `voltageLowAlarmTreshold`\) VALUES \(\?, \?\) ON DUPLICATE KEY UPDATE/);
  await rs.handleTripSettingsFromClient(db, 1, { voltage: 0 });
  assert.match(db.calls[1].sql, /^INSERT INTO `trip_settings` \(`trafoId`, `voltage`\)/);
  await rs.handleTransformerDataFromClient(db, 1, { ratedPower: 160, trafoId: 99, raspiSerialNo: 'X', version: 1 });
  assert.equal(db.calls[2].sql, 'UPDATE transformer_data SET `ratedPower` = ? WHERE trafoId = ?');
  assert.deepEqual(db.calls[2].params, [160, 1]);
  await rs.handleTransformerDataFromClient(db, 1, { raspiSerialNo: 'X' });
  assert.equal(db.calls.length, 3);
});

test('handleMessage merutekan *FromClient ke handler', async () => {
  const ws = fakeWs(); const conn = newConn(ws);
  const db = makeFakeDb();
  conn.meta = { dbName: 'db_x', trafoId: 1, tmuVersion: 2 }; conn.serial = 'S7'; conn.state = { lastRealtime: 0, lastHarmonic: 0, lastStatus: 0, lastSync: 0 };
  w._deps.getDbConnection = async () => db;
  await w.handleMessage(conn, { type: 'updateSyncTransformerSettingsFromClient', data: { topOilHighAlarmTreshold: 65 } });
  await w.handleMessage(conn, { type: 'updateSyncTripSettingsFromClient', data: { pressure: 1 } });
  await w.handleMessage(conn, { type: 'updateSyncTransformerDataFromClient', data: { impedance: 5 } });
  assert.match(db.calls[0].sql, /transformer_settings/);
  assert.match(db.calls[1].sql, /trip_settings/);
  assert.match(db.calls[2].sql, /UPDATE transformer_data SET `impedance`/);
});

test('heartbeatVerdict: ping saat sehat, dead tanpa pong, unregistered setelah 30 detik tanpa createConnection', () => {
  const ws = fakeWs();
  assert.equal(w.heartbeatVerdict({ ws, meta: { x: 1 }, openedAt: 0, isAlive: true }, 100000), 'ping');
  assert.equal(w.heartbeatVerdict({ ws, meta: { x: 1 }, openedAt: 0, isAlive: false }, 100000), 'dead');
  assert.equal(w.heartbeatVerdict({ ws, meta: null, openedAt: 0, isAlive: true }, 31000), 'unregistered');
  assert.equal(w.heartbeatVerdict({ ws, meta: null, openedAt: 0, isAlive: true }, 10000), 'ping');
  assert.equal(w.HEARTBEAT_MS, 30000);
});

test('recentTimestamps default 8 hari (klien mengirim 7 hari); handleSyncReading melaporkan affectedRows', async () => {
  const db = makeFakeDb(() => []);
  await rs.recentTimestamps(db, 1);
  const since = db.calls[0].params[1];
  const hours = (Date.now() - since.getTime()) / 3600e3;
  assert.ok(hours > 191.9 && hours < 192.1, `since ${hours} jam`);

  const db2 = makeFakeDb();
  db2.execute = async (sql, params) => { db2.calls.push({ sql, params }); return [{ affectedRows: 2 }, []]; };
  db2.query = db2.execute;
  const n = await rs.handleSyncReading(db2, 1, [{ timestamp: '2026-10-14T00:00:00Z', Van: 1 }, { timestamp: '2026-10-14T00:01:00Z', Van: 2 }, { timestamp: '2026-10-14T00:02:00Z', Van: 3 }]);
  assert.equal(n, 2);
});
