const express = require('express');
const router = express.Router();
const { getAllDatabases, getDbConnection } = require('../utils/db');

const authenticateSuperAdmin = (req, res, next) => {
  const isSuper = req.headers['x-super-admin'];
  if (isSuper === 'true') {
    next();
  } else {
    return res.status(401).json({ error: 'Unauthorized. Super admin access required.' });
  }
};

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'admin') {
    return res.json({ success: true, message: 'Login successful' });
  }
  return res.status(401).json({ error: 'Invalid username or password' });
});

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

router.delete('/databases/:dbName', async (req, res) => {
  const { dbName } = req.params;

  const systemDbs = ['information_schema', 'mysql', 'performance_schema', 'sys', 'defaultdb'];
  if (systemDbs.includes(dbName)) {
    return res.status(403).json({ error: 'Cannot delete system database' });
  }

  try {

    const mysql = require('mysql2/promise');
    const connection = await mysql.createConnection({
      host: process.env.AIVEN_DB_HOST,
      port: process.env.AIVEN_DB_PORT,
      user: process.env.AIVEN_DB_USER,
      password: process.env.AIVEN_DB_PASSWORD
    });

    await connection.execute(`DROP DATABASE \`${dbName}\``);
    await connection.end();

    res.json({ success: true, message: `Database ${dbName} successfully deleted.` });
  } catch (error) {
    console.error(`Error dropping database ${dbName}:`, error);
    res.status(500).json({ error: 'Failed to delete database', details: error.message });
  }
});

module.exports = router;
