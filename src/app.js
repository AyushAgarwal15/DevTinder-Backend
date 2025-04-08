const express = require("express");
const connectDB = require("./config/database");
const User = require("./models/user");
const app = express();

app.use(express.json());

app.post("/signup", async (req, res) => {
  // creating a new instance of the User model
  const user = new User(req.body);

  try {
    // saving the user to the database
    await user.save();
    res.send("User created successfully");
  } catch (err) {
    res.status(400).send("Error creating the user " + err.message);
  }
});

app.get("/feed", async (req, res) => {
  try {
    const users = await User.find();
    if (users.length == 0) {
      throw new Error("No users found");
    } else {
      res.send(users);
    }
  } catch (err) {
    res.status(400).send("Something went wrong" + err.message);
  }
});

app.get("/user", async (req, res) => {
  try {
    const userEmail = req.body.emailId;
    const userId = req.body.id;

    let user;

    if (userEmail) {
      user = await User.findOne({ emailId: userEmail });
    } else if (userId) {
      user = await User.findById(userId);
    }

    if (!user) {
      throw new Error("No user found.");
    } else {
      res.send(user);
    }
  } catch (err) {
    res.status(500).send("Something went wrong: " + err.message);
  }
});

app.delete("/user", async (req, res) => {
  try {
    const userId = req.body.id;
    await User.findByIdAndDelete(userId);
    res.send("User deleted successfully");
  } catch (err) {
    res.status(400).send("Error deleting the user " + err.message);
  }
});

app.patch("/user/:userId", async (req, res) => {
  try {
    const userId = req.params?.userId;
    const data = req.body;

    const ALLOWED_UPDATE_KEYS = [
      "age",
      "gender",
      "location",
      "photoUrl",
      "about",
      "skills",
      "password",
    ];

    const isUpdateAllowed = Object.keys(data).every((key) =>
      ALLOWED_UPDATE_KEYS.includes(key)
    );

    if (!isUpdateAllowed) {
      throw new Error("Invalid update keys");
    }

    await User.findByIdAndUpdate(userId, data, {
      returnDocument: "after",
      runValidators: true,
    });
    res.send("User updated successfully");
  } catch (err) {
    res.status(400).send("Error updating user: " + err.message);
  }
});

connectDB()
  .then(() => {
    console.log("Database connection established.");
    app.listen(7777, () => {
      console.log("Server is running on port 7777");
    });
  })
  .catch((err) => {
    console.error("Database can not be connected!!", err);
  });
