const test = require('node:test');
const assert = require('node:assert/strict');
const { makeFakeDb } = require('./helpers/fakeDb');
const th = require('../utils/trendsHelpers');

test('checkClosestData menyebut data sebelum dan sesudah rentang', async () => {
  const db = makeFakeDb((sql) => (/timestamp < \?/.test(sql) ? [{ timestamp: '2026-10-01T00:00:00Z' }] : []));
  const msg = await th.checkClosestData(db, 1, '2026-10-05', '2026-10-06');
  assert.match(msg, /Tidak ada data pada rentang waktu tersebut/);
  assert.match(msg, /sebelumnya/);
  assert.doesNotMatch(msg, /sesudahnya/);
  assert.match(db.calls[0].sql, /FROM reading_data WHERE trafoId = \? AND timestamp < \?/);
});

test('oilPoint memetakan point ke bentuk oil_sensor lama', () => {
  const p = th.oilPoint({ timestamp: 't', time: '08.00.00', oil_temperature: 55, oil_pressure: 0.4, oilLevelRaw: 1 }, 2);
  assert.deepEqual(p, { timestamp: 't', time: '08.00.00', oil_temperature: 55, oil_pressure: 0.4, oil_level: true, oil_level_alarm: 0, oil_level_trip: 1 });
});

test('evaluateMetric memberi skor dari limits', () => {
  const L = { min: 380, max: 420, tripMin: 360, tripMax: 440 };
  assert.equal(th.evaluateMetric('phaseA', 400, L).status, 'OPTIMAL');
  assert.equal(th.evaluateMetric('phaseA', 425, L).status, 'WARNING');
  assert.equal(th.evaluateMetric('phaseA', 445, L).status, 'CRITICAL');
  assert.equal(th.evaluateMetric('phaseA', 370, L).status, 'WARNING');
  assert.equal(th.evaluateMetric('phaseA', null, L).status, 'NO DATA');
  assert.equal(th.evaluateMetric('phaseA', 400, undefined).thresholdLabel, 'Tidak ada batas');
});

test('healthScore = 100 - 10 alarm - 25 trip, minimum 0', () => {
  assert.equal(th.healthScore({ alarm: 0, trip: 0 }), 100);
  assert.equal(th.healthScore({ alarm: 2, trip: 1 }), 55);
  assert.equal(th.healthScore({ alarm: 10, trip: 4 }), 0);
});

test('failureToEvent memetakan failure_log ke event panel', () => {
  const e = th.failureToEvent({ rowId: 5, time_start: '2026-10-10T01:00:00Z', duration: 30, failure_type: 'High Alarm', parameter: 'OilTemp', parameterValue: '72.5' });
  assert.equal(e.id, 'fl-5');
  assert.equal(e.level, 'ALARM');
  assert.equal(e.source, 'OilTemp');
  assert.match(e.msg, /High Alarm.*72\.5/);
  assert.equal(th.failureToEvent({ rowId: 6, failure_type: 'High Trip', parameter: 'Vab' }).level, 'CRITICAL');
});
