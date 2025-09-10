const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Middleware to verify JWT token
const verifyToken = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ msg: 'No token, authorization denied' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return res.status(401).json({ msg: 'Token is not valid' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(401).json({ msg: 'Token is not valid' });
  }
};

// Middleware to check if user is admin
const isAdmin = async (req, res, next) => {
  try {
    // First verify the token
    await verifyToken(req, res, () => {
      // Then check if user is admin
      if (req.user.role !== 'admin') {
        return res.status(403).json({ msg: 'Admin access required' });
      }
      next();
    });
  } catch (error) {
    console.error('Admin verification error:', error);
    res.status(403).json({ msg: 'Admin access required' });
  }
};

// Middleware to check if user is SOS
const isSOS = async (req, res, next) => {
  try {
    await verifyToken(req, res, () => {
      if (req.user.role !== 'sos') {
        return res.status(403).json({ msg: 'SOS access required' });
      }
      next();
    });
  } catch (error) {
    console.error('SOS verification error:', error);
    res.status(403).json({ msg: 'SOS access required' });
  }
};

module.exports = {
  verifyToken,
  isAdmin,
  isSOS
};