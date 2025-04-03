const express = require("express");

const app = express();

const { userAuth } = require("./middlewares/auth");

app.get("/user/login", (req, res) => {
  res.send("user login");
});

app.get("/user/data", userAuth, (req, res) => {
  res.send("user data");
});

app.listen(7777, () => {
  console.log("Server is running on port 7777");
});
