const express = require("express");
const profileRouter = express.Router();
const bcrypt = require("bcrypt");
const { userAuth } = require("../middlewares/auth");
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
