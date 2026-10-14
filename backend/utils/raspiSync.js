const rm = require('./readingModel');
const sm = require('./statusModel');
const { SETTINGS_COLUMNS, TRIP_COLUMNS } = require('./limitsModel');

// ---------- allowlist kolom ----------
const READING_COLUMNS = ['timestamp', ...Object.keys(rm.COLUMN_MAP)];
const STATUS_ALL_COLUMNS = [...sm.STATUS_COLUMNS];
const SETTINGS_ALL_COLUMNS = [
  ...SETTINGS_COLUMNS,
  'voltageLowTripValue', 'voltageLowAlarmValue', 'voltageHighTripValue', 'voltageHighAlarmValue',
];
const TRIP_SETTINGS_COLUMNS = [...TRIP_COLUMNS];
const TD_COLUMNS = [
  'raspiSerialNo', 'trafoSerialNo', 'ratedPower', 'ratedHighVoltage', 'ratedLowVoltage', 'ratedCurrentHighVoltage',
  'ratedCurrentLowVoltage', 'frequency', 'vectorGroup', 'phase', 'tapType', 'impedance', 'noLoadLoss', 'fullLoadLoss',
  'tapPercentagePlus', 'tapPercentageMinus', 'tapNumberPlus', 'tapNumberMinus', 'topOilHv', 'topOilLv', 'gradientHv',
  'gradientLv', 'windTempHv', 'windTempLv', 'losses', 'hotspotFactor', 'ctRatio', 'coolingMode', 'status', 'SuddenPressure',
  'latitude', 'longitude', 'intervalDelay', 'krated', 'lastSyncTimestamp', 'version', 'imageFileName', 'productionStatus',
];
const FAILURE_COLUMNS = ['failure_id', 'time_start', 'duration', 'failure_type', 'parameter', 'parameterValue'];
const HARMONIC_ORDERS = ['1st', '3rd', '5th', '7th', '9th', '11th', '13th', '15th', '17th', '19th', '21th', '23th', '25th', '27th', '29th', '31th'];

// ---------- helper murni ----------
const DEFAULT_OFFSET = process.env.RASPI_TZ_OFFSET || '+07:00';

// Date | ISO string | 'YYYY-MM-DD HH:mm:ss' (lokal Raspi) -> Date UTC, atau null.
function parseRaspiTimestamp(v, offset = DEFAULT_OFFSET) {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  const s = String(v).trim();
  const plain = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?)(\.\d+)?$/.exec(s);
  const d = plain ? new Date(`${plain[1]}T${plain[2]}${plain[3] || ''}${offset}`) : new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Ambil kolom yang ada di allowlist; nama dicocokkan tanpa peduli huruf besar-kecil.
function pickColumns(row, allowlist) {
  const out = {};
  if (!row || typeof row !== 'object') return out;
  const byLower = new Map(allowlist.map((c) => [c.toLowerCase(), c]));
  for (const [k, v] of Object.entries(row)) {
    const col = byLower.get(String(k).toLowerCase());
    if (col && !(col in out)) out[col] = v;
  }
  return out;
}

// INSERT multi-baris. Kolom = extra (mis. trafoId) + kolom allowlist yang muncul di baris mana pun.
function buildInsert(table, rows, allowlist, extra = {}, { ignore = false } = {}) {
  const picked = (rows || []).map((r) => pickColumns(r, allowlist)).filter((r) => Object.keys(r).length > 0);
  if (picked.length === 0) return null;
  const cols = allowlist.filter((c) => picked.some((r) => c in r));
  const extraCols = Object.keys(extra);
  const all = [...extraCols, ...cols];
  const placeholders = `(${all.map(() => '?').join(', ')})`;
  const params = [];
  for (const r of picked) {
    for (const c of extraCols) params.push(extra[c]);
    for (const c of cols) params.push(c in r ? r[c] : null);
  }
  const sql = `INSERT ${ignore ? 'IGNORE ' : ''}INTO \`${table}\` (${all.map((c) => `\`${c}\``).join(', ')}) VALUES ${picked.map(() => placeholders).join(', ')}`;
  return { sql, params };
}

// Baris harmonik dari Raspi: { Phase, Row1st, Row3rd, ... } -> { Phase, '1st', '3rd', ... }
function mapHarmonicRow(row) {
  const out = { Phase: row && row.Phase !== undefined ? Number(row.Phase) : null };
  for (const o of HARMONIC_ORDERS) {
    const v = row ? (row[`Row${o}`] ?? row[o]) : undefined;
    out[o] = v === undefined || v === null || v === '' ? null : Number(v);
  }
  return out;
}

const first = (x) => (Array.isArray(x) ? x[0] : x) || null;

module.exports = {
  READING_COLUMNS, STATUS_ALL_COLUMNS, SETTINGS_ALL_COLUMNS, TRIP_SETTINGS_COLUMNS, TD_COLUMNS, FAILURE_COLUMNS, HARMONIC_ORDERS,
  parseRaspiTimestamp, pickColumns, buildInsert, mapHarmonicRow, first,
};
