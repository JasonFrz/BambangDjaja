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

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Intranet connection active" });
});

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const transformerRoutes = require("./routes/transformers");
const provisioningRoutes = require("./routes/provisioning");
const trendRoutes = require("./routes/trends");
const whatsappRoutes = require("./routes/whatsapp");
const syncRoutes = require("./routes/sync");

app.use("/api", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/transformers", transformerRoutes);
app.use("/api/provision", provisioningRoutes);
app.use("/api/trends", trendRoutes);
app.use("/api/whatsapp", whatsappRoutes);
app.use("/api/sync", syncRoutes);

server.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
