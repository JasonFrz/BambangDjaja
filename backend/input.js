const mysql = require('mysql2/promise');
require('dotenv').config();

function getRandomDecimal(min, max, decimals = 2) {
  const rand = Math.random() * (max - min) + min;
  return parseFloat(rand.toFixed(decimals));
}

async function generateDummyData() {
  const connection = await mysql.createConnection({
    host: process.env.AIVEN_DB_HOST,
    port: process.env.AIVEN_DB_PORT,
    user: process.env.AIVEN_DB_USER,
    password: process.env.AIVEN_DB_PASSWORD,
    database: 'db_halo' 
  });

  console.log('Connected to MySQL. Seeding dummy data...');

  const electricalRecords = [];
  const oilRecords = [];

  const now = new Date();
  const startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000); 

  for (let t = startTime.getTime(); t <= now.getTime(); t += 2000) {
    const ts = new Date(t).toISOString().slice(0, 19).replace('T', ' ');

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
      1, 0, 0, 1 
    ]);

    oilRecords.push([
      ts,
      getRandomDecimal(45, 72),  
      getRandomDecimal(1.5, 3.2), 
      1 
    ]);
  }

  const elecSql = `INSERT INTO electrical_readings 
    (timestamp, phase_a_v, phase_b_v, phase_c_v, line_ab_v, line_bc_v, line_ca_v, 
     current_a, current_b, current_c, current_n, power_active_total_kw, power_reactive_total_kvar, power_apparent_total_kva, pf_total, 
     power_active_a_kw, power_active_b_kw, power_active_c_kw, frequency, energy_active_total, energy_reactive_total, 
     avg_phase_v, avg_line_v, avg_current, current_unbalance, on_off_status, relay_status, alarm_status, synced) 
    VALUES ?`;

  const oilSql = `INSERT INTO oil_readings (timestamp, oil_temperature, oil_pressure, synced) VALUES ?`;

  const BATCH_SIZE = 5000;
  for (let i = 0; i < electricalRecords.length; i += BATCH_SIZE) {
    const batch = electricalRecords.slice(i, i + BATCH_SIZE);
    await connection.query(elecSql, [batch]);
    console.log(`Inserted ${i + batch.length} / ${electricalRecords.length} electrical records`);
  }

  for (let i = 0; i < oilRecords.length; i += BATCH_SIZE) {
    const batch = oilRecords.slice(i, i + BATCH_SIZE);
    await connection.query(oilSql, [batch]);
    console.log(`Inserted ${i + batch.length} / ${oilRecords.length} oil records`);
  }

  console.log('Seeding complete!');
  await connection.end();
}

generateDummyData().catch(console.error);
