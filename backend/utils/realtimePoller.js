const { getDbConnection } = require('./db');

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
                phaseA: latestElectrical.phase_a,
                phaseB: latestElectrical.phase_b,
                phaseC: latestElectrical.phase_c,
                lineAB: latestElectrical.line_ab,
                lineBC: latestElectrical.line_bc,
                lineCA: latestElectrical.line_ca,
                currentA: latestElectrical.current_a,
                currentB: latestElectrical.current_b,
                currentC: latestElectrical.current_c,
                frequency: latestElectrical.frequency,
                power: latestElectrical.power,
                energy: latestElectrical.energy,
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
                oil_temperature: latestOil.oil_temperature,
                oil_pressure: latestOil.oil_pressure,
                oil_level: latestOil.oil_level === 1 ? true : false,
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
