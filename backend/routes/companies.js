const express = require("express");
const router = express.Router();
const path = require("path");
const crypto = require("crypto");
const { getMasterDb, getDbConnection, getAdminPool } = require("../utils/db");
const { requireRole } = require("../utils/authMiddleware");
const { assertValidDbName, createDatabaseFromSql } = require("../utils/sqlTemplate");
const { patchCompanyDb } = require("../utils/schemaPatch");
const { sendTelegramMessage, parseTelegramConfig } = require("../utils/telegramClient");

// Template skema perusahaan: dump base_tmu di root repo.
const TEMPLATE_SQL = path.join(__dirname, "..", "..", "base_tmu.sql");

router.use(requireRole("admin"), (req, res, next) => {
  if (req.headers["x-super-admin"] !== "true") {
    return res.status(401).json({ error: "Unauthorized. Super admin access required." });
  }
  next();
});

function formatCompany(c) {
  return {
    id: c.company_id,
    nama_perusahaan: c.company_name,
    nama_db: c.database_name,
    company_key: c.company_key,
    tmu_version: c.tmu_version,
    telegram_api_token: c.telegram_api_token,
    telegram_chat_id: c.telegram_chat_id,
    status: c.status,
    trafos: [],
  };
}

router.get("/", async (req, res) => {
  try {
    const master = await getMasterDb();
    const [rows] = await master.execute("SELECT * FROM company ORDER BY company_id DESC");
    const companies = rows.map(formatCompany);
    await Promise.all(
      companies.map(async (c) => {
        if (!c.nama_db) return;
        try {
          const db = await getDbConnection(c.nama_db);
          const [trafos] = await db.query(
            `SELECT td.trafoId AS id, COALESCE(t.nama, td.trafoSerialNo, CONCAT('Trafo ', td.trafoId)) AS nama
             FROM transformer_data td LEFT JOIN trafo t ON t.id = td.trafoId ORDER BY td.trafoId`,
          );
          c.trafos = trafos;
        } catch (e) {
          console.error(`Could not fetch trafos for db ${c.nama_db}:`, e.message);
        }
      }),
    );
    res.json({ success: true, data: companies });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch companies" });
  }
});

router.post("/", async (req, res) => {
  const { nama_perusahaan, nama_db, tmu_version } = req.body || {};
  if (!nama_perusahaan) return res.status(400).json({ error: "Company Name is required" });
  if (!nama_db) return res.status(400).json({ error: "Database name is required" });
  const tg = parseTelegramConfig(req.body);
  if (tg.error) return res.status(400).json({ error: tg.error });
  try {
    assertValidDbName(nama_db);
    const master = await getMasterDb();
    const [dup] = await master.execute(
      "SELECT company_id FROM company WHERE company_name = ? OR database_name = ? LIMIT 1",
      [nama_perusahaan, nama_db],
    );
    if (dup.length > 0) {
      return res.status(400).json({ error: "Company name or database already used by another company" });
    }

    await createDatabaseFromSql(nama_db, TEMPLATE_SQL);
    await patchCompanyDb(await getDbConnection(nama_db));

    // company_key dipasang di Raspi (companyKey pada pesan createConnection).
    const companyKey = crypto.randomBytes(16).toString("hex");
    await master.execute(
      "INSERT INTO company (company_name, database_name, company_key, status, tmu_version, telegram_api_token, telegram_chat_id) VALUES (?, ?, ?, 1, ?, ?, ?)",
      [nama_perusahaan, nama_db, companyKey, parseInt(tmu_version, 10) === 1 ? 1 : 2, tg.config?.token ?? null, tg.config?.chatId ?? null],
    );
    res.json({ success: true, message: "Company created successfully", company_key: companyKey });
  } catch (error) {
    console.error("Error creating company:", error);
    res.status(500).json({ error: "Failed to create company", details: error.message });
  }
});

router.put("/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { nama_perusahaan, nama_db, tmu_version } = req.body || {};
  if (!nama_perusahaan) return res.status(400).json({ error: "Company Name is required" });
  const tg = parseTelegramConfig(req.body);
  if (tg.error) return res.status(400).json({ error: tg.error });
  try {
    const master = await getMasterDb();
    const [dup] = await master.execute(
      "SELECT company_id FROM company WHERE company_name = ? AND company_id != ? LIMIT 1",
      [nama_perusahaan, id],
    );
    if (dup.length > 0) return res.status(400).json({ error: "Company Name already used by another company" });
    const updates = ["company_name = ?"];
    const params = [nama_perusahaan];
    if (nama_db !== undefined) {
      assertValidDbName(nama_db);
      updates.push("database_name = ?");
      params.push(nama_db);
    }
    if (tmu_version !== undefined) {
      updates.push("tmu_version = ?");
      params.push(parseInt(tmu_version, 10) === 1 ? 1 : 2);
    }
    if (tg.config) {
      updates.push("telegram_api_token = ?", "telegram_chat_id = ?");
      params.push(tg.config.token, tg.config.chatId);
    }
    params.push(id);
    await master.execute(`UPDATE company SET ${updates.join(", ")} WHERE company_id = ?`, params);
    res.json({ success: true, message: "Company updated successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to update company", details: error.message });
  }
});

// Uji bot + chat dari isian form (belum perlu disimpan) sebelum dipakai untuk alert.
router.post("/telegram-test", async (req, res) => {
  const tg = parseTelegramConfig(req.body);
  if (tg.error) return res.status(400).json({ error: tg.error });
  if (!tg.config?.token) return res.status(400).json({ error: "Bot Token dan Chat ID Telegram wajib diisi." });
  try {
    await sendTelegramMessage(
      tg.config.token,
      tg.config.chatId,
      "🔔 <b>[TEST NOTIFIKASI TMU]</b>\n\nBot Telegram terhubung. Alert trafo perusahaan ini akan dikirim ke chat ini.\n\n<i>Pesan otomatis dari PT. Bambang Djaja - TMU System</i>",
    );
    res.json({ success: true, message: "Pesan uji Telegram terkirim." });
  } catch (error) {
    res.status(502).json({ error: `Telegram menolak: ${error.message}` });
  }
});

router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    const master = await getMasterDb();
    const [[company]] = await master.execute("SELECT database_name FROM company WHERE company_id = ?", [id]);
    if (company && company.database_name) {
      try {
        assertValidDbName(company.database_name);
        const adminPool = await getAdminPool();
        await adminPool.query(`DROP DATABASE IF EXISTS \`${company.database_name}\``);
      } catch (dbErr) {
        console.error(`Failed to drop database ${company.database_name}:`, dbErr.message);
      }
    }
    await master.execute("DELETE FROM user WHERE company_id = ?", [id]);
    await master.execute("DELETE FROM company WHERE company_id = ?", [id]);
    res.json({ success: true, message: "Company, its users, and database deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete company and its data" });
  }
});

module.exports = router;
