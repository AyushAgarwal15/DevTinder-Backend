const mongoose = require("mongoose");

// Don't disable buffering globally
mongoose.set("bufferCommands", true);

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectToDatabase() {
  if (cached.conn) {
    // Check if the connection is still valid
    if (cached.conn.connection.readyState === 1) {
      return cached.conn;
    }
    // If not valid, clear the cache
    cached.conn = null;
    cached.promise = null;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: true,
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      maxPoolSize: 50,
      minPoolSize: 10,
      family: 4,
      autoIndex: true,
      retryWrites: true,
      retryReads: true,
      connectTimeoutMS: 20000,
      heartbeatFrequencyMS: 5000,
    };

    cached.promise = mongoose
      .connect(process.env.MONGODB_URI, opts)
      .then((mongoose) => {
        console.log("MongoDB connected successfully");

        // Handle connection errors
        mongoose.connection.on("error", (err) => {
          console.error("MongoDB connection error:", err);
          cached.conn = null;
          cached.promise = null;
          // Attempt to reconnect immediately
          connectToDatabase().catch(console.error);
        });

        // Handle disconnection
        mongoose.connection.on("disconnected", () => {
          console.log("MongoDB disconnected");
          cached.conn = null;
          cached.promise = null;
          // Attempt to reconnect immediately
          connectToDatabase().catch(console.error);
        });

        // Handle successful reconnection
        mongoose.connection.on("reconnected", () => {
          console.log("MongoDB reconnected successfully");
        });

        // Handle connection close
        mongoose.connection.on("close", () => {
          console.log("MongoDB connection closed");
          cached.conn = null;
          cached.promise = null;
        });

        return mongoose;
      });
  }

  try {
    cached.conn = await cached.promise;
    // Wait for the connection to be ready
    if (cached.conn.connection.readyState !== 1) {
      await new Promise((resolve) => {
        cached.conn.connection.once("connected", resolve);
        setTimeout(() => {
          if (cached.conn.connection.readyState !== 1) {
            cached.conn = null;
            cached.promise = null;
            throw new Error("Failed to establish MongoDB connection");
          }
        }, 5000);
      });
    }
  } catch (e) {
    cached.promise = null;
    cached.conn = null;
    console.error("MongoDB connection error:", e);
    throw e;
  }

  return cached.conn;
}

module.exports = connectToDatabase;
