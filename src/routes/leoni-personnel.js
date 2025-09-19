// routes/personnel.js - Routes for LeoniPersonnel management
const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin, isSOS } = require('../middleware/auth');
const LeoniPersonnel = require('../models/LeoniPersonnel');
const Vehicle = require('../models/Vehicle');

// =====================================================
// CREATE PERSONNEL + VEHICLE
// =====================================================
router.post('/', verifyToken, async (req, res) => {
  try {
    const { matricule, name, cin, email, address, state, postal_code, vehicle } = req.body;

    // Check duplicates
    const existingPersonnel = await LeoniPersonnel.findOne({
      $or: [{ matricule }, { email }, { cin }]
    });
    if (existingPersonnel) {
      return res.status(400).json({ msg: 'Personnel already exists with this matricule, email, or CIN' });
    }

    // Create personnel
    const newPersonnel = new LeoniPersonnel({
      matricule,
      name,
      cin,
      email,
      address,
      state,
      postal_code
    });
    const personnel = await newPersonnel.save();

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
        owner: personnel._id,
        ownerType: 'LeoniPersonnel'
      });
      await createdVehicle.save();
    }

    res.status(201).json({
      ...personnel.toObject(),
      vehicles: createdVehicle ? [createdVehicle] : []
    });

  } catch (err) {
    console.error('Error creating personnel with vehicle:', err);
    
    // Handle mongoose validation errors
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ msg: messages.join(', ') });
    }
    
    // Handle duplicate key errors
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      return res.status(400).json({ msg: `${field} already exists` });
    }
    
    res.status(500).json({ msg: 'Server error' });
  }
});

// =====================================================
// GET ALL PERSONNEL + VEHICLES
// =====================================================
router.get('/', verifyToken, async (req, res) => {
  try {
    const personnels = await LeoniPersonnel.find();

    const results = await Promise.all(personnels.map(async (p) => {
      const vehicles = await Vehicle.find({ owner: p._id, ownerType: 'LeoniPersonnel' });
      return { ...p.toObject(), vehicles };
    }));

    res.json(results);
  } catch (err) {
    console.error('Error fetching personnels:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// =====================================================
// GET ONE PERSONNEL + VEHICLES
// =====================================================
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const personnel = await LeoniPersonnel.findById(req.params.id);
    if (!personnel) return res.status(404).json({ msg: 'Personnel not found' });

    const vehicles = await Vehicle.find({ owner: personnel._id, ownerType: 'LeoniPersonnel' });

    res.json({ ...personnel.toObject(), vehicles });
  } catch (err) {
    console.error('Error fetching personnel:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// =====================================================
// UPDATE PERSONNEL + VEHICLE
// =====================================================
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { matricule, name, cin, email, address, state, postal_code, vehicle } = req.body;

    const personnel = await LeoniPersonnel.findById(req.params.id);
    if (!personnel) return res.status(404).json({ msg: 'Personnel not found' });

    // Check for duplicates (excluding current record)
    if (matricule || email || cin) {
      const duplicateQuery = { _id: { $ne: req.params.id } };
      const orConditions = [];
      
      if (matricule) orConditions.push({ matricule });
      if (email) orConditions.push({ email });
      if (cin) orConditions.push({ cin });
      
      if (orConditions.length > 0) {
        duplicateQuery.$or = orConditions;
        const existingPersonnel = await LeoniPersonnel.findOne(duplicateQuery);
        if (existingPersonnel) {
          return res.status(400).json({ msg: 'Another personnel already exists with this matricule, email, or CIN' });
        }
      }
    }

    // Update personnel fields
    if (matricule) personnel.matricule = matricule;
    if (name) personnel.name = name;
    if (cin) personnel.cin = cin;
    if (email) personnel.email = email;
    if (address) personnel.address = address;
    if (state) personnel.state = state;
    if (postal_code) personnel.postal_code = postal_code;
    
    await personnel.save();

    // Update vehicle if provided
    let updatedVehicle = null;
    if (vehicle && vehicle.lic_plate_string) {
      // Check if vehicle plate already exists for another personnel
      const existingVehicle = await Vehicle.findOne({ 
        lic_plate_string: vehicle.lic_plate_string,
        $or: [
          { owner: { $ne: personnel._id } },
          { ownerType: { $ne: 'LeoniPersonnel' } }
        ]
      });
      
      if (existingVehicle) {
        return res.status(400).json({ msg: 'Vehicle with this license plate is already assigned to another person' });
      }

      updatedVehicle = await Vehicle.findOneAndUpdate(
        { owner: personnel._id, ownerType: 'LeoniPersonnel' },
        {
          ...vehicle,
          lic_plate_string: vehicle.lic_plate_string.toUpperCase(),
          owner: personnel._id,
          ownerType: 'LeoniPersonnel'
        },
        { new: true, upsert: true }
      );
    }

    // Get current vehicles for response
    const currentVehicles = await Vehicle.find({ owner: personnel._id, ownerType: 'LeoniPersonnel' });

    res.json({
      ...personnel.toObject(),
      vehicles: currentVehicles
    });

  } catch (err) {
    console.error('Error updating personnel:', err);
    
    // Handle mongoose validation errors
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ msg: messages.join(', ') });
    }
    
    // Handle duplicate key errors
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      return res.status(400).json({ msg: `${field} already exists` });
    }
    
    res.status(500).json({ msg: 'Server error' });
  }
});

// =====================================================
// DELETE PERSONNEL + VEHICLE
// =====================================================
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const personnel = await LeoniPersonnel.findById(req.params.id);
    if (!personnel) return res.status(404).json({ msg: 'Personnel not found' });

    await Vehicle.deleteMany({ owner: personnel._id, ownerType: 'LeoniPersonnel' });
    await personnel.deleteOne();

    res.json({ msg: 'Personnel and associated vehicle(s) deleted' });
  } catch (err) {
    console.error('Error deleting personnel:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;