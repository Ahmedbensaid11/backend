const express = require('express');
const router = express.Router();
const Supplier = require('../models/Supplier');
const { verifyToken, isAdmin } = require('../middleware/auth');

// @route   GET /api/suppliers
// @desc    Get all suppliers
// @access  Private (Admin & SOS)
router.get('/', verifyToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    
    let query = {};
    if (search) {
      query = {
        $or: [
          { id_sup: { $regex: search, $options: 'i' } },
          { comp_affil: { $regex: search, $options: 'i' } },
          { num_vst: { $regex: search, $options: 'i' } }
        ]
      };
    }

    const suppliers = await Supplier.find(query)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await Supplier.countDocuments(query);

    res.json({
      suppliers,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total
    });
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   GET /api/suppliers/:id
// @desc    Get supplier by ID
// @access  Private (Admin & SOS)
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.id);
    
    if (!supplier) {
      return res.status(404).json({ msg: 'Supplier not found' });
    }

    res.json(supplier);
  } catch (error) {
    console.error('Error fetching supplier:', error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Supplier not found' });
    }
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   POST /api/suppliers
// @desc    Add a new supplier
// @access  Private (Admin & SOS)
router.post('/', verifyToken, async (req, res) => {
  try {
    const { id_sup, comp_affil, num_vst } = req.body;

    // Check if supplier with same ID already exists
    const existingSupplier = await Supplier.findOne({ id_sup });

    if (existingSupplier) {
      return res.status(400).json({ 
        msg: 'Supplier with this ID already exists' 
      });
    }

    const newSupplier = new Supplier({
      id_sup,
      comp_affil,
      num_vst
    });

    const supplier = await newSupplier.save();
    res.status(201).json(supplier);
  } catch (error) {
    console.error('Error creating supplier:', error);
    if (error.code === 11000) {
      return res.status(400).json({ msg: 'Supplier with this ID already exists' });
    }
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   PUT /api/suppliers/:id
// @desc    Update supplier
// @access  Private (Admin & SOS)
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { id_sup, comp_affil, num_vst } = req.body;

    // Check if another supplier has the same ID
    const existingSupplier = await Supplier.findOne({
      $and: [
        { _id: { $ne: req.params.id } },
        { id_sup }
      ]
    });

    if (existingSupplier) {
      return res.status(400).json({ 
        msg: 'Another supplier with this ID already exists' 
      });
    }

    const supplier = await Supplier.findByIdAndUpdate(
      req.params.id,
      { id_sup, comp_affil, num_vst },
      { new: true, runValidators: true }
    );

    if (!supplier) {
      return res.status(404).json({ msg: 'Supplier not found' });
    }

    res.json(supplier);
  } catch (error) {
    console.error('Error updating supplier:', error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Supplier not found' });
    }
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   DELETE /api/suppliers/:id
// @desc    Delete supplier
// @access  Private (Admin only)
router.delete('/:id', isAdmin, async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.id);
    
    if (!supplier) {
      return res.status(404).json({ msg: 'Supplier not found' });
    }

    await Supplier.findByIdAndDelete(req.params.id);

    res.json({ msg: 'Supplier deleted successfully' });
  } catch (error) {
    console.error('Error deleting supplier:', error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Supplier not found' });
    }
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;