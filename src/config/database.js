const mongoose = require("mongoose");

const connectDB = async () => {
  await mongoose.connect(
    "mongodb+srv://Ayush:ayush%40password.8126@devtinderapp.ndcaecu.mongodb.net/devTinder"
  );
};

module.exports = connectDB;
