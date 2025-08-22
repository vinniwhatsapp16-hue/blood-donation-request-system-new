const express = require('express');
const { query, validationResult } = require('express-validator');
const User = require('../models/User');
const { verifyToken, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/donors/nearby
// @desc    Find nearby donors
// @access  Private
router.get('/nearby',
  verifyToken,
  [
    query('lat').isFloat({ min: -90, max: 90 }).withMessage('Valid latitude required'),
    query('lng').isFloat({ min: -180, max: 180 }).withMessage('Valid longitude required'),
    query('bloodGroup').optional().isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']),
    query('radius').optional().isInt({ min: 1, max: 100 }).withMessage('Radius must be between 1 and 100 km')
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

      const { lat, lng, bloodGroup, radius = 20 } = req.query;

      let query = {
        role: 'donor',
        isAvailable: true,
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [parseFloat(lng), parseFloat(lat)]
            },
            $maxDistance: radius * 1000 // Convert km to meters
          }
        }
      };

      if (bloodGroup) {
        query.bloodGroup = bloodGroup;
      }

      const donors = await User.find(query)
        .select('name bloodGroup location totalDonations rating lastDonation')
        .limit(50);

      // Add distance and eligibility info
      const donorsWithInfo = donors.map(donor => {
        const donorObj = donor.toObject();
        donorObj.canDonate = donor.canDonate();
        donorObj.daysSinceLastDonation = donor.lastDonation 
          ? Math.floor((Date.now() - donor.lastDonation) / (1000 * 60 * 60 * 24))
          : null;
        return donorObj;
      });

      res.json({
        donors: donorsWithInfo,
        count: donorsWithInfo.length
      });

    } catch (error) {
      console.error('Find nearby donors error:', error);
      res.status(500).json({
        message: 'Server error finding nearby donors',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// @route   GET /api/donors
// @desc    Get donors directory with filtering
// @access  Public (with optional auth for more details)
router.get('/',
  optionalAuth,
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 50 }),
    query('bloodGroup').optional().isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']),
    query('city').optional().trim(),
    query('state').optional().trim(),
    query('available').optional().isBoolean()
  ],
  async (req, res) => {
    try {
      const {
        page = 1,
        limit = 20,
        bloodGroup,
        city,
        state,
        available = true
      } = req.query;

      let query = {
        role: 'donor',
        isAvailable: available
      };

      if (bloodGroup) {
        query.bloodGroup = bloodGroup;
      }

      if (city) {
        query['location.city'] = new RegExp(city, 'i');
      }

      if (state) {
        query['location.state'] = new RegExp(state, 'i');
      }

      const skip = (page - 1) * limit;

      // Select different fields based on authentication
      const selectFields = req.user 
        ? 'name bloodGroup location.city location.state totalDonations rating lastDonation'
        : 'name bloodGroup location.city location.state totalDonations rating';

      const donors = await User.find(query)
        .select(selectFields)
        .sort({ totalDonations: -1, rating: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await User.countDocuments(query);

      const donorsWithInfo = donors.map(donor => {
        const donorObj = donor.toObject();
        if (req.user) {
          donorObj.canDonate = donor.canDonate();
        }
        return donorObj;
      });

      res.json({
        donors: donorsWithInfo,
        pagination: {
          page: parseInt(page),
          pages: Math.ceil(total / limit),
          total,
          limit: parseInt(limit)
        }
      });

    } catch (error) {
      console.error('Get donors directory error:', error);
      res.status(500).json({
        message: 'Server error retrieving donors directory',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// @route   GET /api/donors/stats
// @desc    Get donor statistics
// @access  Public
router.get('/stats', async (req, res) => {
  try {
    const stats = await User.aggregate([
      { $match: { role: 'donor' } },
      {
        $group: {
          _id: null,
          totalDonors: { $sum: 1 },
          availableDonors: {
            $sum: { $cond: ['$isAvailable', 1, 0] }
          },
          totalDonations: { $sum: '$totalDonations' },
          avgRating: { $avg: '$rating' }
        }
      }
    ]);

    const bloodGroupStats = await User.aggregate([
      { $match: { role: 'donor' } },
      {
        $group: {
          _id: '$bloodGroup',
          count: { $sum: 1 },
          available: {
            $sum: { $cond: ['$isAvailable', 1, 0] }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const locationStats = await User.aggregate([
      { $match: { role: 'donor' } },
      {
        $group: {
          _id: '$location.state',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    res.json({
      overall: stats[0] || {
        totalDonors: 0,
        availableDonors: 0,
        totalDonations: 0,
        avgRating: 0
      },
      byBloodGroup: bloodGroupStats,
      byLocation: locationStats
    });

  } catch (error) {
    console.error('Get donor stats error:', error);
    res.status(500).json({
      message: 'Server error retrieving donor statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;