const mysql = require('mysql2/promise');
require('dotenv').config();

async function check() {
  const db = await mysql.createConnection({
    host: process.env.AIVEN_DB_HOST,
    port: process.env.AIVEN_DB_PORT,
    user: process.env.AIVEN_DB_USER,
    password: process.env.AIVEN_DB_PASSWORD,
    database: 'db_baru_v2'
  });

  try {
    const [cols] = await db.execute('SHOW COLUMNS FROM users');
    console.log(cols);
  } catch (err) {
    console.error(err);
  }
  await db.end();
}
check();
