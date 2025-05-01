const express = require("express");
const router = express.Router();

// Simple test route to check if the API is working
router.get("/api/test", (req, res) => {
  res.json({
    message: "API is working!",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

// Root path test
router.get("/", (req, res) => {
  res.json({
    message: "DevTinder API root path is working!",
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
