const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();

// Register route
router.post("/register", async (req, res) => {
  try {
    const { cin, firstName, lastName, birthdate, phoneNumber, email, password, role } = req.body;

    // Validate required fields
    if (!cin || !firstName || !lastName || !birthdate || !phoneNumber || !email || !password || !role) {
      return res.status(400).json({ msg: "All fields are required" });
    }

    // Validate role
    if (!['admin', 'sos'].includes(role)) {
      return res.status(400).json({ msg: "Valid role is required (admin or sos)" });
    }

    // Check if user exists (email or CIN)
    const existingUser = await User.findOne({ 
      $or: [{ email }, { cin }] 
    });
    
    if (existingUser) {
      return res.status(400).json({ 
        msg: existingUser.email === email ? "Email already registered" : "CIN already registered" 
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const newUser = new User({
      cin,
      firstName,
      lastName,
      birthdate,
      phoneNumber,
      email,
      password: hashedPassword,
      role
    });

    await newUser.save();

    // Response based on role
    if (role === 'admin') {
      res.status(201).json({ 
        msg: "Admin account created successfully and is active!",
        needsApproval: false
      });
    } else {
      res.status(201).json({ 
        msg: "SOS account created successfully! Waiting for admin approval.",
        needsApproval: true
      });
    }
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ msg: "Server error during registration" });
  }
});

// Login route
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ msg: "Email and password are required" });
    }

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ msg: "Invalid email or password" });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: "Invalid email or password" });
    }

    // Check if account is approved
    if (!user.isApproved) {
      return res.status(403).json({ 
        msg: "Account is pending admin approval. Please contact an administrator.",
        status: "pending_approval"
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(403).json({ 
        msg: "Account has been deactivated. Please contact an administrator.",
        status: "deactivated"
      });
    }

    // Create JWT token
    const token = jwt.sign(
      { 
        id: user._id, 
        email: user.email, 
        role: user.role 
      },
      process.env.JWT_SECRET,
      { expiresIn: "24h" } // Extended to 24 hours
    );

    res.json({
      msg: "Login successful",
      token,
      user: {
        id: user._id,
        cin: user.cin,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        isApproved: user.isApproved,
        isActive: user.isActive
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ msg: "Server error during login" });
  }
});

// Get current user profile
router.get("/me", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json({ user });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ msg: "Server error" });
  }
});

// Update user profile
router.patch("/profile", verifyToken, async (req, res) => {
  try {
    const { firstName, lastName, phoneNumber } = req.body;
    const userId = req.user._id;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { 
        firstName: firstName || req.user.firstName,
        lastName: lastName || req.user.lastName,
        phoneNumber: phoneNumber || req.user.phoneNumber
      },
      { new: true }
    ).select('-password');

    res.json({ 
      msg: "Profile updated successfully",
      user: updatedUser 
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ msg: "Server error" });
  }
});

// Change password
router.patch("/change-password", verifyToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user._id;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ msg: "Current password and new password are required" });
    }

    const user = await User.findById(userId);
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    
    if (!isMatch) {
      return res.status(400).json({ msg: "Current password is incorrect" });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await User.findByIdAndUpdate(userId, { password: hashedNewPassword });

    res.json({ msg: "Password changed successfully" });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ msg: "Server error" });
  }
});

module.exports = router;