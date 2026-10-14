const test = require("node:test");
const assert = require("node:assert/strict");
const lm = require("../utils/limitsModel");

// Sama dengan seed_demo
const S = {
  voltageLowTripTreshold: 10, voltageLowTripValue: 360, voltageLowAlarmTreshold: 5, voltageLowAlarmValue: 380,
  voltageHighTripTreshold: 10, voltageHighTripValue: 440, voltageHighAlarmTreshold: 5, voltageHighAlarmValue: 420,
  voltageUnbalanceHighAlarmTreshold: 3, voltageUnbalanceHighTripTreshold: 5,
  frequencyLowTripTreshold: 5, frequencyLowAlarmTreshold: 2, frequencyHighTripTreshold: 5, frequencyHighAlarmTreshold: 2,
  topOilHighAlarmTreshold: 70, topOilHighTripTreshold: 85, windTempHighAlarmTreshold: 80, windTempHighTripTreshold: 95,
  powerFactorLowAlarmTreshold: 0.85, powerFactorLowTripTreshold: 0.8, currentHighAlarmTreshold: 100, currentHighTripTreshold: 120,
  tankPressureHighTripTreshold: 0.6, tankPressureHighAlarmTreshold: 0.5, busTempHighAlarmTreshold: 70, busTempHighTripTreshold: 85,
  thdCurrentAlarmTreshold: 10, thdCurrentTripTreshold: 15, thdVoltageAlarmTreshold: 5, thdVoltageTripTreshold: 8,
  IneutralHighAlarmTreshold: 20, IneutralHighTripTreshold: 30, H2ppmHighAlarmTreshold: 50, H2ppmHighTripTreshold: 100,
  MoistureppmHighAlarmTreshold: 20, MoistureppmHighTripTreshold: 30,
};
const TD = { ratedLowVoltage: 400, ratedCurrentLowVoltage: 144, frequency: 50 };

test("buildLimits menghasilkan min/max/tripMin/tripMax per metric", () => {
  const L = lm.buildLimits(S, TD);
  assert.deepEqual(L.lineAB, { min: 380, max: 420, tripMin: 360, tripMax: 440 });
  assert.deepEqual(L.lineBC, L.lineAB);
  // tegangan fasa = tegangan line / sqrt(3): 380/1.732 = 219.39, dst.
  assert.deepEqual(L.phaseA, { min: 219.39, max: 242.49, tripMin: 207.85, tripMax: 254.03 });
  assert.deepEqual(L.phaseC, L.phaseA);
  assert.deepEqual(L.frequency, { min: 49, max: 51, tripMin: 47.5, tripMax: 52.5 });
  assert.deepEqual(L.currentA, { min: null, max: 144, tripMin: null, tripMax: 172.8 });
  assert.deepEqual(L.currentN, { min: null, max: 28.8, tripMin: null, tripMax: 43.2 });
  assert.deepEqual(L.pfTotal, { min: 0.85, max: null, tripMin: 0.8, tripMax: null });
  assert.deepEqual(L.oil_temperature, { min: null, max: 70, tripMin: null, tripMax: 85 });
  assert.deepEqual(L.wtiB, { min: null, max: 80, tripMin: null, tripMax: 95 });
  assert.deepEqual(L.busTempC, { min: null, max: 70, tripMin: null, tripMax: 85 });
  assert.deepEqual(L.thdVA, { min: null, max: 5, tripMin: null, tripMax: 8 });
  assert.deepEqual(L.thdIC, { min: null, max: 10, tripMin: null, tripMax: 15 });
  assert.deepEqual(L.oil_pressure, { min: null, max: 0.5, tripMin: null, tripMax: 0.6 });
  assert.deepEqual(L.h2ppm, { min: null, max: 50, tripMin: null, tripMax: 100 });
  assert.deepEqual(L.moisturePpm, { min: null, max: 20, tripMin: null, tripMax: 30 });
  assert.deepEqual(L.unbalanceUV, { min: null, max: 3, tripMin: null, tripMax: 5 });
});

test("buildLimits kosong kalau settings tidak ada, tanpa crash", () => {
  assert.deepEqual(lm.buildLimits(null, TD), {});
  // nameplate kosong: arus dan frekuensi tidak bisa dihitung, tegangan tetap ada
  const L = lm.buildLimits(S, null);
  assert.deepEqual(L.lineAB, { min: 380, max: 420, tripMin: 360, tripMax: 440 });
  assert.deepEqual(L.phaseA, { min: 219.39, max: 242.49, tripMin: 207.85, tripMax: 254.03 });
  assert.equal(L.currentA, undefined);
  assert.equal(L.frequency, undefined);
});

test("computeVoltageValues dari persen dan tegangan nominal", () => {
  assert.deepEqual(
    lm.computeVoltageValues(
      { voltageLowAlarmTreshold: 5, voltageLowTripTreshold: 10, voltageHighAlarmTreshold: 5, voltageHighTripTreshold: 10 },
      400,
    ),
    { voltageLowAlarmValue: 380, voltageLowTripValue: 360, voltageHighAlarmValue: 420, voltageHighTripValue: 440 },
  );
  assert.deepEqual(lm.computeVoltageValues({}, 0), {});
});
