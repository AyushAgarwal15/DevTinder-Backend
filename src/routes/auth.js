const express = require("express");
const authRouter = express.Router();
const User = require("../models/user");
const bcrypt = require("bcrypt");
const { validateSignUpData } = require("../utils/validation");

authRouter.post("/signup", async (req, res) => {
  try {
    // validating the request body
    validateSignUpData(req);

    const { firstName, lastName, emailId, password } = req.body;

    // Encrypt the password
    const passwordHash = await bcrypt.hash(password, 10);

    // creating a new instance of the User model
    const user = new User({
      firstName,
      lastName,
      emailId,
      password: passwordHash,
    });
    // saving the user to the database
    const savedUser = await user.save();
    const token = await savedUser.getJWT();

    // Add the token to cookie and send the response back to the user
    res.cookie("token", token, {
      expires: new Date(Date.now() + 24 * 3600000), // 24 hours
      sameSite: "none",
      secure: true,
      httpOnly: true,
    });
    // sending the response back to the user
    res.json(savedUser);
  } catch (err) {
    res.status(400).send("Error creating the user " + err.message);
  }
});

authRouter.post("/login", async (req, res) => {
  try {
    const { emailId, password } = req.body;

    const user = await User.findOne({ emailId });
    if (!user) {
      throw new Error("Invalid Credentials.");
    }

    const isPasswordValid = await user.validatePassword(password);

    if (isPasswordValid) {
      // create a JWT Token
      const token = await user.getJWT();

      // Add the token to cookie and send the response back to the user
      res.cookie("token", token, {
        expires: new Date(Date.now() + 8 * 3600000),
        sameSite: "none",
        secure: true,
        httpOnly: true,
      });
      res.send(user);
    } else {
      throw new Error("Invalid Credentials.");
    }
    // comparing the password with the hashed password
  } catch (err) {
    res.status(400).send("Error logging in the user: " + err.message);
  }
});

authRouter.post("/logout", async (req, res) => {
  res.cookie("token", null, {
    expires: new Date(Date.now()),
    sameSite: "none",
    secure: true,
    httpOnly: true,
  });
  res.send("User logged out successfully");
});

module.exports = authRouter;
