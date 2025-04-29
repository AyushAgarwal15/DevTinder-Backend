const socket = require("socket.io");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { Chat } = require("../models/chat");
const connectionRequest = require("../models/connectionRequest");

// Simple maps to track users and their current active chat room
const activeUsers = new Map(); // userId -> socketId
const userCurrentChatRoom = new Map(); // userId -> targetUserId they're chatting with

const getSecretChatRoomId = (userId, targetUserId) => {
  const chatRoomId = [userId, targetUserId].sort().join("-$%^&*#@!~");
  return crypto.createHash("sha256").update(chatRoomId).digest("hex");
};

const initializeSocket = (server) => {
  const io = socket(server, {
    cors: {
      origin: process.env.CLIENT_ORIGIN,
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Add authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error("Authentication error: Token missing"));
    }

    try {
      // Verify the token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
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
    const userId = socket.user.id;
    console.log(`User ${userId} connected with socket ID ${socket.id}`);

    // Register this user's socket connection
    activeUsers.set(userId, socket.id);

    // User is not in any chat room initially
    userCurrentChatRoom.delete(userId);

    socket.on("joinChat", ({ firstName, userId, targetUserId }) => {
      // Additional validation to ensure user can only join their own chats
      if (userId !== socket.user.id) {
        socket.emit("error", { message: "Unauthorized access to chat room" });
        return;
      }

      console.log(
        `${firstName} (${userId}) is now chatting with ${targetUserId}`
      );

      // Record that this user is now chatting with the target user
      userCurrentChatRoom.set(userId, targetUserId);

      const chatRoomId = getSecretChatRoomId(userId, targetUserId);

      // Join the chat room
      socket.join(chatRoomId);

      // Notify the room that user has joined
      socket.to(chatRoomId).emit("userJoined", { userId, firstName });

      // Load and send chat history
      Chat.findOne({
        participants: { $all: [userId, targetUserId] },
      })
        .then((chat) => {
          if (chat && chat.messages && chat.messages.length > 0) {
            // Format messages for frontend and send history
            const formattedMessages = chat.messages.map((msg) => ({
              senderId: {
                _id: msg.senderId.toString(),
                firstName: "User", // We don't have firstName stored in the message schema
              },
              text: msg.text,
              _id: msg._id.toString(),
              createdAt: msg.createdAt,
              updatedAt: msg.updatedAt,
            }));

            socket.emit("chatHistory", formattedMessages);
          }
        })
        .catch((err) => {
          console.error("Error loading chat history:", err);
          socket.emit("error", { message: "Failed to load chat history" });
        });
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

          // Format message in a way frontend expects
          const message = {
            senderId: {
              _id: userId,
              firstName: firstName,
            },
            text,
            _id: Date.now().toString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

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

          // Emit the message to the chat room for anyone in it
          io.to(chatRoomId).emit("receivedMessage", message);

          // Check if target user is connected
          const targetSocketId = activeUsers.get(targetUserId);

          if (targetSocketId) {
            // Get who target user is currently chatting with
            const targetUserCurrentChat = userCurrentChatRoom.get(targetUserId);

            // If target user is not chatting with the sender, send a notification
            if (targetUserCurrentChat !== userId) {
              console.log(
                `Sending notification to ${targetUserId} about message from ${firstName}`
              );
              io.to(targetSocketId).emit("messageNotification", {
                ...message,
                notification: true, // Add flag to identify this as a notification
              });
            } else {
              console.log(
                `No notification needed - ${targetUserId} is already chatting with ${userId}`
              );
            }
          } else {
            console.log(
              `Target user ${targetUserId} is not connected, can't send notification`
            );
          }
        } catch (error) {
          console.error("Error saving message to database:", error);
          socket.emit("error", { message: "Failed to save message" });
        }
      }
    );

    socket.on("leaveChat", ({ userId, targetUserId }) => {
      if (userId !== socket.user.id) {
        socket.emit("error", { message: "Unauthorized action" });
        return;
      }

      console.log(`${userId} is no longer chatting with ${targetUserId}`);
      userCurrentChatRoom.delete(userId);

      const chatRoomId = getSecretChatRoomId(userId, targetUserId);
      socket.leave(chatRoomId);
    });

    socket.on("disconnect", () => {
      console.log(`User ${userId} disconnected`);

      // Remove user from active users
      activeUsers.delete(userId);

      // Clear chat room tracking
      userCurrentChatRoom.delete(userId);

      // Let others know this user is offline
      socket.broadcast.emit("userOffline", { userId });
    });
  });

  return io;
};

module.exports = initializeSocket;
