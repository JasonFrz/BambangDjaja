const { oilFlags } = require("./statusModel");

async function checkClosestData(db, trafoId, start, end) {
  const [before] = await db.execute(
    "SELECT timestamp FROM reading_data WHERE trafoId = ? AND timestamp < ? ORDER BY timestamp DESC LIMIT 1",
    [trafoId, start],
  );
  const [after] = await db.execute(
    "SELECT timestamp FROM reading_data WHERE trafoId = ? AND timestamp > ? ORDER BY timestamp ASC LIMIT 1",
    [trafoId, end],
  );
  let msg = "Tidak ada data pada rentang waktu tersebut.";
  if (before.length > 0 || after.length > 0) {
    msg += " Data terdekat ada pada: ";
    if (before.length > 0)
      msg += `sebelumnya (${new Date(before[0].timestamp).toLocaleString("id-ID")})`;
    if (after.length > 0)
      msg += `${before.length > 0 ? " dan " : ""}sesudahnya (${new Date(
        after[0].timestamp,
      ).toLocaleString("id-ID")})`;
  }
  return msg;
}

function oilPoint(point, oilLevelCode) {
  return {
    timestamp: point.timestamp,
    time: point.time,
    oil_temperature: point.oil_temperature,
    oil_pressure: point.oil_pressure,
    oil_level: point.oilLevelRaw === 1,
    ...oilFlags(oilLevelCode),
  };
}

const COLORS = {
  OPTIMAL: "#10b981",
  NORMAL: "#10b981",
  WARNING: "#f59e0b",
  CRITICAL: "#ef4444",
  "NO DATA": "#94a3b8",
};

function evaluateMetric(key, val, L) {
  const base = { key, val, tMin: L ? L.min : null, tMax: L ? L.max : null };
  if (val === null || val === undefined || Number.isNaN(Number(val))) {
    return {
      ...base,
      displayVal: "-",
      score: 50,
      status: "NO DATA",
      colors: COLORS["NO DATA"],
      threshold: "Tidak ada data",
    };
  }
  const displayVal = Number(val).toFixed(
    ["pfTotal", "frequency", "oil_pressure"].includes(key) ? 2 : 1,
  );
  if (!L || (L.min === null && L.max === null)) {
    return {
      ...base,
      displayVal,
      score: 100,
      status: "OPTIMAL",
      color: COLORS.OPTIMAL,
      thresholdLabel: "Tidak ada batas",
    };
  }
  const parts = [];
  if (L.min !== null) parts.push(`Min ${L.min}`);
  if (L.max !== null) parts.push(`Max ${L.max}`);
  const thresholdLabel = parts.join(" / ");
  let status = "OPTIMAL",
    score = 100;
  const beyondTrip =
    (L.tripMin !== null && val < L.tripMin) ||
    (L.tripMax !== null && val > L.tripMax);
  const beyondAlarm =
    (L.min !== null && val < L.min) || (L.max !== null && val > L.max);
  if (beyondTrip) {
    status = "CRITICAL";
    score = 35;
  } else if (beyondAlarm) {
    status = "WARNING";
    score = 65;
  }
  return {
    ...base,
    displayVal,
    score,
    status,
    color: COLORS[status],
    thresholdLabel,
  };
}

function healthScore(counts) {
  return Math.max(0, 100 - 10 * (counts.alarm || 0) - 25 * (counts.trip || 0));
}

function failureToEvent(row) {
  const ts = row.time_start ? new Date(row.time_start) : new Date();
  const type = String(row.failure_type || "");
  const level = /trip/i.test(type)
    ? "CRITICAL"
    : /alarm/i.test(type)
      ? "ALARM"
      : "WARN";
  return {
    id: `fl-${row.rowId}`,
    timestamp: ts.toISOString(),
    time: ts.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZone: "Asia/Jakarta",
    }),
    level,
    source: row.parameter || "Raspi",
    msg: `${type || "Failure"} pada ${row.parameter || "-"}: nilai ${row.parameterValue ?? "-"}${row.duration ? ` (durasi ${row.duration}s)` : ""}`,
  };
}

module.exports = {
  checkClosestData,
  oilPoint,
  evaluateMetric,
  healthScore,
  failureToEvent,
};
