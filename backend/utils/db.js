const mysql = require('mysql2/promise');
require('dotenv').config();

const connectionPools = new Map();

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
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  connectionPools.set(dbName, pool);

  try {
    const connection = await pool.getConnection();
    connection.release();
    console.log(`Successfully connected to database: ${dbName}`);
  } catch (error) {
    console.error(`Failed to connect to database: ${dbName}`, error);
    connectionPools.delete(dbName);
    throw error;
  }

  return pool;
}

async function getAllDatabases() {
  const connection = await mysql.createConnection({
    host: process.env.AIVEN_DB_HOST,
    port: process.env.AIVEN_DB_PORT,
    user: process.env.AIVEN_DB_USER,
    password: process.env.AIVEN_DB_PASSWORD
  });

  try {
    const [rows] = await connection.execute('SHOW DATABASES');
    
    const systemDbs = ['information_schema', 'mysql', 'performance_schema', 'sys', 'defaultdb'];
    const databases = rows
      .map(row => row.Database)
      .filter(db => !systemDbs.includes(db));
    return databases;
  } finally {
    await connection.end();
  }
}

module.exports = {
  getDbConnection,
  getAllDatabases
};
