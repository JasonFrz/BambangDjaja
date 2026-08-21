const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const app = express();
app.set("trust proxy", 1); // Allow rate limiting behind proxies like ngrok

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: function (origin, callback) {
      callback(null, origin || "*");
    },
    methods: ["GET", "POST"],
    credentials: true,
    allowedHeaders: ["ngrok-skip-browser-warning"]
  },
});

const PORT = process.env.PORT || 5000;

// Security Headers
app.use(helmet());

// Rate Limiting (Maksimal 200 request per 15 menit per IP)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 1000, 
  message: { error: "Terlalu banyak request dari IP ini, coba lagi nanti." },
  standardHeaders: true, 
  legacyHeaders: false, 
});

// Apply rate limiter global (atau bisa ditaruh di app.use("/api", limiter) saja)
app.use("/api/", limiter);

app.use(cors({
  origin: function (origin, callback) {
    // Allow any origin for development/ngrok
    callback(null, origin || "*");
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true
}));
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
      // Leave previous trafo rooms to prevent multiple subscriptions from one client
      for (const room of socket.rooms) {
        if (room.startsWith("trafo_")) {
          socket.leave(room);
          const roomData = io.sockets.adapter.rooms.get(room);
          if (!roomData || roomData.size === 0) {
            activeSubscriptions.delete(room);
            roomIntervals.delete(room);
            console.log(`Removed ${room} from active subscriptions as client switched trafo`);
          }
        }
      }

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
const adminRoutes = require("./routes/admin");
const superuserUsersRoutes = require("./routes/superuser_users");
const profileRoutes = require("./routes/profile");
const analyticsRoutes = require("./routes/analytics");
const layoutsRoutes = require("./routes/layouts");
const settingsRoutes = require("./routes/settings");
const { verifyToken } = require("./utils/authMiddleware");
const { router: alertsRoutes } = require("./routes/alerts");
const trafoRoutes = require("./routes/trafo");

app.use("/api", authRoutes); // /api/login is inside here, so it remains unprotected
app.use("/api/users", verifyToken, userRoutes);
app.use("/api/trends", verifyToken, trendRoutes);
app.use("/api/admin", verifyToken, adminRoutes);
app.use("/api/superuser-users", verifyToken, superuserUsersRoutes);
app.use("/api/profile", verifyToken, profileRoutes);
app.use("/api/analytics", verifyToken, analyticsRoutes);
app.use("/api/layouts", verifyToken, layoutsRoutes);
app.use("/api/settings", verifyToken, settingsRoutes);
app.use("/api/alerts", verifyToken, alertsRoutes);
app.use("/api/trafo", verifyToken, trafoRoutes);

const startRealtimePoller = require("./utils/realtimePoller");
const { initWhatsApp } = require("./utils/whatsappClient");
const whatsappRoutes = require("./routes/whatsappRoutes");
const autoAddIndexes = require("./utils/autoIndex");

app.use("/api/whatsapp", verifyToken, whatsappRoutes);

server.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
  
  // Otomatis tambahkan index di database baru saat server menyala
  autoAddIndexes();
  
  startRealtimePoller(io, activeSubscriptions, roomIntervals);

  setTimeout(() => {
    initWhatsApp();
  }, 2000);
});

