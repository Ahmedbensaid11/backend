const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  cin: { type: String, required: true, unique: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  birthdate: { type: Date, required: true },
  phoneNumber: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { 
    type: String, 
    enum: ['admin', 'sos'], 
    required: true 
  },
  isApproved: { 
    type: Boolean, 
    default: function() {
      // Admin accounts are auto-approved, SOS accounts need approval
      return this.role === 'admin';
    }
  },
  isActive: { 
    type: Boolean, 
    default: false 
  },
  approvedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    default: null 
  },
  approvedAt: { 
    type: Date, 
    default: null 
  }
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);