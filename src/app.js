const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();

// Middleware
app.use(express.json());

// CORS configuration for your frontend
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'http://localhost:3002', // Added your frontend port
    'http://localhost:3003',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3002',
    'http://127.0.0.1:3003'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));

// Debug middleware to log all requests
app.use((req, res, next) => {
  console.log(`📝 ${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Test route to verify server is working - MUST be before other routes
app.get("/api/test", (req, res) => {
  console.log("🧪 Test route hit");
  res.json({ msg: "Server is working!", timestamp: new Date() });
});

// Routes - Register ALL routes BEFORE error handlers
app.use("/api/auth", require("./routes/auth"));
app.use("/api/admin", require("./routes/admin"));

// Incidents routes with more detailed logging
console.log("🔗 Loading incidents routes...");
try {
  const incidentRoutes = require('./routes/Incidents');
  console.log("✅ Incidents routes loaded successfully");
  app.use('/api/incidents', incidentRoutes);
  console.log("✅ Incidents routes registered at /api/incidents");
} catch (error) {
  console.error("❌ Error loading incidents routes:", error);
}

// Other routes
app.use("/api/workers", require("./routes/workers"));
app.use("/api/vehicles", require("./routes/vehicles"));
app.use("/api/suppliers", require("./routes/suppliers"));
app.use("/api/leoni-personnel", require("./routes/leoni-personnel"));
app.use('/api/schedule-presence', require('./routes/SchedulePresence'));

// Access log routes
const accessLogRoutes = require('./routes/accessLogs');
app.use('/api/access-logs', accessLogRoutes);

// Basic log routes
const logRoutes = require('./routes/logs');
app.use('/api/logs', logRoutes);

// Basic route
app.get("/", (req, res) => {
  res.json({ 
    message: "LEONI Personnel Management API is running!",
    endpoints: {
      auth: "/api/auth",
      admin: "/api/admin",
      incidents: "/api/incidents",
      workers: "/api/workers",
      vehicles: "/api/vehicles",
      suppliers: "/api/suppliers",
      personnel: "/api/leoni-personnel"
    }
  });
});

// Test route to check if server is responding
app.get("/api/test", (req, res) => {
  res.json({ msg: "Server is working!", timestamp: new Date() });
});

// Error handling middleware - MUST be after routes
app.use((err, req, res, next) => {
  console.error("💥 Error:", err.stack);
  res.status(500).json({ msg: "Something went wrong!" });
});

// 404 handler - MUST be last
app.use((req, res) => {
  console.log("❌ 404 - Route not found:", req.method, req.url);
  res.status(404).json({ msg: "Route not found" });
});

module.exports = app;