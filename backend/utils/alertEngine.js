const sm = require('./statusModel');

const RANK = { normal: 0, alarm: 1, trip: 2 };

// Parameter transformer_status -> key frontend (untuk nilai terakhir dan batas).
const PARAM_METRIC = {
  Vab: 'lineAB', Vbc: 'lineBC', Vca: 'lineCA',
  Current1: 'currentA', Current2: 'currentB', Current3: 'currentC', Ineutral: 'currentN',
  THDVoltage1: 'thdVA', THDVoltage2: 'thdVB', THDVoltage3: 'thdVC',
  THDCurrent1: 'thdIA', THDCurrent2: 'thdIB', THDCurrent3: 'thdIC',
  PF: 'pfTotal', Freq: 'frequency',
  BusTemp1: 'busTempA', BusTemp2: 'busTempB', BusTemp3: 'busTempC',
  OilTemp: 'oil_temperature', WTITemp1: 'wtiA', WTITemp2: 'wtiB', WTITemp3: 'wtiC',
  Pressure: 'oil_pressure', OilLevel: 'oilLevelRaw', H2ppm: 'h2ppm', Moistureppm: 'moisturePpm',
  Uab: 'unbalanceUV', Ubc: 'unbalanceVW', Uca: 'unbalanceUW',
};

// Hanya perubahan yang memburuk: normal->alarm, normal->trip, alarm->trip.
function diffStatus(before, after) {
  const b = before || {}, a = after || {};
  const out = [];
  for (const parameter of sm.STATUS_COLUMNS) {
    if (!(parameter in a)) continue;
    const from = sm.normalizeCode(b[parameter]);
    const to = sm.normalizeCode(a[parameter]);
    const lf = sm.levelOf(from), lt = sm.levelOf(to);
    if (RANK[lt] > RANK[lf]) out.push({ parameter, from, to, level: lt });
  }
  return out;
}

function limitLabel(level, L) {
  if (!L) return '-';
  const parts = [];
  if (level === 'trip') {
    if (L.tripMin !== null && L.tripMin !== undefined) parts.push(`Trip Min ${L.tripMin}`);
    if (L.tripMax !== null && L.tripMax !== undefined) parts.push(`Trip Max ${L.tripMax}`);
  } else {
    if (L.min !== null && L.min !== undefined) parts.push(`Min ${L.min}`);
    if (L.max !== null && L.max !== undefined) parts.push(`Max ${L.max}`);
  }
  return parts.length > 0 ? parts.join(' / ') : '-';
}

function buildAlerts(changes, point, limits) {
  const p = point || {}, L = limits || {};
  return changes.map((c) => {
    const key = PARAM_METRIC[c.parameter];
    const raw = key ? p[key] : undefined;
    return {
      name: c.parameter,
      sub: sm.STATUS_LABELS[c.to],
      val: raw === undefined || raw === null ? '-' : raw,
      limit: limitLabel(c.level, key ? L[key] : null),
      type: c.level === 'trip' ? 'TRIP' : 'ALARM',
    };
  });
}

class Cooldown {
  constructor(ms = 15 * 60 * 1000) { this.ms = ms; this.last = new Map(); }
  allow(key, now = Date.now()) {
    const prev = this.last.get(key);
    if (prev !== undefined && now - prev <= this.ms) return false;
    this.last.set(key, now);
    return true;
  }
}

// Dipanggil setelah receivedSyncUpdateStatusTransformer. send = alertSender.sendAlertMessage.
async function processStatusChange({ dbName, trafoId, before, after, point, limits, cooldown, now = Date.now(), send }) {
  const changes = diffStatus(before, after).filter((c) => cooldown.allow(`${dbName}:${trafoId}:${c.parameter}`, now));
  if (changes.length === 0) return [];
  const alerts = buildAlerts(changes, point, limits);
  await send(dbName, trafoId, alerts);
  return alerts;
}

module.exports = { PARAM_METRIC, diffStatus, buildAlerts, Cooldown, processStatusChange };
