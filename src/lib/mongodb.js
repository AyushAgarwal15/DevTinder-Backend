const mongoose = require("mongoose");

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
      serverSelectionTimeoutMS: 60000,
      socketTimeoutMS: 60000,
      maxIdleTimeMS: 60000,
      maxPoolSize: 10,
      minPoolSize: 1,
      family: 4,
      autoIndex: true,
      retryWrites: true,
      retryReads: true,
      connectTimeoutMS: 30000,
      heartbeatFrequencyMS: 10000,
      keepAlive: true,
      keepAliveInitialDelay: 300000,
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
          // Attempt to reconnect
          setTimeout(() => {
            console.log("Attempting to reconnect to MongoDB...");
            connectToDatabase().catch(console.error);
          }, 5000);
        });

        // Handle disconnection
        mongoose.connection.on("disconnected", () => {
          console.log("MongoDB disconnected");
          cached.conn = null;
          cached.promise = null;
          // Attempt to reconnect
          setTimeout(() => {
            console.log("Attempting to reconnect to MongoDB...");
            connectToDatabase().catch(console.error);
          }, 5000);
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
  } catch (e) {
    cached.promise = null;
    console.error("MongoDB connection error:", e);
    throw e;
  }

  return cached.conn;
}

module.exports = connectToDatabase;
