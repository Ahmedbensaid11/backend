const mongoose = require('mongoose');

const VehiculogSchema = new mongoose.Schema({
  // Vehicle log specific fields matching your schema
  vlog_date: {
    type: Date,
    required: true,
    default: Date.now
  },
  
  // Entry time for the vehicle
  entry_time: {
    type: Date,
    required: true
  },
  
  // Exit time for the vehicle (null if still present)
  exit_time: {
    type: Date,
    default: null
  },
  
  // Reference to the vehicle
  vehicle: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle',
    required: true
  },
  
  // Reference to the corresponding log entry
  log: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Log',
    required: true
  },
  
  // Additional vehicle-specific notes
  vehicleNotes: {
    type: String,
    trim: true,
    maxlength: 300
  },
  
  // Parking location/zone
  parkingLocation: {
    type: String,
    trim: true,
    maxlength: 100
  },
  
  // Who recorded this vehicle log
  recordedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Index for better performance
VehiculogSchema.index({ vehicle: 1 });
VehiculogSchema.index({ vlog_date: 1 });
VehiculogSchema.index({ log: 1 });

// Virtual for duration (calculated from entry and exit times)
VehiculogSchema.virtual('duration').get(function() {
  if (!this.exit_time) return null;
  
  const durationMs = this.exit_time - this.entry_time;
  return Math.floor(durationMs / (1000 * 60)); // Duration in minutes
});

// Virtual for formatted duration
VehiculogSchema.virtual('formattedDuration').get(function() {
  const duration = this.duration;
  if (!duration) return 'Still present';
  
  const hours = Math.floor(duration / 60);
  const minutes = duration % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
});

// Ensure virtuals are included in JSON
VehiculogSchema.set('toJSON', { virtuals: true });
VehiculogSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Vehiculog', VehiculogSchema);