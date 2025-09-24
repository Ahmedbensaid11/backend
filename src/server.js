// server.js
const mongoose = require('mongoose');
const app = require('./app');
require('dotenv').config();

// Simple MongoDB connection
mongoose.connect('mongodb://localhost:27017/leoni_db')
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err));

const PORT = 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📋 Test: http://localhost:${PORT}/api/test`);
  console.log(`📋 Incidents test: http://localhost:${PORT}/api/incidents/test`);
});