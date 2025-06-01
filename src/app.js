const path = require("path");
const envPath = path.resolve(process.cwd(), ".env");

require("dotenv").config({ path: envPath });
const express = require("express");
const connectDB = require("./config/database");
const app = express();
const cookieParser = require("cookie-parser");
const cors = require("cors");
const http = require("http");
const mongoose = require("mongoose");

// Define allowed origins based on environment
const allowedOrigins = [
  process.env.CLIENT_ORIGIN,
  "https://devtinder-ayush.vercel.app",
  "http://localhost:5173",
  "http://localhost:3000",
];

// Configure CORS with more options
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.log("Blocked by CORS:", origin);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Cookie",
    ],
    exposedHeaders: ["set-cookie"],
  })
);

// For preflight requests
app.options("*", cors());

// Increase payload limit for profile pictures
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Configure cookie parser with secure options
const cookieConfig = {
  secure: process.env.NODE_ENV === "production",
  httpOnly: true,
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
};
app.use(cookieParser(process.env.COOKIE_SECRET, cookieConfig));

// Initialize database connection before setting up routes
let isConnected = false;
let connectionRetries = 0;
const MAX_RETRIES = 5;
const RETRY_INTERVAL = 2000;

// Middleware to ensure database connection with timeout
const ensureDbConnected = async (req, res, next) => {
  if (!isConnected) {
    try {
      while (!isConnected && connectionRetries < MAX_RETRIES) {
        try {
          const mongoose = await connectDB();
          // Wait for the connection to be ready
          if (mongoose.connection.readyState !== 1) {
            await new Promise((resolve, reject) => {
              const timeout = setTimeout(() => {
                reject(new Error("Connection timeout"));
              }, 10000);

              mongoose.connection.once("connected", () => {
                clearTimeout(timeout);
                resolve();
              });
            });
          }
          isConnected = true;
          connectionRetries = 0;
          console.log("Database connection established.");
          break;
        } catch (error) {
          connectionRetries++;
          console.error(
            `Database connection attempt ${connectionRetries} failed:`,
            error
          );
          if (connectionRetries === MAX_RETRIES) {
            throw new Error("Maximum connection retries reached");
          }
          await new Promise((resolve) => setTimeout(resolve, RETRY_INTERVAL));
        }
      }
    } catch (error) {
      console.error("All database connection attempts failed:", error);
      return res.status(503).json({
        status: "error",
        message: "Service temporarily unavailable. Please try again later.",
      });
    }
  }
  next();
};

// Apply the database connection middleware to all routes except health check
app.use((req, res, next) => {
  if (req.path === "/health") {
    return next();
  }
  return ensureDbConnected(req, res, next);
});

// Health check endpoint with detailed status
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    database: {
      connected: isConnected,
      retries: connectionRetries,
      readyState: isConnected ? mongoose.connection.readyState : 0,
    },
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Global error handler:", err);
  res.status(err.status || 500).json({
    status: "error",
    message:
      process.env.NODE_ENV === "production"
        ? "An unexpected error occurred"
        : err.message,
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
  });
});

const authRouter = require("./routes/auth");
const profileRouter = require("./routes/profile");
const requestRouter = require("./routes/request");
const userRouter = require("./routes/user");
const chatRouter = require("./routes/chat");
const githubRouter = require("./routes/github");
const testRouter = require("./routes/test");

const initializeSocket = require("./utils/socket");

// Route registration
app.use("/", authRouter);
app.use("/", profileRouter);
app.use("/", requestRouter);
app.use("/", userRouter);
app.use("/", chatRouter);
app.use("/", githubRouter);
app.use("/", testRouter);

const server = http.createServer(app);

// Initialize socket with error handling
try {
  initializeSocket(server);
  console.log("Socket.IO initialized successfully");
} catch (error) {
  console.error("Failed to initialize Socket.IO:", error);
}

// Start server based on environment
if (process.env.NODE_ENV !== "production") {
  // Development
  const startServer = async () => {
    try {
      const mongoose = await connectDB();
      // Wait for the connection to be ready
      if (mongoose.connection.readyState !== 1) {
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Initial connection timeout"));
          }, 30000);

          mongoose.connection.once("connected", () => {
            clearTimeout(timeout);
            resolve();
          });
        });
      }
      isConnected = true;
      console.log("Database connection established.");
      const port = process.env.PORT || 3000;
      server.listen(port, () => {
        console.log(`Server is running on port ${port}`);
      });
    } catch (err) {
      console.error("Failed to start server:", err);
      process.exit(1);
    }
  };

  startServer();
} else {
  // Production (Vercel)
  const initializeProduction = async () => {
    try {
      const mongoose = await connectDB();
      // Wait for the connection to be ready
      if (mongoose.connection.readyState !== 1) {
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Initial connection timeout"));
          }, 30000);

          mongoose.connection.once("connected", () => {
            clearTimeout(timeout);
            resolve();
          });
        });
      }
      isConnected = true;
      console.log("Database connection established in production.");
    } catch (err) {
      console.error("Database connection failed in production:", err);
      // Don't exit in production, let Vercel handle the error
    }
  };

  initializeProduction();
}

// Handle uncaught exceptions and rejections
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  // In production, you might want to notify your error tracking service here
});

process.on("unhandledRejection", (error) => {
  console.error("Unhandled Rejection:", error);
  // In production, you might want to notify your error tracking service here
});

module.exports = app;
