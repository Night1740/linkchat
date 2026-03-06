require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const mongoose = require("mongoose");
const { Server } = require("socket.io");

const authRoutes = require("./routes/auth");
const groupRoutes = require("./routes/groups");
const messageRoutes = require("./routes/messages");
const linkRoutes = require("./routes/links");
const registerSocketHandlers = require("./sockets/chat");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",           // Allow Chrome extension (chrome-extension://) and localhost
    methods: ["GET", "POST"],
    credentials: false,
  },
  // FIX: Allow both polling and websocket so the extension can complete the handshake
  transports: ["polling", "websocket"],
  allowEIO3: true,         // backwards-compat for older socket.io clients
});

// Middleware
app.use(cors({ origin: "*" }));
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/links", linkRoutes);

// Health check
app.get("/", (req, res) => res.json({ status: "LinkChat API running" }));

// Socket.IO
registerSocketHandlers(io);

// MongoDB Connection
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("✅ Connected to MongoDB Atlas");
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  });