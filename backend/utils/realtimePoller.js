const { getDbConnection } = require("./db");
const rm = require("./readingModel");
const tm = require("./trafoModel");
const sm = require("./statusModel");

const META_TTL_MS = 60 * 1000;

function buildPayloads(point, td, statusRow) {
  const full = rm.computeDerived(point, td);
  const meter = { ...full, modbus_connected: true };
  const oil = {
    oil_temperature: point.oil_temperature,
    oil_pressure: point.oil_pressure,
    oil_level: point.oilLevelRaw === 1,
    ...sm.oilFlags(statusRow ? statusRow.OilLevel : undefined),
    timestamp: point.timestamp,
    adc_connected: true,
  };
  return { meter, oil };
}

function startRealtimePoller(io, activeSubscriptions, roomIntervals) {
  const lastSeen = {};
  const lastEmitTime = {};
  const metaCache = new Map(); // roomName -> { at, td, status }

  async function getMeta(db, trafoId, roomName) {
    const cached = metaCache.get(roomName);
    if (cached && Date.now() - cached.at < META_TTL_MS) return cached;
    const [td, status] = await Promise.all([
      tm.getTransformerData(db, trafoId),
      tm.getStatusRow(db, trafoId),
    ]);
    const meta = { at: Date.now(), td, status };
    metaCache.set(roomName, meta);
    return meta;
  }

  setInterval(async () => {
    try {
      const rooms = io.sockets.adapter.rooms;
      const active = [];
      for (const [roomName, clients] of rooms.entries()) {
        if (!roomName.startsWith("trafo_") || clients.size === 0) continue;
        const dbName = activeSubscriptions.get(roomName);
        if (!dbName) continue;
        const trafoId =
          parseInt(roomName.slice(`trafo_${dbName}_`.length), 10) || 1;
        active.push({ roomName, dbName, trafoId });
      }
      const now = Date.now();

      await Promise.allSettled(
        active.map(async ({ roomName, dbName, trafoId }) => {
          const interval = roomIntervals.get(roomName) ?? 0;
          if (interval > 0 && now - (lastEmitTime[roomName] || 0) < interval)
            return;
          try {
            const db = await getDbConnection(dbName);
            const point = await rm.getLatest(db, trafoId);
            if (!point || lastSeen[roomName] === point.timestamp) return;
            lastSeen[roomName] = point.timestamp;
            lastEmitTime[roomName] = now;
            const { td, status } = await getMeta(db, trafoId, roomName);
            const { meter, oil } = buildPayloads(point, td, status);
            io.to(roomName).emit("meter", meter);
            io.to(roomName).emit("oil_sensor", oil);
          } catch (err) {
            if (err.code === "ER_BAD_DB_ERROR") {
              console.warn(
                `Database ${dbName} tidak ada. Room ${roomName} dihapus dari polling.`,
              );
              activeSubscriptions.delete(roomName);
            } else {
              console.error(
                `Error polling ${dbName} untuk ${roomName}:`,
                err.message,
              );
            }
          }
        }),
      );
    } catch (error) {
      console.error("Realtime poller error:", error);
    }
  }, 1000);
}

startRealtimePoller.buildPayloads = buildPayloads;
module.exports = startRealtimePoller;
module.exports.buildPayloads = buildPayloads;
