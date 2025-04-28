const socket = require("socket.io");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { Chat } = require("../models/chat");
const connectionRequest = require("../models/connectionRequest");

// You should store this in an environment variable
const JWT_SECRET = "ayush@secret.8126";

const getSecretChatRoomId = (userId, targetUserId) => {
  const chatRoomId = [userId, targetUserId].sort().join("-$%^&*#@!~");
  return crypto.createHash("sha256").update(chatRoomId).digest("hex");
};

const initializeSocket = (server) => {
  const io = socket(server, {
    cors: {
      origin: "http://localhost:5173",
      credentials: true,
    },
  });

  // Add authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error("Authentication error: Token missing"));
    }

    try {
      // Verify the token
      const decoded = jwt.verify(token, JWT_SECRET);
      console.log("Decoded token:", decoded);

      // Store user data in socket object
      socket.user = decoded;

      // If your token contains _id instead of id, make sure to handle it
      if (!socket.user.id && socket.user._id) {
        socket.user.id = socket.user._id;
      }

      next();
    } catch (err) {
      console.log("Token verification error:", err);
      return next(new Error("Authentication error: Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    console.log(`User ${socket.user.id} connected`);

    socket.on("joinChat", ({ firstName, userId, targetUserId }) => {
      // Additional validation to ensure user can only join their own chats
      if (userId !== socket.user.id) {
        socket.emit("error", { message: "Unauthorized access to chat room" });
        return;
      }

      const chatRoomId = getSecretChatRoomId(userId, targetUserId);
      socket.join(chatRoomId);
      console.log(`${firstName} joined chat room: ${chatRoomId}`);

      // Notify the room that user has joined
      socket.to(chatRoomId).emit("userJoined", { userId, firstName });
    });

    socket.on(
      "sendMessage",
      async ({ firstName, userId, targetUserId, text }) => {
        try {
          const isConnected = await connectionRequest.findOne({
            $or: [
              {
                fromUserId: userId,
                toUserId: targetUserId,
                status: "accepted",
              },
              {
                fromUserId: targetUserId,
                toUserId: userId,
                status: "accepted",
              },
            ],
          });

          if (!isConnected) {
            socket.emit("error", { message: "You are not connected" });
            return;
          }

          // Additional validation to ensure user can only send messages as themselves
          if (userId !== socket.user.id) {
            socket.emit("error", { message: "Unauthorized message sending" });
            return;
          }

          const chatRoomId = getSecretChatRoomId(userId, targetUserId);
          const message = { firstName, text, userId, timestamp: new Date() };

          // save message to database
          let chat = await Chat.findOne({
            participants: { $all: [userId, targetUserId] },
          });

          if (!chat) {
            // Create a new chat if it doesn't exist
            chat = new Chat({
              participants: [userId, targetUserId],
              messages: [{ senderId: userId, text, createdAt: new Date() }],
            });
          } else {
            // Add message to existing chat
            chat.messages.push({
              senderId: userId,
              text,
              createdAt: new Date(),
            });
          }

          await chat.save();

          // Emit the message to all clients in the room
          io.to(chatRoomId).emit("receivedMessage", message);
          console.log(`Message sent to chat room ${chatRoomId}:`, message);
        } catch (error) {
          console.error("Error saving message to database:", error);
          socket.emit("error", { message: "Failed to save message" });
        }
      }
    );

    socket.on("disconnect", () => {
      console.log(`User ${socket.user.id} disconnected`);
    });
  });

  return io; // Return io instance for potential use elsewhere
};

module.exports = initializeSocket;
