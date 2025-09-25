const mongoose = require("mongoose");

// Clear any existing model to prevent OverwriteModelError
if (mongoose.models.Incident) {
  delete mongoose.models.Incident;
}

const incidentSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: [
      'Login bug',
      'Report submission error', 
      'Gate malfunction',
      'Electricity outage',
      'Fire',
      'Car accident',
      'Unauthorized worker entry',
      "Worker's vehicle overstaying"
    ],
    required: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  date: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'resolved'],
    default: 'pending'
  },
  reportedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  default_priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  resolvedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Index for better query performance
incidentSchema.index({ reportedBy: 1, createdAt: -1 });
incidentSchema.index({ status: 1, createdAt: -1 });
incidentSchema.index({ default_priority: 1 });

module.exports = mongoose.model("Incident", incidentSchema);