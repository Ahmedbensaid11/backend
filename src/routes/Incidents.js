  const express = require("express");
  const mongoose = require("mongoose");
  const Incident = require("../models/Incident");
  const { verifyToken, isAdmin, isSOS } = require("../middleware/auth");
  const router = express.Router();

  console.log("🚀🚀🚀 INCIDENTS ROUTES FILE LOADING 🚀🚀🚀");

  // ================== TEST ROUTES ==================

  // Test route
  router.get("/test", (req, res) => {
    console.log("🧪 Incidents test route hit");
    res.json({ msg: "Incidents routes are working!" });
  });

  // Debug route
  router.get("/debug", (req, res) => {
    console.log("🧪 /api/incidents/debug route hit");
    res.json({
      msg: "My-reports route should work!",
      user: req.user || "No user"
    });
  });

  // Temporary test-create route (in-memory only, no save)
  router.post("/test-create", async (req, res) => {
    try {
      console.log("🧪 Testing incident creation...");
      const testIncident = new Incident({
        type: "Fire",
        description: "Test fire incident",
        date: new Date(),
        reportedBy: new mongoose.Types.ObjectId(),
        default_priority: "high"
      });

      console.log("✅ Test incident created in memory:", testIncident);
      res.json({ msg: "Test successful", incident: testIncident });
    } catch (error) {
      console.error("❌ Test failed:", error);
      res.status(500).json({ msg: "Test failed", error: error.message });
    }
  });

  // NEW: Simple test route (saves to DB)
  router.post("/test-simple", isSOS, async (req, res) => {
    try {
      console.log("🧪 Testing simple incident creation (DB save)");

      const testIncident = {
        type: "Fire",
        description: "Test incident",
        date: new Date(),
        reportedBy: req.user._id,
        default_priority: "high",
        status: "pending"
      };

      console.log("Creating test incident with data:", testIncident);

      const newIncident = new Incident(testIncident);
      await newIncident.save();

      console.log("✅ Test incident created successfully:", newIncident._id);
      res.json({ msg: "Test successful", incident: newIncident });
    } catch (error) {
      console.error("❌ Test error:", error);
      res.status(500).json({ msg: "Test failed", error: error.message });
    }
  });

  // ================== PRIORITY MAPPING ==================
  const PRIORITY_MAPPING = {
    'Login bug': 'medium',
    'Report submission error': 'low',
    'Gate malfunction': 'high',
    'Electricity outage': 'high',
    'Fire': 'high',
    'Car accident': 'medium',
    'Unauthorized worker entry': 'medium',
    "Worker's vehicle overstaying": 'low'
  };

  // ================== SOS ROUTES ==================

  // Get own incidents
  console.log("📋 Registering /my-reports route");
  router.get("/my-reports", isSOS, async (req, res) => {
    console.log("🎯 [Incidents] /my-reports route HIT!");
    try {
      console.log("📋 Fetching incidents for user:", req.user.email);
      const { page = 1, limit = 10, status, type, search } = req.query;

      const query = { reportedBy: req.user._id };
      if (status) query.status = status;
      if (type) query.type = type;
      if (search) {
        query.$or = [
          { description: { $regex: search, $options: "i" } },
          { type: { $regex: search, $options: "i" } }
        ];
      }

      const incidents = await Incident.find(query)
        .populate("reportedBy", "firstName lastName email")
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
      console.error("❌ Error fetching user incidents:", error);
      res.status(500).json({ msg: "Server error while fetching incidents" });
    }
  });

  // Create incident report
  router.post("/report", isSOS, async (req, res) => {
    try {
      console.log("📝 Creating new incident report");
      const { type, description, date } = req.body;
      console.log("Received data:", { type, description, date });

      // Validate input
      if (!type || !description || !date) {
        return res.status(400).json({
          msg: "All fields are required",
          fields: ["type", "description", "date"]
        });
      }

      const validTypes = Object.keys(PRIORITY_MAPPING);
      if (!validTypes.includes(type)) {
        return res.status(400).json({ msg: "Invalid incident type" });
      }

      const incidentDate = new Date(date);
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (incidentDate > today) {
        return res.status(400).json({ msg: "Incident date cannot be in the future" });
      }

      const defaultPriority = PRIORITY_MAPPING[type] || "medium";

      const newIncident = new Incident({
        type,
        description: description.trim(),
        date: incidentDate,
        reportedBy: req.user._id,
        default_priority: defaultPriority,
        status: "pending"
      });

      console.log("About to save incident:", newIncident);
      await newIncident.save();
      await newIncident.populate("reportedBy", "firstName lastName email");

      console.log("✅ Incident saved successfully");
      res.status(201).json({
        msg: "Incident reported successfully",
        incident: newIncident
      });
    } catch (error) {
      console.error("❌ FULL Error creating incident:", error);
      res.status(500).json({ msg: "Server error while reporting incident", error: error.message });
    }
  });

  // ================== ADMIN ROUTES ==================

  // Get all incidents
  router.get("/admin/all", isAdmin, async (req, res) => {
    try {
      const { page = 1, limit = 10, status, type, search, default_priority } = req.query;
      const query = {};
      if (status) query.status = status;
      if (type) query.type = type;
      if (default_priority) query.default_priority = default_priority;
      if (search) {
        query.$or = [
          { description: { $regex: search, $options: "i" } },
          { type: { $regex: search, $options: "i" } }
        ];
      }

      const incidents = await Incident.find(query)
        .populate("reportedBy", "firstName lastName email cin")
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
      console.error("❌ Error fetching all incidents:", error);
      res.status(500).json({ msg: "Server error while fetching incidents" });
    }
  });

  // Get incident statistics
  router.get("/admin/stats", isAdmin, async (req, res) => {
    try {
      const stats = await Incident.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            pending: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } },
            resolved: { $sum: { $cond: [{ $eq: ["$status", "resolved"] }, 1, 0] } }
          }
        }
      ]);

      const typeStats = await Incident.aggregate([
        { $group: { _id: "$type", count: { $sum: 1 } } }
      ]);

      const priorityStats = await Incident.aggregate([
        { $group: { _id: "$default_priority", count: { $sum: 1 } } }
      ]);

      res.json({
        overall: stats[0] || { total: 0, pending: 0, resolved: 0 },
        byType: typeStats,
        byPriority: priorityStats
      });
    } catch (error) {
      console.error("❌ Error fetching stats:", error);
      res.status(500).json({ msg: "Server error while fetching statistics" });
    }
  });

  // Mark incident as resolved
  router.patch("/admin/:id/resolve", isAdmin, async (req, res) => {
    console.log("🎯 RESOLVE ROUTE HIT! ID:", req.params.id);
    try {
      const incidentId = req.params.id;

      if (!incidentId.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({ msg: "Invalid incident ID format" });
      }

      const incident = await Incident.findById(incidentId);
      if (!incident) {
        return res.status(404).json({ msg: "Incident not found" });
      }

      if (incident.status === "resolved") {
        return res.status(400).json({ msg: "Incident is already resolved" });
      }

      const updatedIncident = await Incident.findByIdAndUpdate(
        incidentId,
        { status: "resolved", resolvedAt: new Date() },
        { new: true }
      ).populate("reportedBy", "firstName lastName email cin");

      console.log("✅ Incident resolved successfully:", updatedIncident._id);

      res.json({
        msg: "Incident marked as resolved successfully",
        incident: updatedIncident
      });
    } catch (error) {
      console.error("❌ Error resolving incident:", error);
      res.status(500).json({ msg: "Server error while resolving incident" });
    }
  });

  console.log("📋 All Incidents routes registered");
  module.exports = router;