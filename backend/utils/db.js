const mysql = require('mysql2/promise');
require('dotenv').config();

const connectionPools = new Map();
let adminPool = null;
let isMasterInit = false;

async function getAdminPool() {
  if (!adminPool) {
    adminPool = mysql.createPool({
      host: process.env.AIVEN_DB_HOST,
      port: process.env.AIVEN_DB_PORT,
      user: process.env.AIVEN_DB_USER,
      password: process.env.AIVEN_DB_PASSWORD,
      timezone: 'Z',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
  }
  return adminPool;
}

async function getDbConnection(dbName) {
  if (!dbName) {
    throw new Error('Database name is required to get a connection');
  }

  if (connectionPools.has(dbName)) {
    return connectionPools.get(dbName);
  }

  const pool = mysql.createPool({
    host: process.env.AIVEN_DB_HOST,
    port: process.env.AIVEN_DB_PORT,
    user: process.env.AIVEN_DB_USER,
    password: process.env.AIVEN_DB_PASSWORD,
    database: dbName,
    timezone: 'Z',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  connectionPools.set(dbName, pool);

  try {
    const connection = await pool.getConnection();
    connection.release();

  } catch (error) {
    console.error(`Failed to connect to database: ${dbName}`, error);
    connectionPools.delete(dbName);
    throw error;
  }

  return pool;
}

async function initMasterDb(connection) {
  await connection.execute(`CREATE DATABASE IF NOT EXISTS tmu_master`);
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS tmu_master.transformers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      db_name VARCHAR(100) UNIQUE NOT NULL,
      registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await connection.execute(`
    CREATE TABLE IF NOT EXISTS tmu_master.users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(50) DEFAULT 'admin',
      tenant_db VARCHAR(100) DEFAULT NULL,
      email VARCHAR(100) DEFAULT NULL,
      nomor_telpon VARCHAR(20) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const [columnsInfo] = await connection.execute("SHOW COLUMNS FROM tmu_master.users");
  const columns = columnsInfo.map(c => c.Field);
  
  if (!columns.includes('role')) {
    await connection.execute("ALTER TABLE tmu_master.users ADD COLUMN role VARCHAR(50) DEFAULT 'admin' AFTER password");
  }
  if (!columns.includes('tenant_db')) {
    await connection.execute("ALTER TABLE tmu_master.users ADD COLUMN tenant_db VARCHAR(100) DEFAULT NULL AFTER role");
  }
  if (!columns.includes('email')) {
    await connection.execute("ALTER TABLE tmu_master.users ADD COLUMN email VARCHAR(100) DEFAULT NULL AFTER tenant_db");
  }
  if (!columns.includes('nomor_telpon')) {
    await connection.execute("ALTER TABLE tmu_master.users ADD COLUMN nomor_telpon VARCHAR(20) DEFAULT NULL AFTER email");
  }

  const [users] = await connection.execute('SELECT COUNT(*) as count FROM tmu_master.users');
  if (users[0].count === 0) {
    const bcrypt = require('bcryptjs');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('admin', salt);
    await connection.execute('INSERT INTO tmu_master.users (username, password) VALUES (?, ?)', ['admin', hashedPassword]);
    console.log('✅ Default admin user created (admin:admin)');
  }
}

async function getAllDatabases() {
  const pool = await getAdminPool();

  try {
    // 1. Initialize master DB if not exists (only once per runtime)
    if (!isMasterInit) {
      await initMasterDb(pool);
      isMasterInit = true;
    }

    // 2. Fallback to SHOW DATABASES to auto-register any manually created DBs
    const [rows] = await pool.execute('SHOW DATABASES');
    const systemDbs = ['information_schema', 'mysql', 'performance_schema', 'sys', 'defaultdb', 'tmu_master'];
    const actualDbs = rows
      .map(row => row.Database)
      .filter(db => !systemDbs.includes(db));

    // 3. Sync actual DBs to master registry (INSERT IGNORE)
    if (actualDbs.length > 0) {
      const values = actualDbs.map(db => `('${db}')`).join(',');
      await pool.execute(`INSERT IGNORE INTO tmu_master.transformers (db_name) VALUES ${values}`);
    }

    // 4. Return list from master registry (so future central queries can just query tmu_master)
    const [masterRows] = await pool.execute('SELECT db_name FROM tmu_master.transformers ORDER BY db_name ASC');
    
    // Filter masterRows to only return DBs that still actually exist
    const activeDbs = masterRows.map(r => r.db_name).filter(db => actualDbs.includes(db));
    return activeDbs;
  } catch (err) {
    console.error('Error in getAllDatabases:', err);
    throw err;
  }
}

module.exports = {
  getDbConnection,
  getAllDatabases,
  getAdminPool
};
