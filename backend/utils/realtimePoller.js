const { getDbConnection } = require('./db');
const { calculateEfficiency } = require('./efficiency');
const whatsappClient = require('./whatsappClient');

const waCooldowns = new Map(); // Store last WA sent time per transformer to avoid spam (e.g. 'trafo_dbName_trafoId' -> timestamp)
const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

const startRealtimePoller = (io, activeSubscriptions) => {
  // Store the last seen IDs for each transformer so we don't send duplicates
  const lastSeenElectrical = {};
  const lastSeenOil = {};

  setInterval(async () => {
    try {
      // Find all rooms currently active with prefix "trafo_"
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

      for (const { trafoId, dbName, roomName } of activeTrafos) {
        try {
          const db = await getDbConnection(dbName);

          // Fetch latest electrical reading
          const [elecRows] = await db.execute(
            'SELECT * FROM electrical_readings ORDER BY timestamp DESC LIMIT 1'
          );
          
          if (elecRows.length > 0) {
            const latestElectrical = elecRows[0];
            const lastId = lastSeenElectrical[roomName];
            if (lastId !== latestElectrical.id) {
              lastSeenElectrical[roomName] = latestElectrical.id;
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
              
              // WhatsApp Alert Logic for Frequency
              const currentFreq = parseFloat(latestElectrical.frequency) || 0;
              if (currentFreq > 52.5 && whatsappClient.waReady) {
                const now = Date.now();
                const lastSent = waCooldowns.get(roomName) || 0;
                if (now - lastSent > COOLDOWN_MS) {
                  // We need to alert. Let's find users in this dbName.
                  try {
                    const [users] = await db.execute('SELECT nomor_telpon FROM users WHERE nomor_telpon IS NOT NULL');
                    for (const user of users) {
                      if (user.nomor_telpon) {
                        const msg = `⚠️ *[TMU ALERT - FREKUENSI TINGGI]*\n\nTrafo *${trafoId}* (DB: ${dbName}) terdeteksi memiliki frekuensi tidak normal!\nFrekuensi saat ini: *${currentFreq.toFixed(2)} Hz*\n\nSilakan segera periksa sistem Anda.\n\n_Pesan otomatis dari PT. Bambang Djaja - TMU System_`;
                        await whatsappClient.sendWhatsAppMessage(user.nomor_telpon, msg).catch(() => {});
                      }
                    }
                    waCooldowns.set(roomName, now);
                  } catch (waErr) {
                    console.error('Gagal mengirim WA Alert:', waErr.message);
                  }
                }
              }
            }
          }

          // Fetch latest oil reading
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
                oil_level: true, // Data terletak di backend bukan db
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
  }, 5000); // Poll every 5 seconds
};

module.exports = startRealtimePoller;
