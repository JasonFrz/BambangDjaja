require("dotenv").config();
const { getMasterDb, getDbConnection } = require("../utils/db");

async function seed() {
  const master = await getMasterDb();
  
  // 1. Pastikan Perusahaan terdaftar di master_tmu_app
  await master.query(`
    INSERT INTO company (company_id, company_name, database_name, company_code, company_key, status, tmu_version)
    VALUES (1, 'PT Bambang Djaja', 'base_tmu_company_table_v2', 'BD-001', 'demo-company-key-0001', 1, 2)
    ON DUPLICATE KEY UPDATE 
      company_name = VALUES(company_name),
      database_name = VALUES(database_name),
      company_key = VALUES(company_key),
      status = VALUES(status),
      tmu_version = VALUES(tmu_version)
  `);

  // 2. Bersihkan tabel user dan masukkan hanya 1 user 'test'
  await master.query("DELETE FROM user");
  await master.query(`
    INSERT INTO user (user_id, username, password, role, salt, company_id, status, email, phone)
    VALUES (1, 'test', '729dd529bfd776b856c3a5b0ed022f76715caf947a9a5831df7c91603ce8d494', 1, 'tst12', 1, 9, 'test@bambangdjaja.com', '081234567890')
  `);
  console.log("Master user 'test' inserted.");

  // 3. Masukkan juga ke tabel users di base_tmu_company_table_v2 dan pastikan skema trafo lengkap
  const { patchCompanyDb } = require("../utils/schemaPatch");
  const companyDb = await getDbConnection('base_tmu_company_table_v2');
  await patchCompanyDb(companyDb);

  await companyDb.query("DELETE FROM users");
  await companyDb.query(`
    INSERT INTO users (user_id, username, password, role, name, salt, status)
    VALUES (1, 'test', '729dd529bfd776b856c3a5b0ed022f76715caf947a9a5831df7c91603ce8d494', 1, 'Test User', 'tst12', 9)
  `);
  console.log("Company user 'test' inserted.");

  // 4. Pastikan setidaknya 1 trafo terdaftar agar halaman fleet tidak kosong
  await companyDb.query("DROP TABLE IF EXISTS trafo");
  await companyDb.query(`
    INSERT INTO transformer_data (trafoId, raspiSerialNo, trafoSerialNo, ratedPower, ratedHighVoltage, ratedLowVoltage, ratedCurrentHighVoltage, ratedCurrentLowVoltage, frequency, vectorGroup, phase, tapType, impedance, noLoadLoss, fullLoadLoss, status, SuddenPressure, latitude, longitude, version, productionStatus)
    VALUES (1, 'FAKE-RASPI-001', 'TRF-001', 100, 20, 400, 2.89, 144, 50, 'Dyn5', 3, 'OCTC', 4, 150, 1200, 1, 0, -7.2575, 112.7521, 2, 1)
    ON DUPLICATE KEY UPDATE raspiSerialNo = VALUES(raspiSerialNo)
  `);
  console.log("Trafo 1 inserted/updated in transformer_data.");

  console.log("HANYA 1 USER 'test' YANG AKTIF.");
  process.exit(0);
}

seed().catch(err => {
  console.error("Seed error:", err);
  process.exit(1);
});
