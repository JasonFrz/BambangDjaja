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
