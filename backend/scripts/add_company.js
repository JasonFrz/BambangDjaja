require("dotenv").config();
const crypto = require("crypto");
const mysql = require("mysql2/promise");
const { getDbConfig, getMasterDbName } = require("../utils/db");
const { assertValidDbName } = require("../utils/sqlTemplate");

async function main() {
  const [companyName, dbName, keyArg, versionArg] = process.argv.slice(2);
  if (!companyName || !dbName) {
    console.error(
      'Pemakaian: node scripts/add_company.js "<Nama Perusahaan>" <namaDatabase> [companyKey] [tmuVersion]',
    );
    process.exit(1);
  }
  assertValidDbName(dbName);
  const companyKey = keyArg || crypto.randomBytes(16).toString("hex");
  const tmuVersion = parseInt(versionArg, 10) || 2;
  const conn = await mysql.createConnection(getDbConfig(getMasterDbName()));
  try {
    await conn.query(
      `INSERT INTO company(company_name, database_name, company_key, status, tmu_version) VALUES(?,?,?,1,?) ON DUPLICATE KEY UPDATE company_name = VALUES(company_name), database_name = VALUES(database_name), tmu_version = VALUES(tmu_version)`,
      [companyName, dbName, companyKey, tmuVersion],
    );
    console.log(
      `Perusahaan "${companyName}" terdaftar. database=${dbName} company_key=${companyKey} tmu_version=${tmuVersion}`,
    );
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error("Gagal:", err.message);
  process.exit(1);
});
