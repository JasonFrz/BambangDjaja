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

const activeSubscriptions = new Map(); // map roomName -> dbName

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("subscribe_transformer", (data) => {
    // data can be { trafoId, dbName }
    const trafoId = data.trafoId || data;
    const dbName = data.dbName;
    
    if (trafoId && dbName) {
      const roomName = `trafo_${dbName}_${trafoId}`;
      socket.join(roomName);
      activeSubscriptions.set(roomName, dbName);
      console.log(`Client ${socket.id} subscribed to ${roomName} for DB: ${dbName}`);
    }
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Intranet connection active" });
});

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const trendRoutes = require("./routes/trends");

app.use("/api", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/trends", trendRoutes);

const startRealtimePoller = require("./utils/realtimePoller");
const { initWhatsApp } = require("./utils/whatsappClient");
const whatsappRoutes = require("./routes/whatsappRoutes");

app.use("/api/whatsapp", whatsappRoutes);

server.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
  startRealtimePoller(io, activeSubscriptions);
  
  // Initialize WhatsApp in the background
  setTimeout(() => {
    initWhatsApp();
  }, 2000);
});

