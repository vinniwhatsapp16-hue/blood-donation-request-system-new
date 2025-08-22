const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET || 'blood-donation-secret-key-change-in-production',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// Verify JWT token
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        message: 'No token provided or invalid format' 
      });
    }
    
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'blood-donation-secret-key-change-in-production');
    
    const user = await User.findById(decoded.userId).select('-password');
    if (!user) {
      return res.status(401).json({ 
        message: 'Token is not valid - user not found' 
      });
    }
    
    if (user.isLocked) {
      return res.status(423).json({ 
        message: 'Account is temporarily locked due to failed login attempts' 
      });
    }
    
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        message: 'Token has expired' 
      });
    } else if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        message: 'Invalid token' 
      });
    }
    
    console.error('Auth middleware error:', error);
    res.status(500).json({ 
      message: 'Server error during authentication' 
    });
  }
};

// Role-based authorization middleware
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        message: 'Authentication required' 
      });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: `Access denied. Required roles: ${roles.join(', ')}` 
      });
    }
    
    next();
  };
};

// Optional authentication (for public endpoints that benefit from user context)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(); // Continue without user context
    }
    
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'blood-donation-secret-key-change-in-production');
    
    const user = await User.findById(decoded.userId).select('-password');
    if (user && !user.isLocked) {
      req.user = user;
    }
    
    next();
  } catch (error) {
    // Log error but continue without user context
    console.log('Optional auth failed:', error.message);
    next();
  }
};

// Middleware to check if user is verified
const requireVerification = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      message: 'Authentication required' 
    });
  }
  
  if (!req.user.isVerified) {
    return res.status(403).json({ 
      message: 'Please verify your email address to access this resource' 
    });
  }
  
  next();
};

// Middleware to check if user owns the resource or is admin
const ownerOrAdmin = (resourceField = 'requester') => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ 
          message: 'Authentication required' 
        });
      }
      
      // Admin can access everything
      if (req.user.role === 'admin') {
        return next();
      }
      
      // For new resources, user is automatically the owner
      if (req.method === 'POST') {
        return next();
      }
      
      // Check ownership for existing resources
      const resourceId = req.params.id;
      if (!resourceId) {
        return res.status(400).json({ 
          message: 'Resource ID required' 
        });
      }
      
      // This would need to be adapted based on the specific model
      // For now, we'll allow and let the route handler validate ownership
      next();
    } catch (error) {
      console.error('Ownership check error:', error);
      res.status(500).json({ 
        message: 'Server error during authorization' 
      });
    }
  };
};

// Rate limiting per user
const userRateLimit = (maxRequests = 50, windowMs = 15 * 60 * 1000) => {
  const userRequests = new Map();
  
  return (req, res, next) => {
    if (!req.user) {
      return next();
    }
    
    const userId = req.user._id.toString();
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Clean old entries
    const userRequestTimes = userRequests.get(userId) || [];
    const validRequests = userRequestTimes.filter(time => time > windowStart);
    
    if (validRequests.length >= maxRequests) {
      return res.status(429).json({
        message: 'Too many requests. Please try again later.'
      });
    }
    
    validRequests.push(now);
    userRequests.set(userId, validRequests);
    
    next();
  };
};

module.exports = {
  generateToken,
  verifyToken,
  authorize,
  optionalAuth,
  requireVerification,
  ownerOrAdmin,
  userRateLimit
};