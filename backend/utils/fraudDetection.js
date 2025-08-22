const BloodRequest = require('../models/BloodRequest');
const User = require('../models/User');

/**
 * Fraud Detection Service
 * Analyzes blood requests for potential fraudulent patterns
 */
class FraudDetectionService {
  
  /**
   * Analyze a blood request for fraud indicators
   * @param {Object} bloodRequest - The blood request to analyze
   * @param {Object} requester - The user making the request
   * @returns {Object} - Fraud analysis result with score and factors
   */
  async analyzeRequest(bloodRequest, requester) {
    try {
      const factors = [];
      let totalScore = 0;

      // Factor 1: Request frequency (0-25 points)
      const frequencyScore = await this.analyzeRequestFrequency(requester);
      if (frequencyScore > 0) {
        factors.push({
          factor: 'High request frequency',
          weight: frequencyScore
        });
        totalScore += frequencyScore;
      }

      // Factor 2: Location consistency (0-20 points)
      const locationScore = await this.analyzeLocationConsistency(bloodRequest, requester);
      if (locationScore > 0) {
        factors.push({
          factor: 'Location inconsistency',
          weight: locationScore
        });
        totalScore += locationScore;
      }

      // Factor 3: Contact information patterns (0-15 points)
      const contactScore = this.analyzeContactPatterns(bloodRequest, requester);
      if (contactScore > 0) {
        factors.push({
          factor: 'Suspicious contact patterns',
          weight: contactScore
        });
        totalScore += contactScore;
      }

      // Factor 4: Request timing patterns (0-15 points)
      const timingScore = this.analyzeTimingPatterns(bloodRequest);
      if (timingScore > 0) {
        factors.push({
          factor: 'Unusual timing patterns',
          weight: timingScore
        });
        totalScore += timingScore;
      }

      // Factor 5: Medical reason analysis (0-10 points)
      const medicalReasonScore = this.analyzeMedicalReason(bloodRequest);
      if (medicalReasonScore > 0) {
        factors.push({
          factor: 'Suspicious medical reason',
          weight: medicalReasonScore
        });
        totalScore += medicalReasonScore;
      }

      // Factor 6: Hospital information verification (0-15 points)
      const hospitalScore = await this.analyzeHospitalInfo(bloodRequest);
      if (hospitalScore > 0) {
        factors.push({
          factor: 'Hospital information concerns',
          weight: hospitalScore
        });
        totalScore += hospitalScore;
      }

      return {
        score: Math.min(totalScore, 100), // Cap at 100
        factors,
        riskLevel: this.getRiskLevel(totalScore)
      };

    } catch (error) {
      console.error('Fraud detection error:', error);
      return {
        score: 0,
        factors: [],
        riskLevel: 'low',
        error: 'Analysis failed'
      };
    }
  }

  /**
   * Analyze request frequency patterns
   */
  async analyzeRequestFrequency(requester) {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [dailyCount, weeklyCount, monthlyCount] = await Promise.all([
      BloodRequest.countDocuments({
        requester: requester._id,
        createdAt: { $gte: oneDayAgo }
      }),
      BloodRequest.countDocuments({
        requester: requester._id,
        createdAt: { $gte: oneWeekAgo }
      }),
      BloodRequest.countDocuments({
        requester: requester._id,
        createdAt: { $gte: oneMonthAgo }
      })
    ]);

    let score = 0;

    // More than 3 requests in 24 hours is highly suspicious
    if (dailyCount > 3) score += 25;
    else if (dailyCount > 2) score += 15;
    else if (dailyCount > 1) score += 5;

    // More than 10 requests in a week
    if (weeklyCount > 10) score += 20;
    else if (weeklyCount > 7) score += 10;
    else if (weeklyCount > 5) score += 5;

    // More than 20 requests in a month
    if (monthlyCount > 20) score += 15;
    else if (monthlyCount > 15) score += 8;

    return Math.min(score, 25); // Cap at 25 points
  }

  /**
   * Analyze location consistency
   */
  async analyzeLocationConsistency(bloodRequest, requester) {
    let score = 0;

    // Check if request location is significantly different from user location
    if (requester.location && requester.location.coordinates) {
      const distance = this.calculateDistance(
        requester.location.coordinates,
        bloodRequest.location.coordinates
      );

      // More than 100km from user's registered location
      if (distance > 100) score += 20;
      else if (distance > 50) score += 10;
      else if (distance > 25) score += 5;
    }

    // Check for inconsistent city/state information
    if (requester.location) {
      if (requester.location.city.toLowerCase() !== bloodRequest.location.city.toLowerCase()) {
        score += 10;
      }
      if (requester.location.state.toLowerCase() !== bloodRequest.location.state.toLowerCase()) {
        score += 15;
      }
    }

    return Math.min(score, 20);
  }

  /**
   * Analyze contact information patterns
   */
  analyzeContactPatterns(bloodRequest, requester) {
    let score = 0;

    // Check if primary contact phone is different from user's phone
    if (requester.phone !== bloodRequest.contactInfo.primaryPhone) {
      score += 5;
    }

    // Check for suspicious phone number patterns (repeated digits, etc.)
    const phone = bloodRequest.contactInfo.primaryPhone.replace(/\D/g, '');
    if (this.isRepeatingPattern(phone)) {
      score += 10;
    }

    // Check doctor phone vs hospital phone vs contact phone similarity
    const doctorPhone = bloodRequest.doctorInfo.phone.replace(/\D/g, '');
    const hospitalPhone = bloodRequest.hospital.phone.replace(/\D/g, '');
    const contactPhone = phone;

    if (doctorPhone === hospitalPhone || doctorPhone === contactPhone || hospitalPhone === contactPhone) {
      score += 8;
    }

    return Math.min(score, 15);
  }

  /**
   * Analyze timing patterns
   */
  analyzeTimingPatterns(bloodRequest) {
    let score = 0;
    const now = new Date();
    const hour = now.getHours();

    // Requests made at unusual hours (late night/early morning)
    if (hour < 6 || hour > 23) {
      score += 5;
    }

    // Check time until required (very urgent or suspiciously far in future)
    const hoursUntilRequired = (bloodRequest.requiredBy - now) / (1000 * 60 * 60);
    
    if (hoursUntilRequired < 2) {
      score += 15; // Extremely urgent requests can be suspicious
    } else if (hoursUntilRequired > 30 * 24) {
      score += 10; // Requests for more than 30 days in future
    }

    return Math.min(score, 15);
  }

  /**
   * Analyze medical reason for suspicious patterns
   */
  analyzeMedicalReason(bloodRequest) {
    let score = 0;
    const reason = bloodRequest.medicalReason.toLowerCase();

    // Check for generic or vague reasons
    const genericReasons = [
      'emergency', 'urgent', 'operation', 'surgery', 'accident',
      'blood loss', 'anemia', 'transfusion needed'
    ];

    const isGeneric = genericReasons.some(generic => 
      reason.includes(generic) && reason.length < 50
    );

    if (isGeneric) {
      score += 8;
    }

    // Check for repeated common phrases
    if (reason.includes('please help') || reason.includes('urgent need')) {
      score += 5;
    }

    return Math.min(score, 10);
  }

  /**
   * Analyze hospital information
   */
  async analyzeHospitalInfo(bloodRequest) {
    let score = 0;

    // Check for generic hospital names
    const hospitalName = bloodRequest.hospital.name.toLowerCase();
    const genericNames = [
      'city hospital', 'general hospital', 'medical center',
      'clinic', 'healthcare', 'hospital'
    ];

    if (genericNames.some(generic => hospitalName === generic)) {
      score += 10;
    }

    // Check if hospital location matches request location
    const hospitalAddress = bloodRequest.hospital.address.toLowerCase();
    const requestCity = bloodRequest.location.city.toLowerCase();

    if (!hospitalAddress.includes(requestCity)) {
      score += 8;
    }

    // TODO: In a real implementation, you could verify hospital against a database
    // of registered medical facilities

    return Math.min(score, 15);
  }

  /**
   * Calculate distance between two coordinates (in kilometers)
   */
  calculateDistance(coords1, coords2) {
    const [lon1, lat1] = coords1;
    const [lon2, lat2] = coords2;

    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);

    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Convert degrees to radians
   */
  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * Check if a string has repeating patterns (suspicious phone numbers)
   */
  isRepeatingPattern(str) {
    // Check for repeated digits (like 1111111111)
    if (/^(\d)\1{6,}$/.test(str)) return true;
    
    // Check for simple patterns (like 1234567890)
    if (str === '1234567890' || str === '0123456789') return true;
    
    return false;
  }

  /**
   * Get risk level based on score
   */
  getRiskLevel(score) {
    if (score >= 70) return 'high';
    if (score >= 40) return 'medium';
    if (score >= 20) return 'low';
    return 'minimal';
  }

  /**
   * Batch analyze multiple requests (for admin review)
   */
  async batchAnalyze(requestIds) {
    const results = [];

    for (const requestId of requestIds) {
      try {
        const bloodRequest = await BloodRequest.findById(requestId).populate('requester');
        if (bloodRequest) {
          const analysis = await this.analyzeRequest(bloodRequest, bloodRequest.requester);
          results.push({
            requestId,
            analysis
          });
        }
      } catch (error) {
        results.push({
          requestId,
          error: error.message
        });
      }
    }

    return results;
  }
}

module.exports = new FraudDetectionService();