const STATUS_LABELS = {
  1: "Low Trip",
  2: "Low Alarm",
  3: "Normal",
  4: "High Alarm",
  5: "High Trip",
};

const STATUS_COLUMNS = [
  "Vab",
  "Vbc",
  "Vca",
  "Current1",
  "Current2",
  "Current3",
  "Ineutral",
  "THDVoltage1",
  "THDVoltage2",
  "THDVoltage3",
  "THDCurrent1",
  "THDCurrent2",
  "THDCurrent3",
  "PF",
  "Freq",
  "BusTemp1",
  "BusTemp2",
  "BusTemp3",
  "OilTemp",
  "WTITemp1",
  "WTITemp2",
  "WTITemp3",
  "Pressure",
  "OilLevel",
  "H2ppm",
  "Moistureppm",
  "Uab",
  "Ubc",
  "Uca",
];

function normalizeCode(v) {
  const n = Number(v);
  return STATUS_LABELS[n] ? n : 3;
}

function levelOf(code) {
  if (code === 3) return "normal";
  if (code === 2 || code === 4) return "alarm";
  return "trip";
}

function groupKey(param) {
  return String(param).replace(
    /^(WTITemp|BusTemp|THDCurrent|THDVoltage|Current)[123]$/,
    "$1",
  );
}

function buildStatusItems(statusRow, recs = []) {
  const row = statusRow || {};
  let alarm = 0,
    trip = 0;
  const items = STATUS_COLUMNS.map((parameter) => {
    const code = normalizeCode(row[parameter]);
    const level = levelOf(code);
    if (level === "alarm") alarm++;
    if (level === "trip") trip++;
    const key = groupKey(parameter);
    const recommendations =
      level === "normal"
        ? []
        : recs.filter((r) => r.parameter === key).map((r) => r.recommendation);
    return {
      parameter,
      code,
      label: STATUS_LABELS[code],
      level,
      recommendations,
    };
  });
  return { allSafe: alarm === 0 && trip === 0, counts: { alarm, trip }, items };
}

function oilFlags(oilLevelCode) {
  const code = normalizeCode(oilLevelCode);
  return {
    oil_level_alarm: code === 3 ? 1 : 0,
    oil_level_trip: code === 1 ? 0 : 1,
  };
}

function pressureLevel(code) {
  const level = levelOf(normalizeCode(code));
  return level === "normal" ? "safe" : level;
}

module.exports = {
  STATUS_LABELS,
  STATUS_COLUMNS,
  normalizeCode,
  levelOf,
  groupKey,
  buildStatusItems,
  oilFlags,
  pressureLevel,
};
