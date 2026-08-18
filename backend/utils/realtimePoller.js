const { getDbConnection } = require('./db');
const { calculateEfficiency } = require('./efficiency');
const whatsappClient = require('./whatsappClient');
const emailClient = require('./emailClient');

const waCooldowns = new Map(); 
const COOLDOWN_MS = 5 * 60 * 1000; 

const startRealtimePoller = (io, activeSubscriptions, roomIntervals) => {
  
  const lastSeenElectrical = {};
  const lastSeenOil = {};
  const lastEmitTime = {}; // tracks last emit time per room

  // Base tick every 1 second — actual emit respects per-room interval
  setInterval(async () => {
    try {
      
      const rooms = io.sockets.adapter.rooms;
      const activeTrafos = [];

      for (const [roomName, clients] of rooms.entries()) {
        if (roomName.startsWith("trafo_") && clients.size > 0) {
          const dbName = activeSubscriptions.get(roomName);
          if (dbName) {
            const trafoId = roomName.replace("trafo_", "");
            activeTrafos.push({ trafoId, dbName, roomName });
          }
        }
      }

      const now = Date.now();

      for (const { trafoId, dbName, roomName } of activeTrafos) {
        // Check if enough time has passed for this room's interval
        const interval = roomIntervals.get(roomName) ?? 5000; // default 5s
        const lastEmit = lastEmitTime[roomName] || 0;
        
        // interval 0 = real-time, always emit
        if (interval > 0 && now - lastEmit < interval) {
          continue; // skip this room, interval not elapsed yet
        }

        try {
          const db = await getDbConnection(dbName);

          const [elecRows] = await db.execute(
            'SELECT * FROM electrical_readings ORDER BY timestamp DESC LIMIT 1'
          );
          
          if (elecRows.length > 0) {
            const latestElectrical = elecRows[0];
            const lastId = lastSeenElectrical[roomName];
            if (lastId !== latestElectrical.id) {
              lastSeenElectrical[roomName] = latestElectrical.id;
              lastEmitTime[roomName] = now;
              io.to(roomName).emit("meter", {
                phaseA: parseFloat(latestElectrical.phase_a_v) || 0,
                phaseB: parseFloat(latestElectrical.phase_b_v) || 0,
                phaseC: parseFloat(latestElectrical.phase_c_v) || 0,
                lineAB: parseFloat(latestElectrical.line_ab_v) || 0,
                lineBC: parseFloat(latestElectrical.line_bc_v) || 0,
                lineCA: parseFloat(latestElectrical.line_ca_v) || 0,
                currentA: parseFloat(latestElectrical.current_a) || 0,
                currentB: parseFloat(latestElectrical.current_b) || 0,
                currentC: parseFloat(latestElectrical.current_c) || 0,
                currentN: parseFloat(latestElectrical.current_n) || 0,
                currentUnbalance: parseFloat(latestElectrical.current_unbalance) || 0,
                powerActiveTotal: parseFloat(latestElectrical.power_active_total) || 0,
                powerReactiveTotal: parseFloat(latestElectrical.power_reactive_total) || 0,
                powerApparentTotal: parseFloat(latestElectrical.power_apparent_total) || 0,
                pfTotal: parseFloat(latestElectrical.pf_total) || 0,
                powerActiveA: parseFloat(latestElectrical.power_active_a) || 0,
                powerActiveB: parseFloat(latestElectrical.power_active_b) || 0,
                powerActiveC: parseFloat(latestElectrical.power_active_c) || 0,
                frequency: parseFloat(latestElectrical.frequency) || 0,
                energyActiveTotal: parseFloat(latestElectrical.energy_active_total) || 0,
                energyReactiveTotal: parseFloat(latestElectrical.energy_reactive_total) || 0,
                avgPhaseV: parseFloat(latestElectrical.avg_phase_v) || 0,
                avgLineV: parseFloat(latestElectrical.avg_line_v) || 0,
                avgCurrent: parseFloat(latestElectrical.avg_current) || 0,
                onOffStatus: parseInt(latestElectrical.on_off_status) || 0,
                relayStatus: parseInt(latestElectrical.relay_status) || 0,
                alarmStatus: parseInt(latestElectrical.alarm_status) || 0,
                synced: parseInt(latestElectrical.synced) || 0,
                efficiency: calculateEfficiency(latestElectrical.current_a, latestElectrical.current_b, latestElectrical.current_c),
                timestamp: latestElectrical.timestamp,
                modbus_connected: true,
              });

              const currentFreq = parseFloat(latestElectrical.frequency) || 0;
              if (currentFreq > 52.5 && whatsappClient.waReady) {
                const alertNow = Date.now();
                const lastSent = waCooldowns.get(roomName) || 0;
                if (alertNow - lastSent > COOLDOWN_MS) {
                  waCooldowns.set(roomName, alertNow);
                  
                  // Jalankan proses kirim pesan secara asynchronous (non-blocking) agar poller utama tidak terhenti
                  (async () => {
                    try {
                      const [columnsInfo] = await db.execute("SHOW COLUMNS FROM users");
                      const columns = columnsInfo.map(c => c.Field);
                      
                      if (columns.includes('nomor_telpon') || columns.includes('email')) {
                        let selectCols = ['nomor_telpon'];
                        if (columns.includes('email')) selectCols.push('email');
                        
                        const [users] = await db.execute(`SELECT ${selectCols.join(', ')} FROM users`);
                        for (const user of users) {
                          const phone = user.nomor_telpon ? user.nomor_telpon.trim() : '';
                          const email = user.email ? user.email.trim() : '';
                          
                          const msg = `⚠️ *[TMU ALERT - FREKUENSI TINGGI]*\n\nTrafo *${trafoId}* (DB: ${dbName}) terdeteksi memiliki frekuensi tidak normal!\nFrekuensi saat ini: *${currentFreq.toFixed(2)} Hz*\n\nSilakan segera periksa sistem Anda.\n\n_Pesan otomatis dari PT. Bambang Djaja - TMU System_`;
                          const emailSubject = `[TMU ALERT] Frekuensi Tinggi Terdeteksi pada Trafo ${trafoId}`;
                          const emailMsg = `Peringatan: Frekuensi tinggi terdeteksi!\n\nTrafo: ${trafoId}\nDatabase: ${dbName}\nFrekuensi saat ini: ${currentFreq.toFixed(2)} Hz\n\nSilakan segera periksa sistem Anda.\n\nPesan otomatis dari PT. Bambang Djaja - TMU System`;

                          if (phone.length >= 10) {
                            await whatsappClient.sendWhatsAppMessage(phone, msg).catch(() => {});
                            // Tambahkan delay agar puppeteer whatsapp tidak crash saat kirim massal
                            await new Promise(resolve => setTimeout(resolve, 3000));
                          }
                          
                          if (email && email.includes('@')) {
                            await emailClient.sendEmailMessage(email, emailSubject, emailMsg).catch(() => {});
                          }
                        }
                      }
                    } catch (waErr) {
                      console.error('Gagal mengirim WA/Email Alert:', waErr.message);
                    }
                  })();
                }
              }
            }
          }

          const [oilRows] = await db.execute(
            'SELECT * FROM oil_readings ORDER BY timestamp DESC LIMIT 1'
          );

          if (oilRows.length > 0) {
            const latestOil = oilRows[0];
            const lastId = lastSeenOil[roomName];
            if (lastId !== latestOil.id) {
              lastSeenOil[roomName] = latestOil.id;
              io.to(roomName).emit("oil_sensor", {
                oil_temperature: parseFloat(latestOil.oil_temperature) || 0,
                oil_pressure: parseFloat(latestOil.oil_pressure) || 0,
                oil_level: latestOil.oil_level == 1,
                oil_level_alarm: (latestOil.oil_level_alarm == 1 || latestOil.oil_level_alarm === true) ? 1 : 0,
                oil_level_trip: (latestOil.oil_level_trip == 1 || latestOil.oil_level_trip === true) ? 1 : 0,
                timestamp: latestOil.timestamp,
                adc_connected: true,
              });
            }
          }
        } catch (dbErr) {
          console.error(`Error polling DB ${dbName} for ${roomName}:`, dbErr.message);
        }
      }
    } catch (error) {
      console.error("Realtime poller error:", error);
    }
  }, 1000); // Base tick every 1s; per-room interval controls actual emission
};

module.exports = startRealtimePoller;
