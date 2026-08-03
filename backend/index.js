const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
require("dotenv").config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.set("io", io);

const activeSubscriptions = new Map();
const roomIntervals = new Map(); // stores polling interval per room

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("subscribe_transformer", (data) => {

    const trafoId = data.trafoId || data;
    const dbName = data.dbName;

    if (trafoId && dbName) {
      const roomName = `trafo_${dbName}_${trafoId}`;
      socket.join(roomName);
      activeSubscriptions.set(roomName, dbName);
      console.log(`Client ${socket.id} subscribed to ${roomName} for DB: ${dbName}`);
    }
  });

  socket.on("set_poll_interval", (interval) => {
    const ms = parseInt(interval, 10);
    // Find which trafo room this socket belongs to
    for (const roomName of socket.rooms) {
      if (roomName.startsWith("trafo_")) {
        roomIntervals.set(roomName, ms >= 0 ? ms : 5000);
        console.log(`Room ${roomName} poll interval set to ${ms}ms`);
      }
    }
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
    for (const roomName of socket.rooms) {
      if (roomName.startsWith("trafo_")) {
        const room = io.sockets.adapter.rooms.get(roomName);
        if (!room || room.size === 0) {
          activeSubscriptions.delete(roomName);
          roomIntervals.delete(roomName);
          console.log(`Removed ${roomName} from active subscriptions`);
        }
      }
    }
  });

  socket.on("disconnecting", () => {
    for (const roomName of socket.rooms) {
      if (roomName.startsWith("trafo_")) {
        const room = io.sockets.adapter.rooms.get(roomName);
        if (room && room.size === 1) {
          activeSubscriptions.delete(roomName);
          roomIntervals.delete(roomName);
          console.log(`Removed ${roomName} from active subscriptions as last client is leaving`);
        }
      }
    }
  });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Intranet connection active" });
});

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const trendRoutes = require("./routes/trends");
const superadminRoutes = require("./routes/superadmin");
const superuserUsersRoutes = require("./routes/superuser_users");
const profileRoutes = require("./routes/profile");
const analyticsRoutes = require("./routes/analytics");

app.use("/api", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/trends", trendRoutes);
app.use("/api/superadmin", superadminRoutes);
app.use("/api/superuser-users", superuserUsersRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/analytics", analyticsRoutes);


const startRealtimePoller = require("./utils/realtimePoller");
const { initWhatsApp } = require("./utils/whatsappClient");
const whatsappRoutes = require("./routes/whatsappRoutes");

app.use("/api/whatsapp", whatsappRoutes);

server.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
  startRealtimePoller(io, activeSubscriptions, roomIntervals);

  setTimeout(() => {
    initWhatsApp();
  }, 2000);
});

