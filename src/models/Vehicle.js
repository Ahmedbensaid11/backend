const mongoose = require('mongoose');

const VehicleSchema = new mongoose.Schema({
  lic_plate_string: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  },
  mark: {
    type: String,
    required: true,
    trim: true
  },
  model: {
    type: String,
    required: true,
    trim: true
  },
  v_year: {
    type: Number,
    required: true,
    min: 1900,
    max: new Date().getFullYear() + 1
  },
  color: {
    type: String,
    required: true,
    trim: true
  },
  // Enhanced owner system to support multiple entity types
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    // This will be populated based on ownerType
    refPath: 'ownerType'
  },
  ownerType: {
    type: String,
    required: true,
    enum: ['Worker', 'Supplier', 'LeoniPersonnel']
  }
}, {
  timestamps: true
});

// Index for better search performance
VehicleSchema.index({ lic_plate_string: 1 });
VehicleSchema.index({ owner: 1, ownerType: 1 });
VehicleSchema.index({ mark: 1, model: 1 });

// Virtual to get owner info regardless of type
VehicleSchema.virtual('ownerInfo', {
  localField: 'owner',
  foreignField: '_id',
  justOne: true,
  options: function() {
    return { select: this.getOwnerSelectFields() };
  },
  ref: function() {
    return this.ownerType;
  }
});

// Method to get appropriate fields based on owner type
VehicleSchema.methods.getOwnerSelectFields = function() {
  switch(this.ownerType) {
    case 'Worker':
      return 'worker_name cin email com_num';
    case 'Supplier':
      return 'id_sup comp_affil num_vst';
    case 'LeoniPersonnel':
      return 'matricule name email department position';
    default:
      return '';
  }
};

// Ensure virtual fields are serialized
VehicleSchema.set('toJSON', { virtuals: true });
VehicleSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Vehicle', VehicleSchema);