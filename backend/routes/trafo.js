const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { getDbConnection, getMasterDb } = require("../utils/db");
const { requireRole } = require("../utils/authMiddleware");
const { uploadToCloudinary } = require("../utils/cloudinaryClient");
const { sendToRaspi } = require("../utils/raspiWebSocket");
const { logActivity } = require("../utils/activityLog");
const { getCompanyByDb } = require("../utils/masterModel");
const rm = require("../utils/readingModel");
const sm = require("../utils/statusModel");
const tm = require("../utils/trafoModel");

const uploadDir = path.join(__dirname, "..", "public", "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) =>
      cb(null, "trafo-" + Date.now() + "-" + Math.round(Math.random() * 1e9) + path.extname(file.originalname)),
  }),
});

// Kolom transformer_data yang boleh diubah dari web (allowlist, bukan dari body).
const EDITABLE_TD = [
  "trafoSerialNo", "ratedPower", "ratedHighVoltage", "ratedLowVoltage", "ratedCurrentHighVoltage", "ratedCurrentLowVoltage",
  "frequency", "vectorGroup", "phase", "tapType", "impedance", "noLoadLoss", "fullLoadLoss",
  "tapPercentagePlus", "tapPercentageMinus", "tapNumberPlus", "tapNumberMinus",
  "topOilHv", "topOilLv", "gradientHv", "gradientLv", "windTempHv", "windTempLv", "losses", "hotspotFactor",
  "ctRatio", "coolingMode", "SuddenPressure", "latitude", "longitude", "intervalDelay", "krated", "productionStatus",
];

const HARMONIC_ORDERS = [
  "1st", "3rd", "5th", "7th", "9th", "11th", "13th", "15th", "17th", "19th", "21th", "23th", "25th", "27th", "29th", "31th",
];

router.use(async (req, res, next) => {
  const dbName = req.headers["x-db-name"];
  if (!dbName) return res.status(400).json({ error: "Missing X-DB-Name header" });
  try {
    req.dbName = dbName;
    req.db = await getDbConnection(dbName);
    next();
  } catch (e) {
    res.status(500).json({ error: "Database tidak bisa diakses: " + e.message });
  }
});

const trafoIdParam = (req) => parseInt(req.params.id, 10);

// Harus didaftarkan sebelum /:id supaya "company-info" tidak dibaca sebagai id.
router.get("/company-info", async (req, res) => {
  try {
    const c = await getCompanyByDb(await getMasterDb(), req.dbName);
    // company_key adalah kredensial Raspi; hanya pengelola yang boleh melihatnya.
    const canSeeKey = ["admin", "superuser"].includes(String(req.user?.role || "").toLowerCase());
    res.json({
      success: true,
      nama_perusahaan: c ? c.company_name : req.dbName,
      nama_db: req.dbName,
      company_key: c && canSeeKey ? c.company_key : null,
      tmu_version: c ? c.tmu_version : null,
    });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/", async (req, res) => {
  try {
    res.json(await tm.listTrafos(req.db));
  } catch (error) {
    console.error("Error fetching all trafos:", error);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const list = await tm.listTrafos(req.db);
    const t = list.find((x) => x.id === trafoIdParam(req));
    if (!t) return res.status(404).json({ error: "Trafo not found in db" });
    res.json(t);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

// ---------- nama kustom dan foto (tabel trafo) ----------

router.put("/:id/name", async (req, res) => {
  const name = String(req.body?.name || "").trim();
  if (!name) return res.status(400).json({ error: "Name is required" });
  try {
    await req.db.execute(
      "INSERT INTO trafo (id, nama) VALUES (?, ?) ON DUPLICATE KEY UPDATE nama = VALUES(nama)",
      [trafoIdParam(req), name],
    );
    res.json({ success: true, message: "Name updated successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/:id/image", upload.single("image"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No image uploaded" });
  try {
    const imageUrl = await uploadToCloudinary(req.file);
    await req.db.execute(
      "INSERT INTO trafo (id, image_url) VALUES (?, ?) ON DUPLICATE KEY UPDATE image_url = VALUES(image_url)",
      [trafoIdParam(req), imageUrl],
    );
    res.json({ success: true, imageUrl, message: "Image uploaded to Cloudinary successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/:id/image", async (req, res) => {
  try {
    await req.db.execute("UPDATE trafo SET image_url = NULL WHERE id = ?", [trafoIdParam(req)]);
    res.json({ success: true, message: "Image reset successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ---------- nameplate (transformer_data) ----------

router.get("/:id/data", async (req, res) => {
  try {
    const td = await tm.getTransformerData(req.db, trafoIdParam(req));
    if (!td) return res.status(404).json({ error: "transformer_data tidak ditemukan" });
    res.json({ success: true, data: td, editable: EDITABLE_TD });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/:id/data", requireRole("admin", "superuser"), async (req, res) => {
  const trafoId = trafoIdParam(req);
  const body = req.body || {};
  const keys = Object.keys(body).filter((k) => EDITABLE_TD.includes(k));
  if (keys.length === 0) return res.status(400).json({ error: "Tidak ada kolom nameplate yang valid" });
  try {
    const before = await tm.getTransformerData(req.db, trafoId);
    if (!before) return res.status(404).json({ error: "transformer_data tidak ditemukan" });

    const sets = keys.map((k) => `\`${k}\` = ?`).join(", ");
    const values = keys.map((k) => (body[k] === "" ? null : body[k]));
    await req.db.execute(`UPDATE transformer_data SET ${sets} WHERE trafoId = ?`, [...values, trafoId]);

    const after = await tm.getTransformerData(req.db, trafoId);
    const pushed = sendToRaspi(after.raspiSerialNo, { type: "updateSyncTransformerDataFromServer", data: after });

    const master = await getMasterDb();
    const company = await getCompanyByDb(master, req.dbName);
    logActivity(master, {
      userId: req.user.id, companyId: company?.company_id, username: req.user.username,
      type: "TRANSFORMER_DATA_UPDATE", description: `Ubah nameplate trafo ${trafoId}`, module: "transformer-data",
      trafoId, trafoSerialNo: after.trafoSerialNo,
      oldValue: Object.fromEntries(keys.map((k) => [k, before[k]])),
      newValue: Object.fromEntries(keys.map((k) => [k, after[k]])),
      ip: req.ip, userAgent: req.headers["user-agent"],
    });
    res.json({ success: true, data: after, pushed });
  } catch (error) {
    res.status(500).json({ error: "Server error", details: error.message });
  }
});

// ---------- status per parameter + rekomendasi ----------

router.get("/:id/status", async (req, res) => {
  const trafoId = trafoIdParam(req);
  try {
    const [row, trip, recs] = await Promise.all([
      tm.getStatusRow(req.db, trafoId),
      tm.getTripStatusRow(req.db, trafoId),
      tm.getRecommendations(await getMasterDb()),
    ]);
    const tripActive = trip ? sm.STATUS_COLUMNS.filter((c) => Number(trip[c]) === 1) : [];
    res.json({ success: true, ...sm.buildStatusItems(row, recs), tripActive });
  } catch (error) {
    res.status(500).json({ error: "Server error", details: error.message });
  }
});

// ---------- panel Physical: tap, oil level, pressure, gas fault, sudden pressure ----------

router.get("/:id/physical", async (req, res) => {
  const trafoId = trafoIdParam(req);
  try {
    const [td, status, latest] = await Promise.all([
      tm.getTransformerData(req.db, trafoId),
      tm.getStatusRow(req.db, trafoId),
      rm.getLatest(req.db, trafoId),
    ]);
    const LOG_COLS = "failure_id, time_start, duration, failure_type, parameter, parameterValue";
    const [gas] = await req.db.execute(
      `SELECT ${LOG_COLS} FROM failure_log WHERE trafoId = ? AND (failure_type LIKE '%Gas%' OR parameter = 'GasFault') ORDER BY time_start DESC LIMIT 1`,
      [trafoId],
    );
    const [sudden] = await req.db.execute(
      `SELECT ${LOG_COLS} FROM failure_log WHERE trafoId = ? AND (failure_type LIKE '%Sudden%' OR parameter = 'SuddenPressure') ORDER BY time_start DESC LIMIT 1`,
      [trafoId],
    );
    const oilCode = sm.normalizeCode(status && status.OilLevel);
    const pressCode = sm.normalizeCode(status && status.Pressure);
    res.json({
      success: true,
      tap: {
        type: td ? td.tapType : null,
        position: td && td.tapType === "OCTC" ? td.impedance : null,
        plus: td ? td.tapNumberPlus : null,
        minus: td ? td.tapNumberMinus : null,
      },
      oilLevel: { code: oilCode, label: sm.STATUS_LABELS[oilCode], level: sm.levelOf(oilCode), raw: latest ? latest.oilLevelRaw : null },
      pressure: { value: latest ? latest.oil_pressure : null, code: pressCode, level: sm.pressureLevel(pressCode), reference: 0.5 },
      gasFault: gas[0] || null,
      suddenPressure: { flag: td ? td.SuddenPressure : null, lastLog: sudden[0] || null },
      timestamp: latest ? latest.timestamp : null,
    });
  } catch (error) {
    res.status(500).json({ error: "Server error", details: error.message });
  }
});

// Kolom oil quality tidak ada di dump base_tmu; balas available:false kalau memang tidak ada.
router.get("/:id/oil-quality", async (req, res) => {
  try {
    const [rows] = await req.db.execute(
      "SELECT waterActivity, oilBDV, oilCondition FROM transformer_data WHERE trafoId = ?",
      [trafoIdParam(req)],
    );
    const r = rows[0] || {};
    res.json({
      success: true, available: true,
      waterActivity: r.waterActivity ?? null, oilBDV: r.oilBDV ?? null, oilCondition: r.oilCondition ?? null,
    });
  } catch (error) {
    if (error.code === "ER_BAD_FIELD_ERROR") return res.json({ success: true, available: false });
    res.status(500).json({ error: "Server error", details: error.message });
  }
});

router.get("/:id/harmonics", async (req, res) => {
  const type = req.query.type === "current" ? "current" : "voltage";
  const table = type === "current" ? "temp_current_harmonic" : "temp_voltage_harmonic";
  try {
    const cols = HARMONIC_ORDERS.map((o) => `\`${o}\``).join(", ");
    const [rows] = await req.db.query(`SELECT Phase, ${cols} FROM ${table} WHERE trafoId = ? ORDER BY Phase ASC`, [
      trafoIdParam(req),
    ]);
    res.json({
      success: true,
      type,
      orders: HARMONIC_ORDERS,
      data: rows.map((r) => ({
        phase: r.Phase,
        orders: Object.fromEntries(HARMONIC_ORDERS.map((o) => [o, rm.toNumber(r[o]) ?? 0])),
      })),
    });
  } catch (error) {
    res.status(500).json({ error: "Server error", details: error.message });
  }
});

module.exports = router;
