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
      userId: req.user.id, 
      companyId: req.company.company_id, 
      username: req.user.username,
      type: "USER_CREATE", 
      description: `Created user ${username}`, 
      module: "Users",
      newValue: { username, role: status === 9 ? "superuser" : "user", email, phone: nomor_telpon },
      ip: req.ip || req.headers["x-forwarded-for"],
      userAgent: req.headers["user-agent"],
    });
    res.status(201).json({ message: "user berhasil dibuat!" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/activity-logs", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let query = `
      SELECT log_id, user_id, company_id, username, activity_type, activity_description, 
             module, trafo_id, trafo_serial_no, old_value, new_value, ip_address, user_agent, created_at 
      FROM user_activity_log 
      WHERE (company_id = ? OR company_id = 0 OR company_id IS NULL)
    `;
    const params = [req.company?.company_id || req.user?.companyId || 1];
    if (startDate) {
      query += ` AND created_at >= ?`;
      params.push(`${startDate} 00:00:00`);
    }
    if (endDate) {
      query += ` AND created_at <= ?`;
      params.push(`${endDate} 23:59:59`);
    }
    query += ` ORDER BY log_id DESC LIMIT 1000`;

    const [rows] = await req.masterDb.execute(query, params);
    res.json({ success: true, logs: rows });
  } catch (error) {
    console.error("Failed to fetch activity logs:", error);
    res.status(500).json({ error: "Server error: " + error.message });
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

    logActivity(req.masterDb, {
      userId: req.user.id,
      companyId: req.company.company_id,
      username: req.user.username,
      type: "USER_UPDATE",
      description: `Updated password for user ${req.params.username}`,
      module: "Users",
      newValue: { username: req.params.username, passwordChanged: true },
      ip: req.ip || req.headers["x-forwarded-for"],
      userAgent: req.headers["user-agent"],
    });

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

    logActivity(req.masterDb, {
      userId: req.user.id,
      companyId: req.company.company_id,
      username: req.user.username,
      type: "USER_UPDATE",
      description: `Updated user ${req.params.username}`,
      module: "Users",
      newValue: { username: req.params.username, role, email, phone: nomor_telpon },
      ip: req.ip || req.headers["x-forwarded-for"],
      userAgent: req.headers["user-agent"],
    });

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
      userId: req.user.id,
      companyId: req.company.company_id,
      username: req.user.username,
      type: "USER_DELETE",
      description: `Deleted user ${req.params.username}`,
      module: "Users",
      ip: req.ip || req.headers["x-forwarded-for"],
      userAgent: req.headers["user-agent"],
    });
    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
