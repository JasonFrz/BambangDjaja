require('dotenv').config();
const mysql = require('mysql2/promise');

const BATCH_SIZE = 5000;

function getRandomDecimal(min, max) {
  return (Math.random() * (max - min) + min).toFixed(3);
}

// Helper to format date for MySQL DATETIME
function toMySQLDate(date) {
  const pad = (n) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

async function run() {
  console.log("Menghubungkan ke database...");
  let db;
  try {
    db = await mysql.createConnection({
      host: process.env.AIVEN_DB_HOST,
      port: process.env.AIVEN_DB_PORT,
      user: process.env.AIVEN_DB_USER,
      password: process.env.AIVEN_DB_PASSWORD,
      database: 'db_halo'
    });
    console.log("Berhasil terhubung ke db_halo.");
  } catch (err) {
    console.error("Gagal terhubung ke database:", err);
    process.exit(1);
  }

  // Hapus data lama di rentang 21-25 Juli 2026 agar tidak duplikat
  console.log("Menghapus data lama di rentang 21-25 Juli 2026...");
  await db.execute("DELETE FROM electrical_readings WHERE timestamp >= '2026-07-21 00:00:00' AND timestamp <= '2026-07-25 23:59:59'");
  await db.execute("DELETE FROM oil_readings WHERE timestamp >= '2026-07-21 00:00:00' AND timestamp <= '2026-07-25 23:59:59'");
  console.log("Data lama berhasil dihapus.");

  // Rentang Waktu: 21 Juli 2026 00:00:00 - 25 Juli 2026 23:59:58
  const startDate = new Date('2026-07-21T00:00:00');
  const endDate = new Date('2026-07-25T23:59:58');
  
  const electricalRecords = [];
  const oilRecords = [];

  console.log("Membangkitkan data dummy (interval 2 detik)...");
  
  let current = new Date(startDate.getTime());
  let count = 0;
  while (current <= endDate) {
    const ts = toMySQLDate(current);

    // Generate Electrical Readings Dummy Data
    const phase_a = getRandomDecimal(220, 230);
    const phase_b = getRandomDecimal(220, 230);
    const phase_c = getRandomDecimal(220, 230);
    const line_ab = getRandomDecimal(380, 395);
    const line_bc = getRandomDecimal(380, 395);
    const line_ca = getRandomDecimal(380, 395);
    const cur_a = getRandomDecimal(15, 70);
    const cur_b = getRandomDecimal(15, 70);
    const cur_c = getRandomDecimal(15, 70);
    const cur_n = getRandomDecimal(0, 3);
    const pwr_act = getRandomDecimal(10, 45);
    const pwr_react = getRandomDecimal(2, 10);
    const pwr_app = getRandomDecimal(12, 50);
    const pf = getRandomDecimal(0.85, 0.99);
    const pwr_a = getRandomDecimal(3, 15);
    const pwr_b = getRandomDecimal(3, 15);
    const pwr_c = getRandomDecimal(3, 15);
    const freq = getRandomDecimal(49.9, 50.1);
    const energy_act = getRandomDecimal(1000, 5000);
    const energy_react = getRandomDecimal(100, 500);
    const avg_ph = ((parseFloat(phase_a) + parseFloat(phase_b) + parseFloat(phase_c)) / 3).toFixed(3);
    const avg_ln = ((parseFloat(line_ab) + parseFloat(line_bc) + parseFloat(line_ca)) / 3).toFixed(3);
    const avg_cur = ((parseFloat(cur_a) + parseFloat(cur_b) + parseFloat(cur_c)) / 3).toFixed(3);
    const cur_unb = getRandomDecimal(0, 2);

    electricalRecords.push([
      ts, phase_a, phase_b, phase_c, line_ab, line_bc, line_ca,
      cur_a, cur_b, cur_c, cur_n, pwr_act, pwr_react, pwr_app, pf,
      pwr_a, pwr_b, pwr_c, freq, energy_act, energy_react,
      avg_ph, avg_ln, avg_cur, cur_unb,
      1, 0, 0, 1 // on_off_status, relay_status, alarm_status, synced
    ]);

    // Oil readings (tiap 2 detik juga)
    oilRecords.push([
      ts,
      getRandomDecimal(45, 72),  // oil_temperature
      getRandomDecimal(1.5, 3.2), // oil_pressure
      1 // synced
    ]);

    count++;
    // Tambah 2 detik
    current.setSeconds(current.getSeconds() + 2);
  }

  console.log(`Total data siap di-insert: ${count} baris`);
  console.log(`Estimasi: ${(count / BATCH_SIZE).toFixed(0)} batch x ${BATCH_SIZE} per batch`);

  // Insert Electrical
  console.log("\nMulai insert electrical_readings...");
  const elecStart = Date.now();
  for (let i = 0; i < electricalRecords.length; i += BATCH_SIZE) {
    const batch = electricalRecords.slice(i, i + BATCH_SIZE);
    const sql = `
      INSERT INTO electrical_readings (
        timestamp, phase_a_v, phase_b_v, phase_c_v, line_ab_v, line_bc_v, line_ca_v,
        current_a, current_b, current_c, current_n, power_active_total_kw,
        power_reactive_total_kvar, power_apparent_total_kva, pf_total,
        power_active_a, power_active_b, power_active_c, frequency,
        energy_active_total, energy_reactive_total, avg_phase_v, avg_line_v,
        avg_current, current_unbalance, on_off_status, relay_status, alarm_status, synced
      ) VALUES ?
    `;
    await db.query(sql, [batch]);
    const progress = Math.min(i + batch.length, electricalRecords.length);
    const pct = ((progress / electricalRecords.length) * 100).toFixed(1);
    process.stdout.write(`\r  [${pct}%] Inserted ${progress} / ${electricalRecords.length}`);
  }
  console.log(`\n  Selesai dalam ${((Date.now() - elecStart) / 1000).toFixed(1)} detik`);

  // Insert Oil
  console.log("\nMulai insert oil_readings...");
  const oilStart = Date.now();
  for (let i = 0; i < oilRecords.length; i += BATCH_SIZE) {
    const batch = oilRecords.slice(i, i + BATCH_SIZE);
    const sql = `
      INSERT INTO oil_readings (
        timestamp, oil_temperature, oil_pressure, synced
      ) VALUES ?
    `;
    await db.query(sql, [batch]);
    const progress = Math.min(i + batch.length, oilRecords.length);
    const pct = ((progress / oilRecords.length) * 100).toFixed(1);
    process.stdout.write(`\r  [${pct}%] Inserted ${progress} / ${oilRecords.length}`);
  }
  console.log(`\n  Selesai dalam ${((Date.now() - oilStart) / 1000).toFixed(1)} detik`);

  console.log("\n========================================");
  console.log(`SELESAI! ${count} data dummy (21 Jul - 25 Jul 2026)`);
  console.log("Interval: setiap 2 detik");
  console.log("Tabel: electrical_readings + oil_readings");
  console.log("========================================");
  await db.end();
}

run();
