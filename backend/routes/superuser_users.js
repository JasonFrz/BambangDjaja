const express = require("express");
const router = express.Router();
const { getMasterDb } = require("../utils/db");
const { requireRole } = require("../utils/authMiddleware");
const { makeSalt, hashPassword } = require("../utils/userAuth");
const { listUsersByCompany } = require("../utils/masterModel");
const { logActivity } = require("../utils/activityLog");
const formatPhoneNumber = require("../utils/phoneFormatter");

router.use(requireRole("superuser"), async (req, res, next) => {
  try {
    req.masterDb = await getMasterDb();
    next();
  } catch (e) {
    res.status(500).json({ error: "Server error: " + e.message });
  }
});

const FIELD_LABEL = { username: "Username", phone: "Phone number", email: "Email" };

// null kalau unik, atau pesan error kalau nilai sudah dipakai user lain.
async function assertUnique(masterDb, field, value, exceptId = null) {
  if (!value || value === "-") return null;
  const [rows] = await masterDb.execute(
    `SELECT user_id FROM user WHERE ${field} = ?${exceptId ? " AND user_id != ?" : ""} LIMIT 1`,
    exceptId ? [value, exceptId] : [value],
  );
  return rows.length > 0 ? `${FIELD_LABEL[field]} is already used by another user` : null;
}

router.get("/activity-logs", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let query = `
      SELECT log_id, user_id, company_id, username, activity_type, activity_description, 
             module, trafo_id, trafo_serial_no, old_value, new_value, ip_address, user_agent, created_at 
      FROM user_activity_log 
      WHERE (company_id = ? OR company_id = 0 OR company_id IS NULL)
    `;
    const params = [req.user.companyId || 1];
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

router.post("/", async (req, res) => {
  try {
    let { username, password, nomor_telpon, email, role } = req.body || {};
    if (!username || !password || !nomor_telpon || !email) {
      return res.status(400).json({ error: "Username, password, nomor telepon, dan email wajib diisi" });
    }
    nomor_telpon = formatPhoneNumber(nomor_telpon);
    for (const [f, v] of [["username", username], ["phone", nomor_telpon], ["email", email]]) {
      const err = await assertUnique(req.masterDb, f, v);
      if (err) return res.status(400).json({ error: err });
    }
    const salt = makeSalt();
    const status = role === "superuser" ? 9 : 2;
    await req.masterDb.execute(
      "INSERT INTO user (username, password, role, salt, company_id, status, email, phone) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [username, hashPassword(password, salt), status, salt, req.user.companyId, status, email, nomor_telpon],
    );

    logActivity(req.masterDb, {
      userId: req.user.id,
      companyId: req.user.companyId,
      username: req.user.username,
      type: "USER_CREATE",
      description: `Created user ${username}`,
      module: "Users",
      newValue: { username, role: status === 9 ? "superuser" : "user", email, phone: nomor_telpon },
      ip: req.ip || req.headers["x-forwarded-for"],
      userAgent: req.headers["user-agent"],
    });

    res.status(201).json({ message: "User created successfully!" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error: " + error.message });
  }
});

router.get("/", async (req, res) => {
  try {
    res.json(await listUsersByCompany(req.masterDb, req.user.companyId, { excludeAdmin: true }));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error: " + error.message });
  }
});

router.put("/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  let { username, password, nomor_telpon, email, role } = req.body || {};
  if (!nomor_telpon || !email) return res.status(400).json({ error: "Nomor telepon dan email wajib diisi" });
  nomor_telpon = formatPhoneNumber(nomor_telpon);

  try {
    const [existing] = await req.masterDb.execute(
      "SELECT user_id, username FROM user WHERE user_id = ? AND status != 1 AND company_id = ? LIMIT 1",
      [id, req.user.companyId],
    );
    if (existing.length === 0) return res.status(404).json({ error: "User not found in your company" });

    for (const [f, v] of [["username", username], ["phone", nomor_telpon], ["email", email]]) {
      const err = await assertUnique(req.masterDb, f, v, id);
      if (err) return res.status(400).json({ error: err });
    }

    const updates = ["phone = ?", "email = ?"];
    const params = [nomor_telpon, email];
    if (username !== undefined) {
      updates.push("username = ?");
      params.push(username);
    }
    if (role !== undefined) {
      const s = role === "superuser" ? 9 : 2;
      updates.push("status = ?, role = ?");
      params.push(s, s);
    }
    if (password) {
      const salt = makeSalt();
      updates.push("password = ?, salt = ?");
      params.push(hashPassword(password, salt), salt);
    }
    params.push(id, req.user.companyId);
    await req.masterDb.execute(
      `UPDATE user SET ${updates.join(", ")} WHERE user_id = ? AND company_id = ?`,
      params,
    );

    logActivity(req.masterDb, {
      userId: req.user.id,
      companyId: req.user.companyId,
      username: req.user.username,
      type: "USER_UPDATE",
      description: `Updated user ${username || existing[0]?.username || id}`,
      module: "Users",
      newValue: { id, username: username || existing[0]?.username, role, email, phone: nomor_telpon, passwordChanged: !!password },
      ip: req.ip || req.headers["x-forwarded-for"],
      userAgent: req.headers["user-agent"],
    });

    res.json({ message: "User updated successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error: " + error.message });
  }
});

router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    const [existing] = await req.masterDb.execute(
      "SELECT user_id, username FROM user WHERE user_id = ? AND status != 1 AND company_id = ? LIMIT 1",
      [id, req.user.companyId],
    );

    const [r] = await req.masterDb.execute(
      "DELETE FROM user WHERE user_id = ? AND status != 1 AND company_id = ?",
      [id, req.user.companyId],
    );
    if (r.affectedRows === 0) return res.status(404).json({ error: "User not found in your company" });

    logActivity(req.masterDb, {
      userId: req.user.id,
      companyId: req.user.companyId,
      username: req.user.username,
      type: "USER_DELETE",
      description: `Deleted user ${existing[0]?.username || id}`,
      module: "Users",
      ip: req.ip || req.headers["x-forwarded-for"],
      userAgent: req.headers["user-agent"],
    });

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error: " + error.message });
  }
});

module.exports = router;
