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
