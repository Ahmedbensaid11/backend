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
const incidentRoutes = require('./routes/Incidents');
app.use('/api/incidents', incidentRoutes);
// New routes for the management system
app.use("/api/workers", require("./routes/workers"));
app.use("/api/vehicles", require("./routes/vehicles"));
app.use("/api/suppliers", require("./routes/suppliers"));
app.use("/api/leoni-personnel", require("./routes/leoni-personnel"));
app.use('/api/schedule-presence', require('./routes/SchedulePresence'));

// In your main app.js or server.js file, add this line with your other routes:

// Import the new access log routes
const accessLogRoutes = require('./routes/accessLogs');

// Add the route (along with your existing routes)
app.use('/api/access-logs', accessLogRoutes);
// Basic route
const logRoutes = require('./routes/logs');
app.use('/api/logs', logRoutes);

app.get("/", (req, res) => {
  res.json({ 
    message: "LEONI Personnel Management API is running!",
    endpoints: {
      auth: "/api/auth",
      admin: "/api/admin",
      workers: "/api/workers",
      vehicles: "/api/vehicles",
      suppliers: "/api/suppliers",
      personnel: "/api/leoni-personnel"
    }
  });
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