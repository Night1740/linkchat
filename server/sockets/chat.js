const jwt = require("jsonwebtoken");
const Message = require("../models/Message");
const Group = require("../models/Group");

const registerSocketHandlers = (io) => {
  // Auth middleware for sockets
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error("Authentication error: No token"));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      next();
    } catch (err) {
      next(new Error("Authentication error: Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    console.log(`🔌 Socket connected: ${socket.id} (user: ${socket.userId})`);

    // Join a group room
    socket.on("joinGroup", async ({ groupId, username }) => {
      try {
        const group = await Group.findById(groupId);
        if (!group) return socket.emit("error", { message: "Group not found" });

        if (!group.members.map(String).includes(String(socket.userId))) {
          return socket.emit("error", { message: "Not a member of this group" });
        }

        socket.join(groupId);
        socket.currentGroupId = groupId;
        socket.username = username;
        console.log(`👥 ${username} joined room ${groupId}`);
      } catch (err) {
        socket.emit("error", { message: err.message });
      }
    });

    // Leave a group room
    socket.on("leaveGroup", ({ groupId }) => {
      socket.leave(groupId);
      console.log(`🚪 Socket ${socket.id} left room ${groupId}`);
    });

    // Send a message
    socket.on("sendMessage", async ({ groupId, message }) => {
      try {
        if (!message || !message.trim()) return;

        const group = await Group.findById(groupId);
        if (!group || !group.members.map(String).includes(String(socket.userId))) {
          return socket.emit("error", { message: "Cannot send message" });
        }

        const newMessage = await Message.create({
          groupId,
          senderId: socket.userId,
          senderName: socket.username || "Unknown",
          message: message.trim(),
        });

        io.to(groupId).emit("receiveMessage", {
          _id: newMessage._id,
          groupId: newMessage.groupId,
          senderId: newMessage.senderId,
          senderName: newMessage.senderName,
          message: newMessage.message,
          createdAt: newMessage.createdAt,
        });
      } catch (err) {
        socket.emit("error", { message: err.message });
      }
    });

    socket.on("disconnect", () => {
      console.log(`🔌 Socket disconnected: ${socket.id}`);
    });
  });
};

module.exports = registerSocketHandlers;
