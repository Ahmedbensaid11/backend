const mongoose = require('mongoose');

const WorkerSchema = new mongoose.Schema({
  cin: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  worker_name: {
    type: String,
    required: true,
    trim: true
  },
  com_num: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  worker_address: {
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
  },
  // Reference to vehicles this worker possesses
  vehicles: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle'
  }]
}, {
  timestamps: true
});

// Index for better search performance
WorkerSchema.index({ cin: 1 });
WorkerSchema.index({ worker_name: 1 });
WorkerSchema.index({ email: 1 });

module.exports = mongoose.model('Worker', WorkerSchema);