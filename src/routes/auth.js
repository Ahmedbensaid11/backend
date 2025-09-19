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

// Get current user profile
router.get("/profile", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    res.json({
      user: {
        id: user._id,
        cin: user.cin,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        birthdate: user.birthdate,
        phoneNumber: user.phoneNumber,
        role: user.role,
        isApproved: user.isApproved,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Server error" });
  }
});

// Update user profile
router.put("/profile", verifyToken, async (req, res) => {
  try {
    const { cin, firstName, lastName, birthdate, phoneNumber, email } = req.body;
    const userId = req.user.id;

    // Validation
    if (!firstName || !lastName || !email || !cin || !birthdate || !phoneNumber) {
      return res.status(400).json({ msg: "All fields are required" });
    }

    // Check if email is being changed and if it's already taken by another user
    if (email !== req.user.email) {
      const existingUser = await User.findOne({ email, _id: { $ne: userId } });
      if (existingUser) {
        return res.status(400).json({ msg: "Email already exists" });
      }
    }

    // Check if CIN is being changed and if it's already taken by another user
    const existingCIN = await User.findOne({ cin, _id: { $ne: userId } });
    if (existingCIN) {
      return res.status(400).json({ msg: "CIN already exists" });
    }

    // Update user
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        cin,
        firstName,
        lastName,
        birthdate,
        phoneNumber,
        email,
      },
      { new: true, runValidators: true }
    ).select('-password');

    if (!updatedUser) {
      return res.status(404).json({ msg: "User not found" });
    }

    res.json({
      msg: "Profile updated successfully",
      user: {
        id: updatedUser._id,
        cin: updatedUser.cin,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        email: updatedUser.email,
        birthdate: updatedUser.birthdate,
        phoneNumber: updatedUser.phoneNumber,
        role: updatedUser.role,
        isApproved: updatedUser.isApproved,
        isActive: updatedUser.isActive,
        createdAt: updatedUser.createdAt,
        updatedAt: updatedUser.updatedAt
      }
    });
  } catch (error) {
    console.error(error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ msg: "Validation error", errors: error.errors });
    }
    res.status(500).json({ msg: "Server error" });
  }
});

// Change password
router.put("/change-password", verifyToken, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user.id;

    // Validation
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ msg: "Both old and new passwords are required" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ msg: "New password must be at least 6 characters long" });
    }

    // Get user with password
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    // Verify old password
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: "Old password is incorrect" });
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await User.findByIdAndUpdate(userId, { password: hashedNewPassword });

    res.json({ msg: "Password changed successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Server error" });
  }
});

module.exports = router;