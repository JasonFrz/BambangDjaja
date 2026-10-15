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

// ---------- nama kustom dan foto (tabel transformer_data) ----------

router.put("/:id/name", requireRole("admin", "superuser"), async (req, res) => {
  const name = String(req.body?.name || "").trim();
  if (!name) return res.status(400).json({ error: "Name is required" });
  try {
    const trafoId = trafoIdParam(req);
    const before = await tm.getTransformerData(req.db, trafoId);
    await req.db.execute(
      "UPDATE transformer_data SET trafoSerialNo = ? WHERE trafoId = ?",
      [name, trafoId],
    );
    const master = await getMasterDb();
    const company = await getCompanyByDb(master, req.dbName);
    logActivity(master, {
      userId: req.user.id,
      companyId: company?.company_id,
      username: req.user.username,
      type: "UPDATE_TRANSFORMER_DATA",
      description: `Updated transformer name for ${name}`,
      module: "Transformer Data",
      trafoId,
      trafoSerialNo: name,
      oldValue: before ? { trafoSerialNo: before.trafoSerialNo } : null,
      newValue: { trafoSerialNo: name },
      ip: req.ip || req.headers["x-forwarded-for"],
      userAgent: req.headers["user-agent"],
    });
    res.json({ success: true, message: "Name updated successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/:id/image", requireRole("admin", "superuser"), upload.single("image"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No image uploaded" });
  try {
    const imageUrl = await uploadToCloudinary(req.file);
    await req.db.execute(
      "UPDATE transformer_data SET imageFileName = ? WHERE trafoId = ?",
      [imageUrl, trafoIdParam(req)],
    );
    res.json({ success: true, imageFileName: imageUrl, imageUrl, message: "Image uploaded to Cloudinary successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/:id/image", requireRole("admin", "superuser"), async (req, res) => {
  try {
    await req.db.execute("UPDATE transformer_data SET imageFileName = NULL WHERE trafoId = ?", [trafoIdParam(req)]);
    res.json({ success: true, message: "Image reset successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ---------- instantaneous report ----------

router.get("/:id/instantaneous", async (req, res) => {
  const trafoId = trafoIdParam(req);
  try {
    const [td, statusRow, tripRow] = await Promise.all([
      tm.getTransformerData(req.db, trafoId),
      tm.getStatusRow(req.db, trafoId),
      tm.getTripStatusRow(req.db, trafoId),
    ]);
    if (!td) return res.status(404).json({ error: "Transformer not found" });

    let [readings] = await req.db.query(
      "SELECT * FROM temp_reading_data_realtime WHERE trafoId = ? ORDER BY timestamp DESC, data_id DESC LIMIT 1",
      [trafoId]
    );
    if (!readings || readings.length === 0) {
      [readings] = await req.db.query(
        "SELECT * FROM reading_data WHERE trafoId = ? ORDER BY timestamp DESC, data_id DESC LIMIT 1",
        [trafoId]
      );
    }
    if (!readings || readings.length === 0) {
      [readings] = await req.db.query(
        "SELECT * FROM temp_instantaneous_report_data ORDER BY timestamp DESC LIMIT 1"
      );
    }

    const r = readings && readings[0] ? readings[0] : {};

    let overallStatus = "SAFE";
    if (statusRow) {
      const vals = Object.values(statusRow);
      if (vals.some((v) => v === 1 || v === 2)) {
        overallStatus = "ALARM";
      }
    }
    if (tripRow) {
      const vals = Object.values(tripRow);
      if (vals.some((v) => v === 1)) {
        overallStatus = "TRIP";
      }
    }

    const powerQuality = [
      { param: "THDV1", label: "THD Voltage Phase 1", value: r.THDV1 ?? null, unit: "%" },
      { param: "THDV2", label: "THD Voltage Phase 2", value: r.THDV2 ?? null, unit: "%" },
      { param: "THDV3", label: "THD Voltage Phase 3", value: r.THDV3 ?? null, unit: "%" },
      { param: "THDI1", label: "THD Current Phase 1", value: r.THDI1 ?? null, unit: "%" },
      { param: "THDI2", label: "THD Current Phase 2", value: r.THDI2 ?? null, unit: "%" },
      { param: "THDI3", label: "THD Current Phase 3", value: r.THDI3 ?? null, unit: "%" },
      { param: "Pa", label: "Active Power Phase A", value: r.Pa ?? null, unit: "W" },
      { param: "Pb", label: "Active Power Phase B", value: r.Pb ?? null, unit: "W" },
      { param: "Pc", label: "Active Power Phase C", value: r.Pc ?? null, unit: "W" },
      { param: "Psig", label: "Total Active Power (Σ)", value: r.Psig ?? null, unit: "W" },
      { param: "Qa", label: "Reactive Power Phase A", value: r.Qa ?? null, unit: "VAR" },
      { param: "Qb", label: "Reactive Power Phase B", value: r.Qb ?? null, unit: "VAR" },
      { param: "Qc", label: "Reactive Power Phase C", value: r.Qc ?? null, unit: "VAR" },
      { param: "Qsig", label: "Total Reactive Power (Σ)", value: r.Qsig ?? null, unit: "VAR" },
      { param: "Sa", label: "Apparent Power Phase A", value: r.Sa ?? null, unit: "VA" },
      { param: "Sb", label: "Apparent Power Phase B", value: r.Sb ?? null, unit: "VA" },
      { param: "Sc", label: "Apparent Power Phase C", value: r.Sc ?? null, unit: "VA" },
      { param: "Ssig", label: "Total Apparent Power (Σ)", value: r.Ssig ?? null, unit: "VA" },
      { param: "PFa", label: "Power Factor Phase A", value: r.PFa ?? null, unit: "" },
      { param: "PFb", label: "Power Factor Phase B", value: r.PFb ?? null, unit: "" },
      { param: "PFc", label: "Power Factor Phase C", value: r.PFc ?? null, unit: "" },
      { param: "PFsig", label: "Total Power Factor", value: r.PFsig ?? null, unit: "" },
      { param: "KRateda", label: "K-Factor Phase A", value: r.KRateda ?? null, unit: "" },
      { param: "KRatedb", label: "K-Factor Phase B", value: r.KRatedb ?? null, unit: "" },
      { param: "KRatedc", label: "K-Factor Phase C", value: r.KRatedc ?? null, unit: "" },
      { param: "deRatinga", label: "De-Rating Phase A", value: r.deRatinga ?? null, unit: "%" },
      { param: "deRatingb", label: "De-Rating Phase B", value: r.deRatingb ?? null, unit: "%" },
      { param: "deRatingc", label: "De-Rating Phase C", value: r.deRatingc ?? null, unit: "%" },
    ];

    const electrical = [
      { param: "Van", label: "Voltage Phase-Neutral A-N", value: r.Van ?? null, unit: "V" },
      { param: "Vbn", label: "Voltage Phase-Neutral B-N", value: r.Vbn ?? null, unit: "V" },
      { param: "Vcn", label: "Voltage Phase-Neutral C-N", value: r.Vcn ?? null, unit: "V" },
      { param: "Vab", label: "Voltage Phase-Phase A-B", value: r.Vab ?? null, unit: "V" },
      { param: "Vbc", label: "Voltage Phase-Phase B-C", value: r.Vbc ?? null, unit: "V" },
      { param: "Vca", label: "Voltage Phase-Phase C-A", value: r.Vca ?? null, unit: "V" },
      { param: "Ia", label: "Current Phase A", value: r.Ia ?? null, unit: "A" },
      { param: "Ib", label: "Current Phase B", value: r.Ib ?? null, unit: "A" },
      { param: "Ic", label: "Current Phase C", value: r.Ic ?? null, unit: "A" },
      { param: "Iavg", label: "Average Current", value: r.Iavg ?? null, unit: "A" },
      { param: "Ineutral", label: "Neutral Current", value: r.Ineutral ?? null, unit: "A" },
      { param: "THDV1", label: "THD Voltage Phase 1", value: r.THDV1 ?? null, unit: "%" },
      { param: "THDV2", label: "THD Voltage Phase 2", value: r.THDV2 ?? null, unit: "%" },
      { param: "THDV3", label: "THD Voltage Phase 3", value: r.THDV3 ?? null, unit: "%" },
      { param: "THDI1", label: "THD Current Phase 1", value: r.THDI1 ?? null, unit: "%" },
      { param: "THDI2", label: "THD Current Phase 2", value: r.THDI2 ?? null, unit: "%" },
      { param: "THDI3", label: "THD Current Phase 3", value: r.THDI3 ?? null, unit: "%" },
      { param: "kWhInp", label: "Active Energy In", value: r.kWhInp ?? 0, unit: "kWh" },
      { param: "kWhOut", label: "Active Energy Out", value: r.kWhOut ?? r.kWh ?? null, unit: "kWh" },
      { param: "kVARhInp", label: "Reactive Energy In", value: r.kVARhInp ?? 0, unit: "kVARh" },
      { param: "kVARhOut", label: "Reactive Energy Out", value: r.kVARhOut ?? r.kVARh ?? null, unit: "kVARh" },
    ];

    const physical = [
      { param: "BusTemp1", label: "Busbar Temp Phase 1", value: r.BusTemp1 ?? null, unit: "°C" },
      { param: "BusTemp2", label: "Busbar Temp Phase 2", value: r.BusTemp2 ?? null, unit: "°C" },
      { param: "BusTemp3", label: "Busbar Temp Phase 3", value: r.BusTemp3 ?? null, unit: "°C" },
      { param: "OilTemp", label: "Top Oil Temperature", value: r.OilTemp ?? null, unit: "°C" },
      { param: "WTITemp1", label: "WTI Temp Phase 1", value: r.WTITemp1 ?? null, unit: "°C" },
      { param: "WTITemp2", label: "WTI Temp Phase 2", value: r.WTITemp2 ?? null, unit: "°C" },
      { param: "WTITemp3", label: "WTI Temp Phase 3", value: r.WTITemp3 ?? null, unit: "°C" },
      { param: "Pressure", label: "Tank Pressure", value: r.Press ?? r.Pressure ?? null, unit: "Bar" },
    ];

    res.json({
      success: true,
      trafo: {
        id: td.trafoId,
        serial_no: td.trafoSerialNo,
        name: td.trafoSerialNo,
        device_serial: td.raspiSerialNo,
        lastSync: r.timestamp || td.lastSyncTimestamp,
        overallStatus,
      },
      categories: {
        powerQuality,
        electrical,
        physical,
      },
      raw: r,
    });
  } catch (error) {
    console.error("Instantaneous report error:", error);
    res.status(500).json({ error: "Server error generating instantaneous report" });
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
    const pushed = sendToRaspi(after.raspiSerialNo, { type: "updateSyncTransformerDataFromServer", data: after }, req.dbName);

    const master = await getMasterDb();
    const company = await getCompanyByDb(master, req.dbName);
    logActivity(master, {
      userId: req.user.id,
      companyId: company?.company_id,
      username: req.user.username,
      type: "UPDATE_TRANSFORMER_DATA",
      description: `Updated transformer data for ${after.trafoSerialNo || trafoId}`,
      module: "Transformer Data",
      trafoId,
      trafoSerialNo: after.trafoSerialNo,
      oldValue: before,
      newValue: after,
      ip: req.ip || req.headers["x-forwarded-for"],
      userAgent: req.headers["user-agent"],
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
    // hasStatus=false: Raspi belum pernah mengirim transformer_status; frontend menampilkan 'belum ada data'.
    res.json({ success: true, hasStatus: !!row, ...sm.buildStatusItems(row, recs), tripActive });
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
        display: sm.tapDisplay(td),
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
