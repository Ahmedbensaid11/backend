const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Base token verification function
const verifyTokenAndUser = async (req) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    throw new Error('No token, authorization denied');
  }

  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const user = await User.findById(decoded.id).select('-password');
  
  if (!user) {
    throw new Error('Token is not valid');
  }

  return user;
};

// Middleware to verify JWT token
const verifyToken = async (req, res, next) => {
  try {
    const user = await verifyTokenAndUser(req);
    req.user = user;
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(401).json({ msg: error.message });
  }
};

// Middleware to check if user is admin
const isAdmin = async (req, res, next) => {
  try {
    const user = await verifyTokenAndUser(req);
    
    if (user.role !== 'admin') {
      return res.status(403).json({ msg: 'Admin access required' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Admin verification error:', error);
    res.status(401).json({ msg: error.message });
  }
};

// Middleware to check if user is SOS
const isSOS = async (req, res, next) => {
  try {
    const user = await verifyTokenAndUser(req);
    
    if (user.role !== 'sos') {
      return res.status(403).json({ msg: 'SOS access required' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('SOS verification error:', error);
    res.status(401).json({ msg: error.message });
  }
};

module.exports = {
  verifyToken,
  isAdmin,
  isSOS
};