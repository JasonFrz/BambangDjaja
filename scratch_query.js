const { getDbConnection } = require('./backend/utils/db');

async function main() {
  try {
    const pool = await getDbConnection('tmu_master');
    const [rows] = await pool.query('DESCRIBE companies');
    console.log(rows);
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
main();
