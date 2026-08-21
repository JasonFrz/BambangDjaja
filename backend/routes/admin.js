const express = require('express');
const router = express.Router();
const { getAllDatabases, getDbConnection, getAdminPool } = require('../utils/db');
const bcrypt = require('bcryptjs');

const authenticateSuperAdmin = (req, res, next) => {
  const isSuper = req.headers['x-super-admin'];
  if (isSuper === 'true') {
    next();
  } else {
    return res.status(401).json({ error: 'Unauthorized. Super admin access required.' });
  }
};

router.use(authenticateSuperAdmin);

router.get('/databases', async (req, res) => {
  try {
    const databases = await getAllDatabases();
    res.json({ success: true, databases });
  } catch (error) {
    console.error('Error fetching databases:', error);
    res.status(500).json({ error: 'Failed to fetch databases', details: error.message });
  }
});

router.get('/databases/:dbName/tables', async (req, res) => {
  const { dbName } = req.params;
  try {
    const pool = await getDbConnection(dbName);
    const [rows] = await pool.execute('SHOW TABLES');

    const tables = rows.map(row => Object.values(row)[0]);
    res.json({ success: true, tables });
  } catch (error) {
    console.error(`Error fetching tables for db ${dbName}:`, error);
    res.status(500).json({ error: 'Failed to fetch tables', details: error.message });
  }
});

router.get('/databases/:dbName/tables/:tableName', async (req, res) => {
  const { dbName, tableName } = req.params;
  const { limit, sort } = req.query;
  try {
    const pool = await getDbConnection(dbName);

    const [cols] = await pool.execute(`SHOW COLUMNS FROM \`${tableName}\``);
    const colNames = cols.map(c => c.Field);
    
    let orderClause = '';
    if (sort === 'latest') {
      if (colNames.includes('id')) orderClause = 'ORDER BY id DESC';
      else if (colNames.includes('timestamp')) orderClause = 'ORDER BY timestamp DESC';
      else if (colNames.includes('created_at')) orderClause = 'ORDER BY created_at DESC';
    } else if (sort === 'oldest') {
      if (colNames.includes('id')) orderClause = 'ORDER BY id ASC';
      else if (colNames.includes('timestamp')) orderClause = 'ORDER BY timestamp ASC';
      else if (colNames.includes('created_at')) orderClause = 'ORDER BY created_at ASC';
    }

    let limitClause = 'LIMIT 100';
    if (limit === 'all') {
      limitClause = '';
    } else if (limit) {
      const parsed = parseInt(limit);
      if (!isNaN(parsed) && parsed > 0) {
        limitClause = `LIMIT ${parsed}`;
      }
    }

    const query = `SELECT * FROM \`${tableName}\` ${orderClause} ${limitClause}`;
    const [rows] = await pool.execute(query);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error(`Error fetching data for table ${tableName}:`, error);
    res.status(500).json({ error: 'Failed to fetch table data', details: error.message });
  }
});

router.put('/databases/:oldDbName', async (req, res) => {
  const { oldDbName } = req.params;
  const { newDbName } = req.body;
  
  if (!newDbName || newDbName.trim() === '') {
    return res.status(400).json({ error: 'New database name is required' });
  }
  
  const systemDbs = ['information_schema', 'mysql', 'performance_schema', 'sys', 'defaultdb', 'tmu_master'];
  if (systemDbs.includes(oldDbName) || systemDbs.includes(newDbName)) {
    return res.status(403).json({ error: 'Cannot rename system database' });
  }

  try {
    const pool = await getAdminPool();
    const [rows] = await pool.execute('SHOW DATABASES LIKE ?', [newDbName]);
    if (rows.length > 0) return res.status(400).json({ error: 'Database with new name already exists' });

    await pool.execute(`CREATE DATABASE \`${newDbName}\``);

    const [tables] = await pool.execute(`SELECT TABLE_NAME FROM information_schema.tables WHERE table_schema = ?`, [oldDbName]);
    for (const table of tables) {
      const tableName = table.TABLE_NAME;
      await pool.execute(`RENAME TABLE \`${oldDbName}\`.\`${tableName}\` TO \`${newDbName}\`.\`${tableName}\``);
    }

    await pool.execute(`DROP DATABASE \`${oldDbName}\``);
    await pool.execute(`UPDATE tmu_master.users SET nama_db = ? WHERE nama_db = ?`, [newDbName, oldDbName]);

    res.json({ success: true, message: `Database successfully renamed to ${newDbName}.` });
  } catch (error) {
    console.error(`Error renaming database ${oldDbName} to ${newDbName}:`, error);
    res.status(500).json({ error: 'Failed to rename database', details: error.message });
  }
});

router.delete('/databases/:dbName', async (req, res) => {
  const { dbName } = req.params;

  const systemDbs = ['information_schema', 'mysql', 'performance_schema', 'sys', 'defaultdb', 'tmu_master'];
  if (systemDbs.includes(dbName)) {
    return res.status(403).json({ error: 'Cannot delete system database' });
  }

  try {

    const pool = await getAdminPool();
    await pool.execute(`DROP DATABASE \`${dbName}\``);

    res.json({ success: true, message: `Database ${dbName} successfully deleted.` });
  } catch (error) {
    console.error(`Error dropping database ${dbName}:`, error);
    res.status(500).json({ error: 'Failed to delete database', details: error.message });
  }
});

// Admin Users CRUD endpoints
router.get('/users', async (req, res) => {
  try {
    const pool = await getDbConnection('tmu_master');
    const [users] = await pool.execute("SELECT id, username, ROLE as role, email, nomor_telpon, created_at FROM users WHERE role = 'admin' ORDER BY created_at DESC");
    res.json({ success: true, data: users });
  } catch (error) {
    console.error('Error fetching admin users:', error);
    res.status(500).json({ error: 'Failed to fetch admin users' });
  }
});

router.post('/users', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  try {
    const pool = await getDbConnection('tmu_master');
    const [existing] = await pool.execute('SELECT id FROM users WHERE username = ?', [username]);
    if (existing.length > 0) return res.status(400).json({ error: 'Username already exists' });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    await pool.execute(
      "INSERT INTO users (nama_db, username, nomor_telpon, password, email, ROLE, created_at) VALUES (?, ?, ?, ?, ?, 'admin', NOW())", 
      ['tmu_master', username, '-', hashedPassword, '-']
    );
    res.json({ success: true, message: 'Admin user created successfully' });
  } catch (error) {
    console.error('Error creating admin user:', error);
    res.status(500).json({ error: 'Failed to create admin user' });
  }
});

router.put('/users/:id', async (req, res) => {
  const { id } = req.params;
  const { username, password } = req.body;

  try {
    const pool = await getDbConnection('tmu_master');
    
    if (username) {
      const [existing] = await pool.execute('SELECT id FROM users WHERE username = ? AND id != ?', [username, id]);
      if (existing.length > 0) return res.status(400).json({ error: 'Username already taken' });
    }

    if (password) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      await pool.execute('UPDATE users SET username = ?, password = ? WHERE id = ?', [username, hashedPassword, id]);
    } else {
      await pool.execute('UPDATE users SET username = ? WHERE id = ?', [username, id]);
    }

    res.json({ success: true, message: 'Admin user updated successfully' });
  } catch (error) {
    console.error('Error updating admin user:', error);
    res.status(500).json({ error: 'Failed to update admin user' });
  }
});

router.delete('/users/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    const pool = await getDbConnection('tmu_master');
    const [countRow] = await pool.execute("SELECT COUNT(*) as count FROM users WHERE role = 'admin'");
    if (countRow[0].count <= 1) {
      return res.status(400).json({ error: 'Cannot delete the last remaining admin user' });
    }

    await pool.execute("DELETE FROM users WHERE id = ? AND role = 'admin'", [id]);
    res.json({ success: true, message: 'Admin user deleted successfully' });
  } catch (error) {
    console.error('Error deleting admin user:', error);
    res.status(500).json({ error: 'Failed to delete admin user' });
  }
});

router.get('/all-users', async (req, res) => {
  try {
    const pool = await getDbConnection('tmu_master');
    const [users] = await pool.execute("SELECT id, username, ROLE as role, email, nomor_telpon as nomor_telpon, nama_db, created_at FROM users WHERE ROLE != 'admin' ORDER BY created_at DESC");
    res.json({ success: true, data: users });
  } catch (error) {
    console.error('Error fetching all users:', error);
    res.status(500).json({ error: 'Failed to fetch all users' });
  }
});

router.put('/app-users/:id', async (req, res) => {
  const { id } = req.params;
  const { username, password, role, nama_db, nomor_telpon, email } = req.body;

  try {
    const pool = await getDbConnection('tmu_master');
    
    if (username) {
      const [existing] = await pool.execute('SELECT id FROM users WHERE username = ? AND id != ?', [username, id]);
      if (existing.length > 0) return res.status(400).json({ error: 'Username already taken' });
    }

    const formatPhoneNumber = require('../utils/phoneFormatter');
    let phone = nomor_telpon ? formatPhoneNumber(nomor_telpon) : undefined;
    
    let query = 'UPDATE users SET ';
    const params = [];
    const updates = [];
    
    if (username !== undefined) { updates.push('username = ?'); params.push(username); }
    if (role !== undefined) { updates.push('ROLE = ?'); params.push(role); }
    if (nama_db !== undefined) { updates.push('nama_db = ?'); params.push(nama_db); }
    if (phone !== undefined) { updates.push('nomor_telpon = ?'); params.push(phone || '-'); }
    if (email !== undefined) { updates.push('email = ?'); params.push(email); }
    
    if (password) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      updates.push('password = ?'); params.push(hashedPassword);
    }

    if (updates.length > 0) {
      query += updates.join(', ') + " WHERE id = ? AND ROLE != 'admin'";
      params.push(id);
      await pool.execute(query, params);
    }

    res.json({ success: true, message: 'App user updated successfully' });
  } catch (error) {
    console.error('Error updating app user:', error);
    res.status(500).json({ error: 'Failed to update app user' });
  }
});

router.delete('/app-users/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    const pool = await getDbConnection('tmu_master');
    await pool.execute("DELETE FROM users WHERE id = ? AND ROLE != 'admin'", [id]);
    res.json({ success: true, message: 'App user deleted successfully' });
  } catch (error) {
    console.error('Error deleting app user:', error);
    res.status(500).json({ error: 'Failed to delete app user' });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const { getAllDatabases } = require('../utils/db');
    const dbRows = await getAllDatabases();
    const dbCount = dbRows.length;
    
    let totalTables = 0;
    if (dbRows.length > 0) {
      const pool = await getAdminPool();
      const dbNames = dbRows.map(db => `'${db}'`).join(',');
      const [tableCountRes] = await pool.execute(`SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA IN (${dbNames})`);
      totalTables = tableCountRes[0].count;
    }

    const poolMaster = await getDbConnection('tmu_master');

    const [userRes] = await poolMaster.execute("SELECT COUNT(*) as count FROM users WHERE ROLE != 'admin'");
    const [adminRes] = await poolMaster.execute("SELECT COUNT(*) as count FROM users WHERE role = 'admin'");
    
    res.json({
      success: true,
      databases: dbCount,
      tables: totalTables,
      appUsers: userRes[0].count,
      activeAdmins: adminRes[0].count
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

module.exports = router;
