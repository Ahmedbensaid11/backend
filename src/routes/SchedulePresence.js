const express = require('express');
const router = express.Router();
const SchedulePresence = require('../models/SchedulePresence');
const { verifyToken, isAdmin } = require('../middleware/auth');

// @route   GET /api/schedule-presence
// @desc    Get all scheduled presences (Any authenticated user can view)
// @access  Private (Any authenticated user)
router.get('/', verifyToken, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search = '', 
      status = '', 
      sortBy = 'date',
      sortOrder = 'desc' 
    } = req.query;

    // Build search query
    const searchQuery = {};
    
    if (search) {
      searchQuery.supplierName = { $regex: search, $options: 'i' };
    }
    
    if (status && status !== 'all') {
      searchQuery.status = status;
    }

    // Build sort object
    const sortObject = {};
    sortObject[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute query with pagination
    const schedules = await SchedulePresence.find(searchQuery)
      .populate('createdBy', 'name email')
      .sort(sortObject)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    // Get total count for pagination
    const total = await SchedulePresence.countDocuments(searchQuery);

    res.json({
      success: true,
      data: schedules,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching schedule presences:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while fetching schedule presences' 
    });
  }
});

// @route   GET /api/schedule-presence/:id
// @desc    Get single scheduled presence (Any authenticated user can view)
// @access  Private (Any authenticated user)
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const schedule = await SchedulePresence.findById(req.params.id)
      .populate('createdBy', 'name email');

    if (!schedule) {
      return res.status(404).json({ 
        success: false, 
        message: 'Schedule presence not found' 
      });
    }

    res.json({
      success: true,
      data: schedule
    });

  } catch (error) {
    console.error('Error fetching schedule presence:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid schedule presence ID' 
      });
    }

    res.status(500).json({ 
      success: false, 
      message: 'Server error while fetching schedule presence' 
    });
  }
});

// @route   POST /api/schedule-presence
// @desc    Create new scheduled presence (Admin only)
// @access  Private (Admin)
router.post('/', isAdmin, async (req, res) => {
  try {
    const { supplierName, date, time, reason } = req.body;

    // Validate required fields
    if (!supplierName || !date || !time || !reason) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required: supplierName, date, time, reason'
      });
    }

    // Validate time format
    if (!/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time)) {
      return res.status(400).json({
        success: false,
        message: 'Time must be in HH:MM format (24-hour)'
      });
    }

    // Check for duplicate scheduling (same supplier on same date and time)
    const existingSchedule = await SchedulePresence.findOne({
      supplierName: supplierName.trim(),
      date: new Date(date),
      time: time,
      status: { $in: ['scheduled', 'rescheduled'] }
    });

    if (existingSchedule) {
      return res.status(400).json({
        success: false,
        message: 'A meeting with this supplier is already scheduled for this date and time'
      });
    }

    // Create new schedule presence
    const newSchedule = new SchedulePresence({
      supplierName: supplierName.trim(),
      date: new Date(date),
      time: time,
      reason: reason.trim(),
      createdBy: req.user._id
    });

    const savedSchedule = await newSchedule.save();
    await savedSchedule.populate('createdBy', 'name email');

    res.status(201).json({
      success: true,
      message: 'Schedule presence created successfully',
      data: savedSchedule
    });

  } catch (error) {
    console.error('Error creating schedule presence:', error);

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while creating schedule presence'
    });
  }
});

// @route   PUT /api/schedule-presence/:id
// @desc    Update scheduled presence (Admin only)
// @access  Private (Admin)
router.put('/:id', isAdmin, async (req, res) => {
  try {
    const { supplierName, date, time, reason, status } = req.body;

    const schedule = await SchedulePresence.findById(req.params.id);

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: 'Schedule presence not found'
      });
    }

    // Validate time format if provided
    if (time && !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time)) {
      return res.status(400).json({
        success: false,
        message: 'Time must be in HH:MM format (24-hour)'
      });
    }

    // Check for duplicate if supplier name, date, or time is being changed
    if ((supplierName && supplierName !== schedule.supplierName) || 
        (date && new Date(date).getTime() !== schedule.date.getTime()) ||
        (time && time !== schedule.time)) {
      
      const checkSupplier = supplierName || schedule.supplierName;
      const checkDate = date ? new Date(date) : schedule.date;
      const checkTime = time || schedule.time;
      
      const existingSchedule = await SchedulePresence.findOne({
        _id: { $ne: req.params.id },
        supplierName: checkSupplier,
        date: checkDate,
        time: checkTime,
        status: { $in: ['scheduled', 'rescheduled'] }
      });

      if (existingSchedule) {
        return res.status(400).json({
          success: false,
          message: 'A meeting with this supplier is already scheduled for this date and time'
        });
      }
    }

    // Update fields
    if (supplierName) schedule.supplierName = supplierName.trim();
    if (date) schedule.date = new Date(date);
    if (time) schedule.time = time;
    if (reason) schedule.reason = reason.trim();
    if (status) schedule.status = status;

    const updatedSchedule = await schedule.save();
    await updatedSchedule.populate('createdBy', 'name email');

    res.json({
      success: true,
      message: 'Schedule presence updated successfully',
      data: updatedSchedule
    });

  } catch (error) {
    console.error('Error updating schedule presence:', error);

    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid schedule presence ID'
      });
    }

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while updating schedule presence'
    });
  }
});

// @route   DELETE /api/schedule-presence/:id
// @desc    Delete scheduled presence (Admin only)
// @access  Private (Admin)
router.delete('/:id', isAdmin, async (req, res) => {
  try {
    const schedule = await SchedulePresence.findById(req.params.id);

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: 'Schedule presence not found'
      });
    }

    await SchedulePresence.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Schedule presence deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting schedule presence:', error);

    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid schedule presence ID'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while deleting schedule presence'
    });
  }
});

// @route   GET /api/schedule-presence/stats/summary
// @desc    Get schedule presence statistics (Admin only)
// @access  Private (Admin)
router.get('/stats/summary', isAdmin, async (req, res) => {
  try {
    const stats = await SchedulePresence.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const totalSchedules = await SchedulePresence.countDocuments();
    const upcomingSchedules = await SchedulePresence.countDocuments({
      date: { $gte: new Date() },
      status: { $in: ['scheduled', 'rescheduled'] }
    });

    res.json({
      success: true,
      data: {
        total: totalSchedules,
        upcoming: upcomingSchedules,
        statusBreakdown: stats
      }
    });

  } catch (error) {
    console.error('Error fetching schedule stats:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching statistics'
    });
  }
});

module.exports = router;