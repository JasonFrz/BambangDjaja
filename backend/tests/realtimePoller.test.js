const test = require('node:test');
const assert = require('node:assert/strict');
const { buildPayloads } = require('../utils/realtimePoller');
const rm = require('../utils/readingModel');

test('buildPayloads membuat meter dan oil_sensor dari satu point', () => {
  const point = rm.mapRow({ timestamp: '2026-10-13T01:02:03.000Z', trafoId: 1, Van: 230, Iavg: 72, Qa: 100, Sa: 15000, deRatinga: 90, OilTemp: 55, Press: 0.41, Level: 1 });
  const td = { ratedPower: 100, ratedCurrentLowVoltage: 144, noLoadLoss: 150, fullLoadLoss: 1200 };
  const { meter, oil } = buildPayloads(point, td, { OilLevel: 2 });
  assert.equal(meter.phaseA, 230);
  assert.equal(meter.efficiency, 99.55);
  assert.equal(meter.leadLag.a, 'leading');
  assert.equal(meter.derating.a.used, 15);
  assert.equal(meter.modbus_connected, true);
  assert.equal(meter.timestamp, '2026-10-13T01:02:03.000Z');
  assert.deepEqual(oil, { oil_temperature: 55, oil_pressure: 0.41, oil_level: true, oil_level_alarm: 0, oil_level_trip: 1, timestamp: '2026-10-13T01:02:03.000Z', adc_connected: true });
});

test('buildPayloads tetap jalan tanpa nameplate dan tanpa status', () => {
  const point = rm.mapRow({ timestamp: new Date(), Van: 1 });
  const { meter, oil } = buildPayloads(point, null, null);
  assert.equal(meter.efficiency, null);
  assert.equal(meter.derating, null);
  assert.equal(oil.oil_level_alarm, 1);
});
