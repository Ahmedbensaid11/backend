const express = require('express');
const router = express.Router();
const Vehicle = require('../models/Vehicle');
const Worker = require('../models/Worker');
const Supplier = require('../models/Supplier');
const LeoniPersonnel = require('../models/LeoniPersonnel');
const { verifyToken, isAdmin } = require('../middleware/auth');

// Helper function to get the correct model based on owner type
const getOwnerModel = (ownerType) => {
  switch(ownerType) {
    case 'Worker':
      return Worker;
    case 'Supplier':
      return Supplier;
    case 'LeoniPersonnel':
      return LeoniPersonnel;
    default:
      throw new Error('Invalid owner type');
  }
};

// Helper function to get owner display info
const getOwnerInfo = async (owner, ownerType) => {
  const OwnerModel = getOwnerModel(ownerType);
  const ownerDoc = await OwnerModel.findById(owner);
  
  if (!ownerDoc) return null;

  switch(ownerType) {
    case 'Worker':
      return {
        _id: ownerDoc._id,
        name: ownerDoc.worker_name,
        identifier: ownerDoc.cin,
        contact: ownerDoc.email,
        type: 'Worker'
      };
    case 'Supplier':
      return {
        _id: ownerDoc._id,
        name: ownerDoc.comp_affil,
        identifier: ownerDoc.id_sup,
        contact: ownerDoc.num_vst,
        type: 'Supplier'
      };
    case 'LeoniPersonnel':
      return {
        _id: ownerDoc._id,
        name: ownerDoc.name,
        identifier: ownerDoc.matricule,
        contact: ownerDoc.email,
        type: 'Leoni Personnel'
      };
    default:
      return null;
  }
};

// @route   GET /api/vehicles
// @desc    Get all vehicles with enhanced owner info
// @access  Private (Admin & SOS)
router.get('/', verifyToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', ownerType = '' } = req.query;
    
    let query = {};
    if (search) {
      query = {
        $or: [
          { lic_plate_string: { $regex: search, $options: 'i' } },
          { mark: { $regex: search, $options: 'i' } },
          { model: { $regex: search, $options: 'i' } },
          { color: { $regex: search, $options: 'i' } }
        ]
      };
    }

    // Filter by owner type if specified
    if (ownerType && ['Worker', 'Supplier', 'LeoniPersonnel'].includes(ownerType)) {
      query.ownerType = ownerType;
    }

    const vehicles = await Vehicle.find(query)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    // Populate owner info for each vehicle
    const vehiclesWithOwners = await Promise.all(
      vehicles.map(async (vehicle) => {
        const ownerInfo = await getOwnerInfo(vehicle.owner, vehicle.ownerType);
        return {
          ...vehicle.toObject(),
          ownerInfo
        };
      })
    );

    const total = await Vehicle.countDocuments(query);

    res.json({
      vehicles: vehiclesWithOwners,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total
    });
  } catch (error) {
    console.error('Error fetching vehicles:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   GET /api/vehicles/:id
// @desc    Get vehicle by ID with owner info
// @access  Private (Admin & SOS)
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id);
    
    if (!vehicle) {
      return res.status(404).json({ msg: 'Vehicle not found' });
    }

    const ownerInfo = await getOwnerInfo(vehicle.owner, vehicle.ownerType);
    
    res.json({
      ...vehicle.toObject(),
      ownerInfo
    });
  } catch (error) {
    console.error('Error fetching vehicle:', error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Vehicle not found' });
    }
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   GET /api/vehicles/owner/:ownerType/:ownerId
// @desc    Get all vehicles for a specific owner (Worker, Supplier, or LeoniPersonnel)
// @access  Private (Admin & SOS)
router.get('/owner/:ownerType/:ownerId', verifyToken, async (req, res) => {
  try {
    const { ownerType, ownerId } = req.params;

    // Validate owner type
    if (!['Worker', 'Supplier', 'LeoniPersonnel'].includes(ownerType)) {
      return res.status(400).json({ msg: 'Invalid owner type' });
    }

    // Check if owner exists
    const OwnerModel = getOwnerModel(ownerType);
    const ownerExists = await OwnerModel.findById(ownerId);
    if (!ownerExists) {
      return res.status(404).json({ msg: `${ownerType} not found` });
    }

    const vehicles = await Vehicle.find({ 
      owner: ownerId, 
      ownerType: ownerType 
    });

    const ownerInfo = await getOwnerInfo(ownerId, ownerType);

    res.json({
      vehicles,
      owner: ownerInfo,
      totalVehicles: vehicles.length
    });
  } catch (error) {
    console.error('Error fetching owner vehicles:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   GET /api/vehicles/by-type/:ownerType
// @desc    Get all vehicles by owner type
// @access  Private (Admin & SOS)
router.get('/by-type/:ownerType', verifyToken, async (req, res) => {
  try {
    const { ownerType } = req.params;
    const { page = 1, limit = 10 } = req.query;

    if (!['Worker', 'Supplier', 'LeoniPersonnel'].includes(ownerType)) {
      return res.status(400).json({ msg: 'Invalid owner type' });
    }

    const vehicles = await Vehicle.find({ ownerType })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const vehiclesWithOwners = await Promise.all(
      vehicles.map(async (vehicle) => {
        const ownerInfo = await getOwnerInfo(vehicle.owner, vehicle.ownerType);
        return {
          ...vehicle.toObject(),
          ownerInfo
        };
      })
    );

    const total = await Vehicle.countDocuments({ ownerType });

    res.json({
      vehicles: vehiclesWithOwners,
      ownerType,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total
    });
  } catch (error) {
    console.error('Error fetching vehicles by type:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   POST /api/vehicles
// @desc    Add a new vehicle
// @access  Private (Admin & SOS)
router.post('/', verifyToken, async (req, res) => {
  try {
    const {
      lic_plate_string,
      mark,
      model,
      v_year,
      color,
      owner,
      ownerType
    } = req.body;

    // Validate owner type
    if (!['Worker', 'Supplier', 'LeoniPersonnel'].includes(ownerType)) {
      return res.status(400).json({ msg: 'Invalid owner type' });
    }

    // Check if vehicle with same license plate already exists
    const existingVehicle = await Vehicle.findOne({ lic_plate_string });
    if (existingVehicle) {
      return res.status(400).json({ 
        msg: 'Vehicle with this license plate already exists' 
      });
    }

    // Check if owner exists
    const OwnerModel = getOwnerModel(ownerType);
    const ownerExists = await OwnerModel.findById(owner);
    if (!ownerExists) {
      return res.status(400).json({ msg: `${ownerType} not found` });
    }

    const newVehicle = new Vehicle({
      lic_plate_string: lic_plate_string.toUpperCase(),
      mark,
      model,
      v_year,
      color,
      owner,
      ownerType
    });

    const vehicle = await newVehicle.save();
    
    // Add vehicle to owner's vehicles array (for Workers only, as per original design)
    if (ownerType === 'Worker') {
      await Worker.findByIdAndUpdate(
        owner,
        { $addToSet: { vehicles: vehicle._id } }
      );
    }

    const ownerInfo = await getOwnerInfo(owner, ownerType);

    res.status(201).json({
      ...vehicle.toObject(),
      ownerInfo
    });
  } catch (error) {
    console.error('Error creating vehicle:', error);
    if (error.code === 11000) {
      return res.status(400).json({ msg: 'Vehicle with this license plate already exists' });
    }
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   PUT /api/vehicles/:id
// @desc    Update vehicle
// @access  Private (Admin & SOS)
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const {
      lic_plate_string,
      mark,
      model,
      v_year,
      color,
      owner,
      ownerType
    } = req.body;

    const currentVehicle = await Vehicle.findById(req.params.id);
    if (!currentVehicle) {
      return res.status(404).json({ msg: 'Vehicle not found' });
    }

    // Validate owner type
    if (!['Worker', 'Supplier', 'LeoniPersonnel'].includes(ownerType)) {
      return res.status(400).json({ msg: 'Invalid owner type' });
    }

    // Check if another vehicle has the same license plate
    const existingVehicle = await Vehicle.findOne({
      $and: [
        { _id: { $ne: req.params.id } },
        { lic_plate_string: lic_plate_string.toUpperCase() }
      ]
    });

    if (existingVehicle) {
      return res.status(400).json({ 
        msg: 'Another vehicle with this license plate already exists' 
      });
    }

    // Check if new owner exists
    const OwnerModel = getOwnerModel(ownerType);
    const ownerExists = await OwnerModel.findById(owner);
    if (!ownerExists) {
      return res.status(400).json({ msg: `${ownerType} not found` });
    }

    // Handle owner changes for Workers (remove from old, add to new)
    if (currentVehicle.ownerType === 'Worker' || ownerType === 'Worker') {
      // Remove from old Worker if it was a Worker
      if (currentVehicle.ownerType === 'Worker') {
        await Worker.findByIdAndUpdate(
          currentVehicle.owner,
          { $pull: { vehicles: req.params.id } }
        );
      }
      
      // Add to new Worker if it's becoming a Worker's vehicle
      if (ownerType === 'Worker') {
        await Worker.findByIdAndUpdate(
          owner,
          { $addToSet: { vehicles: req.params.id } }
        );
      }
    }

    const vehicle = await Vehicle.findByIdAndUpdate(
      req.params.id,
      {
        lic_plate_string: lic_plate_string.toUpperCase(),
        mark,
        model,
        v_year,
        color,
        owner,
        ownerType
      },
      { new: true, runValidators: true }
    );

    const ownerInfo = await getOwnerInfo(owner, ownerType);

    res.json({
      ...vehicle.toObject(),
      ownerInfo
    });
  } catch (error) {
    console.error('Error updating vehicle:', error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Vehicle not found' });
    }
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   DELETE /api/vehicles/:id
// @desc    Remove vehicle
// @access  Private (Admin only)
router.delete('/:id', isAdmin, async (req, res) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id);
    
    if (!vehicle) {
      return res.status(404).json({ msg: 'Vehicle not found' });
    }

    // Remove vehicle from Worker's vehicles array if it's a Worker's vehicle
    if (vehicle.ownerType === 'Worker') {
      await Worker.findByIdAndUpdate(
        vehicle.owner,
        { $pull: { vehicles: req.params.id } }
      );
    }

    await Vehicle.findByIdAndDelete(req.params.id);

    res.json({ msg: 'Vehicle deleted successfully' });
  } catch (error) {
    console.error('Error deleting vehicle:', error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Vehicle not found' });
    }
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;