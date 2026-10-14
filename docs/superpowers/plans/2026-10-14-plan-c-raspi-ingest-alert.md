# Rencana C: Ingest Raspberry Pi dan Alert

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Server menerima koneksi WebSocket dari Raspberry Pi (protokol `../tmu/tmu-app-client-deploy/websocket.js`), menulis data realtime, historis, status, harmonik, dan failure log ke DB perusahaan berskema `base_tmu`, menandai online/offline, dan mengirim alert WhatsApp/email saat status memburuk.

**Architecture:** `raspiWebSocket.js` hanya mengurus koneksi, routing pesan, dan penjadwalan permintaan; semua penulisan DB ada di `raspiSync.js` (fungsi kecil yang menerima `db` sehingga bisa diuji dengan `fakeDb`). Keputusan alert ada di `alertEngine.js` (diff status, cooldown, bentuk pesan) dan pengirimannya memakai `alertSender.sendAlertMessage` dari Rencana B. `scripts/fake_raspi.js` meniru klien Raspi untuk uji lokal tanpa perangkat.

**Tech Stack:** Node 22, `ws` (sudah ada di backend), mysql2/promise, `node:test`, `tests/helpers/fakeDb.js`.

**Spec:** `docs/superpowers/specs/2026-10-13-tmu-legacy-schema-design.md` bagian 5, 6.4, 9 (fake_raspi), 10 (urutan 8–9).

## Global Constraints

- Nama kolom reading `base_tmu` di luar `readingModel.js` hanya boleh muncul sebagai allowlist kolom insert di `raspiSync.js` (diturunkan dari `readingModel.COLUMN_MAP`, bukan ditulis ulang).
- Semua nilai dari Raspi masuk SQL lewat `?`. Nama kolom yang berasal dari payload selalu disaring lewat allowlist; kolom yang tidak dikenal dibuang, bukan error.
- Zona waktu: sesi MySQL dan driver memakai UTC (Rencana B). Timestamp dari Raspi: string ISO ber-`Z`/offset dipakai apa adanya; string polos `YYYY-MM-DD HH:mm:ss` dianggap waktu lokal Raspi dengan offset `RASPI_TZ_OFFSET` (default `+07:00`).
- Nama kolom dari Raspi dicocokkan tanpa peduli huruf besar-kecil (`TIMESTAMP`, `deRatingB` dari view `shrink_data_temp`).
- Protokol dan nama pesan harus persis seperti klien: `createConnection`, `ping_ws`/`pong_server`, `requestReadingDataRealTime`/`getReadingDataRealTimeReceived`, `requestCurrentHarmonicRealTime`/`receivedRequestCurrentHarmonicRealTime`, `requestVoltageHarmonicRealTime`/`receivedRequestVoltageHarmonicRealTime`, `requestSyncUpdateStatusTransformer`/`receivedSyncUpdateStatusTransformer`, `requestTapPositionRealTime`/`getTapPositionRealTimeReceived`, `requestSyncDataReading`/`receivedSyncDataReading`/`successSyncDataReading`, `requestSyncDataFailureLog`/`receivedSyncDataFailureLog`, `terminateConnection`. Payload klien selalu array baris (`transformerData[0]`, dst.).
- Pesan yang tidak ditangani (`prepareDownloadLogFile`, `requestPerformanceReportDataDaily`, `requestSyncDataReport`, `requestReportInstantaneousDataRealTime`) hanya di-log.
- Unit test tidak boleh butuh MySQL atau socket.
- Tidak menambah dependency baru.

## Review Focus

1. Raspi dengan `companyKey` yang tidak terdaftar: koneksi ditutup setelah log, tidak ada DB yang disentuh dan tidak ada crash. Test di Task 2 (`registerConnection` mengembalikan `null`).
2. Payload baris dengan kolom asing atau nama kolom beda huruf (`TIMESTAMP`, `deRatingB`, `data_id`): hanya kolom yang dikenal yang di-INSERT, timestamp tetap terbaca. Test di Task 1 (`pickColumns`, `buildInsert`).
3. Status memburuk lalu kembali normal lalu memburuk lagi dalam 15 menit: alert kedua ditahan cooldown; parameter lain tetap boleh. Test di Task 3.
4. Raspi mengirim `receivedSyncDataReading` dengan ratusan baris yang sebagian sudah ada: `INSERT IGNORE` dengan index unik `(trafoId, timestamp)`, tidak ada duplikat atau error. Test di Task 2 (SQL memakai `INSERT IGNORE`), live di Task 5.
5. Tidak ada penonton room: permintaan realtime dan harmonik tidak dikirim, tetapi status dan sync tetap berjalan. Test di Task 4 (`dueRequests`).

## File Structure

| File | Status | Tanggung jawab |
|---|---|---|
| `backend/utils/raspiSync.js` | baru | helper murni (timestamp, pickColumns, buildInsert, mapHarmonicRow) dan handler DB per pesan |
| `backend/utils/alertEngine.js` | baru | `diffStatus`, `PARAM_METRIC`, `buildAlerts`, `Cooldown`, `processStatusChange` |
| `backend/utils/raspiWebSocket.js` | tulis ulang | koneksi, routing pesan ke `raspiSync`, scheduler `dueRequests`, `raspiClients`, `sendToRaspi` |
| `backend/index.js` | ubah kecil | `initRaspiWebSocket(server, { activeSubscriptions })` |
| `backend/scripts/fake_raspi.js` | baru | simulator klien Raspi |
| `backend/tests/raspiSync.test.js`, `alertEngine.test.js`, `raspiScheduler.test.js` | baru | unit test |

---

### Task 1: Helper murni `raspiSync`: timestamp, pickColumns, buildInsert, harmonik

**Files:**
- Create: `backend/utils/raspiSync.js` (bagian helper)
- Test: `backend/tests/raspiSync.test.js`

**Interfaces:**
- Consumes: `readingModel.COLUMN_MAP`, `statusModel.STATUS_COLUMNS`, `limitsModel.SETTINGS_COLUMNS/TRIP_COLUMNS`.
- Produces: `parseRaspiTimestamp(v, offset='+07:00') -> Date|null`, `pickColumns(row, allowlist) -> {col: val}` (case-insensitive), `buildInsert(table, rows, allowlist, extra, { ignore }) -> { sql, params } | null`, `mapHarmonicRow(row) -> { Phase, '1st'.. '31th' }`, konstanta `READING_COLUMNS`, `TD_COLUMNS`, `SETTINGS_ALL_COLUMNS`, `TRIP_SETTINGS_COLUMNS`, `STATUS_ALL_COLUMNS`, `FAILURE_COLUMNS`, `HARMONIC_ORDERS`.

- [x] **Step 1: Tulis test**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const rs = require('../utils/raspiSync');

test('parseRaspiTimestamp: ISO dipakai apa adanya, string polos dianggap WIB', () => {
  assert.equal(rs.parseRaspiTimestamp('2026-10-14T01:02:03.000Z').toISOString(), '2026-10-14T01:02:03.000Z');
  assert.equal(rs.parseRaspiTimestamp('2026-10-14 08:02:03').toISOString(), '2026-10-14T01:02:03.000Z');
  assert.equal(rs.parseRaspiTimestamp('2026-10-14 08:02:03', '+00:00').toISOString(), '2026-10-14T08:02:03.000Z');
  assert.equal(rs.parseRaspiTimestamp(new Date('2026-01-01T00:00:00Z')).toISOString(), '2026-01-01T00:00:00.000Z');
  assert.equal(rs.parseRaspiTimestamp('bukan tanggal'), null);
  assert.equal(rs.parseRaspiTimestamp(null), null);
});

test('pickColumns mencocokkan nama kolom tanpa peduli huruf dan membuang kolom asing', () => {
  const out = rs.pickColumns({ TIMESTAMP: 't', van: 230, deRatingB: 95, data_id: 9, timestamp_string: 'x' }, ['timestamp', 'Van', 'deRatingb']);
  assert.deepEqual(out, { timestamp: 't', Van: 230, deRatingb: 95 });
});

test('buildInsert membuat multi-row INSERT dengan allowlist dan kolom tambahan', () => {
  const rows = [{ Van: 1, Vbn: 2, asing: 9 }, { Van: 3 }];
  const q = rs.buildInsert('reading_data', rows, ['Van', 'Vbn'], { trafoId: 7 }, { ignore: true });
  assert.equal(q.sql, 'INSERT IGNORE INTO `reading_data` (`trafoId`, `Van`, `Vbn`) VALUES (?, ?, ?), (?, ?, ?)');
  assert.deepEqual(q.params, [7, 1, 2, 7, 3, null]);
  assert.equal(rs.buildInsert('reading_data', [], ['Van'], { trafoId: 7 }), null);
  assert.equal(rs.buildInsert('reading_data', [{ asing: 1 }], ['Van'], {}), null);
});

test('mapHarmonicRow memetakan Row1st.. ke 1st.. dan Phase', () => {
  const row = rs.mapHarmonicRow({ Phase: 2, Row1st: 100, Row3rd: 2.5, Row31th: 0.1, lain: 1 });
  assert.equal(row.Phase, 2);
  assert.equal(row['1st'], 100);
  assert.equal(row['3rd'], 2.5);
  assert.equal(row['31th'], 0.1);
  assert.equal(row['5th'], null);
  assert.equal('lain' in row, false);
});

test('allowlist kolom diturunkan dari model, bukan ditulis ulang', () => {
  assert.ok(rs.READING_COLUMNS.includes('timestamp'));
  assert.ok(rs.READING_COLUMNS.includes('Van') && rs.READING_COLUMNS.includes('Level'));
  assert.equal(rs.READING_COLUMNS.includes('trafoId'), false);
  assert.ok(rs.STATUS_ALL_COLUMNS.includes('OilLevel'));
  assert.ok(rs.SETTINGS_ALL_COLUMNS.includes('voltageLowAlarmValue'));
  assert.ok(rs.TD_COLUMNS.includes('raspiSerialNo') && rs.TD_COLUMNS.includes('ratedPower'));
  assert.equal(rs.TD_COLUMNS.includes('trafoId'), false);
});
```

- [x] **Step 2: `npm test`, pastikan gagal karena modul belum ada**

- [x] **Step 3: Tulis bagian helper `backend/utils/raspiSync.js`**

```js
const rm = require('./readingModel');
const sm = require('./statusModel');
const { SETTINGS_COLUMNS, TRIP_COLUMNS } = require('./limitsModel');

// ---------- allowlist kolom ----------
const READING_COLUMNS = ['timestamp', ...Object.keys(rm.COLUMN_MAP)];
const STATUS_ALL_COLUMNS = [...sm.STATUS_COLUMNS];
const SETTINGS_ALL_COLUMNS = [
  ...SETTINGS_COLUMNS,
  'voltageLowTripValue', 'voltageLowAlarmValue', 'voltageHighTripValue', 'voltageHighAlarmValue',
];
const TRIP_SETTINGS_COLUMNS = [...TRIP_COLUMNS];
const TD_COLUMNS = [
  'raspiSerialNo', 'trafoSerialNo', 'ratedPower', 'ratedHighVoltage', 'ratedLowVoltage', 'ratedCurrentHighVoltage',
  'ratedCurrentLowVoltage', 'frequency', 'vectorGroup', 'phase', 'tapType', 'impedance', 'noLoadLoss', 'fullLoadLoss',
  'tapPercentagePlus', 'tapPercentageMinus', 'tapNumberPlus', 'tapNumberMinus', 'topOilHv', 'topOilLv', 'gradientHv',
  'gradientLv', 'windTempHv', 'windTempLv', 'losses', 'hotspotFactor', 'ctRatio', 'coolingMode', 'status', 'SuddenPressure',
  'latitude', 'longitude', 'intervalDelay', 'krated', 'lastSyncTimestamp', 'version', 'imageFileName', 'productionStatus',
];
const FAILURE_COLUMNS = ['failure_id', 'time_start', 'duration', 'failure_type', 'parameter', 'parameterValue'];
const HARMONIC_ORDERS = ['1st', '3rd', '5th', '7th', '9th', '11th', '13th', '15th', '17th', '19th', '21th', '23th', '25th', '27th', '29th', '31th'];

// ---------- helper murni ----------
const DEFAULT_OFFSET = process.env.RASPI_TZ_OFFSET || '+07:00';

// Date | ISO string | 'YYYY-MM-DD HH:mm:ss' (lokal Raspi) -> Date UTC, atau null.
function parseRaspiTimestamp(v, offset = DEFAULT_OFFSET) {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  const s = String(v).trim();
  const plain = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?)(\.\d+)?$/.exec(s);
  const d = plain ? new Date(`${plain[1]}T${plain[2]}${plain[3] || ''}${offset}`) : new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Ambil kolom yang ada di allowlist; nama dicocokkan tanpa peduli huruf besar-kecil.
function pickColumns(row, allowlist) {
  const out = {};
  if (!row || typeof row !== 'object') return out;
  const byLower = new Map(allowlist.map((c) => [c.toLowerCase(), c]));
  for (const [k, v] of Object.entries(row)) {
    const col = byLower.get(String(k).toLowerCase());
    if (col && !(col in out)) out[col] = v;
  }
  return out;
}

// INSERT multi-baris. Kolom = extra (mis. trafoId) + kolom allowlist yang muncul di baris mana pun.
function buildInsert(table, rows, allowlist, extra = {}, { ignore = false } = {}) {
  const picked = (rows || []).map((r) => pickColumns(r, allowlist)).filter((r) => Object.keys(r).length > 0);
  if (picked.length === 0) return null;
  const cols = allowlist.filter((c) => picked.some((r) => c in r));
  const extraCols = Object.keys(extra);
  const all = [...extraCols, ...cols];
  const placeholders = `(${all.map(() => '?').join(', ')})`;
  const params = [];
  for (const r of picked) {
    for (const c of extraCols) params.push(extra[c]);
    for (const c of cols) params.push(c in r ? r[c] : null);
  }
  const sql = `INSERT ${ignore ? 'IGNORE ' : ''}INTO \`${table}\` (${all.map((c) => `\`${c}\``).join(', ')}) VALUES ${picked.map(() => placeholders).join(', ')}`;
  return { sql, params };
}

// Baris harmonik dari Raspi: { Phase, Row1st, Row3rd, ... } -> { Phase, '1st', '3rd', ... }
function mapHarmonicRow(row) {
  const out = { Phase: row && row.Phase !== undefined ? Number(row.Phase) : null };
  for (const o of HARMONIC_ORDERS) {
    const v = row ? (row[`Row${o}`] ?? row[o]) : undefined;
    out[o] = v === undefined || v === null || v === '' ? null : Number(v);
  }
  return out;
}

const first = (x) => (Array.isArray(x) ? x[0] : x) || null;

module.exports = {
  READING_COLUMNS, STATUS_ALL_COLUMNS, SETTINGS_ALL_COLUMNS, TRIP_SETTINGS_COLUMNS, TD_COLUMNS, FAILURE_COLUMNS, HARMONIC_ORDERS,
  parseRaspiTimestamp, pickColumns, buildInsert, mapHarmonicRow, first,
};
```

- [x] **Step 4: `npm test` lulus (Task 1), commit**

```bash
git add backend/utils/raspiSync.js backend/tests/raspiSync.test.js
git commit -m "feat(backend): raspiSync helper murni: timestamp Raspi, pickColumns, buildInsert, harmonik"
```

---

### Task 2: Handler DB `raspiSync`: registrasi, realtime, harmonik, status, tap, sync reading, failure log, last connection

**Files:**
- Modify: `backend/utils/raspiSync.js` (tambah handler)
- Test: `backend/tests/raspiSync.test.js` (tambah)

**Interfaces:**
- Consumes: Task 1, `fakeDb`.
- Produces (semua `async`, menerima `db` pool):
  - `registerConnection(masterDb, openDb, msg) -> { dbName, trafoId, tmuVersion, companyId } | null`
  - `handleReadingRealtime(db, trafoId, rows) -> number`
  - `handleHarmonic(db, trafoId, kind: 'voltage'|'current', rows) -> number`
  - `handleStatusSync(db, trafoId, statusRow, tripRow) -> void` (upsert keduanya)
  - `handleTapPosition(db, trafoId, tdRow) -> void`
  - `handleSyncReading(db, trafoId, rows) -> number`
  - `handleSyncFailureLog(db, trafoId, rows) -> number`
  - `touchLastConnection(masterDb, raspiSerialNo, now = new Date()) -> void`
  - `recentTimestamps(db, trafoId, hours = 24) -> [{ timestamp: ISO }]`
  - `knownFailureIds(db, trafoId) -> [{ failure_id }]`

- [x] **Step 1: Tambah test**

```js
const { makeFakeDb } = require('./helpers/fakeDb');

test('registerConnection: companyKey tidak dikenal -> null tanpa menyentuh DB perusahaan', async () => {
  const master = makeFakeDb(() => []);
  let opened = 0;
  const r = await rs.registerConnection(master, async () => { opened++; return makeFakeDb(); }, { companyKey: 'x', raspiSerialNo: 'R1' });
  assert.equal(r, null);
  assert.equal(opened, 0);
  assert.match(master.calls[0].sql, /FROM company WHERE company_key = \?/);
});

test('registerConnection: trafo baru -> INSERT transformer_data + settings + trip + status', async () => {
  const master = makeFakeDb(() => [{ company_id: 92, database_name: 'db_demo', tmu_version: 2 }]);
  const company = makeFakeDb((sql) => (/FROM transformer_data/.test(sql) ? [] : []));
  company.execute = async (sql, params) => { company.calls.push({ sql: sql.replace(/\s+/g, ' ').trim(), params }); return /INSERT INTO `transformer_data`/.test(sql) ? [{ insertId: 5 }, []] : [[], []]; };
  company.query = company.execute;
  const msg = {
    companyKey: 'k', raspiSerialNo: 'R1', version: 2,
    transformerData: [{ trafoSerialNo: 'T-1', ratedPower: 100, asing: 1 }],
    transformerSettings: [{ voltageLowAlarmTreshold: 5, voltageLowAlarmValue: 380 }],
    transformerStatus: [{ Vab: 3, OilTemp: 4 }], tripSettings: [{ voltage: 1 }], tripStatus: [{ Vab: 0 }],
  };
  const r = await rs.registerConnection(master, async () => company, msg);
  assert.deepEqual(r, { dbName: 'db_demo', trafoId: 5, tmuVersion: 2, companyId: 92 });
  const sqls = company.calls.map((c) => c.sql);
  assert.ok(sqls.some((s) => /INSERT INTO `transformer_data` \(`raspiSerialNo`, `trafoSerialNo`, `ratedPower`, `lastSyncTimestamp`, `version`\)/.test(s)));
  assert.ok(sqls.some((s) => /INSERT INTO `transformer_settings` \(`trafoId`, `voltageLowAlarmTreshold`, `voltageLowAlarmValue`\)/.test(s)));
  assert.ok(sqls.some((s) => /INSERT INTO `trip_settings` \(`trafoId`, `voltage`\)/.test(s)));
  assert.ok(sqls.some((s) => /INSERT INTO `transformer_status` .* ON DUPLICATE KEY UPDATE/.test(s)));
  assert.ok(sqls.some((s) => /INSERT INTO `trip_status` .* ON DUPLICATE KEY UPDATE/.test(s)));
});

test('registerConnection: trafo sudah ada -> hanya status, trip_status, lastSync/version', async () => {
  const master = makeFakeDb(() => [{ company_id: 92, database_name: 'db_demo', tmu_version: 2 }]);
  const company = makeFakeDb((sql) => (/FROM transformer_data WHERE raspiSerialNo/.test(sql) ? [{ trafoId: 1 }] : []));
  const r = await rs.registerConnection(master, async () => company, { companyKey: 'k', raspiSerialNo: 'R1', version: 2, transformerStatus: [{ Vab: 3 }], tripStatus: [{ Vab: 0 }] });
  assert.equal(r.trafoId, 1);
  const sqls = company.calls.map((c) => c.sql);
  assert.equal(sqls.some((s) => /INSERT INTO `transformer_data`/.test(s)), false);
  assert.ok(sqls.some((s) => /UPDATE transformer_data SET lastSyncTimestamp = \?, version = \? WHERE trafoId = \?/.test(s)));
  assert.ok(sqls.some((s) => /INSERT INTO `transformer_status`/.test(s)));
});

test('handleReadingRealtime: DELETE lalu INSERT hanya kolom dikenal, timestamp dikonversi', async () => {
  const db = makeFakeDb();
  const n = await rs.handleReadingRealtime(db, 1, [{ data_id: 9, timestamp: '2026-10-14T01:00:00.000Z', Van: 230, Asing: 1 }, { TIMESTAMP: '2026-10-14 08:00:01', Van: 231 }]);
  assert.equal(n, 2);
  assert.match(db.calls[0].sql, /DELETE FROM temp_reading_data_realtime WHERE trafoId = \?/);
  assert.equal(db.calls[1].sql, 'INSERT INTO `temp_reading_data_realtime` (`trafoId`, `timestamp`, `Van`) VALUES (?, ?, ?), (?, ?, ?)');
  assert.equal(db.calls[1].params[1].toISOString(), '2026-10-14T01:00:00.000Z');
  assert.equal(db.calls[1].params[4].toISOString(), '2026-10-14T01:00:01.000Z');
});

test('handleReadingRealtime: baris tanpa timestamp valid dibuang; kosong -> tidak DELETE', async () => {
  const db = makeFakeDb();
  assert.equal(await rs.handleReadingRealtime(db, 1, [{ Van: 1 }]), 0);
  assert.equal(db.calls.length, 0);
});

test('handleHarmonic: tabel sesuai jenis, kolom Row dipetakan', async () => {
  const db = makeFakeDb();
  const n = await rs.handleHarmonic(db, 1, 'current', [{ Phase: 1, Row1st: 100, Row3rd: 2 }]);
  assert.equal(n, 1);
  assert.match(db.calls[0].sql, /DELETE FROM temp_current_harmonic WHERE trafoId = \?/);
  assert.match(db.calls[1].sql, /^INSERT INTO `temp_current_harmonic` \(`trafoId`, `Phase`, `1st`, `3rd`, `5th`/);
  assert.equal(db.calls[1].params[0], 1);
  assert.equal(db.calls[1].params[3], 2);
  await assert.rejects(() => rs.handleHarmonic(db, 1, 'lain', []), /jenis harmonik/);
});

test('handleStatusSync: upsert transformer_status dan trip_status hanya kolom status', async () => {
  const db = makeFakeDb();
  await rs.handleStatusSync(db, 1, { Vab: 4, OilTemp: 3, asing: 1 }, { Vab: 1 });
  assert.equal(db.calls[0].sql, 'INSERT INTO `transformer_status` (`trafoId`, `Vab`, `OilTemp`) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE `Vab` = VALUES(`Vab`), `OilTemp` = VALUES(`OilTemp`)');
  assert.deepEqual(db.calls[0].params, [1, 4, 3]);
  assert.match(db.calls[1].sql, /^INSERT INTO `trip_status` \(`trafoId`, `Vab`\)/);
});

test('handleTapPosition hanya mengubah tapType dan impedance', async () => {
  const db = makeFakeDb();
  await rs.handleTapPosition(db, 1, { tapType: 'OCTC', impedance: 4, ratedPower: 999 });
  assert.equal(db.calls[0].sql, 'UPDATE transformer_data SET `tapType` = ?, `impedance` = ? WHERE trafoId = ?');
  assert.deepEqual(db.calls[0].params, ['OCTC', 4, 1]);
  await rs.handleTapPosition(db, 1, { ratedPower: 1 });
  assert.equal(db.calls.length, 1);
});

test('handleSyncReading: INSERT IGNORE reading_data dengan trafoId, timestamp WIB dikonversi', async () => {
  const db = makeFakeDb();
  const n = await rs.handleSyncReading(db, 1, [{ TIMESTAMP: '2026-10-14 08:15:00', timestamp_string: '2026-10-14 08:15:00', Van: 1, deRatingB: 95 }]);
  assert.equal(n, 1);
  assert.match(db.calls[0].sql, /^INSERT IGNORE INTO `reading_data` \(`trafoId`, `timestamp`, `Van`, `deRatingb`\)/);
  assert.equal(db.calls[0].params[1].toISOString(), '2026-10-14T01:15:00.000Z');
});

test('handleSyncFailureLog: INSERT IGNORE failure_log, time_start dikonversi', async () => {
  const db = makeFakeDb();
  const n = await rs.handleSyncFailureLog(db, 1, [{ failure_id: 7, time_start: '2026-10-14T00:00:00.000Z', duration: 5, failure_type: 'High Alarm', parameter: 'OilTemp', parameterValue: '80', rowId: 99 }]);
  assert.equal(n, 1);
  assert.match(db.calls[0].sql, /^INSERT IGNORE INTO `failure_log` \(`trafoId`, `failure_id`, `time_start`, `duration`, `failure_type`, `parameter`, `parameterValue`\)/);
  assert.equal(db.calls[0].params[2].toISOString(), '2026-10-14T00:00:00.000Z');
});

test('touchLastConnection upsert dengan Date JS; recentTimestamps dan knownFailureIds membaca DB', async () => {
  const master = makeFakeDb();
  const now = new Date('2026-10-14T01:00:00Z');
  await rs.touchLastConnection(master, 'R1', now);
  assert.match(master.calls[0].sql, /INSERT INTO trafo_last_connection \(raspi_serial_no, last_connection_time\) VALUES \(\?, \?\) ON DUPLICATE KEY UPDATE last_connection_time = VALUES\(last_connection_time\)/);
  assert.deepEqual(master.calls[0].params, ['R1', now]);

  const db = makeFakeDb((sql) => (/FROM reading_data/.test(sql) ? [{ timestamp: new Date('2026-10-14T00:59:00Z') }] : [{ failure_id: 3 }]));
  const ts = await rs.recentTimestamps(db, 1, 24);
  assert.deepEqual(ts, [{ timestamp: '2026-10-14T00:59:00.000Z' }]);
  assert.match(db.calls[0].sql, /SELECT timestamp FROM reading_data WHERE trafoId = \? AND timestamp >= \? ORDER BY timestamp/);
  assert.deepEqual(await rs.knownFailureIds(db, 1), [{ failure_id: 3 }]);
});
```

- [x] **Step 2: `npm test`, pastikan test baru gagal (`registerConnection is not a function`)**

- [x] **Step 3: Tambah handler ke `backend/utils/raspiSync.js`** (sebelum `module.exports`, lalu tambahkan nama-namanya ke exports)

```js
// ---------- handler DB ----------
function upsertSql(table, trafoId, row, allowlist) {
  const picked = pickColumns(row, allowlist);
  const cols = Object.keys(picked);
  if (cols.length === 0) return null;
  const all = ['trafoId', ...cols];
  return {
    sql: `INSERT INTO \`${table}\` (${all.map((c) => `\`${c}\``).join(', ')}) VALUES (${all.map(() => '?').join(', ')}) ON DUPLICATE KEY UPDATE ${cols.map((c) => `\`${c}\` = VALUES(\`${c}\`)`).join(', ')}`,
    params: [trafoId, ...cols.map((c) => picked[c])],
  };
}

async function run(db, q) {
  if (!q) return null;
  const [res] = await db.execute(q.sql, q.params);
  return res;
}

// createConnection: cari perusahaan, daftarkan/segarkan trafo. null = tolak koneksi.
async function registerConnection(masterDb, openDb, msg) {
  const [companies] = await masterDb.execute(
    'SELECT company_id, database_name, tmu_version FROM company WHERE company_key = ? LIMIT 1', [String(msg.companyKey || '')]);
  const company = companies[0];
  if (!company) return null;
  const db = await openDb(company.database_name);
  const serial = String(msg.raspiSerialNo || '').trim();
  if (!serial) return null;
  const now = new Date();
  const version = Number(msg.version) || company.tmu_version || 2;

  const [existing] = await db.execute('SELECT trafoId FROM transformer_data WHERE raspiSerialNo = ? LIMIT 1', [serial]);
  let trafoId;
  if (existing[0]) {
    trafoId = existing[0].trafoId;
    await db.execute('UPDATE transformer_data SET lastSyncTimestamp = ?, version = ? WHERE trafoId = ?', [now, version, trafoId]);
  } else {
    const td = { ...pickColumns(first(msg.transformerData) || {}, TD_COLUMNS), raspiSerialNo: serial, lastSyncTimestamp: now, version };
    const res = await run(db, buildInsert('transformer_data', [td], TD_COLUMNS));
    trafoId = res && res.insertId;
    if (!trafoId) throw new Error('INSERT transformer_data tidak mengembalikan trafoId');
    await run(db, buildInsert('transformer_settings', [first(msg.transformerSettings) || {}], SETTINGS_ALL_COLUMNS, { trafoId }));
    await run(db, buildInsert('trip_settings', [first(msg.tripSettings) || {}], TRIP_SETTINGS_COLUMNS, { trafoId }));
  }
  await handleStatusSync(db, trafoId, first(msg.transformerStatus), first(msg.tripStatus));
  return { dbName: company.database_name, trafoId, tmuVersion: version, companyId: company.company_id };
}

function withTimestamp(rows, col) {
  const out = [];
  for (const r of rows || []) {
    const picked = pickColumns(r, [col]);
    const ts = parseRaspiTimestamp(picked[col]);
    if (!ts) continue;
    out.push({ ...r, [col]: ts });
  }
  return out;
}

async function handleReadingRealtime(db, trafoId, rows) {
  const clean = withTimestamp(rows, 'timestamp');
  if (clean.length === 0) return 0;
  await db.execute('DELETE FROM temp_reading_data_realtime WHERE trafoId = ?', [trafoId]);
  await run(db, buildInsert('temp_reading_data_realtime', clean, READING_COLUMNS, { trafoId }));
  return clean.length;
}

async function handleHarmonic(db, trafoId, kind, rows) {
  const table = kind === 'voltage' ? 'temp_voltage_harmonic' : kind === 'current' ? 'temp_current_harmonic' : null;
  if (!table) throw new Error(`jenis harmonik tidak dikenal: ${kind}`);
  const mapped = (rows || []).map(mapHarmonicRow).filter((r) => r.Phase !== null);
  if (mapped.length === 0) return 0;
  await db.execute(`DELETE FROM ${table} WHERE trafoId = ?`, [trafoId]);
  await run(db, buildInsert(table, mapped, ['Phase', ...HARMONIC_ORDERS], { trafoId }));
  return mapped.length;
}

async function handleStatusSync(db, trafoId, statusRow, tripRow) {
  await run(db, upsertSql('transformer_status', trafoId, statusRow || {}, STATUS_ALL_COLUMNS));
  await run(db, upsertSql('trip_status', trafoId, tripRow || {}, STATUS_ALL_COLUMNS));
}

async function handleTapPosition(db, trafoId, tdRow) {
  const picked = pickColumns(tdRow || {}, ['tapType', 'impedance']);
  const cols = Object.keys(picked);
  if (cols.length === 0) return;
  await db.execute(`UPDATE transformer_data SET ${cols.map((c) => `\`${c}\` = ?`).join(', ')} WHERE trafoId = ?`, [...cols.map((c) => picked[c]), trafoId]);
}

async function handleSyncReading(db, trafoId, rows) {
  const clean = withTimestamp(rows, 'timestamp');
  if (clean.length === 0) return 0;
  for (let i = 0; i < clean.length; i += 200) {
    await run(db, buildInsert('reading_data', clean.slice(i, i + 200), READING_COLUMNS, { trafoId }, { ignore: true }));
  }
  return clean.length;
}

async function handleSyncFailureLog(db, trafoId, rows) {
  const clean = withTimestamp(rows, 'time_start');
  if (clean.length === 0) return 0;
  await run(db, buildInsert('failure_log', clean, FAILURE_COLUMNS, { trafoId }, { ignore: true }));
  return clean.length;
}

async function touchLastConnection(masterDb, raspiSerialNo, now = new Date()) {
  await masterDb.execute(
    'INSERT INTO trafo_last_connection (raspi_serial_no, last_connection_time) VALUES (?, ?) ON DUPLICATE KEY UPDATE last_connection_time = VALUES(last_connection_time)',
    [raspiSerialNo, now]);
}

async function recentTimestamps(db, trafoId, hours = 24) {
  const since = new Date(Date.now() - hours * 3600e3);
  const [rows] = await db.execute('SELECT timestamp FROM reading_data WHERE trafoId = ? AND timestamp >= ? ORDER BY timestamp ASC', [trafoId, since]);
  return rows.map((r) => ({ timestamp: new Date(r.timestamp).toISOString() }));
}

async function knownFailureIds(db, trafoId) {
  const [rows] = await db.execute('SELECT failure_id FROM failure_log WHERE trafoId = ? AND failure_id IS NOT NULL ORDER BY failure_id ASC', [trafoId]);
  return rows.map((r) => ({ failure_id: r.failure_id }));
}
```

- [x] **Step 4: `npm test` lulus, commit**

```bash
git add backend/utils/raspiSync.js backend/tests/raspiSync.test.js
git commit -m "feat(backend): raspiSync handler: registrasi Raspi, realtime, harmonik, status, tap, sync reading/failure log"
```

---

### Task 3: `alertEngine`: diff status, cooldown, bentuk alert

**Files:**
- Create: `backend/utils/alertEngine.js`
- Test: `backend/tests/alertEngine.test.js`

**Interfaces:**
- Consumes: `statusModel.normalizeCode/levelOf/STATUS_LABELS`.
- Produces: `diffStatus(before, after) -> [{ parameter, from, to, level }]` (hanya yang memburuk), `PARAM_METRIC`, `buildAlerts(changes, point, limits) -> [{ name, sub, val, limit, type }]`, `class Cooldown(ms=15min) { allow(key, now) }`, `processStatusChange({ dbName, trafoId, before, after, point, limits, cooldown, now, send }) -> alerts terkirim`.

- [x] **Step 1: Tulis test**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const ae = require('../utils/alertEngine');

test('diffStatus hanya melaporkan yang memburuk (3->alarm, 3->trip, alarm->trip)', () => {
  const before = { Vab: 3, OilTemp: 4, Freq: 5, PF: 2, Current1: 3 };
  const after = { Vab: 4, OilTemp: 5, Freq: 3, PF: 2, Current1: 1, H2ppm: 7 };
  const d = ae.diffStatus(before, after);
  assert.deepEqual(d.map((x) => [x.parameter, x.from, x.to, x.level]), [
    ['Vab', 3, 4, 'alarm'], ['Current1', 3, 1, 'trip'], ['OilTemp', 4, 5, 'trip'],
  ]);
  assert.deepEqual(ae.diffStatus(null, { Vab: 4 }), [{ parameter: 'Vab', from: 3, to: 4, level: 'alarm' }]);
  assert.deepEqual(ae.diffStatus({ Vab: 4 }, { Vab: 4 }), []);
});

test('buildAlerts mengisi nilai terakhir dan batas dari limits', () => {
  const changes = [{ parameter: 'Vab', from: 3, to: 4, level: 'alarm' }, { parameter: 'OilTemp', from: 3, to: 5, level: 'trip' }, { parameter: 'OilLevel', from: 3, to: 2, level: 'alarm' }];
  const point = { lineAB: 425.5, oil_temperature: 91, oilLevelRaw: 0 };
  const limits = { lineAB: { min: 380, max: 420, tripMin: 360, tripMax: 440 }, oil_temperature: { min: null, max: 70, tripMin: null, tripMax: 85 } };
  const a = ae.buildAlerts(changes, point, limits);
  assert.deepEqual(a[0], { name: 'Vab', sub: 'High Alarm', val: 425.5, limit: 'Min 380 / Max 420', type: 'ALARM' });
  assert.deepEqual(a[1], { name: 'OilTemp', sub: 'High Trip', val: 91, limit: 'Trip Max 85', type: 'TRIP' });
  assert.deepEqual(a[2], { name: 'OilLevel', sub: 'Low Alarm', val: 0, limit: '-', type: 'ALARM' });
});

test('Cooldown menahan kunci yang sama selama 15 menit', () => {
  const c = new ae.Cooldown();
  const t0 = 1_000_000;
  assert.equal(c.allow('db_demo:1:Vab', t0), true);
  assert.equal(c.allow('db_demo:1:Vab', t0 + 14 * 60e3), false);
  assert.equal(c.allow('db_demo:1:OilTemp', t0 + 1), true);
  assert.equal(c.allow('db_demo:1:Vab', t0 + 15 * 60e3 + 1), true);
});

test('processStatusChange: kirim hanya yang lolos cooldown, tidak kirim kalau kosong', async () => {
  const sent = [];
  const send = async (dbName, trafoId, alerts) => sent.push({ dbName, trafoId, alerts });
  const cooldown = new ae.Cooldown();
  const base = { dbName: 'db_demo', trafoId: 1, point: {}, limits: {}, cooldown, send };
  let out = await ae.processStatusChange({ ...base, before: { Vab: 3 }, after: { Vab: 4 }, now: 0 });
  assert.equal(out.length, 1);
  assert.equal(sent.length, 1);
  out = await ae.processStatusChange({ ...base, before: { Vab: 3 }, after: { Vab: 4 }, now: 60e3 });
  assert.equal(out.length, 0);
  assert.equal(sent.length, 1);
  out = await ae.processStatusChange({ ...base, before: { Vab: 4 }, after: { Vab: 4 }, now: 120e3 });
  assert.equal(sent.length, 1);
});
```

- [x] **Step 2: `npm test`, pastikan gagal karena modul belum ada**

- [x] **Step 3: Tulis `backend/utils/alertEngine.js`**

```js
const sm = require('./statusModel');

const RANK = { normal: 0, alarm: 1, trip: 2 };

// Parameter transformer_status -> key frontend (untuk nilai terakhir dan batas).
const PARAM_METRIC = {
  Vab: 'lineAB', Vbc: 'lineBC', Vca: 'lineCA',
  Current1: 'currentA', Current2: 'currentB', Current3: 'currentC', Ineutral: 'currentN',
  THDVoltage1: 'thdVA', THDVoltage2: 'thdVB', THDVoltage3: 'thdVC',
  THDCurrent1: 'thdIA', THDCurrent2: 'thdIB', THDCurrent3: 'thdIC',
  PF: 'pfTotal', Freq: 'frequency',
  BusTemp1: 'busTempA', BusTemp2: 'busTempB', BusTemp3: 'busTempC',
  OilTemp: 'oil_temperature', WTITemp1: 'wtiA', WTITemp2: 'wtiB', WTITemp3: 'wtiC',
  Pressure: 'oil_pressure', OilLevel: 'oilLevelRaw', H2ppm: 'h2ppm', Moistureppm: 'moisturePpm',
  Uab: 'unbalanceUV', Ubc: 'unbalanceVW', Uca: 'unbalanceUW',
};

// Hanya perubahan yang memburuk: normal->alarm, normal->trip, alarm->trip.
function diffStatus(before, after) {
  const b = before || {}, a = after || {};
  const out = [];
  for (const parameter of sm.STATUS_COLUMNS) {
    if (!(parameter in a)) continue;
    const from = sm.normalizeCode(b[parameter]);
    const to = sm.normalizeCode(a[parameter]);
    const lf = sm.levelOf(from), lt = sm.levelOf(to);
    if (RANK[lt] > RANK[lf]) out.push({ parameter, from, to, level: lt });
  }
  return out;
}

function limitLabel(level, L) {
  if (!L) return '-';
  const parts = [];
  if (level === 'trip') {
    if (L.tripMin !== null && L.tripMin !== undefined) parts.push(`Trip Min ${L.tripMin}`);
    if (L.tripMax !== null && L.tripMax !== undefined) parts.push(`Trip Max ${L.tripMax}`);
  } else {
    if (L.min !== null && L.min !== undefined) parts.push(`Min ${L.min}`);
    if (L.max !== null && L.max !== undefined) parts.push(`Max ${L.max}`);
  }
  return parts.length > 0 ? parts.join(' / ') : '-';
}

function buildAlerts(changes, point, limits) {
  const p = point || {}, L = limits || {};
  return changes.map((c) => {
    const key = PARAM_METRIC[c.parameter];
    const raw = key ? p[key] : undefined;
    return {
      name: c.parameter,
      sub: sm.STATUS_LABELS[c.to],
      val: raw === undefined || raw === null ? '-' : raw,
      limit: limitLabel(c.level, key ? L[key] : null),
      type: c.level === 'trip' ? 'TRIP' : 'ALARM',
    };
  });
}

class Cooldown {
  constructor(ms = 15 * 60 * 1000) { this.ms = ms; this.last = new Map(); }
  allow(key, now = Date.now()) {
    const prev = this.last.get(key);
    if (prev !== undefined && now - prev <= this.ms) return false;
    this.last.set(key, now);
    return true;
  }
}

// Dipanggil setelah receivedSyncUpdateStatusTransformer. send = alertSender.sendAlertMessage.
async function processStatusChange({ dbName, trafoId, before, after, point, limits, cooldown, now = Date.now(), send }) {
  const changes = diffStatus(before, after).filter((c) => cooldown.allow(`${dbName}:${trafoId}:${c.parameter}`, now));
  if (changes.length === 0) return [];
  const alerts = buildAlerts(changes, point, limits);
  await send(dbName, trafoId, alerts);
  return alerts;
}

module.exports = { PARAM_METRIC, diffStatus, buildAlerts, Cooldown, processStatusChange };
```

- [x] **Step 4: `npm test` lulus, commit**

```bash
git add backend/utils/alertEngine.js backend/tests/alertEngine.test.js
git commit -m "feat(backend): alertEngine: diff status memburuk, cooldown 15 menit, bentuk alert"
```

---

### Task 4: `raspiWebSocket.js` tulis ulang: routing pesan, scheduler, alert; wiring `index.js`

**Files:**
- Rewrite: `backend/utils/raspiWebSocket.js`
- Modify: `backend/index.js` (baris `initRaspiWebSocket(server);`)
- Test: `backend/tests/raspiScheduler.test.js`

**Interfaces:**
- Consumes: Task 1–3, `alertSender.sendAlertMessage`, `readingModel.getLatest/computeDerived`, `trafoModel.getTransformerData/getStatusRow`, `limitsModel.buildLimits`, `db.getMasterDb/getDbConnection`.
- Produces: `initRaspiWebSocket(server, { activeSubscriptions })`, `sendToRaspi(serial, payload)`, `raspiClients` (Map serial → ws, dipakai `trafoModel`), `raspiMeta` (Map serial → `{ dbName, trafoId, tmuVersion }`), `dueRequests(state, now, hasWatchers) -> string[]` (murni), `INTERVALS`.

- [x] **Step 1: Tulis test scheduler**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { dueRequests, INTERVALS } = require('../utils/raspiWebSocket');

test('dueRequests: awal koneksi -> status, tap, sync; realtime/harmonik hanya kalau ada penonton', () => {
  const s = { lastRealtime: 0, lastHarmonic: 0, lastStatus: 0, lastSync: 0 };
  assert.deepEqual(dueRequests(s, 10_000, false), ['requestSyncUpdateStatusTransformer', 'requestTapPositionRealTime', 'requestSyncDataReading', 'requestSyncDataFailureLog']);
  assert.deepEqual(dueRequests(s, 10_000, true), ['requestReadingDataRealTime', 'requestCurrentHarmonicRealTime', 'requestVoltageHarmonicRealTime', 'requestSyncUpdateStatusTransformer', 'requestTapPositionRealTime', 'requestSyncDataReading', 'requestSyncDataFailureLog']);
});

test('dueRequests menghormati interval', () => {
  const now = 1_000_000;
  const s = { lastRealtime: now - 4_000, lastHarmonic: now - 59_000, lastStatus: now - 61_000, lastSync: now - 5 * 60_000 };
  assert.deepEqual(dueRequests(s, now, true), ['requestSyncUpdateStatusTransformer', 'requestTapPositionRealTime']);
  s.lastRealtime = now - 5_000;
  assert.deepEqual(dueRequests(s, now, true).slice(0, 1), ['requestReadingDataRealTime']);
  assert.equal(INTERVALS.realtime, 5_000);
  assert.equal(INTERVALS.sync, 10 * 60_000);
});
```

- [x] **Step 2: `npm test`, pastikan gagal (`dueRequests is not a function`)**

- [x] **Step 3: Tulis ulang `backend/utils/raspiWebSocket.js`**

```js
const { WebSocketServer } = require('ws');
const http = require('http');
const { getMasterDb, getDbConnection } = require('./db');
const rs = require('./raspiSync');
const ae = require('./alertEngine');
const rm = require('./readingModel');
const tm = require('./trafoModel');
const { buildLimits } = require('./limitsModel');

// serial -> ws (dipakai trafoModel untuk status online) dan serial -> meta registrasi
const raspiClients = new Map();
const raspiMeta = new Map();
const cooldown = new ae.Cooldown();
let subscriptionsRef = new Map();

const INTERVALS = { realtime: 5_000, harmonic: 60_000, status: 60_000, sync: 10 * 60_000 };

// Murni: permintaan apa yang harus dikirim sekarang.
function dueRequests(state, now, hasWatchers) {
  const out = [];
  if (hasWatchers && now - state.lastRealtime >= INTERVALS.realtime) out.push('requestReadingDataRealTime');
  if (hasWatchers && now - state.lastHarmonic >= INTERVALS.harmonic) out.push('requestCurrentHarmonicRealTime', 'requestVoltageHarmonicRealTime');
  if (now - state.lastStatus >= INTERVALS.status) out.push('requestSyncUpdateStatusTransformer', 'requestTapPositionRealTime');
  if (now - state.lastSync >= INTERVALS.sync) out.push('requestSyncDataReading', 'requestSyncDataFailureLog');
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
  const [latest, td, settings] = await Promise.all([rm.getLatest(db, meta.trafoId), tm.getTransformerData(db, meta.trafoId), getSettings(db, meta.trafoId)]);
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
      const before = await tm.getStatusRow(db, meta.trafoId);
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
```

- [x] **Step 4: Ubah `backend/index.js`**: `initRaspiWebSocket(server);` → `initRaspiWebSocket(server, { activeSubscriptions });`

- [x] **Step 5: `npm test` lulus; `node -e "require('./utils/raspiWebSocket')"` tanpa error; commit**

```bash
git add backend/utils/raspiWebSocket.js backend/index.js backend/tests/raspiScheduler.test.js
git commit -m "feat(backend): raspiWebSocket menangani protokol Raspi penuh, scheduler permintaan, alert saat status memburuk"
```

---

### Task 5: `fake_raspi.js`, uji ujung ke ujung, dokumentasi

**Files:**
- Create: `backend/scripts/fake_raspi.js`
- Modify: `README.md` (bagian 3.5 dan 6), `backend/.env.example` (`RASPI_TZ_OFFSET=+07:00`)

**Interfaces:**
- Consumes: protokol Task 4. Perlu `company_key` perusahaan demo (`SELECT company_key FROM company WHERE database_name='db_demo'`).

- [x] **Step 1: Tulis `backend/scripts/fake_raspi.js`**

```js
// Simulator klien Raspberry Pi.
// node scripts/fake_raspi.js [companyKey] [serial] [wsUrl]
// Tanpa companyKey: dibaca dari master DB untuk perusahaan db_demo.
require('dotenv').config();
const WebSocket = require('ws');

const SERIAL = process.argv[3] || 'FAKE-RASPI-001';
const URL = process.argv[4] || `ws://localhost:${process.env.SERVER_PORT || 5000}/bd-iot-socket`;
const TZ = '+07:00';

const rand = (min, max, dec = 2) => Number((min + Math.random() * (max - min)).toFixed(dec));
// Format 'YYYY-MM-DD HH:mm:ss' dalam WIB, seperti view shrink_data_temp di Raspi.
function localString(d) {
  const t = new Date(d.getTime() + 7 * 3600e3);
  return t.toISOString().slice(0, 19).replace('T', ' ');
}

function reading(ts) {
  const van = rand(225, 235), vbn = rand(225, 235), vcn = rand(225, 235);
  const ia = rand(60, 90), ib = rand(60, 90), ic = rand(60, 90), pf = rand(0.85, 0.99);
  const sa = van * ia, sb = vbn * ib, sc = vcn * ic, pa = sa * pf, pb = sb * pf, pc = sc * pf;
  const q = (s, p) => Math.sqrt(s * s - p * p);
  return {
    data_id: Math.floor(ts.getTime() / 1000), timestamp: ts, Van: van, Vbn: vbn, Vcn: vcn, Vab: rand(395, 405), Vbc: rand(395, 405), Vca: rand(395, 405),
    Ia: ia, Ib: ib, Ic: ic, Iavg: (ia + ib + ic) / 3, Ineutral: rand(0, 5), THDV1: rand(1, 4), THDV2: rand(1, 4), THDV3: rand(1, 4),
    THDI1: rand(3, 9), THDI2: rand(3, 9), THDI3: rand(3, 9), Pa: pa, Pb: pb, Pc: pc, Psig: pa + pb + pc, Qa: q(sa, pa), Qb: -q(sb, pb), Qc: q(sc, pc),
    Qsig: q(sa, pa) - q(sb, pb) + q(sc, pc), Sa: sa, Sb: sb, Sc: sc, Ssig: sa + sb + sc, PFa: pf, PFb: pf, PFc: pf, PFsig: pf, Freq: rand(49.9, 50.1),
    kWh: 13000 + ts.getTime() / 3.6e6, kVARh: 4000 + ts.getTime() / 7.2e6, BusTemp1: rand(40, 55), BusTemp2: rand(40, 55), BusTemp3: rand(40, 55),
    OilTemp: rand(50, 60), WTITemp1: rand(55, 65), WTITemp2: rand(55, 65), WTITemp3: rand(55, 65), Press: rand(0.3, 0.45), Level: 1,
    KRateda: 4, deRatinga: rand(88, 96), KRatedb: 4, deRatingb: rand(88, 96), KRatedc: 4, deRatingc: rand(88, 96), H2ppm: rand(10, 25, 0), Moistureppm: rand(5, 15, 0),
    UnbalanceUV: rand(0, 1.5), UnbalanceVW: rand(0, 1.5), UnbalanceUW: rand(0, 1.5),
  };
}
const harmonicRow = (Phase) => { const r = { Phase, Row1st: 100 }; for (const o of ['3rd', '5th', '7th', '9th', '11th', '13th', '15th', '17th', '19th', '21th', '23th', '25th', '27th', '29th', '31th']) r[`Row${o}`] = rand(0.2, 6); return r; };

const STATUS_COLS = ['Vab', 'Vbc', 'Vca', 'Current1', 'Current2', 'Current3', 'Ineutral', 'THDVoltage1', 'THDVoltage2', 'THDVoltage3', 'THDCurrent1', 'THDCurrent2', 'THDCurrent3', 'PF', 'Freq', 'BusTemp1', 'BusTemp2', 'BusTemp3', 'OilTemp', 'WTITemp1', 'WTITemp2', 'WTITemp3', 'Pressure', 'OilLevel', 'H2ppm', 'Moistureppm', 'Uab', 'Ubc', 'Uca'];
const status = Object.fromEntries(STATUS_COLS.map((c) => [c, 3]));
const tripStatus = Object.fromEntries(STATUS_COLS.map((c) => [c, 0]));
let statusRequests = 0;

const transformerData = { trafoSerialNo: 'TRF-FAKE-001', ratedPower: 100, ratedHighVoltage: 20, ratedLowVoltage: 400, ratedCurrentHighVoltage: 2.89, ratedCurrentLowVoltage: 144, frequency: 50, vectorGroup: 'Dyn5', phase: 3, tapType: 'OCTC', impedance: 4, noLoadLoss: 150, fullLoadLoss: 1200, tapPercentagePlus: 2.5, tapPercentageMinus: 2.5, tapNumberPlus: 2, tapNumberMinus: 2, topOilHv: 60, topOilLv: 60, gradientHv: 10, gradientLv: 10, windTempHv: 65, windTempLv: 65, losses: 1350, hotspotFactor: 1.1, ctRatio: 200, status: 1, coolingMode: 'ONAN', SuddenPressure: 0, latitude: -6.2, longitude: 106.8, intervalDelay: 1, krated: 4 };
const transformerSettings = { voltageLowTripTreshold: 10, voltageLowTripValue: 360, voltageLowAlarmTreshold: 5, voltageLowAlarmValue: 380, voltageHighTripTreshold: 10, voltageHighTripValue: 440, voltageHighAlarmTreshold: 5, voltageHighAlarmValue: 420, voltageUnbalanceHighAlarmTreshold: 2, voltageUnbalanceHighTripTreshold: 4, frequencyLowTripTreshold: 5, frequencyLowAlarmTreshold: 2, frequencyHighTripTreshold: 5, frequencyHighAlarmTreshold: 2, topOilHighAlarmTreshold: 70, topOilHighTripTreshold: 85, windTempHighAlarmTreshold: 80, windTempHighTripTreshold: 95, powerFactorLowAlarmTreshold: 0.85, powerFactorLowTripTreshold: 0.8, currentHighAlarmTreshold: 100, currentHighTripTreshold: 120, tankPressureHighTripTreshold: 0.6, tankPressureHighAlarmTreshold: 0.5, busTempHighAlarmTreshold: 70, busTempHighTripTreshold: 85, thdCurrentAlarmTreshold: 10, thdCurrentTripTreshold: 15, thdVoltageAlarmTreshold: 5, thdVoltageTripTreshold: 8, IneutralHighAlarmTreshold: 20, IneutralHighTripTreshold: 30, H2ppmHighAlarmTreshold: 50, H2ppmHighTripTreshold: 100, MoistureppmHighAlarmTreshold: 20, MoistureppmHighTripTreshold: 30 };
const tripSettings = { voltage: 1, voltageUnbalance: 0, frequency: 1, topOilTemp: 1, busTemp: 0, powerFactor: 0, current: 1, pressure: 1, oilLevel: 1, WTITemp: 1, THDCurrent: 0, THDVoltage: 0, Ineutral: 0, H2ppm: 0, Moistureppm: 0 };

async function resolveCompanyKey() {
  if (process.argv[2]) return process.argv[2];
  const mysql = require('mysql2/promise');
  const { getDbConfig, getMasterDbName } = require('../utils/db');
  const c = await mysql.createConnection(getDbConfig(getMasterDbName()));
  const [rows] = await c.query("SELECT company_key FROM company WHERE database_name = 'db_demo' LIMIT 1");
  await c.end();
  if (!rows[0]) throw new Error('company db_demo tidak ditemukan; jalankan seed_demo.js');
  return rows[0].company_key;
}

async function main() {
  const companyKey = await resolveCompanyKey();
  const ws = new WebSocket(URL);
  const sendMsg = (m) => { if (ws.readyState === 1) ws.send(JSON.stringify(m)); };
  ws.on('open', () => {
    console.log(`terhubung ke ${URL} sebagai ${SERIAL} (companyKey ${companyKey.slice(0, 6)}...)`);
    sendMsg({ type: 'createConnection', companyKey, raspiSerialNo: SERIAL, version: 2, transformerData: [transformerData], transformerSettings: [transformerSettings], transformerStatus: [status], tripSettings: [tripSettings], tripStatus: [tripStatus] });
    setInterval(() => sendMsg({ type: 'ping_ws', raspiSerialNo: SERIAL }), 60000);
  });
  ws.on('message', (raw) => {
    const json = JSON.parse(raw.toString());
    const now = new Date();
    switch (json.type) {
      case 'pong_server': break;
      case 'requestReadingDataRealTime': {
        const readingData = []; for (let i = 0; i < 100; i++) readingData.push(reading(new Date(now.getTime() - i * 1000)));
        sendMsg({ type: 'getReadingDataRealTimeReceived', version: 2, companyKey, readingData }); break;
      }
      case 'requestCurrentHarmonicRealTime': sendMsg({ companyKey, type: 'receivedRequestCurrentHarmonicRealTime', data: [1, 2, 3].map(harmonicRow) }); break;
      case 'requestVoltageHarmonicRealTime': sendMsg({ companyKey, type: 'receivedRequestVoltageHarmonicRealTime', data: [1, 2, 3].map(harmonicRow) }); break;
      case 'requestSyncUpdateStatusTransformer':
        statusRequests++;
        status.OilTemp = statusRequests % 3 === 2 ? 4 : 3; // tiap permintaan ke-2 dari 3: High Alarm, lalu kembali normal
        console.log(`status diminta (#${statusRequests}), OilTemp=${status.OilTemp}`);
        sendMsg({ type: 'receivedSyncUpdateStatusTransformer', raspiSerialNo: SERIAL, transformerStatus: [{ ...status }], tripStatus: [{ ...tripStatus }], companyKey }); break;
      case 'requestTapPositionRealTime': sendMsg({ type: 'getTapPositionRealTimeReceived', raspiSerialNo: SERIAL, companyKey, transformerData: [transformerData] }); break;
      case 'requestSyncDataReading': {
        const have = new Set((json.timestampRange || []).map((e) => localString(new Date(e.timestamp))));
        const data = [];
        for (let i = 120; i >= 1; i--) {
          const ts = new Date(Math.floor(now.getTime() / 60000) * 60000 - i * 60000);
          const s = localString(ts);
          if (have.has(s)) continue;
          const r = reading(ts); delete r.timestamp; delete r.data_id;
          data.push({ timestamp_string: s, TIMESTAMP: s, ...r });
        }
        console.log(`sync reading: server punya ${have.size}, kirim ${data.length}`);
        sendMsg({ type: 'receivedSyncDataReading', version: 2, companyKey, raspiSerialNo: SERIAL, data }); break;
      }
      case 'requestSyncDataFailureLog': {
        const known = new Set((json.failureLogRange || []).map((e) => Number(e.failure_id)));
        const data = known.has(9001) ? [] : [{ failure_id: 9001, time_start: new Date(now.getTime() - 3600e3), timestamp_string: localString(new Date(now.getTime() - 3600e3)), duration: 45, failure_type: 'High Alarm', parameter: 'OilTemp', parameterValue: '71.2' }];
        sendMsg({ type: 'receivedSyncDataFailureLog', companyKey, raspiSerialNo: SERIAL, data }); break;
      }
      case 'successSyncDataReading': console.log('server konfirmasi sync reading'); break;
      case 'updateSyncTransformerSettingsFromServer': console.log('settings dari server:', Object.keys(json.data || {}).length, 'kolom'); break;
      case 'updateSyncTransformerDataFromServer': console.log('transformer data dari server'); break;
      case 'updateSyncTripSettingsFromServer': console.log('trip settings dari server'); break;
      case 'terminateConnection': console.log('server menutup koneksi'); process.exit(1); break;
      default: console.log('pesan tidak dikenal:', json.type);
    }
  });
  ws.on('close', () => { console.log('koneksi ditutup'); process.exit(0); });
  ws.on('error', (e) => { console.error('error:', e.message); process.exit(1); });
}

main().catch((e) => { console.error(e.message); process.exit(1); });
```

- [x] **Step 2: Uji ujung ke ujung dengan server hidup**

Terminal 1: `cd backend && npm start`. Terminal 2: `cd backend && node scripts/fake_raspi.js` (biarkan jalan 90 detik). Terminal 3 (PowerShell):

```powershell
$r = Invoke-RestMethod -Method Post -Uri http://localhost:5000/api/login -ContentType "application/json" -Body '{"username":"demo","password":"demo123"}'
$h = @{ Authorization = "Bearer $($r.token)"; "X-DB-Name" = "db_demo" }
Invoke-RestMethod -Uri http://localhost:5000/api/trafo -Headers $h | ConvertTo-Json -Depth 3        # trafo baru TRF-FAKE-001, status Online
cd backend; node scripts/ws_probe.js                                                                  # trafo 1 (seed) masih jalan
```

Lalu dengan trafo baru (id dari daftar, misal 2): `GET /api/trends/meter?trafo_id=2` (100 baris, timestamp detik ini), `GET /api/trafo/2/harmonics?type=voltage`, `GET /api/trafo/2/status` (OilTemp berganti 3/4 tiap 60 s), `GET /api/trends/events?trafo_id=2` (failure 9001), `SELECT COUNT(*) FROM reading_data WHERE trafoId=2` (~120 lalu bertambah tiap 10 menit, tanpa duplikat), `trafo_last_connection` punya `FAKE-RASPI-001`. Log server menampilkan `alert db_demo/trafo 2: OilTemp High Alarm` saat status berubah ke 4 (pengiriman WA/email gagal diam-diam kalau tidak dikonfigurasi, itu wajar).

Expected tambahan: hentikan fake_raspi, setelah 2 menit `GET /api/trafo` menampilkan `Offline` untuk trafo 2.

- [x] **Step 3: Dokumentasi dan commit**

Tambah `RASPI_TZ_OFFSET=+07:00` ke `backend/.env.example`; README bagian 3.5 tambah `node scripts/fake_raspi.js`; bagian 6 Rencana C dicatat selesai, catatan "alert belum aktif" dihapus.

```bash
git add backend/scripts/fake_raspi.js backend/.env.example README.md
git commit -m "feat(backend): fake_raspi simulator; Rencana C selesai"
```

---

## Selesai Rencana C

Server menerima Raspi asli maupun simulator, data mengalir ke `temp_reading_data_realtime` (dibaca poller), `reading_data` (trend/report), `transformer_status` (status + alert), harmonik, dan `failure_log` (events). Online/offline akurat lewat `raspiClients` dan `trafo_last_connection`. Yang belum: frontend (Rencana D).
