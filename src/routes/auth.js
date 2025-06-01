const express = require("express");
const authRouter = express.Router();
const User = require("../models/user");
const bcrypt = require("bcrypt");
const { validateSignUpData } = require("../utils/validation");
const { generateInitialsAvatar } = require("../utils/avatarGenerator");

// Cookie configuration based on environment
const getCookieConfig = () => {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    expires: new Date(Date.now() + 24 * 3600000), // 24 hours
    sameSite: isProduction ? "none" : "lax",
    secure: isProduction,
    httpOnly: true,
    path: "/",
    ...(isProduction && { domain: process.env.COOKIE_DOMAIN }), // Only set domain in production
  };
};

authRouter.post("/signup", async (req, res) => {
  try {
    // Validating the request body
    validateSignUpData(req);

    const { firstName, lastName, emailId, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ emailId: emailId.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        status: "error",
        message:
          "Email already registered. Please use a different email or login.",
      });
    }

    // Encrypt the password
    const passwordHash = await bcrypt.hash(password, 10);

    // Generate avatar URL
    const photoUrl = generateInitialsAvatar(firstName, lastName);

    // Creating a new instance of the User model
    const user = new User({
      firstName,
      lastName,
      emailId: emailId.toLowerCase(),
      password: passwordHash,
      photoUrl, // Set the photoUrl explicitly
    });

    // Saving the user to the database
    const savedUser = await user.save();
    const token = await savedUser.getJWT();

    // Add the token to cookie with environment-specific settings
    res.cookie("token", token, getCookieConfig());

    // Sending the response back to the user with complete user data
    res.json({
      status: "success",
      data: {
        ...savedUser.toObject(),
        photoUrl, // Ensure photoUrl is included in response
      },
      message: "Account created successfully!",
    });
  } catch (err) {
    res.status(400).json({
      status: "error",
      message: err.message || "Error creating account",
    });
  }
});

authRouter.post("/login", async (req, res) => {
  try {
    const { emailId, password } = req.body;

    if (!emailId || !password) {
      return res.status(400).json({
        status: "error",
        message: "Email and password are required",
      });
    }

    const user = await User.findOne({ emailId: emailId.toLowerCase() });
    if (!user) {
      return res.status(401).json({
        status: "error",
        message: "Invalid email or password",
      });
    }

    const isPasswordValid = await user.validatePassword(password);

    if (!isPasswordValid) {
      return res.status(401).json({
        status: "error",
        message: "Invalid email or password",
      });
    }

    // Create a JWT Token
    const token = await user.getJWT();

    // Add the token to cookie with environment-specific settings
    res.cookie("token", token, getCookieConfig());

    res.json({
      status: "success",
      data: user,
      message: "Logged in successfully!",
    });
  } catch (err) {
    res.status(400).json({
      status: "error",
      message: err.message || "Error logging in",
    });
  }
});

authRouter.post("/logout", (req, res) => {
  try {
    res.cookie("token", "", {
      ...getCookieConfig(),
      expires: new Date(0), // Expire immediately
    });

    res.json({
      status: "success",
      message: "Logged out successfully",
    });
  } catch (err) {
    res.status(400).json({
      status: "error",
      message: err.message || "Error logging out",
    });
  }
});

module.exports = authRouter;
