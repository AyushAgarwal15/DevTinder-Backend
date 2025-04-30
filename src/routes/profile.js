const express = require("express");
const profileRouter = express.Router();
const bcrypt = require("bcrypt");
const { userAuth } = require("../middlewares/auth");
const User = require("../models/user");
const {
  validateEditProfileData,
  validateEditPasswordData,
} = require("../utils/validation");

profileRouter.get("/profile/view", userAuth, async (req, res) => {
  try {
    const user = req.user;
    res.send(user);
  } catch (err) {
    res.status(400).send("ERROR : " + err.message);
  }
});

profileRouter.get("/profile/view/:userId", userAuth, async (req, res) => {
  try {
    const userId = req.params.userId;
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

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.githubId) {
      return res.status(404).json({ message: "User has not connected GitHub" });
    }

    // Return GitHub data if available
    res.json({
      githubData: user.githubData,
      githubRepos: user.githubRepos,
      githubLanguages: user.githubLanguages,
      topRepositories: user.topRepositories,
      contributionStats: user.contributionStats,
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

module.exports = profileRouter;
