const express = require("express");
const profileRouter = express.Router();
const bcrypt = require("bcrypt");
const userAuth = require("../middlewares/auth");
const User = require("../models/user");
const {
  validateEditProfileData,
  validateEditPasswordData,
} = require("../utils/validation");
const multer = require("multer");
const { uploadImage } = require("../utils/cloudinary");

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Not an image! Please upload an image."), false);
    }
  },
});

profileRouter.get("/profile/view", userAuth, async (req, res) => {
  try {
    const user = req.user;
    if (user.isGitHubUser) {
      // For GitHub users, return the user data from the token
      return res.json({
        _id: `github_${user.githubId}`,
        firstName: user.firstName,
        lastName: user.lastName,
        emailId: user.emailId,
        photoUrl: user.photoUrl,
        githubUrl: user.githubUrl,
        about: user.about || "Open to make new connections 🙂",
        githubData: user.githubData,
        githubLanguages: user.githubLanguages || [],
        contributionStats: user.contributionStats || {
          totalRepos: 0,
          totalStars: 0,
          totalForks: 0,
          languages: {},
        },
        isGitHubUser: true,
      });
    }
    res.send(user);
  } catch (err) {
    res.status(400).send("ERROR : " + err.message);
  }
});

profileRouter.get("/profile/view/:userId", userAuth, async (req, res) => {
  try {
    const userId = req.params.userId;

    // Check if it's a GitHub user ID
    if (userId.startsWith("github_")) {
      // For GitHub users, we need to handle differently since they're not in MongoDB
      const githubId = userId.replace("github_", "");
      return res.json({
        _id: userId,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        emailId: req.user.emailId,
        photoUrl: req.user.photoUrl,
        githubUrl: req.user.githubUrl,
        about: req.user.about || "Open to make new connections 🙂",
        githubData: req.user.githubData,
        githubLanguages: req.user.githubLanguages || [],
        contributionStats: req.user.contributionStats || {
          totalRepos: 0,
          totalStars: 0,
          totalForks: 0,
          languages: {},
        },
        isGitHubUser: true,
      });
    }

    // For MongoDB users
    const user = await User.findById(userId).select("-password -__v");
    if (!user) {
      throw new Error("User not found");
    }
    res.send(user);
  } catch (err) {
    res.status(400).send("ERROR : " + err.message);
  }
});

// Get a specific user's GitHub data
profileRouter.get("/profile/github/:userId", userAuth, async (req, res) => {
  try {
    const { userId } = req.params;

    // Handle GitHub users
    if (userId.startsWith("github_")) {
      return res.json({
        githubData: req.user.githubData,
        githubRepos: req.user.githubRepos || [],
        githubLanguages: req.user.githubLanguages || [],
        topRepositories: req.user.topRepositories || [],
        contributionStats: req.user.contributionStats || {
          totalRepos: 0,
          totalStars: 0,
          totalForks: 0,
          languages: {},
        },
      });
    }

    // Handle MongoDB users
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.githubId) {
      return res.status(404).json({ message: "User has not connected GitHub" });
    }

    // Return GitHub data if available
    res.json({
      githubData: user.githubData || null,
      githubRepos: user.githubRepos || [],
      githubLanguages: user.githubLanguages || [],
      topRepositories: user.topRepositories || [],
      contributionStats: user.contributionStats || {
        totalRepos: 0,
        totalStars: 0,
        totalForks: 0,
        languages: {},
      },
    });
  } catch (err) {
    console.error("Error fetching GitHub data:", err);
    res.status(500).json({ message: "Failed to fetch GitHub data" });
  }
});

profileRouter.patch("/profile/edit", userAuth, async (req, res) => {
  try {
    if (!validateEditProfileData(req)) {
      throw new Error("Invalid Edit Fields");
    }

    const loggedInUser = req.user;

    Object.keys(req.body).forEach((key) => {
      loggedInUser[key] = req.body[key];
    });

    await loggedInUser.save();
    res.json({
      message: `${loggedInUser.firstName} ${loggedInUser.lastName}, Your profile updated successfully.`,
      data: loggedInUser,
    });
  } catch (err) {
    res.status(400).send("ERROR : " + err.message);
  }
});

profileRouter.patch("/profile/password", userAuth, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const loggedInUser = req.user;
    const isPasswordValid = await loggedInUser.validatePassword(oldPassword);

    if (!isPasswordValid) {
      throw new Error("Invalid Old Password");
    }

    validateEditPasswordData(req);

    const encryptedNewPassword = await bcrypt.hash(newPassword, 10);
    loggedInUser.password = encryptedNewPassword;
    await loggedInUser.save();
    res.send("Password updated successfully");
  } catch (err) {
    res.status(400).send("ERROR : " + err.message);
  }
});

// Upload profile picture
profileRouter.post(
  "/profile/upload-photo",
  userAuth,
  upload.single("photo"),
  async (req, res) => {
    try {
      if (!req.file) {
        throw new Error("Please upload an image");
      }

      // Convert buffer to base64
      const base64Image = `data:${
        req.file.mimetype
      };base64,${req.file.buffer.toString("base64")}`;

      // Upload to Cloudinary
      const imageUrl = await uploadImage(base64Image);

      // Update user's photoUrl
      const user = req.user;
      user.photoUrl = imageUrl;
      await user.save();

      res.json({ photoUrl: imageUrl });
    } catch (err) {
      console.error("Error uploading photo:", err);
      res.status(400).send(err.message);
    }
  }
);

module.exports = profileRouter;
