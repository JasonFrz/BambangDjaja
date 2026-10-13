const express = require("express");
const router = express.Router();
const { getAllDatabases, getDbConnection, getAdminPool, getMasterDb, getMasterDbName } = require("../utils/db");
const { requireRole } = require("../utils/authMiddleware");
const { assertValidDbName } = require("../utils/sqlTemplate");
const { makeSalt, hashPassword } = require("../utils/userAuth");
const { USER_SELECT, formatUser } = require("../utils/masterModel");
const formatPhoneNumber = require("../utils/phoneFormatter");

const SYSTEM_DBS = ["information_schema", "mysql", "performance_schema", "sys", "defaultdb"];
const isProtectedDb = (name) => SYSTEM_DBS.includes(name) || name === getMasterDbName();

router.use(requireRole("admin"), (req, res, next) => {
  if (req.headers["x-super-admin"] !== "true") {
    return res.status(401).json({ error: "Unauthorized. Super admin access required." });
  }
  next();
});

// ---------- database ----------

router.get("/databases", async (req, res) => {
  try {
    res.json({ success: true, databases: await getAllDatabases() });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch databases", details: error.message });
  }
});

router.get("/databases/:dbName/tables", async (req, res) => {
  try {
    assertValidDbName(req.params.dbName);
    const pool = await getDbConnection(req.params.dbName);
    const [rows] = await pool.query("SHOW TABLES");
    res.json({ success: true, tables: rows.map((r) => Object.values(r)[0]) });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch tables", details: error.message });
  }
});

router.get("/databases/:dbName/tables/:tableName", async (req, res) => {
  const { dbName, tableName } = req.params;
  const { limit, sort } = req.query;
  try {
    assertValidDbName(dbName);
    assertValidDbName(tableName);
    const pool = await getDbConnection(dbName);
    const [cols] = await pool.query(`SHOW COLUMNS FROM \`${tableName}\``);
    const names = cols.map((c) => c.Field);
    const orderCol = ["id", "timestamp", "created_at", "data_id", "rowId", "trafoId"].find((c) => names.includes(c));
    const orderClause =
      orderCol && (sort === "latest" || sort === "oldest")
        ? `ORDER BY \`${orderCol}\` ${sort === "latest" ? "DESC" : "ASC"}`
        : "";
    const parsed = parseInt(limit, 10);
    const limitClause = limit === "all" ? "" : `LIMIT ${Number.isFinite(parsed) && parsed > 0 ? parsed : 100}`;
    const [rows] = await pool.query(`SELECT * FROM \`${tableName}\` ${orderClause} ${limitClause}`);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch table data", details: error.message });
  }
});

router.put("/databases/:oldDbName", async (req, res) => {
  const { oldDbName } = req.params;
  const newDbName = String(req.body?.newDbName || "").trim();
  if (!newDbName) return res.status(400).json({ error: "New database name is required" });
  if (isProtectedDb(oldDbName) || isProtectedDb(newDbName)) {
    return res.status(403).json({ error: "Cannot rename system database" });
  }
  try {
    assertValidDbName(oldDbName);
    assertValidDbName(newDbName);
    const pool = await getAdminPool();
    const [rows] = await pool.query("SHOW DATABASES LIKE ?", [newDbName]);
    if (rows.length > 0) return res.status(400).json({ error: "Database with new name already exists" });

    await pool.query(`CREATE DATABASE \`${newDbName}\``);
    const [tables] = await pool.query(
      "SELECT TABLE_NAME FROM information_schema.tables WHERE table_schema = ?",
      [oldDbName],
    );
    for (const t of tables) {
      await pool.query(`RENAME TABLE \`${oldDbName}\`.\`${t.TABLE_NAME}\` TO \`${newDbName}\`.\`${t.TABLE_NAME}\``);
    }
    await pool.query(`DROP DATABASE \`${oldDbName}\``);
    const master = await getMasterDb();
    await master.execute("UPDATE company SET database_name = ? WHERE database_name = ?", [newDbName, oldDbName]);
    res.json({ success: true, message: `Database successfully renamed to ${newDbName}.` });
  } catch (error) {
    res.status(500).json({ error: "Failed to rename database", details: error.message });
  }
});

router.delete("/databases/:dbName", async (req, res) => {
  const { dbName } = req.params;
  if (isProtectedDb(dbName)) return res.status(403).json({ error: "Cannot delete system database" });
  try {
    assertValidDbName(dbName);
    const pool = await getAdminPool();
    await pool.query(`DROP DATABASE \`${dbName}\``);
    res.json({ success: true, message: `Database ${dbName} successfully deleted.` });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete database", details: error.message });
  }
});

// ---------- admin platform (status 1) ----------

router.get("/users", async (req, res) => {
  try {
    const master = await getMasterDb();
    const [rows] = await master.execute(`${USER_SELECT} WHERE u.status = 1 ORDER BY u.user_id DESC`);
    res.json({ success: true, data: rows.map(formatUser) });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch admin users" });
  }
});

router.post("/users", async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: "Username and password required" });
  try {
    const master = await getMasterDb();
    const [existing] = await master.execute("SELECT user_id FROM user WHERE username = ? LIMIT 1", [username]);
    if (existing.length > 0) return res.status(400).json({ error: "Username already exists" });
    const salt = makeSalt();
    await master.execute(
      "INSERT INTO user (username, password, role, salt, company_id, status, email, phone) VALUES (?, ?, 1, ?, 0, 1, NULL, NULL)",
      [username, hashPassword(password, salt), salt],
    );
    res.json({ success: true, message: "Admin user created successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to create admin user" });
  }
});

router.put("/users/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { username, password } = req.body || {};
  try {
    const master = await getMasterDb();
    if (username) {
      const [dup] = await master.execute(
        "SELECT user_id FROM user WHERE username = ? AND user_id != ? LIMIT 1",
        [username, id],
      );
      if (dup.length > 0) return res.status(400).json({ error: "Username already taken" });
    }
    const updates = [];
    const params = [];
    if (username) {
      updates.push("username = ?");
      params.push(username);
    }
    if (password) {
      const salt = makeSalt();
      updates.push("password = ?, salt = ?");
      params.push(hashPassword(password, salt), salt);
    }
    if (updates.length === 0) return res.status(400).json({ error: "Nothing to update" });
    params.push(id);
    await master.execute(`UPDATE user SET ${updates.join(", ")} WHERE user_id = ? AND status = 1`, params);
    res.json({ success: true, message: "Admin user updated successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to update admin user" });
  }
});

router.delete("/users/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    const master = await getMasterDb();
    const [[{ count }]] = await master.execute("SELECT COUNT(*) AS count FROM user WHERE status = 1");
    if (count <= 1) return res.status(400).json({ error: "Cannot delete the last remaining admin user" });
    await master.execute("DELETE FROM user WHERE user_id = ? AND status = 1", [id]);
    res.json({ success: true, message: "Admin user deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete admin user" });
  }
});

// ---------- user aplikasi (superuser + user semua perusahaan) ----------

router.get("/all-users", async (req, res) => {
  try {
    const master = await getMasterDb();
    const [rows] = await master.execute(`${USER_SELECT} WHERE u.status != 1 ORDER BY u.user_id DESC`);
    res.json({ success: true, data: rows.map(formatUser) });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch all users" });
  }
});

router.put("/app-users/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { username, password, role, nama_db, nomor_telpon, email } = req.body || {};
  try {
    const master = await getMasterDb();
    if (username) {
      const [dup] = await master.execute(
        "SELECT user_id FROM user WHERE username = ? AND user_id != ? LIMIT 1",
        [username, id],
      );
      if (dup.length > 0) return res.status(400).json({ error: "Username already taken" });
    }
    const updates = [];
    const params = [];
    if (username !== undefined) {
      updates.push("username = ?");
      params.push(username);
    }
    if (role !== undefined) {
      const s = role === "superuser" ? 9 : 2;
      updates.push("status = ?, role = ?");
      params.push(s, s);
    }
    if (nama_db !== undefined) {
      const [c] = await master.execute("SELECT company_id FROM company WHERE database_name = ? LIMIT 1", [nama_db]);
      if (c.length === 0) return res.status(400).json({ error: `Database ${nama_db} tidak terdaftar sebagai perusahaan` });
      updates.push("company_id = ?");
      params.push(c[0].company_id);
    }
    if (nomor_telpon !== undefined) {
      updates.push("phone = ?");
      params.push(formatPhoneNumber(nomor_telpon) || null);
    }
    if (email !== undefined) {
      updates.push("email = ?");
      params.push(email || null);
    }
    if (password) {
      const salt = makeSalt();
      updates.push("password = ?, salt = ?");
      params.push(hashPassword(password, salt), salt);
    }
    if (updates.length > 0) {
      params.push(id);
      await master.execute(`UPDATE user SET ${updates.join(", ")} WHERE user_id = ? AND status != 1`, params);
    }
    res.json({ success: true, message: "App user updated successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to update app user" });
  }
});

router.delete("/app-users/:id", async (req, res) => {
  try {
    const master = await getMasterDb();
    await master.execute("DELETE FROM user WHERE user_id = ? AND status != 1", [parseInt(req.params.id, 10)]);
    res.json({ success: true, message: "App user deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete app user" });
  }
});

router.get("/stats", async (req, res) => {
  try {
    const dbs = await getAllDatabases();
    let tables = 0;
    if (dbs.length > 0) {
      const pool = await getAdminPool();
      const [[r]] = await pool.query(
        "SELECT COUNT(*) AS count FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA IN (?)",
        [dbs],
      );
      tables = r.count;
    }
    const master = await getMasterDb();
    const [[u]] = await master.execute("SELECT COUNT(*) AS count FROM user WHERE status != 1");
    const [[a]] = await master.execute("SELECT COUNT(*) AS count FROM user WHERE status = 1");
    res.json({ success: true, databases: dbs.length, tables, appUsers: u.count, activeAdmins: a.count });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

module.exports = router;
