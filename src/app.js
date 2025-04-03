const express = require("express");

const app = express();

app.get("/", (req, res) => {
  res.send("Hello World from root");
});

app.get("/test", (req, res) => {
  res.send("Test Route");
});

app.get("/hello", (req, res) => {
  res.send("Hello World!");
});

app.listen(7777, () => {
  console.log("Server is running on port 3000");
});
