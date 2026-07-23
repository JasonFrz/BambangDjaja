const { getDbConnection } = require('./db');
const { calculateEfficiency } = require('./efficiency');

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
                phaseA: parseFloat(latestElectrical.phase_a) || 0,
                phaseB: parseFloat(latestElectrical.phase_b) || 0,
                phaseC: parseFloat(latestElectrical.phase_c) || 0,
                lineAB: parseFloat(latestElectrical.line_ab) || 0,
                lineBC: parseFloat(latestElectrical.line_bc) || 0,
                lineCA: parseFloat(latestElectrical.line_ca) || 0,
                currentA: parseFloat(latestElectrical.current_a) || 0,
                currentB: parseFloat(latestElectrical.current_b) || 0,
                currentC: parseFloat(latestElectrical.current_c) || 0,
                frequency: parseFloat(latestElectrical.frequency) || 0,
                power: parseFloat(latestElectrical.power) || 0,
                energy: parseFloat(latestElectrical.energy) || 0,
                efficiency: calculateEfficiency(latestElectrical.current_a, latestElectrical.current_b, latestElectrical.current_c),
                timestamp: latestElectrical.timestamp,
                modbus_connected: true,
              });
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
  }, 2000); // Poll every 2 seconds
};

module.exports = startRealtimePoller;
