const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    // Important options for serverless environments
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 15000, // Increase from default 10000
      socketTimeoutMS: 45000,
      family: 4, // Use IPv4, skip trying IPv6
    });

    console.log(`MongoDB connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    throw error;
  }
};

module.exports = connectDB;
