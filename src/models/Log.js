const mongoose = require('mongoose');

const LogSchema = new mongoose.Schema({
  // Main log ID (auto-generated)
  id_log: {
    type: String,
    unique: true,
    required: true,
    default: function() {
      return `LOG${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
    }
  },
  
  // Duration in minutes (calculated automatically)
  duration: {
    type: Number,
    min: 0,
    default: 0,
    validate: {
      validator: function(v) {
        return v >= 0;
      },
      message: 'Duration must be non-negative'
    }
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
  
  // Entry and exit times for calculating duration
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
  
  // Additional notes
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

// Methods for check-in and check-out
LogSchema.methods.checkIn = function() {
  this.status = 'entry';
  this.entryTime = new Date();
  this.exitTime = undefined;
  this.duration = 0;
};

LogSchema.methods.checkOut = function() {
  if (this.entryTime) {
    this.status = 'exit';
    this.exitTime = new Date();
    const durationMs = this.exitTime - this.entryTime;
    const durationMinutes = Math.floor(durationMs / (1000 * 60));
    
    // Ensure duration is never negative
    this.duration = Math.max(0, durationMinutes);
    
    // Log warning if duration would be negative
    if (durationMinutes < 0) {
      console.warn(`Warning: Negative duration detected. Entry: ${this.entryTime}, Exit: ${this.exitTime}`);
      console.warn(`Setting duration to 0 instead of ${durationMinutes} minutes`);
    }
  }
};

// Pre-save middleware to calculate duration safely
LogSchema.pre('save', function(next) {
  if (this.entryTime && this.exitTime) {
    const durationMs = this.exitTime - this.entryTime;
    const durationMinutes = Math.floor(durationMs / (1000 * 60));
    
    // Ensure duration is never negative
    this.duration = Math.max(0, durationMinutes);
    
    // Log warning if duration would be negative
    if (durationMinutes < 0) {
      console.warn(`Warning: Negative duration detected in pre-save. Entry: ${this.entryTime}, Exit: ${this.exitTime}`);
      console.warn(`Setting duration to 0 instead of ${durationMinutes} minutes`);
    }
  }
  next();
});

// Index for better performance
LogSchema.index({ person: 1, personType: 1 });
LogSchema.index({ logDate: 1 });
LogSchema.index({ status: 1 });
LogSchema.index({ id_log: 1 });

// Virtual for formatted duration
LogSchema.virtual('formattedDuration').get(function() {
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
LogSchema.virtual('personInfo', {
  localField: 'person',
  foreignField: '_id',
  justOne: true,
  ref: function() {
    return this.personType;
  }
});

// Ensure virtuals are included in JSON
LogSchema.set('toJSON', { virtuals: true });
LogSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Log', LogSchema);