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
