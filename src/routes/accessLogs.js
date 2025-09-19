// routes/accessLogs.js
const express = require('express');
const router = express.Router();
const AccessLog = require('../models/AccessLog');
const VehicleLog = require('../models/VehicleLog');
const Vehicle = require('../models/Vehicle');
const Supplier = require('../models/Supplier');
const { verifyToken } = require('../middleware/auth');

// =====================================================
// CHECK IN - Create new access log entry
// =====================================================
router.post('/checkin', verifyToken, async (req, res) => {
  try {
    const {
      personId,
      personType, // 'Supplier', 'Worker', 'LeoniPersonnel'
      vehicleId,
      entryTime,
      notes,
      parkingLocation
    } = req.body;

    // Validate required fields
    if (!personId || !personType) {
      return res.status(400).json({
        success: false,
        message: 'Person ID and person type are required'
      });
    }

    // Check if person is already checked in (has an active entry)
    const existingEntry = await AccessLog.findOne({
      person: personId,
      personType: personType,
      status: { $in: ['entry', 'present'] },
      exitTime: { $exists: false }
    });

    if (existingEntry) {
      return res.status(400).json({
        success: false,
        message: 'Person is already checked in'
      });
    }

    // Create access log
    const accessLog = new AccessLog({
      person: personId,
      personType: personType,
      status: 'entry',
      entryTime: entryTime ? new Date(entryTime) : new Date(),
      logDate: new Date(),
      vehicle: vehicleId || null,
      notes: notes || '',
      recordedBy: req.user._id
    });

    const savedAccessLog = await accessLog.save();

    // Create vehicle log if vehicle is involved
    let vehicleLog = null;
    if (vehicleId) {
      vehicleLog = new VehicleLog({
        vehicle: vehicleId,
        accessLog: savedAccessLog._id,
        entry_time: savedAccessLog.entryTime,
        vlog_date: new Date(),
        parkingLocation: parkingLocation || '',
        vehicleNotes: '',
        recordedBy: req.user._id
      });
      await vehicleLog.save();
    }

    // Populate the response
    await savedAccessLog.populate([
      { path: 'person', select: 'name email cin id_sup' },
      { path: 'vehicle', select: 'lic_plate_string mark model' },
      { path: 'recordedBy', select: 'name email' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Check-in successful',
      data: {
        accessLog: savedAccessLog,
        vehicleLog: vehicleLog
      }
    });

  } catch (error) {
    console.error('Error during check-in:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during check-in'
    });
  }
});

// =====================================================
// CHECK OUT - Update access log with exit time
// =====================================================
router.post('/checkout', verifyToken, async (req, res) => {
  try {
    const {
      personId,
      personType,
      exitTime,
      notes
    } = req.body;

    // Find the active entry for this person
    const activeLog = await AccessLog.findOne({
      person: personId,
      personType: personType,
      status: { $in: ['entry', 'present'] },
      exitTime: { $exists: false }
    });

    if (!activeLog) {
      return res.status(400).json({
        success: false,
        message: 'No active check-in found for this person'
      });
    }

    // Update the access log
    activeLog.exitTime = exitTime ? new Date(exitTime) : new Date();
    activeLog.status = 'exit';
    if (notes) {
      activeLog.notes = activeLog.notes ? `${activeLog.notes} | ${notes}` : notes;
    }

    const updatedAccessLog = await activeLog.save();

    // Update vehicle log if exists
    if (activeLog.vehicle) {
      await VehicleLog.findOneAndUpdate(
        { accessLog: activeLog._id },
        { 
          exit_time: updatedAccessLog.exitTime,
          vehicleNotes: notes || ''
        }
      );
    }

    // Populate the response
    await updatedAccessLog.populate([
      { path: 'person', select: 'name email cin id_sup' },
      { path: 'vehicle', select: 'lic_plate_string mark model' },
      { path: 'recordedBy', select: 'name email' }
    ]);

    res.json({
      success: true,
      message: 'Check-out successful',
      data: updatedAccessLog
    });

  } catch (error) {
    console.error('Error during check-out:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during check-out'
    });
  }
});

// =====================================================
// GET ALL ACCESS LOGS with filtering and pagination
// =====================================================
router.get('/', verifyToken, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      status = '',
      personType = '',
      dateFrom = '',
      dateTo = '',
      sortBy = 'logDate',
      sortOrder = 'desc'
    } = req.query;

    // Build query
    let query = {};

    // Search functionality
    if (search) {
      // We'll need to do a more complex search involving populated fields
      const suppliers = await Supplier.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { cin: { $regex: search, $options: 'i' } },
          { id_sup: { $regex: search, $options: 'i' } }
        ]
      }).select('_id');

      const supplierIds = suppliers.map(s => s._id);
      query.$or = [{ person: { $in: supplierIds } }];
    }

    // Status filter
    if (status) {
      query.status = status;
    }

    // Person type filter
    if (personType) {
      query.personType = personType;
    }

    // Date range filter
    if (dateFrom || dateTo) {
      query.logDate = {};
      if (dateFrom) {
        query.logDate.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        query.logDate.$lte = new Date(dateTo + 'T23:59:59.999Z');
      }
    }

    // Build sort object
    const sortObject = {};
    sortObject[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute query with pagination
    const logs = await AccessLog.find(query)
      .populate('person', 'name email cin id_sup')
      .populate('vehicle', 'lic_plate_string mark model color')
      .populate('recordedBy', 'name email')
      .sort(sortObject)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    // Get total count
    const total = await AccessLog.countDocuments(query);

    res.json({
      success: true,
      data: logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching access logs:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching access logs'
    });
  }
});

// =====================================================
// GET CURRENT ACTIVE ENTRIES (who's currently inside)
// =====================================================
router.get('/active', verifyToken, async (req, res) => {
  try {
    const activeEntries = await AccessLog.find({
      status: { $in: ['entry', 'present'] },
      exitTime: { $exists: false }
    })
      .populate('person', 'name email cin id_sup')
      .populate('vehicle', 'lic_plate_string mark model color')
      .populate('recordedBy', 'name email')
      .sort({ entryTime: -1 });

    res.json({
      success: true,
      data: activeEntries,
      count: activeEntries.length
    });

  } catch (error) {
    console.error('Error fetching active entries:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching active entries'
    });
  }
});

// =====================================================
// GET ACCESS LOGS FOR SPECIFIC PERSON
// =====================================================
router.get('/person/:personId', verifyToken, async (req, res) => {
  try {
    const { personId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const logs = await AccessLog.find({ person: personId })
      .populate('person', 'name email cin id_sup')
      .populate('vehicle', 'lic_plate_string mark model color')
      .populate('recordedBy', 'name email')
      .sort({ logDate: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await AccessLog.countDocuments({ person: personId });

    res.json({
      success: true,
      data: logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching person access logs:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching person access logs'
    });
  }
});

// =====================================================
// GET VEHICLE LOGS
// =====================================================
router.get('/vehicles', verifyToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, vehicleId = '' } = req.query;

    let query = {};
    if (vehicleId) {
      query.vehicle = vehicleId;
    }

    const vehicleLogs = await VehicleLog.find(query)
      .populate('vehicle', 'lic_plate_string mark model color')
      .populate({
        path: 'accessLog',
        populate: {
          path: 'person',
          select: 'name email cin id_sup'
        }
      })
      .populate('recordedBy', 'name email')
      .sort({ vlog_date: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await VehicleLog.countDocuments(query);

    res.json({
      success: true,
      data: vehicleLogs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching vehicle logs:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching vehicle logs'
    });
  }
});

// =====================================================
// GET STATISTICS
// =====================================================
router.get('/stats', verifyToken, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      totalEntriesToday,
      currentlyInside,
      totalExitsToday,
      supplierEntries,
      personnelEntries
    ] = await Promise.all([
      AccessLog.countDocuments({
        logDate: { $gte: today, $lt: tomorrow },
        status: { $in: ['entry', 'present'] }
      }),
      AccessLog.countDocuments({
        status: { $in: ['entry', 'present'] },
        exitTime: { $exists: false }
      }),
      AccessLog.countDocuments({
        logDate: { $gte: today, $lt: tomorrow },
        status: 'exit'
      }),
      AccessLog.countDocuments({
        logDate: { $gte: today, $lt: tomorrow },
        personType: 'Supplier',
        status: { $in: ['entry', 'present'] }
      }),
      AccessLog.countDocuments({
        logDate: { $gte: today, $lt: tomorrow },
        personType: { $in: ['Worker', 'LeoniPersonnel'] },
        status: { $in: ['entry', 'present'] }
      })
    ]);

    // Get vehicle statistics
    const vehicleStats = await VehicleLog.aggregate([
      {
        $match: {
          vlog_date: { $gte: today, $lt: tomorrow }
        }
      },
      {
        $group: {
          _id: null,
          totalVehicles: { $sum: 1 },
          currentlyParked: {
            $sum: {
              $cond: [{ $eq: ['$exit_time', null] }, 1, 0]
            }
          }
        }
      }
    ]);

    const vehicleData = vehicleStats[0] || { totalVehicles: 0, currentlyParked: 0 };

    res.json({
      success: true,
      data: {
        today: {
          totalEntries: totalEntriesToday,
          totalExits: totalExitsToday,
          currentlyInside: currentlyInside,
          supplierEntries: supplierEntries,
          personnelEntries: personnelEntries
        },
        vehicles: {
          totalVehiclesToday: vehicleData.totalVehicles,
          currentlyParked: vehicleData.currentlyParked
        }
      }
    });

  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching statistics'
    });
  }
});

// =====================================================
// MANUAL LOG ENTRY (for corrections or manual entries)
// =====================================================
router.post('/manual', verifyToken, async (req, res) => {
  try {
    const {
      personId,
      personType,
      vehicleId,
      logDate,
      entryTime,
      exitTime,
      status,
      notes
    } = req.body;

    // Validate required fields
    if (!personId || !personType || !logDate) {
      return res.status(400).json({
        success: false,
        message: 'Person ID, person type, and log date are required'
      });
    }

    // Create manual access log entry
    const accessLog = new AccessLog({
      person: personId,
      personType: personType,
      status: status || 'entry',
      entryTime: entryTime ? new Date(entryTime) : new Date(),
      exitTime: exitTime ? new Date(exitTime) : undefined,
      logDate: new Date(logDate),
      vehicle: vehicleId || null,
      notes: notes ? `[MANUAL ENTRY] ${notes}` : '[MANUAL ENTRY]',
      recordedBy: req.user._id
    });

    const savedAccessLog = await accessLog.save();

    // Create corresponding vehicle log if vehicle is involved
    if (vehicleId) {
      const vehicleLog = new VehicleLog({
        vehicle: vehicleId,
        accessLog: savedAccessLog._id,
        entry_time: savedAccessLog.entryTime,
        exit_time: savedAccessLog.exitTime || null,
        vlog_date: new Date(logDate),
        vehicleNotes: '[MANUAL ENTRY]',
        recordedBy: req.user._id
      });
      await vehicleLog.save();
    }

    // Populate the response
    await savedAccessLog.populate([
      { path: 'person', select: 'name email cin id_sup' },
      { path: 'vehicle', select: 'lic_plate_string mark model' },
      { path: 'recordedBy', select: 'name email' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Manual log entry created successfully',
      data: savedAccessLog
    });

  } catch (error) {
    console.error('Error creating manual log entry:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating manual log entry'
    });
  }
});

module.exports = router;