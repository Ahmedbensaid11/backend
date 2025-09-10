const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/admin", require("./routes/admin"));

// Basic route
app.get("/", (req, res) => {
  res.json({ message: "API is running!" });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ msg: "Something went wrong!" });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ msg: "Route not found" });
});

module.exports = app;
