const express = require('express');
const { query, body, validationResult } = require('express-validator');
const User = require('../models/User');
const BloodRequest = require('../models/BloodRequest');
const { verifyToken, authorize } = require('../middleware/auth');

const router = express.Router();

// All admin routes require admin role
router.use(verifyToken);
router.use(authorize('admin'));

// @route   GET /api/admin/dashboard
// @desc    Get admin dashboard statistics
// @access  Private (admin)
router.get('/dashboard', async (req, res) => {
  try {
    const [
      userStats,
      requestStats,
      recentRequests,
      fraudulentRequests
    ] = await Promise.all([
      // User statistics
      User.aggregate([
        {
          $group: {
            _id: '$role',
            count: { $sum: 1 }
          }
        }
      ]),
      
      // Blood request statistics
      BloodRequest.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]),
      
      // Recent blood requests
      BloodRequest.find()
        .populate('requester', 'name email')
        .sort({ createdAt: -1 })
        .limit(10)
        .select('patientName bloodGroup urgency status createdAt fraudCheck'),
      
      // High fraud score requests
      BloodRequest.find({
        'fraudCheck.score': { $gt: 70 },
        'fraudCheck.isReviewed': false
      })
        .populate('requester', 'name email')
        .sort({ 'fraudCheck.score': -1 })
        .limit(10)
    ]);

    // Format user stats
    const formattedUserStats = {
      donors: 0,
      requesters: 0,
      admins: 0
    };
    userStats.forEach(stat => {
      formattedUserStats[stat._id + 's'] = stat.count;
    });

    // Format request stats
    const formattedRequestStats = {
      active: 0,
      fulfilled: 0,
      expired: 0,
      cancelled: 0
    };
    requestStats.forEach(stat => {
      formattedRequestStats[stat._id] = stat.count;
    });

    res.json({
      users: formattedUserStats,
      requests: formattedRequestStats,
      recentRequests,
      fraudulentRequests,
      totalUsers: Object.values(formattedUserStats).reduce((a, b) => a + b, 0),
      totalRequests: Object.values(formattedRequestStats).reduce((a, b) => a + b, 0)
    });

  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({
      message: 'Server error retrieving dashboard data',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/admin/users
// @desc    Get all users with pagination and filtering
// @access  Private (admin)
router.get('/users',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('role').optional().isIn(['donor', 'requester', 'admin']),
    query('verified').optional().isBoolean(),
    query('search').optional().trim()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const {
        page = 1,
        limit = 20,
        role,
        verified,
        search
      } = req.query;

      let query = {};

      if (role) {
        query.role = role;
      }

      if (verified !== undefined) {
        query.isVerified = verified;
      }

      if (search) {
        query.$or = [
          { name: new RegExp(search, 'i') },
          { email: new RegExp(search, 'i') }
        ];
      }

      const skip = (page - 1) * limit;

      const users = await User.find(query)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await User.countDocuments(query);

      res.json({
        users,
        pagination: {
          page: parseInt(page),
          pages: Math.ceil(total / limit),
          total,
          limit: parseInt(limit)
        }
      });

    } catch (error) {
      console.error('Admin get users error:', error);
      res.status(500).json({
        message: 'Server error retrieving users',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// @route   GET /api/admin/requests
// @desc    Get all blood requests with pagination and filtering
// @access  Private (admin)
router.get('/requests',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('status').optional().isIn(['active', 'fulfilled', 'expired', 'cancelled']),
    query('urgency').optional().isIn(['low', 'medium', 'high', 'critical']),
    query('bloodGroup').optional().isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']),
    query('fraudScore').optional().isInt({ min: 0, max: 100 })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const {
        page = 1,
        limit = 20,
        status,
        urgency,
        bloodGroup,
        fraudScore
      } = req.query;

      let query = {};

      if (status) {
        query.status = status;
      }

      if (urgency) {
        query.urgency = urgency;
      }

      if (bloodGroup) {
        query.bloodGroup = bloodGroup;
      }

      if (fraudScore) {
        query['fraudCheck.score'] = { $gte: parseInt(fraudScore) };
      }

      const skip = (page - 1) * limit;

      const requests = await BloodRequest.find(query)
        .populate('requester', 'name email phone')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await BloodRequest.countDocuments(query);

      res.json({
        requests,
        pagination: {
          page: parseInt(page),
          pages: Math.ceil(total / limit),
          total,
          limit: parseInt(limit)
        }
      });

    } catch (error) {
      console.error('Admin get requests error:', error);
      res.status(500).json({
        message: 'Server error retrieving requests',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// @route   PUT /api/admin/users/:id/verify
// @desc    Verify or unverify a user
// @access  Private (admin)
router.put('/users/:id/verify',
  [
    body('isVerified').isBoolean().withMessage('isVerified must be a boolean')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { isVerified } = req.body;

      const user = await User.findByIdAndUpdate(
        req.params.id,
        { isVerified },
        { new: true }
      ).select('-password');

      if (!user) {
        return res.status(404).json({
          message: 'User not found'
        });
      }

      res.json({
        message: `User ${isVerified ? 'verified' : 'unverified'} successfully`,
        user
      });

    } catch (error) {
      console.error('Admin verify user error:', error);
      res.status(500).json({
        message: 'Server error updating user verification',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// @route   PUT /api/admin/requests/:id/review-fraud
// @desc    Review fraud check for a blood request
// @access  Private (admin)
router.put('/requests/:id/review-fraud',
  [
    body('isReviewed').isBoolean().withMessage('isReviewed must be a boolean'),
    body('reviewNotes').optional().trim().isLength({ max: 500 })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { isReviewed, reviewNotes } = req.body;

      const bloodRequest = await BloodRequest.findById(req.params.id);
      if (!bloodRequest) {
        return res.status(404).json({
          message: 'Blood request not found'
        });
      }

      bloodRequest.fraudCheck.isReviewed = isReviewed;
      bloodRequest.fraudCheck.reviewedBy = req.user._id;
      bloodRequest.fraudCheck.reviewDate = new Date();
      if (reviewNotes) {
        bloodRequest.fraudCheck.reviewNotes = reviewNotes;
      }

      await bloodRequest.save();

      res.json({
        message: 'Fraud review updated successfully',
        bloodRequest
      });

    } catch (error) {
      console.error('Admin fraud review error:', error);
      res.status(500).json({
        message: 'Server error updating fraud review',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// @route   PUT /api/admin/requests/:id/status
// @desc    Update blood request status
// @access  Private (admin)
router.put('/requests/:id/status',
  [
    body('status').isIn(['active', 'fulfilled', 'expired', 'cancelled']).withMessage('Invalid status')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { status } = req.body;

      const bloodRequest = await BloodRequest.findByIdAndUpdate(
        req.params.id,
        { status },
        { new: true }
      ).populate('requester', 'name email');

      if (!bloodRequest) {
        return res.status(404).json({
          message: 'Blood request not found'
        });
      }

      res.json({
        message: 'Blood request status updated successfully',
        bloodRequest
      });

    } catch (error) {
      console.error('Admin update request status error:', error);
      res.status(500).json({
        message: 'Server error updating request status',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// @route   DELETE /api/admin/users/:id
// @desc    Delete a user (soft delete)
// @access  Private (admin)
router.delete('/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        message: 'User not found'
      });
    }

    if (user.role === 'admin') {
      return res.status(400).json({
        message: 'Cannot delete admin users'
      });
    }

    // Instead of hard delete, deactivate the user
    user.isAvailable = false;
    user.email = `deleted_${Date.now()}_${user.email}`;
    await user.save();

    res.json({
      message: 'User deactivated successfully'
    });

  } catch (error) {
    console.error('Admin delete user error:', error);
    res.status(500).json({
      message: 'Server error deleting user',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/admin/analytics
// @desc    Get platform analytics
// @access  Private (admin)
router.get('/analytics', async (req, res) => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      userGrowth,
      requestTrends,
      responseRates,
      fraudStats
    ] = await Promise.all([
      // User registration trends
      User.aggregate([
        {
          $match: { createdAt: { $gte: thirtyDaysAgo } }
        },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
              role: '$role'
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.date': 1 } }
      ]),

      // Blood request trends
      BloodRequest.aggregate([
        {
          $match: { createdAt: { $gte: thirtyDaysAgo } }
        },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
              status: '$status'
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.date': 1 } }
      ]),

      // Response rates
      BloodRequest.aggregate([
        {
          $match: { createdAt: { $gte: thirtyDaysAgo } }
        },
        {
          $project: {
            hasResponses: { $gt: [{ $size: '$responses' }, 0] },
            responseCount: { $size: '$responses' }
          }
        },
        {
          $group: {
            _id: null,
            totalRequests: { $sum: 1 },
            requestsWithResponses: { $sum: { $cond: ['$hasResponses', 1, 0] } },
            totalResponses: { $sum: '$responseCount' }
          }
        }
      ]),

      // Fraud statistics
      BloodRequest.aggregate([
        {
          $group: {
            _id: null,
            highFraud: { $sum: { $cond: [{ $gt: ['$fraudCheck.score', 70] }, 1, 0] } },
            mediumFraud: { $sum: { $cond: [{ $and: [{ $gt: ['$fraudCheck.score', 30] }, { $lte: ['$fraudCheck.score', 70] }] }, 1, 0] } },
            lowFraud: { $sum: { $cond: [{ $lte: ['$fraudCheck.score', 30] }, 1, 0] } },
            reviewed: { $sum: { $cond: ['$fraudCheck.isReviewed', 1, 0] } }
          }
        }
      ])
    ]);

    res.json({
      userGrowth,
      requestTrends,
      responseRates: responseRates[0] || { totalRequests: 0, requestsWithResponses: 0, totalResponses: 0 },
      fraudStats: fraudStats[0] || { highFraud: 0, mediumFraud: 0, lowFraud: 0, reviewed: 0 }
    });

  } catch (error) {
    console.error('Admin analytics error:', error);
    res.status(500).json({
      message: 'Server error retrieving analytics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;