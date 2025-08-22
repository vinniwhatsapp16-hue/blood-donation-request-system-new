const express = require('express');
const { body, query, validationResult } = require('express-validator');
const BloodRequest = require('../models/BloodRequest');
const User = require('../models/User');
const { verifyToken, authorize, userRateLimit } = require('../middleware/auth');
const fraudDetection = require('../utils/fraudDetection');
const notificationService = require('../utils/notificationService');

const router = express.Router();

// @route   POST /api/blood-requests
// @desc    Create a new blood request
// @access  Private (requester, admin)
router.post('/', 
  verifyToken,
  authorize('requester', 'admin'),
  userRateLimit(5, 60 * 60 * 1000), // 5 requests per hour
  [
    body('patientName')
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Patient name must be between 2 and 100 characters'),
    body('bloodGroup')
      .isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])
      .withMessage('Invalid blood group'),
    body('unitsNeeded')
      .isInt({ min: 1, max: 10 })
      .withMessage('Units needed must be between 1 and 10'),
    body('urgency')
      .isIn(['low', 'medium', 'high', 'critical'])
      .withMessage('Invalid urgency level'),
    body('hospital.name')
      .trim()
      .isLength({ min: 2, max: 150 })
      .withMessage('Hospital name must be between 2 and 150 characters'),
    body('hospital.address')
      .trim()
      .isLength({ min: 5, max: 200 })
      .withMessage('Hospital address must be between 5 and 200 characters'),
    body('hospital.phone')
      .matches(/^\+?[\d\s\-\(\)]{10,15}$/)
      .withMessage('Invalid hospital phone number'),
    body('location.coordinates')
      .isArray({ min: 2, max: 2 })
      .withMessage('Location coordinates must be an array of [longitude, latitude]'),
    body('contactInfo.primaryPhone')
      .matches(/^\+?[\d\s\-\(\)]{10,15}$/)
      .withMessage('Invalid primary phone number'),
    body('medicalReason')
      .trim()
      .isLength({ min: 10, max: 300 })
      .withMessage('Medical reason must be between 10 and 300 characters'),
    body('doctorInfo.name')
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Doctor name must be between 2 and 100 characters'),
    body('doctorInfo.phone')
      .matches(/^\+?[\d\s\-\(\)]{10,15}$/)
      .withMessage('Invalid doctor phone number'),
    body('requiredBy')
      .isISO8601()
      .toDate()
      .custom((date) => {
        if (date <= new Date()) {
          throw new Error('Required by date must be in the future');
        }
        return true;
      })
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

      // Create blood request
      const bloodRequest = new BloodRequest({
        ...req.body,
        requester: req.user._id
      });

      // Run fraud detection
      const fraudScore = await fraudDetection.analyzeRequest(bloodRequest, req.user);
      bloodRequest.fraudCheck.score = fraudScore.score;
      bloodRequest.fraudCheck.factors = fraudScore.factors;

      // Calculate priority
      bloodRequest.calculatePriority();

      await bloodRequest.save();

      // If fraud score is not too high, notify nearby donors
      if (fraudScore.score < 80) {
        try {
          await notificationService.notifyNearbyDonors(bloodRequest);
        } catch (notificationError) {
          console.error('Notification error:', notificationError);
          // Don't fail the request if notification fails
        }
      }

      await bloodRequest.populate('requester', 'name email phone');

      res.status(201).json({
        message: 'Blood request created successfully',
        bloodRequest,
        fraudWarning: fraudScore.score > 50 ? 'This request has been flagged for review' : null
      });

    } catch (error) {
      console.error('Create blood request error:', error);
      res.status(500).json({
        message: 'Server error creating blood request',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// @route   GET /api/blood-requests
// @desc    Get blood requests with filtering and pagination
// @access  Private
router.get('/',
  verifyToken,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
    query('bloodGroup').optional().isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']),
    query('urgency').optional().isIn(['low', 'medium', 'high', 'critical']),
    query('status').optional().isIn(['active', 'fulfilled', 'expired', 'cancelled']),
    query('lat').optional().isFloat({ min: -90, max: 90 }),
    query('lng').optional().isFloat({ min: -180, max: 180 }),
    query('radius').optional().isInt({ min: 1, max: 100 })
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
        limit = 10,
        bloodGroup,
        urgency,
        status = 'active',
        lat,
        lng,
        radius = 20
      } = req.query;

      let query = { status };
      
      // Build query filters
      if (bloodGroup) {
        query.bloodGroup = bloodGroup;
      }
      
      if (urgency) {
        query.urgency = urgency;
      }

      // Location-based filtering
      if (lat && lng) {
        query.location = {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [parseFloat(lng), parseFloat(lat)]
            },
            $maxDistance: radius * 1000 // Convert km to meters
          }
        };
      }

      // If user is a donor, show compatible blood groups
      if (req.user.role === 'donor' && req.user.bloodGroup && !bloodGroup) {
        const tempRequest = new BloodRequest({ bloodGroup: req.user.bloodGroup });
        const compatibleGroups = tempRequest.getCompatibleBloodGroups();
        query.bloodGroup = { $in: compatibleGroups };
      }

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: { priority: -1, createdAt: -1 },
        populate: [
          { path: 'requester', select: 'name email phone' },
          { path: 'responses.donor', select: 'name bloodGroup' }
        ]
      };

      const bloodRequests = await BloodRequest.find(query)
        .populate([{ path: 'requester', select: 'name email phone' }, { path: 'responses.donor', select: 'name bloodGroup' }])
        .sort({ priority: -1, createdAt: -1 })
        .skip((parseInt(page) - 1) * parseInt(limit))
        .limit(parseInt(limit));

      const total = await BloodRequest.countDocuments(query);
      const totalPages = Math.ceil(total / parseInt(limit));

      res.json({
        bloodRequests,
        pagination: {
          page: parseInt(page),
          pages: totalPages,
          total,
          limit: parseInt(limit),
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1
        }
      });

    } catch (error) {
      console.error('Get blood requests error:', error);
      res.status(500).json({
        message: 'Server error retrieving blood requests',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// @route   GET /api/blood-requests/nearby
// @desc    Get nearby blood requests for donors
// @access  Private (donor)
router.get('/nearby',
  verifyToken,
  authorize('donor'),
  [
    query('radius').optional().isInt({ min: 1, max: 100 }).withMessage('Radius must be between 1 and 100 km')
  ],
  async (req, res) => {
    try {
      const { radius = 20 } = req.query;
      const donor = req.user;

      if (!donor.location || !donor.location.coordinates) {
        return res.status(400).json({
          message: 'Donor location not set. Please update your profile.'
        });
      }

      // Find nearby blood requests compatible with donor's blood group
      const tempRequest = new BloodRequest({ bloodGroup: donor.bloodGroup });
      const compatibleGroups = tempRequest.getCompatibleBloodGroups();

      const nearbyRequests = await BloodRequest.find({
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: donor.location.coordinates
            },
            $maxDistance: radius * 1000 // Convert km to meters
          }
        },
        bloodGroup: { $in: compatibleGroups },
        status: 'active'
      })
      .populate('requester', 'name email phone')
      .sort({ priority: -1, createdAt: -1 })
      .limit(20);

      res.json({
        nearbyRequests,
        donor: {
          bloodGroup: donor.bloodGroup,
          location: donor.location,
          canDonate: donor.canDonate()
        }
      });

    } catch (error) {
      console.error('Get nearby requests error:', error);
      res.status(500).json({
        message: 'Server error retrieving nearby requests',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// @route   GET /api/blood-requests/:id
// @desc    Get single blood request
// @access  Private
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const bloodRequest = await BloodRequest.findById(req.params.id)
      .populate('requester', 'name email phone')
      .populate('responses.donor', 'name bloodGroup email phone location');

    if (!bloodRequest) {
      return res.status(404).json({
        message: 'Blood request not found'
      });
    }

    res.json(bloodRequest);

  } catch (error) {
    console.error('Get blood request error:', error);
    res.status(500).json({
      message: 'Server error retrieving blood request',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   POST /api/blood-requests/:id/respond
// @desc    Respond to a blood request
// @access  Private (donor)
router.post('/:id/respond',
  verifyToken,
  authorize('donor'),
  [
    body('message')
      .optional()
      .trim()
      .isLength({ max: 200 })
      .withMessage('Message cannot exceed 200 characters'),
    body('status')
      .isIn(['interested', 'confirmed'])
      .withMessage('Status must be either interested or confirmed')
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

      const { message, status } = req.body;
      const donor = req.user;

      const bloodRequest = await BloodRequest.findById(req.params.id);
      if (!bloodRequest) {
        return res.status(404).json({
          message: 'Blood request not found'
        });
      }

      if (bloodRequest.status !== 'active') {
        return res.status(400).json({
          message: 'This blood request is no longer active'
        });
      }

      // Check if donor can donate to this blood group
      const tempRequest = new BloodRequest({ bloodGroup: donor.bloodGroup });
      const compatibleGroups = tempRequest.getCompatibleBloodGroups();
      
      if (!compatibleGroups.includes(bloodRequest.bloodGroup)) {
        return res.status(400).json({
          message: 'Your blood group is not compatible with this request'
        });
      }

      // Check if donor already responded
      const existingResponse = bloodRequest.responses.find(
        response => response.donor.toString() === donor._id.toString()
      );

      if (existingResponse) {
        return res.status(400).json({
          message: 'You have already responded to this request'
        });
      }

      // Add response
      bloodRequest.responses.push({
        donor: donor._id,
        message,
        status
      });

      await bloodRequest.save();

      // Notify requester about the response
      try {
        await notificationService.notifyRequesterOfResponse(bloodRequest, donor, status);
      } catch (notificationError) {
        console.error('Notification error:', notificationError);
      }

      await bloodRequest.populate('responses.donor', 'name bloodGroup email phone');

      res.json({
        message: 'Response submitted successfully',
        bloodRequest
      });

    } catch (error) {
      console.error('Respond to blood request error:', error);
      res.status(500).json({
        message: 'Server error submitting response',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// @route   PUT /api/blood-requests/:id
// @desc    Update blood request (owner or admin only)
// @access  Private
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const bloodRequest = await BloodRequest.findById(req.params.id);
    
    if (!bloodRequest) {
      return res.status(404).json({
        message: 'Blood request not found'
      });
    }

    // Check ownership or admin rights
    if (bloodRequest.requester.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        message: 'Not authorized to update this blood request'
      });
    }

    // Only allow certain fields to be updated
    const allowedUpdates = ['urgency', 'contactInfo', 'requiredBy', 'status'];
    const updates = {};
    
    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    Object.assign(bloodRequest, updates);
    
    if (updates.urgency) {
      bloodRequest.calculatePriority();
    }

    await bloodRequest.save();

    res.json({
      message: 'Blood request updated successfully',
      bloodRequest
    });

  } catch (error) {
    console.error('Update blood request error:', error);
    res.status(500).json({
      message: 'Server error updating blood request',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;