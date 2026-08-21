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
      queueLimit: 0,
      idleTimeout: 30000
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
    queueLimit: 0,
    idleTimeout: 30000
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


async function getAllDatabases() {
  const pool = await getAdminPool();

  try {
    const [rows] = await pool.execute('SHOW DATABASES');
    const systemDbs = ['information_schema', 'mysql', 'performance_schema', 'sys', 'defaultdb', 'tmu_master'];
    const actualDbs = rows
      .map(row => row.Database)
      .filter(db => !systemDbs.includes(db));

    return actualDbs;
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
