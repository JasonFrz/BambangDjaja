const mysql = require('mysql2/promise');
require('dotenv').config({ path: '../backend/.env' }); // Arahkan ke backend/.env

async function triggerAlarm() {
  const dbName = 'db_test'; // Database target

  const connection = await mysql.createConnection({
    host: process.env.AIVEN_DB_HOST || 'localhost',
    port: process.env.AIVEN_DB_PORT || 3306,
    user: process.env.AIVEN_DB_USER || 'root',
    password: process.env.AIVEN_DB_PASSWORD || '',
    database: dbName 
  });

  console.log(`Terhubung ke database ${dbName}.`);
  console.log(`Mengirim data ekstrem (Electrical & Oil) setiap 1 detik... (Tekan Ctrl+C untuk berhenti)\n`);

  const elecQuery = `
    INSERT INTO electrical_readings (
      phase_a_v, phase_b_v, phase_c_v,
      line_ab_v, line_bc_v, line_ca_v,
      current_a, current_b, current_c,
      current_n, current_unbalance,
      power_active_total_kw, power_reactive_total_kvar, power_apparent_total_kva, pf_total,
      frequency, timestamp
    ) VALUES (
      ?, ?, ?, 
      380.0, 380.0, 380.0, 
      ?, ?, ?, 
      0.0, 0.0, 
      1000.0, 500.0, 1200.0, 0.95, 
      ?, ?
    )
  `;

  const oilQuery = `
    INSERT INTO oil_readings (
      oil_temperature, oil_pressure, oil_level_alarm, oil_level_trip, synced, timestamp
    ) VALUES (
      ?, ?, 1, 1, 1, ?
    )
  `;

  // Fungsi pengirim data
  const sendData = async () => {
    try {
      // Data dibuat sedikit berfluktuasi agar grafik di dashboard bergerak
      const overVoltage = 300.5 + (Math.random() * 5); // Batas wajar 240, dikirim ~302 V
      const overCurrent = 4000.0 + (Math.random() * 50); // Batas wajar 3000, dikirim ~4020 A
      const overFrequency = 65.5 + (Math.random()); // Batas wajar 50.5, dikirim ~66 Hz
      
      const overOilTemp = 110.5 + (Math.random() * 5); // Batas wajar 80, dikirim ~112 C
      const overOilPress = 5.0 + (Math.random()); // Batas wajar mungkin 2, dikirim ~5.5 Bar
      
      const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');

      // Insert Electrical
      await connection.execute(elecQuery, [
        overVoltage, overVoltage, overVoltage, // Phase Voltage A, B, C
        overCurrent, overCurrent, overCurrent, // Phase Current A, B, C
        overFrequency,                         // Frequency
        timestamp
      ]);

      // Insert Oil
      await connection.execute(oilQuery, [
        overOilTemp, overOilPress, timestamp
      ]);

      console.log(`[${timestamp}] Data terkirim! (V: ${overVoltage.toFixed(1)}, I: ${overCurrent.toFixed(1)}, Oil Temp: ${overOilTemp.toFixed(1)}°C)`);
    } catch (error) {
      console.error('Gagal memasukkan data:', error.message);
    }
  };

  // Panggil pertama kali langsung
  await sendData();

  // Looping setiap 1 detik (1000 ms)
  const intervalId = setInterval(sendData, 1000);

  // Tangkap event saat user menekan Ctrl+C di terminal
  process.on('SIGINT', async () => {
    console.log("\n\nMematikan sistem pengiriman data...");
    clearInterval(intervalId);
    await connection.end();
    console.log("Koneksi database ditutup dengan aman. Sampai jumpa!");
    process.exit(0); // Keluar program
  });
}

triggerAlarm().catch(console.error);
