const socket = require("socket.io");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { Chat } = require("../models/chat");
const User = require("../models/user");
const connectionRequest = require("../models/connectionRequest");
const mongoose = require("mongoose");

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
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error("Authentication error: Token missing"));
    }

    try {
      // Verify the token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Find the user in MongoDB
      let user;
      if (decoded.isGitHubUser) {
        user = await User.findOne({ githubId: decoded.githubId });
      } else {
        user = await User.findOne({ _id: decoded._id });
      }

      if (!user) {
        return next(new Error("User not found"));
      }

      // Store user data in socket object
      socket.user = {
        _id: user._id.toString(),
        firstName: user.firstName,
        lastName: user.lastName,
        isGitHubUser: user.isGitHubUser,
      };

      next();
    } catch (err) {
      console.log("Token verification error:", err);
      return next(new Error("Authentication error: Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.user._id;
    console.log(`User ${userId} connected with socket ID ${socket.id}`);

    // Register this user's socket connection
    activeUsers.set(userId, socket.id);

    // User is not in any chat room initially
    userCurrentChatRoom.delete(userId);

    socket.on("joinChat", async ({ firstName, userId, targetUserId }) => {
      // Additional validation to ensure user can only join their own chats
      if (userId !== socket.user._id) {
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

      try {
        // Load and send chat history with populated user data
        const chat = await Chat.findOne({
          participants: { $all: [userId, targetUserId] },
        }).populate({
          path: "messages.senderId",
          select: "firstName lastName",
        });

        if (chat && chat.messages && chat.messages.length > 0) {
          // Format messages for frontend
          const formattedMessages = chat.messages.map((msg) => ({
            senderId: {
              _id: msg.senderId._id.toString(),
              firstName: msg.senderId.firstName || "User",
            },
            text: msg.text,
            _id: msg._id.toString(),
            createdAt: msg.createdAt,
            updatedAt: msg.updatedAt,
          }));

          socket.emit("chatHistory", formattedMessages);
        }
      } catch (err) {
        console.error("Error loading chat history:", err);
        socket.emit("error", { message: "Failed to load chat history" });
      }
    });

    socket.on(
      "sendMessage",
      async ({ firstName, userId, targetUserId, text }) => {
        try {
          // Ensure we're working with valid ObjectIds
          const userObjectId = mongoose.Types.ObjectId.isValid(userId)
            ? new mongoose.Types.ObjectId(userId)
            : null;
          const targetObjectId = mongoose.Types.ObjectId.isValid(targetUserId)
            ? new mongoose.Types.ObjectId(targetUserId)
            : null;

          if (!userObjectId || !targetObjectId) {
            socket.emit("error", { message: "Invalid user IDs" });
            return;
          }

          const isConnected = await connectionRequest.findOne({
            $or: [
              {
                fromUserId: userObjectId,
                toUserId: targetObjectId,
                status: "accepted",
              },
              {
                fromUserId: targetObjectId,
                toUserId: userObjectId,
                status: "accepted",
              },
            ],
          });

          if (!isConnected) {
            socket.emit("error", { message: "You are not connected" });
            return;
          }

          // Additional validation to ensure user can only send messages as themselves
          if (userId !== socket.user._id) {
            socket.emit("error", { message: "Unauthorized message sending" });
            return;
          }

          const chatRoomId = getSecretChatRoomId(userId, targetUserId);

          // Format message
          const messageData = {
            senderId: userObjectId,
            text,
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          // Save message to database
          let chat = await Chat.findOne({
            participants: { $all: [userObjectId, targetObjectId] },
          });

          if (!chat) {
            chat = new Chat({
              participants: [userObjectId, targetObjectId],
              messages: [messageData],
            });
          } else {
            chat.messages.push(messageData);
          }

          await chat.save();

          // Format message for frontend
          const frontendMessage = {
            senderId: {
              _id: userId,
              firstName: firstName,
            },
            text,
            _id: chat.messages[chat.messages.length - 1]._id.toString(),
            createdAt: messageData.createdAt.toISOString(),
            updatedAt: messageData.updatedAt.toISOString(),
          };

          // Emit the message to the chat room
          io.to(chatRoomId).emit("receivedMessage", frontendMessage);

          // Handle notifications
          const targetSocketId = activeUsers.get(targetUserId);
          if (targetSocketId) {
            const targetUserCurrentChat = userCurrentChatRoom.get(targetUserId);
            if (targetUserCurrentChat !== userId) {
              io.to(targetSocketId).emit("messageNotification", {
                ...frontendMessage,
                notification: true,
              });
            }
          }
        } catch (error) {
          console.error("Error sending message:", error);
          socket.emit("error", { message: "Failed to send message" });
        }
      }
    );

    socket.on("leaveChat", ({ userId, targetUserId }) => {
      if (userId !== socket.user._id) {
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
      activeUsers.delete(userId);
      userCurrentChatRoom.delete(userId);
    });
  });

  return io;
};

module.exports = initializeSocket;
