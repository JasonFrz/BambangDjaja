const mysql = require('mysql2/promise');
require('dotenv').config();

const connectionPools = new Map();

/**
 * Gets or creates a connection pool for a specific database.
 * @param {string} dbName - The name of the database (e.g., PT Name).
 * @returns {Promise<mysql.Pool>}
 */
async function getDbConnection(dbName) {
  if (!dbName) {
    throw new Error('Database name is required to get a connection');
  }

  // Check if a pool already exists for this db
  if (connectionPools.has(dbName)) {
    return connectionPools.get(dbName);
  }

  // Create a new pool
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

  // Optional: test the connection once
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

/**
 * Gets a list of all databases on the MySQL server.
 * @returns {Promise<string[]>}
 */
async function getAllDatabases() {
  const connection = await mysql.createConnection({
    host: process.env.AIVEN_DB_HOST,
    port: process.env.AIVEN_DB_PORT,
    user: process.env.AIVEN_DB_USER,
    password: process.env.AIVEN_DB_PASSWORD
  });

  try {
    const [rows] = await connection.execute('SHOW DATABASES');
    // Map to array of strings and filter out system databases
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
