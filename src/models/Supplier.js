const mongoose = require('mongoose');

// Function to generate random supplier ID
const generateSupplierId = () => {
  const prefix = "SUP";
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${prefix}${timestamp}${random}`;
};

const SupplierSchema = new mongoose.Schema({
  // Backend auto-generated fields
  id_sup: {
    type: String,
    unique: true,
    trim: true,
    default: generateSupplierId,
    required: true
  },

 
  
  // Frontend required fields
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    unique: true
  },
  phonenumber: {
    type: String,
    required: true,
    trim: true
  },
  cin: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  companyInfo: {
    type: String,
    required: true,
    trim: true
  }
}, {
  timestamps: true
});

// Pre-save middleware to ensure unique supplier ID and VST number
SupplierSchema.pre('save', async function(next) {
  // Generate unique supplier ID if not present
  if (!this.id_sup) {
    let isUnique = false;
    while (!isUnique) {
      const newId = generateSupplierId();
      const existing = await this.constructor.findOne({ id_sup: newId });
      if (!existing) {
        this.id_sup = newId;
        isUnique = true;
      }
    }
  }

  // Generate auto-incremented VST number if not present
  if (!this.num_vst) {
    try {
      // Find the highest VST number
      const lastSupplier = await this.constructor.findOne(
        { num_vst: { $exists: true, $ne: null } },
        { num_vst: 1 }
      ).sort({ num_vst: -1 });

      let nextVstNumber = 1;
      if (lastSupplier && lastSupplier.num_vst) {
        // Extract number from VST string (e.g., "VST000001" -> 1)
        const lastNumber = parseInt(lastSupplier.num_vst.replace('VST', ''));
        nextVstNumber = lastNumber + 1;
      }

      // Format as VST000001, VST000002, etc.
      this.num_vst = `VST${nextVstNumber.toString().padStart(6, '0')}`;
    } catch (error) {
      console.error('Error generating VST number:', error);
      // Fallback to timestamp-based VST
      this.num_vst = `VST${Date.now().toString().slice(-6)}`;
    }
  }

  next();
});

// Indexes for better search performance
SupplierSchema.index({ id_sup: 1 });
SupplierSchema.index({ name: 1 });
SupplierSchema.index({ cin: 1 });
SupplierSchema.index({ email: 1 });
SupplierSchema.index({ num_vst: 1 });

module.exports = mongoose.model('Supplier', SupplierSchema);