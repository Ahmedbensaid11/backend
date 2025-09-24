// routes/logs.js - Corrected vehicle population approach
const express = require('express');
const router = express.Router();
const Log = require('../models/Log');
const Vehiculog = require('../models/VehicleLog');
const Vehicle = require('../models/Vehicle');
const Supplier = require('../models/Supplier');
const LeoniPersonnel = require('../models/LeoniPersonnel');
const MonthlyVisit = require('../models/MonthlyVisit');
const { verifyToken } = require('../middleware/auth');

// =====================================================
// CHECK IN - Create new log entry + Track monthly visits
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

    // Validate personType
    if (!['Supplier', 'Worker', 'LeoniPersonnel'].includes(personType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid person type'
      });
    }

    // Check if person is already checked in (has an active entry)
    const existingEntry = await Log.findOne({
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

    const visitDate = entryTime ? new Date(entryTime) : new Date();

    // Create log entry
    const logEntry = new Log({
      person: personId,
      personType: personType,
      status: 'entry',
      entryTime: visitDate,
      logDate: visitDate,
      notes: notes || '',
      recordedBy: req.user._id
    });

    const savedLog = await logEntry.save();

    // Track monthly visits for suppliers
    let monthlyVisitRecord = null;
    if (personType === 'Supplier') {
      try {
        monthlyVisitRecord = await MonthlyVisit.incrementVisit(personId, visitDate);
        console.log('Monthly visit updated:', monthlyVisitRecord);
      } catch (error) {
        console.error('Error updating monthly visit count:', error);
        // Don't fail the check-in if monthly visit tracking fails
      }
    }

    // Create vehicle log if vehicle is involved
    let vehicleLog = null;
    if (vehicleId) {
      vehicleLog = new Vehiculog({
        vehicle: vehicleId,
        log: savedLog._id,
        entry_time: savedLog.entryTime,
        vlog_date: visitDate,
        parkingLocation: parkingLocation || '',
        vehicleNotes: '',
        recordedBy: req.user._id
      });
      await vehicleLog.save();
    }

    // Populate the response - NO vehicle population here
    let populateConfig = [
      { path: 'recordedBy', select: 'name email' }
    ];

    if (personType === 'Supplier') {
      populateConfig.push({ path: 'person', select: 'name email cin id_sup' });
    } else if (personType === 'LeoniPersonnel') {
      populateConfig.push({ path: 'person', select: 'name email cin matricule' });
    }

    await savedLog.populate(populateConfig);

    res.status(201).json({
      success: true,
      message: 'Check-in successful',
      data: {
        log: savedLog,
        vehicleLog: vehicleLog,
        monthlyVisitCount: monthlyVisitRecord ? monthlyVisitRecord.visitCount : null
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
// CHECK OUT
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
    const activeLog = await Log.findOne({
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

    // Set exit time
    const currentExitTime = exitTime ? new Date(exitTime) : new Date();
    activeLog.exitTime = currentExitTime;
    activeLog.status = 'exit';

    // Calculate duration safely
    if (activeLog.entryTime) {
      const durationMs = currentExitTime - activeLog.entryTime;
      const durationMinutes = Math.floor(durationMs / (1000 * 60));
      
      // Ensure duration is never negative
      activeLog.duration = Math.max(0, durationMinutes);
      
      // Log warning if duration would be negative
      if (durationMinutes < 0) {
        console.warn(`Warning: Negative duration detected for person ${personId}. Entry: ${activeLog.entryTime}, Exit: ${currentExitTime}`);
        console.warn(`Setting duration to 0 instead of ${durationMinutes} minutes`);
      }
    } else {
      activeLog.duration = 0;
    }
    
    // Add notes if provided
    if (notes) {
      activeLog.notes = activeLog.notes ? `${activeLog.notes} | ${notes}` : notes;
    }

    // Save the updated log
    const updatedLog = await activeLog.save();

    // Update vehicle log if exists
    const vehicleLog = await Vehiculog.findOne({ log: activeLog._id });
    if (vehicleLog) {
      vehicleLog.exit_time = updatedLog.exitTime;
      if (notes) vehicleLog.vehicleNotes = notes;
      await vehicleLog.save();
    }

    // Populate the response - NO vehicle population here
    let populateConfig = [
      { path: 'recordedBy', select: 'name email' }
    ];

    if (activeLog.personType === 'Supplier') {
      populateConfig.push({ path: 'person', select: 'name email cin id_sup' });
    } else if (activeLog.personType === 'LeoniPersonnel') {
      populateConfig.push({ path: 'person', select: 'name email cin matricule' });
    }

    await updatedLog.populate(populateConfig);

    res.json({
      success: true,
      message: 'Check-out successful',
      data: updatedLog
    });

  } catch (error) {
    console.error('Error during check-out:', error);
    
    // More detailed error response for debugging
    if (error.name === 'ValidationError') {
      const validationErrors = Object.keys(error.errors).map(key => ({
        field: key,
        message: error.errors[key].message,
        value: error.errors[key].value
      }));
      
      return res.status(400).json({
        success: false,
        message: 'Validation error during check-out',
        errors: validationErrors
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error during check-out'
    });
  }
});

// Helper function to get vehicle information for a person
const getPersonVehicle = async (personId, personType) => {
  try {
    const vehicle = await Vehicle.findOne({ 
      owner: personId, 
      ownerType: personType 
    }).select('lic_plate_string mark model color');
    return vehicle;
  } catch (error) {
    console.error('Error fetching vehicle:', error);
    return null;
  }
};

// Helper function to enhance logs with vehicle information
const enhanceLogsWithVehicles = async (logs) => {
  return Promise.all(
    logs.map(async (log) => {
      const logObj = log.toObject();
      
      // Try to get vehicle from Vehiculog first (most accurate)
      try {
        const vehicleLog = await Vehiculog.findOne({ log: log._id })
          .populate('vehicle', 'lic_plate_string mark model color');
        
        if (vehicleLog && vehicleLog.vehicle) {
          logObj.vehicleInfo = vehicleLog.vehicle;
          return logObj;
        }
      } catch (error) {
        console.error('Error getting vehicle from Vehiculog:', error);
      }
      
      // Fallback: get vehicle from Vehicle collection
      if (log.person && log.person._id) {
        try {
          const vehicle = await getPersonVehicle(log.person._id, log.personType);
          if (vehicle) {
            logObj.vehicleInfo = vehicle;
          }
        } catch (error) {
          console.error('Error getting vehicle from Vehicle collection:', error);
        }
      }
      
      return logObj;
    })
  );
};

// =====================================================
// GET ALL LOGS with filtering and pagination - FIXED
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

    // Search functionality - enhanced for LeoniPersonnel
    if (search) {
      const suppliers = await Supplier.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { cin: { $regex: search, $options: 'i' } },
          { id_sup: { $regex: search, $options: 'i' } }
        ]
      }).select('_id');

      const personnel = await LeoniPersonnel.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { cin: { $regex: search, $options: 'i' } },
          { matricule: { $regex: search, $options: 'i' } }
        ]
      }).select('_id');

      const supplierIds = suppliers.map(s => s._id);
      const personnelIds = personnel.map(p => p._id);
      
      query.$or = [
        { person: { $in: [...supplierIds, ...personnelIds] } }
      ];
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

    // Execute query with pagination - FIXED: No vehicle population
    const logs = await Log.find(query)
      .populate('person', 'name email cin id_sup matricule') // NO vehicles field
      .populate('recordedBy', 'name email')
      .sort(sortObject)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    // Get total count
    const total = await Log.countDocuments(query);

    // Enhance logs with vehicle information and monthly visit counts
    const enhancedLogs = await Promise.all(
      logs.map(async (log) => {
        const logObj = log.toObject();
        
        // Add monthly visit count for suppliers
        if (log.personType === 'Supplier' && log.person && log.logDate) {
          try {
            const month = new Date(log.logDate).toISOString().slice(0, 7);
            const monthlyCount = await MonthlyVisit.getVisitCount(log.person._id, month);
            logObj.monthlyVisitCount = monthlyCount;
          } catch (error) {
            console.error('Error getting monthly visit count:', error);
            logObj.monthlyVisitCount = 0;
          }
        } else {
          logObj.monthlyVisitCount = null;
        }
        
        // Get vehicle information
        // First try Vehiculog
        try {
          const vehicleLog = await Vehiculog.findOne({ log: log._id })
            .populate('vehicle', 'lic_plate_string mark model color');
          
          if (vehicleLog && vehicleLog.vehicle) {
            logObj.vehicleInfo = vehicleLog.vehicle;
            return logObj;
          }
        } catch (error) {
          console.error('Error getting vehicle from Vehiculog:', error);
        }
        
        // Fallback: get from Vehicle collection
        if (log.person && log.person._id) {
          try {
            const vehicle = await Vehicle.findOne({ 
              owner: log.person._id, 
              ownerType: log.personType 
            }).select('lic_plate_string mark model color');
            
            if (vehicle) {
              logObj.vehicleInfo = vehicle;
            }
          } catch (error) {
            console.error('Error getting vehicle from Vehicle collection:', error);
          }
        }
        
        return logObj;
      })
    );

    res.json({
      success: true,
      data: enhancedLogs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching logs'
    });
  }
});

// =====================================================
// GET CURRENT ACTIVE ENTRIES (who's currently inside)
// =====================================================
router.get('/active', verifyToken, async (req, res) => {
  try {
    const activeEntries = await Log.find({
      status: { $in: ['entry', 'present'] },
      exitTime: { $exists: false }
    })
      .populate('person', 'name email cin id_sup matricule') // NO vehicles field
      .populate('recordedBy', 'name email')
      .sort({ entryTime: -1 });

    // Enhance with vehicle information
    const enhancedEntries = await enhanceLogsWithVehicles(activeEntries);

    res.json({
      success: true,
      data: enhancedEntries,
      count: enhancedEntries.length
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
// GET LOGS FOR SPECIFIC PERSON
// =====================================================
router.get('/person/:personId', verifyToken, async (req, res) => {
  try {
    const { personId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const logs = await Log.find({ person: personId })
      .populate('person', 'name email cin id_sup matricule') // NO vehicles field
      .populate('recordedBy', 'name email')
      .sort({ logDate: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Log.countDocuments({ person: personId });

    // Enhance with vehicle information
    const enhancedLogs = await enhanceLogsWithVehicles(logs);

    res.json({
      success: true,
      data: enhancedLogs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching person logs:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching person logs'
    });
  }
});

// =====================================================
// GET VEHICLE LOGS (Vehiculog)
// =====================================================
router.get('/vehicles', verifyToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, vehicleId = '' } = req.query;

    let query = {};
    if (vehicleId) {
      query.vehicle = vehicleId;
    }

    const vehicleLogs = await Vehiculog.find(query)
      .populate('vehicle', 'lic_plate_string mark model color')
      .populate({
        path: 'log',
        populate: {
          path: 'person',
          select: 'name email cin id_sup matricule'
        }
      })
      .populate('recordedBy', 'name email')
      .sort({ vlog_date: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Vehiculog.countDocuments(query);

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
      personnelEntries,
      leoniPersonnelEntries
    ] = await Promise.all([
      Log.countDocuments({
        logDate: { $gte: today, $lt: tomorrow },
        status: { $in: ['entry', 'present'] }
      }),
      Log.countDocuments({
        status: { $in: ['entry', 'present'] },
        exitTime: { $exists: false }
      }),
      Log.countDocuments({
        logDate: { $gte: today, $lt: tomorrow },
        status: 'exit'
      }),
      Log.countDocuments({
        logDate: { $gte: today, $lt: tomorrow },
        personType: 'Supplier',
        status: { $in: ['entry', 'present'] }
      }),
      Log.countDocuments({
        logDate: { $gte: today, $lt: tomorrow },
        personType: 'Worker',
        status: { $in: ['entry', 'present'] }
      }),
      Log.countDocuments({
        logDate: { $gte: today, $lt: tomorrow },
        personType: 'LeoniPersonnel',
        status: { $in: ['entry', 'present'] }
      })
    ]);

    // Get vehicle statistics
    const vehicleStats = await Vehiculog.aggregate([
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
          personnelEntries: personnelEntries,
          leoniPersonnelEntries: leoniPersonnelEntries
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
// GET MONTHLY VISIT STATISTICS - New endpoint
// =====================================================
router.get('/monthly-visits/:supplierId', verifyToken, async (req, res) => {
  try {
    const { supplierId } = req.params;
    const { months = 12 } = req.query;

    const history = await MonthlyVisit.getSupplierHistory(supplierId, parseInt(months));
    
    res.json({
      success: true,
      data: history
    });

  } catch (error) {
    console.error('Error fetching monthly visits:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching monthly visits'
    });
  }
});

// =====================================================
// GET ALL SUPPLIERS MONTHLY STATS - New endpoint
// =====================================================
router.get('/monthly-stats', verifyToken, async (req, res) => {
  try {
    const { month } = req.query; // Format: "YYYY-MM"
    const currentMonth = month || new Date().toISOString().slice(0, 7);

    const monthlyStats = await MonthlyVisit.find({ month: currentMonth })
      .populate('supplier', 'name email cin id_sup')
      .sort({ visitCount: -1 });

    res.json({
      success: true,
      data: {
        month: currentMonth,
        supplierStats: monthlyStats
      }
    });

  } catch (error) {
    console.error('Error fetching monthly stats:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching monthly statistics'
    });
  }
});

module.exports = router;