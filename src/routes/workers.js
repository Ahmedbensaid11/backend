const express = require('express');
const router = express.Router();
const Worker = require('../models/Worker');
const Vehicle = require('../models/Vehicle');
const { verifyToken, isAdmin } = require('../middleware/auth');

// @route   GET /api/workers
// @desc    Get all workers
// @access  Private (Admin & SOS)
router.get('/', verifyToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    
    let query = {};
    if (search) {
      query = {
        $or: [
          { worker_name: { $regex: search, $options: 'i' } },
          { cin: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ]
      };
    }

    const workers = await Worker.find(query)
      .populate('vehicles', 'lic_plate_string mark model')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await Worker.countDocuments(query);

    res.json({
      workers,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total
    });
  } catch (error) {
    console.error('Error fetching workers:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   GET /api/workers/:id
// @desc    Get worker by ID
// @access  Private (Admin & SOS)
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const worker = await Worker.findById(req.params.id).populate('vehicles');
    
    if (!worker) {
      return res.status(404).json({ msg: 'Worker not found' });
    }

    res.json(worker);
  } catch (error) {
    console.error('Error fetching worker:', error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Worker not found' });
    }
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   POST /api/workers
// @desc    Create a new worker
// @access  Private (Admin & SOS)
router.post('/', verifyToken, async (req, res) => {
  try {
    const {
      cin,
      worker_name,
      com_num,
      email,
      worker_address,
      state,
      postal_code
    } = req.body;

    // Check if worker with same CIN or email already exists
    const existingWorker = await Worker.findOne({
      $or: [{ cin }, { email }]
    });

    if (existingWorker) {
      return res.status(400).json({ 
        msg: 'Worker with this CIN or email already exists' 
      });
    }

    const newWorker = new Worker({
      cin,
      worker_name,
      com_num,
      email,
      worker_address,
      state,
      postal_code
    });

    const worker = await newWorker.save();
    res.status(201).json(worker);
  } catch (error) {
    console.error('Error creating worker:', error);
    if (error.code === 11000) {
      return res.status(400).json({ msg: 'Worker with this CIN already exists' });
    }
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   PUT /api/workers/:id
// @desc    Update worker
// @access  Private (Admin & SOS)
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const {
      cin,
      worker_name,
      com_num,
      email,
      worker_address,
      state,
      postal_code
    } = req.body;

    // Check if another worker has the same CIN or email
    const existingWorker = await Worker.findOne({
      $and: [
        { _id: { $ne: req.params.id } },
        { $or: [{ cin }, { email }] }
      ]
    });

    if (existingWorker) {
      return res.status(400).json({ 
        msg: 'Another worker with this CIN or email already exists' 
      });
    }

    const worker = await Worker.findByIdAndUpdate(
      req.params.id,
      {
        cin,
        worker_name,
        com_num,
        email,
        worker_address,
        state,
        postal_code
      },
      { new: true, runValidators: true }
    ).populate('vehicles');

    if (!worker) {
      return res.status(404).json({ msg: 'Worker not found' });
    }

    res.json(worker);
  } catch (error) {
    console.error('Error updating worker:', error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Worker not found' });
    }
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   DELETE /api/workers/:id
// @desc    Delete worker
// @access  Private (Admin only)
router.delete('/:id', isAdmin, async (req, res) => {
  try {
    const worker = await Worker.findById(req.params.id);
    
    if (!worker) {
      return res.status(404).json({ msg: 'Worker not found' });
    }

    // Delete all vehicles associated with this worker
    await Vehicle.deleteMany({ owner: req.params.id });

    await Worker.findByIdAndDelete(req.params.id);

    res.json({ msg: 'Worker and associated vehicles deleted successfully' });
  } catch (error) {
    console.error('Error deleting worker:', error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Worker not found' });
    }
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;