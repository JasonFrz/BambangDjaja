const fs = require("fs");
const mysql = require("mysql2/promise");
const { getDbConfig } = require("./db");

const DB_NAME_RE = /^[A-Za-z0-9_]{1,64}$/;

function assertValidDbName(name) {
  if (typeof name !== "string" || !DB_NAME_RE.test(name)) {
    throw new Error(`Nama database tidak valid: "${name}"`);
  }
}

function sanitizeDump(text) {
  return text
    .replace(/^CREATE DATABASE[^\r\n]*;[ \t]*$/gim, "")
    .replace(/^USE[ \t]+`?[A-Za-z0-9_]+`?[ \t]*;[ \t]*$/gim, "")
    .replace(/utf8mb3_slovenian_ci/g, "utf8_general_ci")
    .replace(/CHARSET=utf8mb3/g, "CHARSET=utf8");
}

async function createDatabaseFromSql(dbName, sqlFilePath) {
  assertValidDbName(dbName);
  const raw = fs.readFileSync(sqlFilePath, "utf8");
  const sqlText = sanitizeDump(raw);

  const conn = await mysql.createConnection({
    ...getDbConfig(),
    multipleStatements: true,
  });

  try {
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${dbName}\` DEFAULT CHARACTER SET utf8mb4`,
    );
    await conn.query(`USE \`${dbName}\``);
    await conn.query(sqlText);
  } finally {
    await conn.end();
  }
}

module.exports = { sanitizeDump, assertValidDbName, createDatabaseFromSql };
