const SETTINGS_COLUMNS = [
  "voltageLowTripTreshold",
  "voltageLowAlarmTreshold",
  "voltageHighTripTreshold",
  "voltageHighAlarmTreshold",
  "voltageUnbalanceHighAlarmTreshold",
  "voltageUnbalanceHighTripTreshold",
  "frequencyLowTripTreshold",
  "frequencyLowAlarmTreshold",
  "frequencyHighTripTreshold",
  "frequencyHighAlarmTreshold",
  "topOilHighAlarmTreshold",
  "topOilHighTripTreshold",
  "windTempHighAlarmTreshold",
  "windTempHighTripTreshold",
  "powerFactorLowAlarmTreshold",
  "powerFactorLowTripTreshold",
  "currentHighAlarmTreshold",
  "currentHighTripTreshold",
  "tankPressureHighTripTreshold",
  "tankPressureHighAlarmTreshold",
  "busTempHighAlarmTreshold",
  "busTempHighTripTreshold",
  "thdCurrentAlarmTreshold",
  "thdCurrentTripTreshold",
  "thdVoltageAlarmTreshold",
  "thdVoltageTripTreshold",
  "IneutralHighAlarmTreshold",
  "IneutralHighTripTreshold",
  "H2ppmHighAlarmTreshold",
  "H2ppmHighTripTreshold",
  "MoistureppmHighAlarmTreshold",
  "MoistureppmHighTripTreshold",
];

const TRIP_COLUMNS = [
  "voltage",
  "voltageUnbalance",
  "frequency",
  "topOilTemp",
  "busTemp",
  "powerFactor",
  "current",
  "pressure",
  "oilLevel",
  "WTITemp",
  "THDCurrent",
  "THDVoltage",
  "Ineutral",
  "H2ppm",
  "Moistureppm",
];

const num = (v) =>
  v === null || v === undefined || v === "" || Number.isNaN(Number(v))
    ? null
    : Number(v);
const r2 = (v) => (v === null ? null : Math.round(v * 100) / 100);
const lim = (min, max, tripMin, tripMax) => ({
  min: r2(min),
  max: r2(max),
  tripMin: r2(tripMin),
  tripMax: r2(tripMax),
});

function buildLimits(settings, td) {
  if (!settings) return {};
  const s = settings,
    t = td || {};
  const L = {};

  const v = lim(
    num(s.voltageLowAlarmValue),
    num(s.voltageHighAlarmValue),
    num(s.voltageLowTripValue),
    num(s.voltageHighTripValue),
  );

  // Threshold tegangan di transformer_settings adalah tegangan line (Vab/Vbc/Vca).
  // Tegangan fasa (Van) = line / sqrt(3), jadi batasnya ikut dibagi sqrt(3).
  for (const k of ["lineAB", "lineBC", "lineCA"]) L[k] = v;
  const SQRT3 = Math.sqrt(3);
  const div = (x) => (x === null ? null : x / SQRT3);
  const vp = lim(div(v.min), div(v.max), div(v.tripMin), div(v.tripMax));
  for (const k of ["phaseA", "phaseB", "phaseC"]) L[k] = vp;

  const fn = num(t.frequency);
  if (fn) {
    L.frequency = lim(
      fn * (1 - (num(s.frequencyLowAlarmTreshold) || 0) / 100),
      fn * (1 + (num(s.frequencyHighAlarmTreshold) || 0) / 100),
      fn * (1 - (num(s.frequencyLowTripTreshold) || 0) / 100),
      fn * (1 + (num(s.frequencyHighTripTreshold) || 0) / 100),
    );
  }

  const ir = num(t.ratedCurrentLowVoltage);
  if (ir) {
    const c = lim(
      null,
      (ir * (num(s.currentHighAlarmTreshold) || 0)) / 100,
      null,
      (ir * (num(s.currentHighTripTreshold) || 0)) / 100,
    );
    for (const k of ["currentA", "currentB", "currentC"]) L[k] = c;
    L.currentN = lim(
      null,
      (ir * (num(s.IneutralHighAlarmTreshold) || 0)) / 100,
      null,
      (ir * (num(s.IneutralHighTripTreshold) || 0)) / 100,
    );
  }

  const pf = lim(
    num(s.powerFactorLowAlarmTreshold),
    null,
    num(s.powerFactorLowTripTreshold),
    null,
  );
  for (const k of ["pfTotal", "pfA", "pfB", "pfC"]) L[k] = pf;

  L.oil_temperature = lim(
    null,
    num(s.topOilHighAlarmTreshold),
    null,
    num(s.topOilHighTripTreshold),
  );
  const wti = lim(
    null,
    num(s.windTempHighAlarmTreshold),
    null,
    num(s.windTempHighTripTreshold),
  );
  for (const k of ["wtiA", "wtiB", "wtiC"]) L[k] = wti;
  const bus = lim(
    null,
    num(s.busTempHighAlarmTreshold),
    null,
    num(s.busTempHighTripTreshold),
  );
  for (const k of ["busTempA", "busTempB", "busTempC"]) L[k] = bus;
  const thdV = lim(
    null,
    num(s.thdVoltageAlarmTreshold),
    null,
    num(s.thdVoltageTripTreshold),
  );
  for (const k of ["thdVA", "thdVB", "thdVC"]) L[k] = thdV;
  const thdI = lim(
    null,
    num(s.thdCurrentAlarmTreshold),
    null,
    num(s.thdCurrentTripTreshold),
  );
  for (const k of ["thdIA", "thdIB", "thdIC"]) L[k] = thdI;
  L.oil_pressure = lim(
    null,
    num(s.tankPressureHighAlarmTreshold),
    null,
    num(s.tankPressureHighTripTreshold),
  );
  L.h2ppm = lim(
    null,
    num(s.H2ppmHighAlarmTreshold),
    null,
    num(s.H2ppmHighTripTreshold),
  );
  L.moisturePpm = lim(
    null,
    num(s.MoistureppmHighAlarmTreshold),
    null,
    num(s.MoistureppmHighTripTreshold),
  );
  const unb = lim(
    null,
    num(s.voltageUnbalanceHighAlarmTreshold),
    null,
    num(s.voltageUnbalanceHighTripTreshold),
  );
  for (const k of ["unbalanceUV", "unbalanceVW", "unbalanceUW"]) L[k] = unb;
  return L;
}

function computeVoltageValues(s, ratedLowVoltage) {
  const rated = num(ratedLowVoltage);
  if (!rated) return {};
  const out = {};
  const pairs = [
    ["voltageLowAlarmTreshold", "voltageLowAlarmValue", -1],
    ["voltageLowTripTreshold", "voltageLowTripValue", -1],
    ["voltageHighAlarmTreshold", "voltageHighAlarmValue", 1],
    ["voltageHighTripTreshold", "voltageHighTripValue", 1],
  ];
  for (const [pct, val, sign] of pairs) {
    const p = num(s && s[pct]);
    if (p !== null) out[val] = r2(rated + sign * (p / 100) * rated);
  }
  return out;
}

module.exports = {
  SETTINGS_COLUMNS,
  TRIP_COLUMNS,
  buildLimits,
  computeVoltageValues,
};
