const path = require("path");
const envPath = path.resolve(process.cwd(), ".env");

require("dotenv").config({ path: envPath });
const express = require("express");
const connectDB = require("./config/database");
const app = express();
const cookieParser = require("cookie-parser");
const cors = require("cors");
const http = require("http");

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

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// Initialize database connection before setting up routes
let isConnected = false;
let connectionRetries = 0;
const MAX_RETRIES = 3;

// Middleware to ensure database connection
const ensureDbConnected = async (req, res, next) => {
  if (!isConnected) {
    try {
      while (!isConnected && connectionRetries < MAX_RETRIES) {
        try {
          await connectDB();
          isConnected = true;
          console.log("Database connection established.");
        } catch (error) {
          connectionRetries++;
          console.error(
            `Database connection attempt ${connectionRetries} failed:`,
            error
          );
          if (connectionRetries === MAX_RETRIES) {
            throw error;
          }
          // Wait before retrying
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }
    } catch (error) {
      console.error("All database connection attempts failed:", error);
      return res.status(500).json({
        status: "error",
        message: "Database connection failed. Please try again later.",
      });
    }
  }
  next();
};

// Apply the database connection middleware to all routes
app.use(ensureDbConnected);

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
  connectDB()
    .then(() => {
      isConnected = true;
      console.log("Database connection established.");
      const port = process.env.PORT || 3000;
      server.listen(port, () => {
        console.log(`Server is running on port ${port}`);
      });
    })
    .catch((err) => {
      console.error("Database connection failed:", err);
      process.exit(1);
    });
} else {
  // Production (Vercel)
  connectDB()
    .then(() => {
      isConnected = true;
      console.log("Database connection established in production.");
    })
    .catch((err) => {
      console.error("Database connection failed in production:", err);
      // Don't exit in production, let Vercel handle the error
    });
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
