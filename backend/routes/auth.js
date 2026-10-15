const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const { getMasterDb, getMasterDbName } = require("../utils/db");
const { verifyPassword, roleFromStatus } = require("../utils/userAuth");
const { logActivity } = require("../utils/activityLog");

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    error:
      "Terlalu banyak percobaan login, Silahkan coba lagi setelah 15 menit",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/login", loginLimiter, async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password)
    return res.status(400).json({ error: "Missing username or password" });

  try {
    const masterDb = await getMasterDb();
    const [rows] = await masterDb.execute(
      `SELECT u.user_id, u.username, u.password, u.salt, u.status, u.company_id, u.email, u.phone, c.company_name, c.database_name, c.tmu_version FROM user u LEFT JOIN company c ON u.company_id = c.company_id WHERE u.username = ? OR u.email = ? OR u.phone = ? LIMIT 1`,
      [username, username, username],
    );
    if (rows.length === 0)
      return res.status(401).json({ error: "username atau password invalid" });
    const user = rows[0];
    const ok = await verifyPassword(password, user.password, user.salt);
    if (!ok)
      return res.status(401).json({ error: "Username atau password invalid" });
    const role = roleFromStatus(user.status);
    const dbName = user.database_name || getMasterDbName();
    const companyName = user.company_name || dbName;
    const payload = {
      id: user.user_id,
      username: user.username,
      role,
      dbName,
      companyId: user.company_id || 0,
      companyName,
      tmuVersion: user.tmu_version || 2,
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: "24h",
    });

    logActivity(masterDb, {
      userId: user.user_id,
      companyId: user.company_id || 0,
      username: user.username,
      type: "LOGIN",
      description: `User ${user.username} login berhasil`,
      module: "Auth",
      ip: req.ip || req.headers["x-forwarded-for"],
      userAgent: req.headers["user-agent"],
    });

    res.json({
      success: true,
      token,
      username: user.username,
      role,
      company_name: companyName,
      nama_perusahaan: companyName,
      db_name: dbName,
      phone: user.phone || "",
      email: user.email || "",
      tmu_version: payload.tmuVersion,
    });
  } catch (error) {
    console.error("login error", error);
    res.status(500).json({ error: "Server error: " + error.message });
  }
});

module.exports = router;
