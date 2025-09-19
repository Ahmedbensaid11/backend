const express = require("express");
const Incident = require("../models/Incident");
const { verifyToken, isAdmin, isSOS } = require("../middleware/auth");

const router = express.Router();

// SOS Routes - Create incident report
router.post("/report", isSOS, async (req, res) => {
  try {
    const { type, description, date } = req.body;

    // Validate required fields
    if (!type || !description || !date) {
      return res.status(400).json({ 
        msg: "All fields are required", 
        fields: ["type", "description", "date"] 
      });
    }

    // Validate incident type
    if (!['Real Parking', 'Application'].includes(type)) {
      return res.status(400).json({ msg: "Invalid incident type" });
    }

    // Validate date is not in the future
    const incidentDate = new Date(date);
    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today

    if (incidentDate > today) {
      return res.status(400).json({ msg: "Incident date cannot be in the future" });
    }

    // Create new incident
    const newIncident = new Incident({
      type,
      description: description.trim(),
      date: incidentDate,
      reportedBy: req.user._id
    });

    await newIncident.save();

    // Populate the reportedBy field for response
    await newIncident.populate('reportedBy', 'firstName lastName email');

    res.status(201).json({
      msg: "Incident reported successfully",
      incident: newIncident
    });

  } catch (error) {
    console.error("Error creating incident:", error);
    res.status(500).json({ msg: "Server error while reporting incident" });
  }
});

// SOS Routes - Get own incidents
router.get("/my-reports", isSOS, async (req, res) => {
  try {
    const { page = 1, limit = 10, status, type, search } = req.query;
    
    // Build query
    const query = { reportedBy: req.user._id };
    
    if (status) query.status = status;
    if (type) query.type = type;
    if (search) {
      query.$or = [
        { description: { $regex: search, $options: 'i' } },
        { type: { $regex: search, $options: 'i' } }
      ];
    }

    // Execute query with pagination
    const incidents = await Incident.find(query)
      .populate('reportedBy', 'firstName lastName email')
      .populate('approvedBy', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Incident.countDocuments(query);

    res.json({
      incidents,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });

  } catch (error) {
    console.error("Error fetching user incidents:", error);
    res.status(500).json({ msg: "Server error while fetching incidents" });
  }
});

// SOS Routes - Get specific incident details
router.get("/my-reports/:id", isSOS, async (req, res) => {
  try {
    const incident = await Incident.findOne({
      _id: req.params.id,
      reportedBy: req.user._id
    })
    .populate('reportedBy', 'firstName lastName email')
    .populate('approvedBy', 'firstName lastName email');

    if (!incident) {
      return res.status(404).json({ msg: "Incident not found" });
    }

    res.json({ incident });

  } catch (error) {
    console.error("Error fetching incident:", error);
    res.status(500).json({ msg: "Server error while fetching incident" });
  }
});

// Admin Routes - Get all incidents
router.get("/admin/all", isAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 10, status, type, search, priority } = req.query;
    
    // Build query
    const query = {};
    
    if (status) query.status = status;
    if (type) query.type = type;
    if (priority) query.priority = priority;
    if (search) {
      query.$or = [
        { description: { $regex: search, $options: 'i' } },
        { type: { $regex: search, $options: 'i' } }
      ];
    }

    // Execute query with pagination
    const incidents = await Incident.find(query)
      .populate('reportedBy', 'firstName lastName email cin')
      .populate('approvedBy', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Incident.countDocuments(query);

    // Get summary statistics
    const stats = await Incident.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      incidents,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
      stats
    });

  } catch (error) {
    console.error("Error fetching all incidents:", error);
    res.status(500).json({ msg: "Server error while fetching incidents" });
  }
});

// Admin Routes - Update incident status
router.patch("/admin/:id/status", isAdmin, async (req, res) => {
  try {
    const { status, adminNotes, priority } = req.body;
    const incidentId = req.params.id;

    // Validate status
    const validStatuses = ['pending', 'approved', 'rejected', 'resolved'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ msg: "Invalid status" });
    }

    // Find incident
    const incident = await Incident.findById(incidentId);
    if (!incident) {
      return res.status(404).json({ msg: "Incident not found" });
    }

    // Update incident
    const updateData = { status };
    
    if (adminNotes !== undefined) updateData.adminNotes = adminNotes;
    if (priority !== undefined) updateData.priority = priority;

    // Set approval/resolution timestamps and admin
    if (status === 'approved' || status === 'rejected') {
      updateData.approvedBy = req.user._id;
      updateData.approvedAt = new Date();
    }
    
    if (status === 'resolved') {
      updateData.resolvedAt = new Date();
    }

    const updatedIncident = await Incident.findByIdAndUpdate(
      incidentId,
      updateData,
      { new: true }
    )
    .populate('reportedBy', 'firstName lastName email cin')
    .populate('approvedBy', 'firstName lastName email');

    res.json({
      msg: `Incident ${status} successfully`,
      incident: updatedIncident
    });

  } catch (error) {
    console.error("Error updating incident:", error);
    res.status(500).json({ msg: "Server error while updating incident" });
  }
});

// Admin Routes - Get incident statistics
router.get("/admin/stats", isAdmin, async (req, res) => {
  try {
    const stats = await Incident.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
          approved: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } },
          rejected: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } },
          resolved: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } }
        }
      }
    ]);

    const typeStats = await Incident.aggregate([
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 }
        }
      }
    ]);

    const priorityStats = await Incident.aggregate([
      {
        $group: {
          _id: '$priority',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      overall: stats[0] || { total: 0, pending: 0, approved: 0, rejected: 0, resolved: 0 },
      byType: typeStats,
      byPriority: priorityStats
    });

  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({ msg: "Server error while fetching statistics" });
  }
});

// Common Routes - Get incident by ID (accessible by both admin and owner)
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const query = { _id: req.params.id };
    
    // If user is SOS, they can only see their own incidents
    if (req.user.role === 'sos') {
      query.reportedBy = req.user._id;
    }

    const incident = await Incident.findOne(query)
      .populate('reportedBy', 'firstName lastName email cin')
      .populate('approvedBy', 'firstName lastName email');

    if (!incident) {
      return res.status(404).json({ msg: "Incident not found" });
    }

    res.json({ incident });

  } catch (error) {
    console.error("Error fetching incident:", error);
    res.status(500).json({ msg: "Server error while fetching incident" });
  }
});

module.exports = router;