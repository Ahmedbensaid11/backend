const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Base token verification function with detailed logging
const verifyTokenAndUser = async (req) => {
  console.log('🔍 Auth middleware starting...');
  
  const authHeader = req.header('Authorization');
  console.log('🔍 Auth header:', authHeader ? authHeader.substring(0, 20) + '...' : 'None');
  
  const token = authHeader?.replace('Bearer ', '');
  
  if (!token) {
    console.log('❌ No token provided');
    throw new Error('No token, authorization denied');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('🔍 Token decoded successfully for user ID:', decoded.id);
    
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      console.log('❌ User not found in database for ID:', decoded.id);
      throw new Error('Token is not valid');
    }

    console.log('✅ User found:', user.email, 'Role:', user.role);
    return user;
  } catch (jwtError) {
    console.log('❌ JWT verification failed:', jwtError.message);
    throw new Error('Token is not valid');
  }
};

// Middleware to verify JWT token
const verifyToken = async (req, res, next) => {
  try {
    console.log('🔐 Verifying token for route:', req.originalUrl);
    const user = await verifyTokenAndUser(req);
    req.user = user;
    next();
  } catch (error) {
    console.error('❌ Token verification error:', error.message);
    res.status(401).json({ msg: error.message });
  }
};

// Middleware to check if user is admin
const isAdmin = async (req, res, next) => {
  try {
    console.log('🛡️ Checking admin access for route:', req.originalUrl);
    const user = await verifyTokenAndUser(req);
    
    if (user.role !== 'admin') {
      console.log('❌ Access denied. User role:', user.role, 'Required: admin');
      return res.status(403).json({ msg: 'Admin access required' });
    }

    console.log('✅ Admin access granted for user:', user.email);
    req.user = user;
    next();
  } catch (error) {
    console.error('❌ Admin verification error:', error.message);
    res.status(401).json({ msg: error.message });
  }
};

// Middleware to check if user is SOS
const isSOS = async (req, res, next) => {
  try {
    console.log('🔒 [isSOS] Middleware called for route:', req.originalUrl);
    const user = await verifyTokenAndUser(req);
    console.log('🔒 [isSOS] User found:', user.email, 'Role:', user.role);
    if (user.role !== 'sos') {
      console.log('❌ [isSOS] Access denied. User role:', user.role, 'Required: sos');
      return res.status(403).json({ msg: 'SOS access required' });
    }
    console.log('✅ [isSOS] SOS access granted for user:', user.email);
    req.user = user;
    next();
  } catch (error) {
    console.error('❌ [isSOS] SOS verification error:', error.message);
    res.status(401).json({ msg: error.message });
  }
};

module.exports = {
  verifyToken,
  isAdmin,
  isSOS
};