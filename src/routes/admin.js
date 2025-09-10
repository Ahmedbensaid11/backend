const express = require("express");
const User = require("../models/User");
const { isAdmin } = require("../middleware/auth");

const router = express.Router();

// Get all pending SOS user approvals
router.get("/pending-approvals", isAdmin, async (req, res) => {
  try {
    const pendingUsers = await User.find({ 
      isApproved: false, 
      role: 'sos' 
    })
    .select('-password')
    .sort({ createdAt: -1 }); // Newest first

    res.json({ 
      pendingUsers,
      count: pendingUsers.length 
    });
  } catch (error) {
    console.error('Pending approvals fetch error:', error);
    res.status(500).json({ msg: "Server error" });
  }
});

// Get all users with filtering options
router.get("/users", isAdmin, async (req, res) => {
  try {
    const { role, isApproved, isActive, page = 1, limit = 10 } = req.query;
    
    // Build filter object
    let filter = {};
    if (role) filter.role = role;
    if (isApproved !== undefined) filter.isApproved = isApproved === 'true';
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const users = await User.find(filter)
      .select('-password')
      .populate('approvedBy', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalUsers = await User.countDocuments(filter);
    
    res.json({
      users,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalUsers / parseInt(limit)),
        totalUsers,
        hasNext: skip + users.length < totalUsers,
        hasPrev: parseInt(page) > 1
      }
    });
  } catch (error) {
    console.error('Users fetch error:', error);
    res.status(500).json({ msg: "Server error" });
  }
});

// Get user statistics
router.get("/stats", isAdmin, async (req, res) => {
  try {
    const stats = await Promise.all([
      User.countDocuments({ role: 'admin' }),
      User.countDocuments({ role: 'sos' }),
      User.countDocuments({ role: 'sos', isApproved: false }),
      User.countDocuments({ role: 'sos', isApproved: true }),
      User.countDocuments({ isActive: false })
    ]);

    res.json({
      totalAdmins: stats[0],
      totalSOS: stats[1],
      pendingApprovals: stats[2],
      approvedSOS: stats[3],
      deactivatedUsers: stats[4],
      totalUsers: stats[0] + stats[1]
    });
  } catch (error) {
    console.error('Stats fetch error:', error);
    res.status(500).json({ msg: "Server error" });
  }
});

// Approve a SOS user
router.patch("/approve-user/:userId", isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const adminId = req.user._id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    if (user.role !== 'sos') {
      return res.status(400).json({ msg: "Only SOS users can be approved" });
    }

    if (user.isApproved) {
      return res.status(400).json({ msg: "User is already approved" });
    }

    // Update user approval status
    user.isApproved = true;
    user.approvedBy = adminId;
    user.approvedAt = new Date();
    await user.save();

    // Populate the approvedBy field for response
    await user.populate('approvedBy', 'firstName lastName email');

    res.json({ 
      msg: "User approved successfully",
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        isApproved: user.isApproved,
        approvedBy: user.approvedBy,
        approvedAt: user.approvedAt
      }
    });
  } catch (error) {
    console.error('User approval error:', error);
    res.status(500).json({ msg: "Server error" });
  }
});

// Reject/Delete a pending SOS user
router.delete("/reject-user/:userId", isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body; // Optional rejection reason

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    if (user.isApproved) {
      return res.status(400).json({ msg: "Cannot reject an approved user" });
    }

    // Store user info before deletion
    const rejectedUser = {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email
    };

    await User.findByIdAndDelete(userId);

    res.json({ 
      msg: "User rejected and removed successfully",
      rejectedUser,
      reason: reason || "No reason provided"
    });
  } catch (error) {
    console.error('User rejection error:', error);
    res.status(500).json({ msg: "Server error" });
  }
});

// Toggle user active status (activate/deactivate)
router.patch("/toggle-status/:userId", isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    // Prevent admin from deactivating themselves
    if (userId === req.user._id.toString()) {
      return res.status(400).json({ msg: "Cannot deactivate your own account" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    user.isActive = !user.isActive;
    await user.save();

    res.json({ 
      msg: `User ${user.isActive ? 'activated' : 'deactivated'} successfully`,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        isActive: user.isActive
      }
    });
  } catch (error) {
    console.error('User status toggle error:', error);
    res.status(500).json({ msg: "Server error" });
  }
});

// Get specific user details
router.get("/user/:userId", isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId)
      .select('-password')
      .populate('approvedBy', 'firstName lastName email');

    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    res.json({ user });
  } catch (error) {
    console.error('User details fetch error:', error);
    res.status(500).json({ msg: "Server error" });
  }
});

// Bulk approve multiple users
router.patch("/bulk-approve", isAdmin, async (req, res) => {
  try {
    const { userIds } = req.body; // Array of user IDs
    const adminId = req.user._id;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ msg: "User IDs array is required" });
    }

    const result = await User.updateMany(
      { 
        _id: { $in: userIds }, 
        role: 'sos', 
        isApproved: false 
      },
      { 
        isApproved: true, 
        approvedBy: adminId, 
        approvedAt: new Date() 
      }
    );

    res.json({ 
      msg: `Successfully approved ${result.modifiedCount} users`,
      approvedCount: result.modifiedCount 
    });
  } catch (error) {
    console.error('Bulk approval error:', error);
    res.status(500).json({ msg: "Server error" });
  }
});

module.exports = router;