const mongoose = require('mongoose');

const bloodRequestSchema = new mongoose.Schema({
  requester: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  patientName: {
    type: String,
    required: [true, 'Patient name is required'],
    trim: true,
    maxlength: [100, 'Patient name cannot exceed 100 characters']
  },
  bloodGroup: {
    type: String,
    required: [true, 'Blood group is required'],
    enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
  },
  unitsNeeded: {
    type: Number,
    required: [true, 'Number of units needed is required'],
    min: [1, 'At least 1 unit is required'],
    max: [10, 'Cannot request more than 10 units at once']
  },
  urgency: {
    type: String,
    required: [true, 'Urgency level is required'],
    enum: ['low', 'medium', 'high', 'critical'],
    index: true
  },
  hospital: {
    name: {
      type: String,
      required: [true, 'Hospital name is required'],
      maxlength: [150, 'Hospital name cannot exceed 150 characters']
    },
    address: {
      type: String,
      required: [true, 'Hospital address is required'],
      maxlength: [200, 'Hospital address cannot exceed 200 characters']
    },
    phone: {
      type: String,
      required: [true, 'Hospital phone is required'],
      match: [/^\+?[\d\s\-\(\)]{10,15}$/, 'Please enter a valid phone number']
    }
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: [true, 'Location coordinates are required']
    },
    address: {
      type: String,
      required: [true, 'Address is required'],
      maxlength: [200, 'Address cannot exceed 200 characters']
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      maxlength: [50, 'City cannot exceed 50 characters']
    },
    state: {
      type: String,
      required: [true, 'State is required'],
      maxlength: [50, 'State cannot exceed 50 characters']
    }
  },
  contactInfo: {
    primaryPhone: {
      type: String,
      required: [true, 'Primary contact phone is required'],
      match: [/^\+?[\d\s\-\(\)]{10,15}$/, 'Please enter a valid phone number']
    },
    alternatePhone: {
      type: String,
      match: [/^\+?[\d\s\-\(\)]{10,15}$/, 'Please enter a valid phone number']
    },
    email: {
      type: String,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    }
  },
  medicalReason: {
    type: String,
    required: [true, 'Medical reason is required'],
    maxlength: [300, 'Medical reason cannot exceed 300 characters']
  },
  doctorInfo: {
    name: {
      type: String,
      required: [true, 'Doctor name is required'],
      maxlength: [100, 'Doctor name cannot exceed 100 characters']
    },
    phone: {
      type: String,
      required: [true, 'Doctor phone is required'],
      match: [/^\+?[\d\s\-\(\)]{10,15}$/, 'Please enter a valid phone number']
    },
    license: {
      type: String,
      maxlength: [50, 'License number cannot exceed 50 characters']
    }
  },
  requiredBy: {
    type: Date,
    required: [true, 'Required by date is required'],
    validate: {
      validator: function(date) {
        return date > new Date();
      },
      message: 'Required by date must be in the future'
    }
  },
  status: {
    type: String,
    enum: ['active', 'fulfilled', 'expired', 'cancelled'],
    default: 'active',
    index: true
  },
  responses: [{
    donor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    message: String,
    responseDate: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['interested', 'confirmed', 'donated', 'declined'],
      default: 'interested'
    }
  }],
  notifiedDonors: [{
    donor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    notificationDate: {
      type: Date,
      default: Date.now
    },
    method: {
      type: String,
      enum: ['email', 'sms', 'push']
    }
  }],
  fulfillmentDetails: {
    donatedUnits: {
      type: Number,
      default: 0
    },
    donors: [{
      donor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      units: Number,
      donationDate: Date
    }],
    fulfilledDate: Date
  },
  fraudCheck: {
    score: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    factors: [{
      factor: String,
      weight: Number
    }],
    isReviewed: {
      type: Boolean,
      default: false
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reviewDate: Date,
    reviewNotes: String
  },
  priority: {
    type: Number,
    default: 50,
    min: 1,
    max: 100
  },
  expiresAt: {
    type: Date,
    index: { expireAfterSeconds: 0 }
  }
}, {
  timestamps: true
});

// Create geospatial index for location-based queries
bloodRequestSchema.index({ location: '2dsphere' });

// Compound indexes for efficient queries
bloodRequestSchema.index({ status: 1, bloodGroup: 1, urgency: 1 });
bloodRequestSchema.index({ requester: 1, status: 1 });
bloodRequestSchema.index({ createdAt: -1 });
bloodRequestSchema.index({ 'fraudCheck.score': 1, 'fraudCheck.isReviewed': 1 });

// Pre-save middleware to set expiration date
bloodRequestSchema.pre('save', function(next) {
  if (this.isNew && !this.expiresAt) {
    // Set expiration based on urgency
    const hoursToExpire = {
      'critical': 6,
      'high': 24,
      'medium': 72,
      'low': 168 // 7 days
    };
    
    const hours = hoursToExpire[this.urgency] || 72;
    this.expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
  }
  next();
});

// Method to get compatible blood groups for requests
bloodRequestSchema.methods.getCompatibleBloodGroups = function() {
  const compatibility = {
    'A+': ['A+', 'A-', 'O+', 'O-'],
    'A-': ['A-', 'O-'],
    'B+': ['B+', 'B-', 'O+', 'O-'],
    'B-': ['B-', 'O-'],
    'AB+': ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
    'AB-': ['A-', 'B-', 'AB-', 'O-'],
    'O+': ['O+', 'O-'],
    'O-': ['O-']
  };
  
  return compatibility[this.bloodGroup] || [];
};

// Method to calculate priority score
bloodRequestSchema.methods.calculatePriority = function() {
  let score = 50; // Base score
  
  // Urgency factor (0-40 points)
  const urgencyScores = {
    'critical': 40,
    'high': 30,
    'medium': 20,
    'low': 10
  };
  score += urgencyScores[this.urgency] || 0;
  
  // Time factor (0-20 points based on how soon it's needed)
  const hoursUntilNeeded = (this.requiredBy - Date.now()) / (1000 * 60 * 60);
  if (hoursUntilNeeded <= 6) score += 20;
  else if (hoursUntilNeeded <= 24) score += 15;
  else if (hoursUntilNeeded <= 72) score += 10;
  else score += 5;
  
  // Units needed factor (0-10 points)
  score += Math.min(this.unitsNeeded * 2, 10);
  
  // Fraud check penalty (0 to -30 points)
  if (this.fraudCheck.score > 70) score -= 30;
  else if (this.fraudCheck.score > 50) score -= 20;
  else if (this.fraudCheck.score > 30) score -= 10;
  
  this.priority = Math.max(1, Math.min(100, score));
  return this.priority;
};

// Method to check if request is expired
bloodRequestSchema.methods.isExpired = function() {
  return this.expiresAt && this.expiresAt < new Date();
};

// Static method to find nearby requests
bloodRequestSchema.statics.findNearby = function(coordinates, maxDistance = 20000) {
  return this.find({
    location: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: coordinates
        },
        $maxDistance: maxDistance // meters (20km default)
      }
    },
    status: 'active'
  }).populate('requester', 'name phone email')
    .sort({ priority: -1, createdAt: -1 });
};

module.exports = mongoose.model('BloodRequest', bloodRequestSchema);