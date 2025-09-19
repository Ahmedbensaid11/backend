const mongoose = require('mongoose');

const AccessLogSchema = new mongoose.Schema({
  // Log ID (auto-generated)
  log_id: {
    type: String,
    unique: true,
    required: true,
    default: function() {
      return `LOG${Date.now()}${Math.floor(Math.random() * 1000)}`;
    }
  },
  
  // Duration in minutes (calculated automatically)
  duration: {
    type: Number,
    min: 0,
    default: 0
  },
  
  // Status: 'entry', 'exit', 'present'
  status: {
    type: String,
    enum: ['entry', 'exit', 'present'],
    required: true,
    default: 'entry'
  },
  
  // Reference to the person (can be Supplier, Worker, or LeoniPersonnel)
  person: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'personType'
  },
  
  personType: {
    type: String,
    required: true,
    enum: ['Supplier', 'Worker', 'LeoniPersonnel']
  },
  
  // Entry and exit times
  entryTime: {
    type: Date,
    required: function() {
      return this.status === 'entry' || this.status === 'present';
    }
  },
  
  exitTime: {
    type: Date,
    required: function() {
      return this.status === 'exit';
    }
  },
  
  // The date of the log entry
  logDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  
  // Reference to vehicle if person came with vehicle
  vehicle: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle',
    required: false
  },
  
  // Additional notes or reason for visit
  notes: {
    type: String,
    trim: true,
    maxlength: 500
  },
  
  // Who recorded this log entry
  recordedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Pre-save middleware to calculate duration
AccessLogSchema.pre('save', function(next) {
  if (this.entryTime && this.exitTime) {
    const durationMs = this.exitTime - this.entryTime;
    this.duration = Math.floor(durationMs / (1000 * 60)); // Convert to minutes
  }
  next();
});

// Index for better performance
AccessLogSchema.index({ person: 1, personType: 1 });
AccessLogSchema.index({ logDate: 1 });
AccessLogSchema.index({ status: 1 });
AccessLogSchema.index({ vehicle: 1 });

// Virtual for formatted duration
AccessLogSchema.virtual('formattedDuration').get(function() {
  if (this.duration === 0) return 'N/A';
  
  const hours = Math.floor(this.duration / 60);
  const minutes = this.duration % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
});

// Virtual for person info (populated)
AccessLogSchema.virtual('personInfo', {
  localField: 'person',
  foreignField: '_id',
  justOne: true,
  ref: function() {
    return this.personType;
  }
});

// Ensure virtuals are included in JSON
AccessLogSchema.set('toJSON', { virtuals: true });
AccessLogSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('AccessLog', AccessLogSchema);