const test = require("node:test");
const assert = require("node:assert/strict");
const sm = require("../utils/statusModel");

test("groupKey menyatukan parameter per fase ke key rekomendasi", () => {
  assert.equal(sm.groupKey("WTITemp2"), "WTITemp");
  assert.equal(sm.groupKey("BusTemp3"), "BusTemp");
  assert.equal(sm.groupKey("THDCurrent1"), "THDCurrent");
  assert.equal(sm.groupKey("THDVoltage3"), "THDVoltage");
  assert.equal(sm.groupKey("Current2"), "Current");
  assert.equal(sm.groupKey("Vab"), "Vab");
  assert.equal(sm.groupKey("OilLevel"), "OilLevel");
});

test("buildStatusItems memberi label, level, dan rekomendasi hanya untuk yang tidak normal", () => {
  const recs = [
    { parameter: "OilTemp", recommendation: "Periksa kipas" },
    { parameter: "WTITemp", recommendation: "Kurangi beban" },
    { parameter: "Vab", recommendation: "Cek tap" },
  ];
  const row = { OilTemp: 4, WTITemp1: 5, Vab: 3, Vbc: 2 };
  const r = sm.buildStatusItems(row, recs);
  assert.equal(r.allSafe, false);
  assert.deepEqual(r.counts, { alarm: 2, trip: 1 });
  const byParam = Object.fromEntries(r.items.map((i) => [i.parameter, i]));
  assert.deepEqual(byParam.OilTemp, {
    parameter: "OilTemp", code: 4, label: "High Alarm", level: "alarm", recommendations: ["Periksa kipas"],
  });
  assert.deepEqual(byParam.WTITemp1, {
    parameter: "WTITemp1", code: 5, label: "High Trip", level: "trip", recommendations: ["Kurangi beban"],
  });
  assert.deepEqual(byParam.Vab, {
    parameter: "Vab", code: 3, label: "Normal", level: "normal", recommendations: [],
  });
  assert.equal(byParam.Vbc.label, "Low Alarm");
  assert.equal(r.items.length, sm.STATUS_COLUMNS.length);
});

test("buildStatusItems menganggap NULL, kode asing, dan baris kosong sebagai Normal", () => {
  const r = sm.buildStatusItems({ OilTemp: null, Vab: 7 }, []);
  assert.equal(r.allSafe, true);
  assert.ok(r.items.every((i) => i.code === 3));
  assert.equal(sm.buildStatusItems(null, []).allSafe, true);
});

test("oilFlags dan pressureLevel dari kode status", () => {
  assert.deepEqual(sm.oilFlags(3), { oil_level_alarm: 1, oil_level_trip: 1 });
  assert.deepEqual(sm.oilFlags(2), { oil_level_alarm: 0, oil_level_trip: 1 });
  assert.deepEqual(sm.oilFlags(1), { oil_level_alarm: 0, oil_level_trip: 0 });
  assert.deepEqual(sm.oilFlags(undefined), { oil_level_alarm: 1, oil_level_trip: 1 });
  assert.equal(sm.pressureLevel(3), "safe");
  assert.equal(sm.pressureLevel(2), "alarm");
  assert.equal(sm.pressureLevel(4), "alarm");
  assert.equal(sm.pressureLevel(1), "trip");
  assert.equal(sm.pressureLevel(5), "trip");
});
