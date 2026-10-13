const COLUMN_MAP = {
  Van: "phaseA",
  Vbn: "phaseB",
  Vcn: "phaseC",
  Vab: "lineAB",
  Vbc: "lineBC",
  Vca: "lineCA",
  Ia: "currentA",
  Ib: "currentB",
  Ic: "currentC",
  Ineutral: "currentN",
  Iavg: "avgCurrent",
  Pa: "powerActiveA",
  Pb: "powerActiveB",
  Pc: "powerActiveC",
  Psig: "powerActiveTotal",
  Qa: "powerReactiveA",
  Qb: "powerReactiveB",
  Qc: "powerReactiveC",
  Qsig: "powerReactiveTotal",
  Sa: "powerApparentA",
  Sb: "powerApparentB",
  Sc: "powerApparentC",
  Ssig: "powerApparentTotal",
  PFa: "pfA",
  PFb: "pfB",
  PFc: "pfC",
  PFsig: "pfTotal",
  Freq: "frequency",
  kWh: "energyActiveTotal",
  kVARh: "energyReactiveTotal",
  OilTemp: "oil_temperature",
  Press: "oil_pressure",
  WTITemp1: "wtiA",
  WTITemp2: "wtiB",
  WTITemp3: "wtiC",
  BusTemp1: "busTempA",
  BusTemp2: "busTempB",
  BusTemp3: "busTempC",
  THDV1: "thdVA",
  THDV2: "thdVB",
  THDV3: "thdVC",
  THDI1: "thdIA",
  THDI2: "thdIB",
  THDI3: "thdIC",
  H2ppm: "h2ppm",
  Moistureppm: "moisturePpm",
  deRatinga: "deRatingA",
  deRatingb: "deRatingB",
  deRatingc: "deRatingC",
  KRateda: "kRatedA",
  KRatedb: "kRatedB",
  KRatedc: "kRatedC",
  UnbalanceUV: "unbalanceUV",
  UnbalanceVW: "unbalanceVW",
  UnbalanceUW: "unbalanceUW",
  Level: "oilLevelRaw",
};

const WATT_COLUMNS = new Set([
  "Pa",
  "Pb",
  "Pc",
  "Psig",
  "Qa",
  "Qb",
  "Qc",
  "Qsig",
  "Sa",
  "Sb",
  "Sc",
  "Ssig",
]);

const KEY_TO_COLUMN = Object.fromEntries(
  Object.entries(COLUMN_MAP).map(([col, key]) => [key, col]),
);
const ALL_KEYS = Object.values(COLUMN_MAP);

function toNumber(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function mapRow(row) {
  const date = row.timestamp ? new Date(row.timestamp) : new Date();
  const point = {
    timestamp: date.toISOString(),
    time: date.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZone: "Asia/Jakarta",
    }),
    trafoId: row.trafoId ?? null,
  };
  for (const [col, key] of Object.entries(COLUMN_MAP)) {
    let n = toNumber(row[col]);
    if (n === null) n = 0;
    else if (WATT_COLUMNS.has(col)) n = n / 1000;
    point[key] = n;
  }
  return point;
}

function buildSelect(keys, { aggregate = false } = {}) {
  const cols = keys.map((k) => KEY_TO_COLUMN[k]).filter(Boolean);
  if (cols.length === 0) throw new Error("Tidak ada metric valid");
  return cols
    .map((c) => (aggregate ? `ROUND(AVG(\`${c}\`),2) AS \`${c}\`` : `\`${c}\``))
    .join(", ");
}

async function getLatest(db, trafoId) {
  const [rows] = await db.execute(
    "SELECT * FROM temp_reading_data_realtime WHERE trafoId = ? ORDER BY timestamp DESC, data_id DESC LIMIT 1",
    [trafoId],
  );
  return rows.length ? mapRow(rows[0]) : null;
}

async function getRealtimeSeries(db, trafoId, limit = 60) {
  const lim = Math.min(Math.max(parseInt(limit, 10) || 60, 1), 500);
  const [rows] = await db.query(
    `SELECT * FROM (SELECT * FROM temp_reading_data_realtime WHERE trafoId = ? ORDER BY timestamp DESC LIMIT ${lim}) sub ORDER BY timestamp ASC`,
    [trafoId],
  );
  return rows.map(mapRow);
}

async function getHistory(
  db,
  trafoId,
  start,
  end,
  intervalSec = 0,
  keys = ALL_KEYS,
) {
  const intv = parseInt(intervalSec, 10) || 0;
  let sql;
  if (intv > 0) {
    sql = `SELECT FROM_UNIXTIME(UNIX_TIMESTAMP(MIN(timestamp)) DIV ${intv} * ${intv}) AS timestamp, ${buildSelect(keys, { aggregate: true })} FROM reading_data WHERE trafoId = ? AND timestamp >= ? AND timestamp <= ? GROUP BY UNIX_TIMESTAMP(timestamp) DIV ${intv} ORDER BY timestamp ASC LIMIT 5000`;
  } else {
    sql = `SELECT timestamp, ${buildSelect(keys)} FROM reading_data WHERE trafoId = ? AND timestamp >= ? AND timestamp <= ? ORDER BY timestamp ASC LIMIT 5000`;
  }
  const [rows] = await db.query(sql, [trafoId, start, end]);
  return rows.map(mapRow);
}

function computeEfficiency(point, td) {
  const rated = toNumber(td && td.ratedCurrentLowVoltage);
  const fullLoadLoss = toNumber(td && td.fullLoadLoss);
  const noLoadLoss = toNumber(td && td.noLoadLoss);
  const ratedPower = toNumber(td && td.ratedPower);
  if (!rated || fullLoadLoss === null || noLoadLoss === null || !ratedPower)
    return null;

  const iavg =
    toNumber(point.avgCurrent) ||
    ((point.currentA || 0) + (point.currentB || 0) + (point.currentC || 0)) / 3;

  const ratio = iavg / rated;
  const loadLoss = ratio * ratio * fullLoadLoss;
  const inputPower = ratedPower * 1000 + noLoadLoss + loadLoss;
  const eff = (1 - (noLoadLoss + loadLoss) / inputPower) * 100;
  return Number.isFinite(eff) ? round2(eff) : null;
}

function leadLag(q) {
  if (q > 0) return "leading";
  if (q < 0) return "lagging";
  return "unity";
}

function computeDerating(point, td) {
  const ratedPower = toNumber(td && td.ratedPower);
  if (!ratedPower) return null;
  const full = ratedPower / 3;
  const phase = (deRating, apparentKva, kRated) => {
    const available = ((toNumber(deRating) ?? 100) / 100) * full;
    return {
      kRated: toNumber(kRated),
      full: round2(full),
      available: round2(available),
      lost: round2(full - available),
      used: round2(toNumber(apparentKva) || 0),
    };
  };
  return {
    a: phase(point.deRatingA, point.powerApparentA, point.kRatedA),
    b: phase(point.deRatingB, point.powerApparentB, point.kRatedB),
    c: phase(point.deRatingC, point.powerApparentC, point.kRatedC),
  };
}

function computeDerived(point, td) {
  return {
    ...point,
    efficiency: computeEfficiency(point, td),
    leadLag: {
      a: leadLag(point.powerReactiveA),
      b: leadLag(point.powerReactiveB),
      c: leadLag(point.powerReactiveC),
    },
    derating: computeDerating(point, td),
  };
}

module.exports = {
  COLUMN_MAP,
  KEY_TO_COLUMN,
  ALL_KEYS,
  WATT_COLUMNS,
  mapRow,
  buildSelect,
  getLatest,
  getRealtimeSeries,
  getHistory,
  computeEfficiency,
  leadLag,
  computeDerating,
  computeDerived,
};
