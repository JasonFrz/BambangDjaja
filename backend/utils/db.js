const mysql = require("mysql2/promise");
require("dotenv").config();

const connectionPools = new Map();
let adminPool = null;
let isMasterInit = false;

function getMasterDbName() {
  return process.env.MASTER_DB || "master_tmu_app";
}

function getMasterDb() {
  return getDbConnection(getMasterDbName());
}

function getDbConfig(dbName = null) {
  const host =
    process.env.DB_HOST ||
    process.env.HOST ||
    process.env.AIVEN_DB_HOST ||
    "localhost";
  const port = parseInt(
    process.env.DB_PORT ||
      (process.env.PORT == 3306 ? process.env.PORT : null) ||
      process.env.AIVEN_DB_PORT ||
      3306,
  );
  const user =
    process.env.DB_USER ||
    process.env.USER ||
    process.env.AIVEN_DB_USER ||
    "root";
  const password =
    process.env.DB_PASSWORD !== undefined
      ? process.env.DB_PASSWORD
      : process.env.PASSWORD !== undefined
        ? process.env.PASSWORD
        : process.env.AIVEN_DB_PASSWORD !== undefined
          ? process.env.AIVEN_DB_PASSWORD
          : "";

  const config = {
    host,
    port,
    user,
    password,
    timezone: "Z",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    idleTimeout: 30000,
  };

  if (dbName) {
    config.database = dbName;
  }

  return config;
}

async function getAdminPool() {
  if (!adminPool) {
    adminPool = mysql.createPool(getDbConfig());
  }
  return adminPool;
}

async function getDbConnection(dbName) {
  if (!dbName) {
    throw new Error("Database name is required to get a connection");
  }

  if (connectionPools.has(dbName)) {
    return connectionPools.get(dbName);
  }

  const pool = mysql.createPool(getDbConfig(dbName));

  connectionPools.set(dbName, pool);

  try {
    const connection = await pool.getConnection();
    connection.release();
  } catch (error) {
    if (error.code !== "ER_BAD_DB_ERROR") {
      console.error(`Failed to connect to database: ${dbName}`, error);
    }
    connectionPools.delete(dbName);
    throw error;
  }

  return pool;
}

async function getAllDatabases() {
  const pool = await getAdminPool();

  try {
    const [rows] = await pool.execute("SHOW DATABASES");
    const systemDbs = [
      "information_schema",
      "mysql",
      "performance_schema",
      "sys",
      "defaultdb",
      "tmu_master",
      getMasterDbName(),
    ];
    const actualDbs = rows
      .map((row) => row.Database)
      .filter((db) => !systemDbs.includes(db));

    return actualDbs;
  } catch (err) {
    console.error("Error in getAllDatabases:", err);
    throw err;
  }
}

module.exports = {
  getDbConfig,
  getDbConnection,
  getAllDatabases,
  getAdminPool,
  getMasterDbName,
  getMasterDb,
};
