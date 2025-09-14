// routes/suppliers.js
const express = require('express');
const router = express.Router();
const Supplier = require('../models/Supplier');
const Vehicle = require('../models/Vehicle');
const { verifyToken, isAdmin } = require('../middleware/auth');

// =====================================================
// CREATE SUPPLIER + VEHICLE
// =====================================================
router.post('/', verifyToken, async (req, res) => {
  try {
    const { 
      name,
      email,
      phonenumber,
      companyInfo,
      cin,
      vehicle 
    } = req.body;

    console.log('Received data:', req.body); // Debug log

    // Check duplicate email
    const existingEmail = await Supplier.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      return res.status(400).json({ msg: 'Supplier with this email already exists' });
    }

    // Check duplicate CIN
    const existingCIN = await Supplier.findOne({ cin });
    if (existingCIN) {
      return res.status(400).json({ msg: 'Supplier with this CIN already exists' });
    }

    // Validate required fields
    if (!name || !email || !phonenumber || !companyInfo || !cin) {
      return res.status(400).json({ 
        msg: 'All required fields must be provided',
        missing: {
          name: !name,
          email: !email,
          phonenumber: !phonenumber,
          companyInfo: !companyInfo,
          cin: !cin
        }
      });
    }

    // Validate formats
    if (!/^[0-9]{8}$/.test(cin)) {
      return res.status(400).json({ msg: 'CIN must be exactly 8 digits' });
    }

    if (!/^[0-9]{8}$/.test(phonenumber)) {
      return res.status(400).json({ msg: 'Phone number must be exactly 8 digits' });
    }

    // Create supplier with all fields (id_sup and num_vst will be auto-generated)
    const newSupplier = new Supplier({ 
      name,
      email: email.toLowerCase(),
      phonenumber,
      companyInfo,
      cin
    });
    const supplier = await newSupplier.save();

    // Create vehicle if provided
    let createdVehicle = null;
    if (vehicle && vehicle.lic_plate_string) {
      const existingVehicle = await Vehicle.findOne({ lic_plate_string: vehicle.lic_plate_string });
      if (existingVehicle) {
        return res.status(400).json({ msg: 'Vehicle already exists with this license plate' });
      }

      createdVehicle = new Vehicle({
        ...vehicle,
        lic_plate_string: vehicle.lic_plate_string.toUpperCase(),
        owner: supplier._id,
        ownerType: 'Supplier'
      });
      await createdVehicle.save();
    }

    res.status(201).json({
      ...supplier.toObject(),
      vehicles: createdVehicle ? [createdVehicle] : []
    });

  } catch (error) {
    console.error('Error creating supplier:', error);
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({ msg: `Duplicate ${field}. This ${field} already exists.` });
    }
    res.status(500).json({ msg: 'Server error' });
  }
});

// =====================================================
// GET ALL SUPPLIERS + VEHICLES
// =====================================================
router.get('/', verifyToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;

    let query = {};
    if (search) {
      query = {
        $or: [
          { id_sup: { $regex: search, $options: 'i' } },
          { num_vst: { $regex: search, $options: 'i' } },
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { cin: { $regex: search, $options: 'i' } },
          { companyInfo: { $regex: search, $options: 'i' } }
        ]
      };
    }

    const suppliers = await Supplier.find(query)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await Supplier.countDocuments(query);

    const results = await Promise.all(suppliers.map(async (s) => {
      const vehicles = await Vehicle.find({ owner: s._id, ownerType: 'Supplier' });
      return { ...s.toObject(), vehicles };
    }));

    res.json({
      suppliers: results,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total
    });
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// =====================================================
// GET ONE SUPPLIER + VEHICLES
// =====================================================
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) {
      return res.status(404).json({ msg: 'Supplier not found' });
    }

    const vehicles = await Vehicle.find({ owner: supplier._id, ownerType: 'Supplier' });

    res.json({ ...supplier.toObject(), vehicles });
  } catch (error) {
    console.error('Error fetching supplier:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// =====================================================
// UPDATE SUPPLIER + VEHICLE
// =====================================================
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { 
      // Frontend fields (id_sup and num_vst cannot be changed - they're auto-generated)
      name,
      email,
      phonenumber,
      companyInfo,
      cin,
      // Vehicle data
      vehicle 
    } = req.body;

    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) {
      return res.status(404).json({ msg: 'Supplier not found' });
    }

    // Check for duplicate CIN if provided and different from current
    if (cin && cin !== supplier.cin) {
      const existingCIN = await Supplier.findOne({
        _id: { $ne: req.params.id },
        cin
      });
      if (existingCIN) {
        return res.status(400).json({ msg: 'Another supplier with this CIN already exists' });
      }

      // Validate CIN format
      if (!/^[0-9]{8}$/.test(cin)) {
        return res.status(400).json({ msg: 'CIN must be exactly 8 digits' });
      }
    }

    // Check for duplicate email if provided and different from current
    if (email && email.toLowerCase() !== supplier.email) {
      const existingEmail = await Supplier.findOne({
        _id: { $ne: req.params.id },
        email: email.toLowerCase()
      });
      if (existingEmail) {
        return res.status(400).json({ msg: 'Another supplier with this email already exists' });
      }
    }

    // Validate phone number format if provided
    if (phonenumber && !/^[0-9]{8}$/.test(phonenumber)) {
      return res.status(400).json({ msg: 'Phone number must be exactly 8 digits' });
    }

    // Update supplier fields (id_sup and num_vst are never updated - they're auto-generated and unique)
    if (name !== undefined) supplier.name = name || undefined;
    if (email !== undefined) supplier.email = email ? email.toLowerCase() : undefined;
    if (phonenumber !== undefined) supplier.phonenumber = phonenumber || undefined;
    if (companyInfo !== undefined) supplier.companyInfo = companyInfo || undefined;
    if (cin !== undefined) supplier.cin = cin || undefined;

    await supplier.save();

    // Update or create vehicle
    let updatedVehicle = null;
    if (vehicle && vehicle.lic_plate_string) {
      // Check if license plate conflicts with other vehicles
      const existingVehicle = await Vehicle.findOne({
        lic_plate_string: vehicle.lic_plate_string.toUpperCase(),
        $or: [
          { owner: { $ne: supplier._id } },
          { ownerType: { $ne: 'Supplier' } }
        ]
      });

      if (existingVehicle) {
        return res.status(400).json({ msg: 'Vehicle with this license plate is already assigned to another entity' });
      }

      // Validate vehicle data
      if (!vehicle.mark || !vehicle.model || !vehicle.v_year || !vehicle.color) {
        return res.status(400).json({ msg: 'Vehicle mark, model, year and color are required' });
      }

      // Validate year
      const currentYear = new Date().getFullYear();
      if (vehicle.v_year < 1900 || vehicle.v_year > currentYear + 1) {
        return res.status(400).json({ msg: `Vehicle year must be between 1900 and ${currentYear + 1}` });
      }

      updatedVehicle = await Vehicle.findOneAndUpdate(
        { owner: supplier._id, ownerType: 'Supplier' },
        {
          lic_plate_string: vehicle.lic_plate_string.toUpperCase(),
          mark: vehicle.mark,
          model: vehicle.model,
          v_year: vehicle.v_year,
          color: vehicle.color,
          owner: supplier._id,
          ownerType: 'Supplier'
        },
        { new: true, upsert: true }
      );
    }

    // Get current vehicles
    const currentVehicles = await Vehicle.find({ owner: supplier._id, ownerType: 'Supplier' });

    res.json({
      ...supplier.toObject(),
      vehicles: currentVehicles
    });

  } catch (error) {
    console.error('Error updating supplier:', error);
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({ msg: `Duplicate ${field}. This ${field} already exists.` });
    }
    res.status(500).json({ msg: 'Server error' });
  }
});

// =====================================================
// DELETE SUPPLIER + VEHICLES
// =====================================================
router.delete('/:id', isAdmin, async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) {
      return res.status(404).json({ msg: 'Supplier not found' });
    }

    await Vehicle.deleteMany({ owner: supplier._id, ownerType: 'Supplier' });
    await supplier.deleteOne();

    res.json({ msg: 'Supplier and associated vehicle(s) deleted' });
  } catch (error) {
    console.error('Error deleting supplier:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;