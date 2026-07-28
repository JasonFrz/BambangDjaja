const express = require("express");
const router = express.Router();
const prisma = require("../prismaClient");
const { authenticateDevice } = require("../middleware/auth");

router.post("/", authenticateDevice, async (req, res) => {
  const transformerId = req.device.transformer_id;

  if (!transformerId) {
    return res.status(400).json({ error: "device belum terdaftar!" });
  }

  const { electrical_readings = [], oil_readings = [] } = req.body;

  try {
    const electricalData = electrical_readings
      .filter((r) => r.timestamp)
      .map((r) => ({
        transformer_id: transformerId,
        timestamp: new Date(r.timestamp),
        phase_a: r.phase_a,
        phase_b: r.phase_b,
        phase_c: r.phase_c,
        line_ab: r.line_ab,
        line_bc: r.line_bc,
        line_ca: r.line_ca,
        current_a: r.current_a,
        current_b: r.current_b,
        current_c: r.current_c,
        frequency: r.frequency,
        power: r.power,
        energy: r.energy,
      }));

    const oilData = oil_readings
      .filter((r) => r.timestamp)
      .map((r) => ({
        transformer_id: transformerId,
        timestamp: new Date(r.timestamp),
        oil_pressure: r.oil_pressure,
        oil_temperature: r.oil_temperature,
      }));

    if (electricalData.length) {
      await prisma.electricalReading.createMany({ data: electricalData });

      const latestE = electricalData[electricalData.length - 1];
      const io = req.app.get("io");
      if (io) {
        io.to("trafo_" + transformerId).emit("meter", {
          phaseA: latestE.phase_a,
          phaseB: latestE.phase_b,
          phaseC: latestE.phase_c,
          lineAB: latestE.line_ab,
          lineBC: latestE.line_bc,
          lineCA: latestE.line_ca,
          currentA: latestE.current_a,
          currentB: latestE.current_b,
          currentC: latestE.current_c,
          frequency: latestE.frequency,
          power: latestE.power,
          energy: latestE.energy,
          modbus_connected: true
        });
      }
    }

    if (oilData.length) {
      await prisma.oilReading.createMany({ data: oilData });

      const latestO = oilData[oilData.length - 1];
      const io = req.app.get("io");
      if (io) {
        io.to("trafo_" + transformerId).emit("oil_sensor", {
          oil_temperature: latestO.oil_temperature,
          oil_pressure: latestO.oil_pressure,
          timestamp: latestO.timestamp,
          adc_connected: true
        });
      }
    }

    await prisma.registeredDevice.update({
      where: { id: req.device.id },
      data: { last_online: new Date(), status: "online" },
    });

    res.status(200).json({
      electrical_ids: electrical_readings
        .filter((r) => r.timestamp)
        .map((r) => r.id),
      oil_ids: oil_readings.filter((r) => r.timestamp).map((r) => r.id),
    });
  } catch (error) {
    console.error("sync ingest error:", error);
    res.status(500).json({ error: "gagal simpan data sync" });
  }
});

module.exports = router;
