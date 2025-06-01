const jwt = require("jsonwebtoken");
const User = require("../models/user");

const userAuth = async (req, res, next) => {
  try {
    // Read the token from the req cookies or Authorization header
    let token = req.cookies.token;

    // If no cookie token, check Authorization header
    if (!token && req.headers.authorization) {
      const authHeader = req.headers.authorization;
      if (authHeader.startsWith("Bearer ")) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      return res.status(401).json({
        status: "error",
        message: "Authentication required. Please login.",
        details: "No token provided",
      });
    }

    // Validate the token
    let decodedToken;
    try {
      decodedToken = await jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      return res.status(401).json({
        status: "error",
        message: "Invalid or expired token. Please login again.",
        details: jwtError.message,
      });
    }

    // Check if this is a GitHub user (has isGitHubUser flag)
    if (decodedToken.isGitHubUser) {
      // For GitHub users, we use the token data directly
      req.user = decodedToken;
      next();
      return;
    }

    // For regular users, find in MongoDB
    try {
      const user = await User.findOne({ _id: decodedToken._id });
      if (!user) {
        return res.status(401).json({
          status: "error",
          message: "User not found in database",
          details: `User ID ${decodedToken._id} not found`,
        });
      }
      req.user = user;
      next();
    } catch (dbError) {
      return res.status(500).json({
        status: "error",
        message: "Database error while finding user",
        details: dbError.message,
      });
    }
  } catch (error) {
    console.error("Auth Error:", error);
    res.status(401).json({
      status: "error",
      message: "Authentication failed. Please login again.",
      details: error.message,
    });
  }
};

module.exports = userAuth;
