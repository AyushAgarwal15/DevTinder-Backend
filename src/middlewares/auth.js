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

    try {
      let user;
      // Check if this is a GitHub user
      if (decodedToken.isGitHubUser) {
        // For GitHub users, find or create their MongoDB document
        user = await User.findOne({ githubId: decodedToken.githubId });

        if (!user) {
          // Create a new user document if one doesn't exist
          user = await User.create({
            githubId: decodedToken.githubId,
            email: decodedToken.email,
            firstName: decodedToken.name
              ? decodedToken.name.split(" ")[0]
              : "GitHub",
            lastName: decodedToken.name
              ? decodedToken.name.split(" ")[1] || "User"
              : "User",
            avatar: decodedToken.avatar,
            isGitHubUser: true,
          });
        }
      } else {
        // For regular users, find in MongoDB
        user = await User.findOne({ _id: decodedToken._id });
      }

      if (!user) {
        return res.status(401).json({
          status: "error",
          message: "User not found in database",
          details: decodedToken.isGitHubUser
            ? `GitHub user ${decodedToken.githubId} not found`
            : `User ID ${decodedToken._id} not found`,
        });
      }

      // Set the MongoDB user document in req.user
      req.user = user;
      next();
    } catch (dbError) {
      console.error("Database error:", dbError);
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
