const connectToDatabase = require("../lib/mongodb");

const connectDB = async () => {
  try {
    const mongoose = await connectToDatabase();
    console.log(`MongoDB connected: ${mongoose.connection.host}`);
    return mongoose;
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    throw error;
  }
};

module.exports = connectDB;
