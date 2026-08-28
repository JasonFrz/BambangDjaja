require('dotenv').config({ path: './backend/.env' });
const mysql = require('mysql2/promise');

async function main() {
  try {
    const pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: 'tmu_master'
    });
    const [companies] = await pool.query('DESCRIBE companies');
    console.log("Companies schema:");
    console.log(companies);
    
    // Also let's check what tables exist in tmu_master
    const [tables] = await pool.query('SHOW TABLES');
    console.log("Tables in tmu_master:");
    console.log(tables);
    
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
main();
