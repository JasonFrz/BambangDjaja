const { getMasterDb } = require("./db");
const { raspiClients } = require("./raspiWebSocket");

// Trafo dianggap online kalau Raspi-nya terhubung lewat WebSocket, atau terakhir
// terhubung kurang dari 2 menit lalu (master.trafo_last_connection).
const ONLINE_WINDOW_SEC = 120;

async function getTransformerData(db, trafoId) {
  const [rows] = await db.execute("SELECT * FROM transformer_data WHERE trafoId = ? LIMIT 1", [trafoId]);
  return rows[0] || null;
}

async function getStatusRow(db, trafoId) {
  const [rows] = await db.execute("SELECT * FROM transformer_status WHERE trafoId = ? LIMIT 1", [trafoId]);
  return rows[0] || null;
}

async function getTripStatusRow(db, trafoId) {
  const [rows] = await db.execute("SELECT * FROM trip_status WHERE trafoId = ? LIMIT 1", [trafoId]);
  return rows[0] || null;
}

async function getRecommendations(masterDb) {
  const [rows] = await masterDb.execute(
    "SELECT parameter, recommendation FROM parameter_failure_recommendation ORDER BY id",
  );
  return rows;
}

// { raspiSerialNo: true/false } untuk sekumpulan serial sekaligus (satu query).
async function getOnlineMap(masterDb, serials) {
  const result = {};
  const list = [...new Set(serials.filter(Boolean))];
  for (const s of list) {
    const ws = raspiClients.get(s);
    result[s] = !!(ws && ws.readyState === 1);
  }
  const pending = list.filter((s) => !result[s]);
  if (pending.length > 0) {
    const [rows] = await masterDb.query(
      `SELECT raspi_serial_no, TIMESTAMPDIFF(SECOND, last_connection_time, NOW()) AS age
       FROM trafo_last_connection WHERE raspi_serial_no IN (?)`,
      [pending],
    );
    for (const r of rows) {
      if (r.age !== null && r.age >= 0 && r.age <= ONLINE_WINDOW_SEC) result[r.raspi_serial_no] = true;
    }
  }
  return result;
}

// Daftar trafo untuk TransformerSelection: { id, nama, image_url, device_serial, status, ... }.
async function listTrafos(db) {
  const [rows] = await db.query(
    `SELECT td.trafoId AS id, td.raspiSerialNo, td.trafoSerialNo, td.ratedPower, td.ratedLowVoltage, td.version,
            t.nama, t.image_url, t.created_at
     FROM transformer_data td LEFT JOIN trafo t ON t.id = td.trafoId ORDER BY td.trafoId ASC`,
  );
  const online = await getOnlineMap(await getMasterDb(), rows.map((r) => r.raspiSerialNo));
  return rows.map((r) => ({
    id: r.id,
    nama: r.nama || r.trafoSerialNo || `Trafo ${r.id}`,
    image_url: r.image_url || null,
    device_serial: r.raspiSerialNo || null,
    serial_no: r.trafoSerialNo || null,
    rated_power: r.ratedPower,
    rated_low_voltage: r.ratedLowVoltage,
    tmu_version: r.version,
    created_at: r.created_at || null,
    status: online[r.raspiSerialNo] ? "Online" : "Offline",
  }));
}

module.exports = {
  ONLINE_WINDOW_SEC,
  getTransformerData,
  getStatusRow,
  getTripStatusRow,
  getRecommendations,
  getOnlineMap,
  listTrafos,
};
