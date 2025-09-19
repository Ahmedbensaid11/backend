// models/MonthlyVisit.js - Track monthly visit counts for suppliers
const mongoose = require('mongoose');

const monthlyVisitSchema = new mongoose.Schema({
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier',
    required: true
  },
  month: {
    type: String, // Format: "YYYY-MM" (e.g., "2024-12")
    required: true
  },
  year: {
    type: Number,
    required: true
  },
  visitCount: {
    type: Number,
    default: 0
  },
  lastVisit: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Create compound index for efficient queries
monthlyVisitSchema.index({ supplier: 1, month: 1 }, { unique: true });
monthlyVisitSchema.index({ month: 1 });
monthlyVisitSchema.index({ year: 1 });

// Update the updatedAt field before saving
monthlyVisitSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Static method to increment visit count
monthlyVisitSchema.statics.incrementVisit = async function(supplierId, visitDate = new Date()) {
  const month = visitDate.toISOString().slice(0, 7); // "YYYY-MM"
  const year = visitDate.getFullYear();
  
  try {
    const result = await this.findOneAndUpdate(
      { supplier: supplierId, month: month },
      { 
        $inc: { visitCount: 1 },
        $set: { 
          lastVisit: visitDate,
          year: year
        }
      },
      { 
        upsert: true, 
        new: true,
        setDefaultsOnInsert: true
      }
    );
    
    return result;
  } catch (error) {
    console.error('Error incrementing visit count:', error);
    throw error;
  }
};

// Static method to get visit count for a specific month
monthlyVisitSchema.statics.getVisitCount = async function(supplierId, month) {
  try {
    const record = await this.findOne({ supplier: supplierId, month: month });
    return record ? record.visitCount : 0;
  } catch (error) {
    console.error('Error getting visit count:', error);
    return 0;
  }
};

// Static method to get supplier's visit history
monthlyVisitSchema.statics.getSupplierHistory = async function(supplierId, limit = 12) {
  try {
    const history = await this.find({ supplier: supplierId })
      .sort({ month: -1 })
      .limit(limit)
      .populate('supplier', 'name email');
    
    return history;
  } catch (error) {
    console.error('Error getting supplier history:', error);
    return [];
  }
};

module.exports = mongoose.model('MonthlyVisit', monthlyVisitSchema);