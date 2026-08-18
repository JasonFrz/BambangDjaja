const { getDbConnection, getAllDatabases } = require('../utils/db');

async function addIndexes() {
  try {
    const databases = await getAllDatabases();
    
    for (const dbName of databases) {
      console.log(`Checking indexes for database: ${dbName}...`);
      const db = await getDbConnection(dbName);
      
      try {
        // Cek dan tambah index untuk electrical_readings (timestamp)
        await db.execute('CREATE INDEX idx_electrical_timestamp ON electrical_readings(timestamp)');
        console.log(`  [OK] Index timestamp ditambahkan di electrical_readings.`);
      } catch (err) {
        if (err.code === 'ER_DUP_KEYNAME') console.log(`  [SKIP] Index timestamp sudah ada di electrical_readings.`);
        else console.error(`  [ERROR] electrical_readings:`, err.message);
      }
      
      try {
        // Cek dan tambah index untuk oil_readings (timestamp)
        await db.execute('CREATE INDEX idx_oil_timestamp ON oil_readings(timestamp)');
        console.log(`  [OK] Index timestamp ditambahkan di oil_readings.`);
      } catch (err) {
        if (err.code === 'ER_DUP_KEYNAME') console.log(`  [SKIP] Index timestamp sudah ada di oil_readings.`);
        else console.error(`  [ERROR] oil_readings:`, err.message);
      }
    }
    console.log('Selesai menambahkan index!');
    process.exit(0);
  } catch (error) {
    console.error('Fatal Error:', error);
    process.exit(1);
  }
}

addIndexes();
