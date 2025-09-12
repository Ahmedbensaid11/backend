const mongoose = require('mongoose');

const SupplierSchema = new mongoose.Schema({
  id_sup: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  comp_affil: {
    type: String,
    required: true,
    trim: true
  },
  num_vst: {
    type: String,
    required: true,
    trim: true
  }
}, {
  timestamps: true
});

// Index for better search performance
SupplierSchema.index({ id_sup: 1 });
SupplierSchema.index({ comp_affil: 1 });

module.exports = mongoose.model('Supplier', SupplierSchema);