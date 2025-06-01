const mongoose = require("mongoose");

// Disable mongoose buffering globally
mongoose.set("bufferCommands", false);

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
      bufferCommands: false, // Disable buffering
      serverSelectionTimeoutMS: 30000, // Reduced from 60000
      socketTimeoutMS: 45000, // Reduced from 60000
      maxIdleTimeMS: 45000, // Reduced from 60000
      maxPoolSize: 50, // Increased from 10
      minPoolSize: 10, // Increased from 1
      family: 4,
      autoIndex: true,
      retryWrites: true,
      retryReads: true,
      connectTimeoutMS: 20000,
      heartbeatFrequencyMS: 5000,
      keepAlive: true,
      keepAliveInitialDelay: 30000,
      autoCreate: true,
      writeConcern: {
        w: "majority",
        j: true,
      },
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
        });

        // Handle process termination
        process.on("SIGINT", async () => {
          try {
            await mongoose.connection.close();
            console.log("MongoDB connection closed through app termination");
            process.exit(0);
          } catch (err) {
            console.error("Error closing MongoDB connection:", err);
            process.exit(1);
          }
        });

        return mongoose;
      });
  }

  try {
    cached.conn = await cached.promise;
    // Verify connection is successful
    if (cached.conn.connection.readyState !== 1) {
      throw new Error("Failed to establish MongoDB connection");
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
