const mongoose = require("mongoose");

const incidentSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['Real Parking', 'Application'],
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
    enum: ['pending', 'approved', 'rejected', 'resolved'],
    default: 'pending'
  },
  reportedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  approvedAt: {
    type: Date,
    default: null
  },
  adminNotes: {
    type: String,
    default: ''
  },
  priority: {
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

module.exports = mongoose.model("Incident", incidentSchema);