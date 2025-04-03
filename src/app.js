const express = require("express");

const app = express();

app.get("/user", (req, res) => {
  console.log(req.query);
  res.send({ firstName: "Ayush", lastName: "Agarwal" });
});

app.listen(7777, () => {
  console.log("Server is running on port 7777");
});
