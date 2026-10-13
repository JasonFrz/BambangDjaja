const express = require("express");
const router = express.Router();
const { getMasterDb } = require("../utils/db");
const { requireRole } = require("../utils/authMiddleware");
const { makeSalt, hashPassword } = require("../utils/userAuth");
const { getCompanyByDb, listUsersByCompany } = require("../utils/masterModel");
const { logActivity } = require("../utils/activityLog");
const formatPhoneNumber = require("../utils/phoneFormatter");

// Menentukan perusahaan yang dikelola: superuser = perusahaannya sendiri,
// admin platform = dari X-DB-Name (lihat authMiddleware).
const resolveCompany = async (req, res, next) => {
  try {
    req.masterDb = await getMasterDb();
    const dbName = req.headers["x-db-name"] || req.user.dbName;
    const company = await getCompanyByDb(req.masterDb, dbName);
    if (!company) {
      return res.status(404).json({ error: `Perusahaan untuk database ${dbName} tidak ditemukan` });
    }
    req.company = company;
    next();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

router.use(requireRole("admin", "superuser"), resolveCompany);

// superuser hanya boleh membuat superuser (9) atau user biasa (2), tidak pernah admin platform.
const statusForNewUser = (role) => (role === "superuser" ? 9 : 2);

router.post("/", async (req, res) => {
  try {
    let { username, password, role, nomor_telpon, email } = req.body || {};
    if (!username || !password || !nomor_telpon || !email) {
      return res.status(400).json({ error: "Username, password, nomor telepon, dan email wajib diisi" });
    }
    nomor_telpon = formatPhoneNumber(nomor_telpon);

    const [existing] = await req.masterDb.execute("SELECT user_id FROM user WHERE username = ? LIMIT 1", [username]);
    if (existing.length > 0) return res.status(400).json({ error: "Username already exists" });

    const salt = makeSalt();
    const status = statusForNewUser(role);
    await req.masterDb.execute(
      "INSERT INTO user (username, password, role, salt, company_id, status, email, phone) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [username, hashPassword(password, salt), status, salt, req.company.company_id, status, email, nomor_telpon],
    );
    logActivity(req.masterDb, {
      userId: req.user.id, companyId: req.company.company_id, username: req.user.username,
      type: "USER_CREATE", description: `Membuat user ${username}`, module: "users",
      newValue: { username, role: status === 9 ? "superuser" : "user" },
    });
    res.status(201).json({ message: "user berhasil dibuat!" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/", async (req, res) => {
  try {
    res.json(await listUsersByCompany(req.masterDb, req.company.company_id));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/:username/password", async (req, res) => {
  const { password } = req.body || {};
  if (!password) return res.status(400).json({ error: "New password is required" });
  try {
    const salt = makeSalt();
    const [r] = await req.masterDb.execute(
      "UPDATE user SET password = ?, salt = ? WHERE username = ? AND company_id = ?",
      [hashPassword(password, salt), salt, req.params.username, req.company.company_id],
    );
    if (r.affectedRows === 0) return res.status(404).json({ error: "User not found in your company" });
    res.json({ message: "Password updated successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/:username", async (req, res) => {
  const { role, nomor_telpon, email } = req.body || {};
  try {
    const updates = [];
    const params = [];
    if (role !== undefined) {
      const s = statusForNewUser(role);
      updates.push("status = ?, role = ?");
      params.push(s, s);
    }
    if (nomor_telpon !== undefined) {
      updates.push("phone = ?");
      params.push(formatPhoneNumber(nomor_telpon) || null);
    }
    if (email !== undefined) {
      updates.push("email = ?");
      params.push(email || null);
    }
    if (updates.length === 0) return res.status(400).json({ error: "No fields to update" });

    params.push(req.params.username, req.company.company_id);
    const [r] = await req.masterDb.execute(
      `UPDATE user SET ${updates.join(", ")} WHERE username = ? AND company_id = ?`,
      params,
    );
    if (r.affectedRows === 0) return res.status(404).json({ error: "User not found in your company" });
    res.json({ message: "User updated successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/:username", async (req, res) => {
  try {
    const [r] = await req.masterDb.execute(
      "DELETE FROM user WHERE username = ? AND company_id = ? AND status != 1",
      [req.params.username, req.company.company_id],
    );
    if (r.affectedRows === 0) return res.status(404).json({ error: "User not found in your company" });
    logActivity(req.masterDb, {
      userId: req.user.id, companyId: req.company.company_id, username: req.user.username,
      type: "USER_DELETE", description: `Menghapus user ${req.params.username}`, module: "users",
    });
    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
