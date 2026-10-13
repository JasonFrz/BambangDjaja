require("dotenv").config();
const path = require("path");
const { createDatabaseFromSql } = require("../utils/sqlTemplate");

async function main() {
  const [file, dbName] = process.argv.slice(2);
  if (!file || !dbName) {
    console.error(
      "Pemakaian: node scripts/import_sql.js <path-file.sql> <namaDatabase>",
    );
    process.exit(1);
  }
  const abs = path.resolve(file);
  console.log(`import ${abs} ke db ${dbName} ...`);
  await createDatabaseFromSql(dbName, abs);
  console.log("selesai");
}

main().catch((err) => {
  console.error("gagal import: ", err.message);
  process.exit(1);
});
