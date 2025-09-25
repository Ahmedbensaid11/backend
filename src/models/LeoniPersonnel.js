const mongoose = require('mongoose');

const LeoniPersonnelSchema = new mongoose.Schema({
  matricule: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  cin: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    validate: {
      validator: function(v) {
        return /^[0-9]{8}$/.test(v);
      },
      message: 'CIN must be exactly 8 digits'
    }
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  phone: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    validate: {
      validator: function(v) {
        // Validates phone numbers in format: +216XXXXXXXX or XXXXXXXX (8 digits)
        return /^(\+216)?[0-9]{8}$/.test(v);
      },
      message: 'Phone number must be 8 digits or in format +216XXXXXXXX'
    }
  },
  address: {
    type: String,
    required: true,
    trim: true
  },
  state: {
    type: String,
    required: true,
    trim: true
  },
  postal_code: {
    type: String,
    required: true,
    trim: true
  }
}, {
  timestamps: true
});

// Index for better search performance
LeoniPersonnelSchema.index({ matricule: 1 });
LeoniPersonnelSchema.index({ name: 1 });
LeoniPersonnelSchema.index({ cin: 1 });
LeoniPersonnelSchema.index({ email: 1 });
LeoniPersonnelSchema.index({ phone: 1 });

module.exports = mongoose.model('LeoniPersonnel', LeoniPersonnelSchema);