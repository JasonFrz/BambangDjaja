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

// ---------- handler DB ----------
function upsertSql(table, trafoId, row, allowlist) {
  const picked = pickColumns(row, allowlist);
  const cols = Object.keys(picked);
  if (cols.length === 0) return null;
  const all = ['trafoId', ...cols];
  return {
    sql: `INSERT INTO \`${table}\` (${all.map((c) => `\`${c}\``).join(', ')}) VALUES (${all.map(() => '?').join(', ')}) ON DUPLICATE KEY UPDATE ${cols.map((c) => `\`${c}\` = VALUES(\`${c}\`)`).join(', ')}`,
    params: [trafoId, ...cols.map((c) => picked[c])],
  };
}

async function run(db, q) {
  if (!q) return null;
  const [res] = await db.execute(q.sql, q.params);
  return res;
}

// createConnection: cari perusahaan, daftarkan/segarkan trafo. null = tolak koneksi.
async function registerConnection(masterDb, openDb, msg) {
  const [companies] = await masterDb.execute(
    'SELECT company_id, database_name, tmu_version FROM company WHERE company_key = ? LIMIT 1', [String(msg.companyKey || '')]);
  const company = companies[0];
  if (!company) return null;
  const db = await openDb(company.database_name);
  const serial = String(msg.raspiSerialNo || '').trim();
  if (!serial) return null;
  const now = new Date();
  const version = Number(msg.version) || company.tmu_version || 2;

  const [existing] = await db.execute('SELECT trafoId FROM transformer_data WHERE raspiSerialNo = ? LIMIT 1', [serial]);
  let trafoId;
  if (existing[0]) {
    trafoId = existing[0].trafoId;
    await db.execute('UPDATE transformer_data SET lastSyncTimestamp = ?, version = ? WHERE trafoId = ?', [now, version, trafoId]);
  } else {
    const td = { ...pickColumns(first(msg.transformerData) || {}, TD_COLUMNS), raspiSerialNo: serial, lastSyncTimestamp: now, version };
    const res = await run(db, buildInsert('transformer_data', [td], TD_COLUMNS));
    trafoId = res && res.insertId;
    if (!trafoId) throw new Error('INSERT transformer_data tidak mengembalikan trafoId');
    await run(db, buildInsert('transformer_settings', [first(msg.transformerSettings) || {}], SETTINGS_ALL_COLUMNS, { trafoId }));
    await run(db, buildInsert('trip_settings', [first(msg.tripSettings) || {}], TRIP_SETTINGS_COLUMNS, { trafoId }));
  }
  await handleStatusSync(db, trafoId, first(msg.transformerStatus), first(msg.tripStatus));
  return { dbName: company.database_name, trafoId, tmuVersion: version, companyId: company.company_id };
}

// Ganti kolom waktu (apa pun hurufnya: timestamp/TIMESTAMP) dengan Date UTC; baris tanpa waktu valid dibuang.
function withTimestamp(rows, col) {
  const out = [];
  const lower = col.toLowerCase();
  for (const r of rows || []) {
    const picked = pickColumns(r, [col]);
    const ts = parseRaspiTimestamp(picked[col]);
    if (!ts) continue;
    const copy = {};
    for (const [k, v] of Object.entries(r)) if (String(k).toLowerCase() !== lower) copy[k] = v;
    copy[col] = ts;
    out.push(copy);
  }
  return out;
}

async function handleReadingRealtime(db, trafoId, rows) {
  const clean = withTimestamp(rows, 'timestamp');
  if (clean.length === 0) return 0;
  await db.execute('DELETE FROM temp_reading_data_realtime WHERE trafoId = ?', [trafoId]);
  await run(db, buildInsert('temp_reading_data_realtime', clean, READING_COLUMNS, { trafoId }));
  return clean.length;
}

async function handleHarmonic(db, trafoId, kind, rows) {
  const table = kind === 'voltage' ? 'temp_voltage_harmonic' : kind === 'current' ? 'temp_current_harmonic' : null;
  if (!table) throw new Error(`jenis harmonik tidak dikenal: ${kind}`);
  const mapped = (rows || []).map(mapHarmonicRow).filter((r) => r.Phase !== null);
  if (mapped.length === 0) return 0;
  await db.execute(`DELETE FROM ${table} WHERE trafoId = ?`, [trafoId]);
  await run(db, buildInsert(table, mapped, ['Phase', ...HARMONIC_ORDERS], { trafoId }));
  return mapped.length;
}

async function handleStatusSync(db, trafoId, statusRow, tripRow) {
  await run(db, upsertSql('transformer_status', trafoId, statusRow || {}, STATUS_ALL_COLUMNS));
  await run(db, upsertSql('trip_status', trafoId, tripRow || {}, STATUS_ALL_COLUMNS));
}

async function handleTapPosition(db, trafoId, tdRow) {
  const picked = pickColumns(tdRow || {}, ['tapType', 'impedance']);
  const cols = Object.keys(picked);
  if (cols.length === 0) return;
  await db.execute(`UPDATE transformer_data SET ${cols.map((c) => `\`${c}\` = ?`).join(', ')} WHERE trafoId = ?`, [...cols.map((c) => picked[c]), trafoId]);
}

async function handleSyncReading(db, trafoId, rows) {
  const clean = withTimestamp(rows, 'timestamp');
  if (clean.length === 0) return 0;
  for (let i = 0; i < clean.length; i += 200) {
    await run(db, buildInsert('reading_data', clean.slice(i, i + 200), READING_COLUMNS, { trafoId }, { ignore: true }));
  }
  return clean.length;
}

async function handleSyncFailureLog(db, trafoId, rows) {
  const clean = withTimestamp(rows, 'time_start');
  if (clean.length === 0) return 0;
  await run(db, buildInsert('failure_log', clean, FAILURE_COLUMNS, { trafoId }, { ignore: true }));
  return clean.length;
}

async function touchLastConnection(masterDb, raspiSerialNo, now = new Date()) {
  await masterDb.execute(
    'INSERT INTO trafo_last_connection (raspi_serial_no, last_connection_time) VALUES (?, ?) ON DUPLICATE KEY UPDATE last_connection_time = VALUES(last_connection_time)',
    [raspiSerialNo, now]);
}

async function recentTimestamps(db, trafoId, hours = 24) {
  const since = new Date(Date.now() - hours * 3600e3);
  const [rows] = await db.execute('SELECT timestamp FROM reading_data WHERE trafoId = ? AND timestamp >= ? ORDER BY timestamp ASC', [trafoId, since]);
  return rows.map((r) => ({ timestamp: new Date(r.timestamp).toISOString() }));
}

async function knownFailureIds(db, trafoId) {
  const [rows] = await db.execute('SELECT failure_id FROM failure_log WHERE trafoId = ? AND failure_id IS NOT NULL ORDER BY failure_id ASC', [trafoId]);
  return rows.map((r) => ({ failure_id: r.failure_id }));
}

module.exports = {
  READING_COLUMNS, STATUS_ALL_COLUMNS, SETTINGS_ALL_COLUMNS, TRIP_SETTINGS_COLUMNS, TD_COLUMNS, FAILURE_COLUMNS, HARMONIC_ORDERS,
  parseRaspiTimestamp, pickColumns, buildInsert, mapHarmonicRow, first,
  registerConnection, handleReadingRealtime, handleHarmonic, handleStatusSync, handleTapPosition,
  handleSyncReading, handleSyncFailureLog, touchLastConnection, recentTimestamps, knownFailureIds,
};
