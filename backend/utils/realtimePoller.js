const prisma = require("../prismaClient");

const startRealtimePoller = (io) => {
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
          const trafoId = roomName.replace("trafo_", "");
          activeTrafos.push(parseInt(trafoId));
        }
      }

      for (const trafoId of activeTrafos) {
        // Fetch latest electrical reading
        const latestElectrical = await prisma.electricalReading.findFirst({
          where: { transformer_id: trafoId },
          orderBy: { timestamp: "desc" },
        });

        if (latestElectrical) {
          const lastId = lastSeenElectrical[trafoId];
          if (lastId !== latestElectrical.id) {
            lastSeenElectrical[trafoId] = latestElectrical.id;
            io.to(`trafo_${trafoId}`).emit("meter", {
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
        const latestOil = await prisma.oilReading.findFirst({
          where: { transformer_id: trafoId },
          orderBy: { timestamp: "desc" },
        });

        if (latestOil) {
          const lastId = lastSeenOil[trafoId];
          if (lastId !== latestOil.id) {
            lastSeenOil[trafoId] = latestOil.id;
            io.to(`trafo_${trafoId}`).emit("oil_sensor", {
              oil_temperature: latestOil.oil_temperature,
              oil_pressure: latestOil.oil_pressure,
              oil_level: latestOil.oil_level === 1 ? true : false,
              timestamp: latestOil.timestamp,
              adc_connected: true,
            });
          }
        }
      }
    } catch (error) {
      console.error("Realtime poller error:", error);
    }
  }, 2000); // Poll every 2 seconds
};

module.exports = startRealtimePoller;
