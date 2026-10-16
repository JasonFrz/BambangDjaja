const express = require("express");
const router = express.Router();
const { getDbConnection, getMasterDb } = require("../utils/db");
const { requireRole } = require("../utils/authMiddleware");
const { sendToRaspi } = require("../utils/raspiWebSocket");
const { logActivity } = require("../utils/activityLog");
const { getCompanyByDb } = require("../utils/masterModel");
const { getTransformerData } = require("../utils/trafoModel");
const {
  SETTINGS_COLUMNS,
  TRIP_COLUMNS,
  buildLimits,
  computeVoltageValues,
} = require("../utils/limitsModel");
const { parsePositiveInt, parseNumericBody } = require("../utils/validate");

router.use(async (req, res, next) => {
  const dbName = req.headers["x-db-name"];
  if (!dbName)
    return res.status(400).json({ error: "Missing X-DB-Name header" });
  try {
    req.dbName = dbName;
    req.db = await getDbConnection(dbName);
    next();
  } catch (e) {
    res
      .status(500)
      .json({ error: "Database tidak bisa diakses: " + e.message });
  }
});

const trafoIdOf = (req) =>
  parseInt(
    req.query.trafo_id || req.params.trafoId || req.headers["x-trafo-id"] || 1,
    10,
  ) || 1;

async function getSettings(db, trafoId) {
  const [rows] = await db.execute(
    "SELECT * FROM transformer_settings WHERE trafoId = ? LIMIT 1",
    [trafoId],
  );
  return rows[0] || null;
}

async function getTrip(db, trafoId) {
  const [rows] = await db.execute(
    "SELECT * FROM trip_settings WHERE trafoId = ? LIMIT 1",
    [trafoId],
  );
  return rows[0] || null;
}

async function writeLog(
  req,
  trafoId,
  type,
  description,
  oldValue,
  newValue,
  moduleName = "Settings",
  trafoSerialNo = null,
) {
  const master = await getMasterDb();
  const company = await getCompanyByDb(master, req.dbName);
  logActivity(master, {
    userId: req.user.id,
    companyId: company?.company_id,
    username: req.user.username,
    type,
    description,
    module: moduleName,
    trafoId,
    trafoSerialNo,
    oldValue,
    newValue,
    ip: req.ip || req.headers["x-forwarded-for"],
    userAgent: req.headers["user-agent"],
  });
}

const pick = (obj, keys) =>
  Object.fromEntries(keys.map((k) => [k, obj ? obj[k] : undefined]));

router.get("/thresholds", async (req, res) => {
  try {
    const trafoId = trafoIdOf(req);
    const [settings, trip] = await Promise.all([
      getSettings(req.db, trafoId),
      getTrip(req.db, trafoId),
    ]);
    res.json({
      success: true,
      trafoId,
      settings,
      trip,
      editable: SETTINGS_COLUMNS,
      tripColumns: TRIP_COLUMNS,
    });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to fetch settings", details: error.message });
  }
});

router.get("/limits", async (req, res) => {
  try {
    const trafoId = trafoIdOf(req);
    const [settings, td] = await Promise.all([
      getSettings(req.db, trafoId),
      getTransformerData(req.db, trafoId),
    ]);
    res.json({ success: true, trafoId, limits: buildLimits(settings, td) });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to build limits", details: error.message });
  }
});

router.put(
  "/thresholds/:trafoId",
  requireRole("admin", "superuser"),
  async (req, res) => {
    // Untuk PUT, trafo hanya dari path (bukan query) supaya tidak salah sasaran.
    const trafoId = parsePositiveInt(req.params.trafoId);
    if (!trafoId) return res.status(400).json({ error: "trafoId tidak valid" });
    const { values, invalid } = parseNumericBody(req.body, SETTINGS_COLUMNS);
    if (invalid.length > 0)
      return res
        .status(400)
        .json({ error: `Nilai bukan angka: ${invalid.join(", ")}` });
    const keys = Object.keys(values);
    if (keys.length === 0)
      return res
        .status(400)
        .json({ error: "Tidak ada kolom threshold yang valid" });
    try {
      const before = await getSettings(req.db, trafoId);
      if (!before)
        return res.status(404).json({
          error: "transformer_settings tidak ditemukan untuk trafo ini",
        });
      const td = await getTransformerData(req.db, trafoId);

      // Gabungkan nilai baru ke baris lama, lalu hitung ulang 4 kolom tegangan absolut.
      const merged = { ...before };
      for (const k of keys) merged[k] = values[k];
      const updates = {
        ...pick(merged, keys),
        ...computeVoltageValues(merged, td && td.ratedLowVoltage),
      };

      const cols = Object.keys(updates);
      await req.db.execute(
        `UPDATE transformer_settings SET ${cols.map((c) => `\`${c}\` = ?`).join(", ")} WHERE trafoId = ?`,
        [...cols.map((c) => updates[c]), trafoId],
      );
      const after = await getSettings(req.db, trafoId);
      const pushed = sendToRaspi(
        td && td.raspiSerialNo,
        { type: "updateSyncTransformerSettingsFromServer", data: after },
        req.dbName,
      );

      const tag =
        req.body?.dataTag ||
        (keys.length > 0
          ? keys[0].includes("tankPressure")
            ? "tankPressure"
            : keys[0].includes("topOil")
              ? "topOil"
              : keys[0].includes("windTemp")
                ? "windTemp"
                : keys[0]
          : "settings");
      await writeLog(
        req,
        trafoId,
        "UPDATE_TRANSFORMER_SETTINGS",
        `Updated transformer settings: ${tag}`,
        pick(before, cols),
        req.body?.dataTag ? req.body : pick(after, cols),
        "Settings",
        td?.trafoSerialNo || null,
      );
      res.json({
        success: true,
        settings: after,
        pushed,
        message: pushed
          ? "Setting updated and pushed to Raspi"
          : "Setting updated (Raspi offline, akan sinkron saat terhubung)",
      });
    } catch (error) {
      res
        .status(500)
        .json({ error: "Failed to update setting", details: error.message });
    }
  },
);

router.put(
  "/trip/:trafoId",
  requireRole("admin", "superuser"),
  async (req, res) => {
    const trafoId = parsePositiveInt(req.params.trafoId);
    if (!trafoId) return res.status(400).json({ error: "trafoId tidak valid" });
    const body = req.body || {};
    const keys = Object.keys(body).filter((k) => TRIP_COLUMNS.includes(k));
    if (keys.length === 0)
      return res.status(400).json({ error: "Tidak ada kolom trip yang valid" });
    const bad = keys.filter((k) => ![0, 1, 2].includes(Number(body[k])));
    if (bad.length > 0)
      return res
        .status(400)
        .json({ error: `Nilai trip harus 0/1/2: ${bad.join(", ")}` });
    try {
      const before = await getTrip(req.db, trafoId);
      if (!before)
        return res
          .status(404)
          .json({ error: "trip_settings tidak ditemukan untuk trafo ini" });
      await req.db.execute(
        `UPDATE trip_settings SET ${keys.map((k) => `\`${k}\` = ?`).join(", ")} WHERE trafoId = ?`,
        [...keys.map((k) => Number(body[k])), trafoId],
      );
      const after = await getTrip(req.db, trafoId);
      const td = await getTransformerData(req.db, trafoId);
      const pushed = sendToRaspi(
        td && td.raspiSerialNo,
        { type: "updateSyncTripSettingsFromServer", data: after },
        req.dbName,
      );
      await writeLog(
        req,
        trafoId,
        "UPDATE_TRIP_SETTINGS",
        "Updated trip settings for transformer",
        pick(before, keys),
        pick(after, keys),
        "Trip Settings",
        td?.trafoSerialNo || null,
      );
      res.json({ success: true, trip: after, pushed });
    } catch (error) {
      res.status(500).json({
        error: "Failed to update trip settings",
        details: error.message,
      });
    }
  },
);

module.exports = router;
