const { getDbConnection, getAllDatabases } = require('./db');

async function autoAddIndexes() {
  try {
    const databases = await getAllDatabases();
    
    for (const dbName of databases) {
      if (dbName === 'tmu_master') continue;
      
      const db = await getDbConnection(dbName);
      
      try {
        await db.execute('CREATE INDEX idx_electrical_timestamp ON electrical_readings(timestamp)');
        console.log(`[Auto-Index] Berhasil menambahkan index timestamp di ${dbName}.electrical_readings`);
      } catch (err) {
        // Abaikan jika index sudah ada atau tabel belum dibuat oleh IRIV
      }
      
      try {
        await db.execute('CREATE INDEX idx_oil_timestamp ON oil_readings(timestamp)');
        console.log(`[Auto-Index] Berhasil menambahkan index timestamp di ${dbName}.oil_readings`);
      } catch (err) {
        // Abaikan
      }
    }
  } catch (error) {
    console.error('[Auto-Index] Gagal menjalankan pengecekan index:', error.message);
  }
}

module.exports = autoAddIndexes;
