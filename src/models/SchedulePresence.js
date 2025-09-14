const mongoose = require('mongoose');

const schedulePresenceSchema = new mongoose.Schema({
  supplierName: {
    type: String,
    required: [true, 'Supplier name is required'],
    trim: true
  },
  date: {
    type: Date,
    required: [true, 'Date is required'],
    validate: {
      validator: function(value) {
        return value >= new Date().setHours(0, 0, 0, 0);
      },
      message: 'Date cannot be in the past'
    }
  },
  time: {
    type: String,
    required: [true, 'Time is required'],
    validate: {
      validator: function(value) {
        // Validate HH:MM format (24-hour)
        return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(value);
      },
      message: 'Time must be in HH:MM format (24-hour)'
    }
  },
  reason: {
    type: String,
    required: [true, 'Reason is required'],
    trim: true,
    maxlength: [500, 'Reason cannot exceed 500 characters']
  },
  status: {
    type: String,
    enum: ['scheduled', 'completed', 'cancelled', 'rescheduled'],
    default: 'scheduled'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for efficient querying
schedulePresenceSchema.index({ date: 1, supplierName: 1 });
schedulePresenceSchema.index({ createdBy: 1 });

// Virtual for formatted time (if needed for display)
schedulePresenceSchema.virtual('formattedTime').get(function() {
  return this.time;
});

// Pre-save middleware to update updatedAt
schedulePresenceSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('SchedulePresence', schedulePresenceSchema);