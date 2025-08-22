const nodemailer = require('nodemailer');
const User = require('../models/User');
const BloodRequest = require('../models/BloodRequest');

/**
 * Notification Service
 * Handles email and SMS notifications for blood donation system
 */
class NotificationService {
  constructor() {
    // Initialize email transporter
    this.emailTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    // SMS service would be initialized here (Twilio, AWS SNS, etc.)
    // For demo purposes, we'll log SMS notifications
  }

  /**
   * Notify nearby donors about a new blood request
   */
  async notifyNearbyDonors(bloodRequest) {
    try {
      const compatibleGroups = bloodRequest.getCompatibleBloodGroups();
      
      // Find nearby donors with compatible blood groups
      const nearbyDonors = await User.find({
        role: 'donor',
        bloodGroup: { $in: compatibleGroups },
        isAvailable: true,
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: bloodRequest.location.coordinates
            },
            $maxDistance: 20000 // 20km radius
          }
        }
      }).limit(50); // Limit to avoid spam

      console.log(`Found ${nearbyDonors.length} nearby compatible donors`);

      const notifications = [];

      for (const donor of nearbyDonors) {
        try {
          // Send email notification
          if (donor.email) {
            await this.sendEmailToDonor(donor, bloodRequest);
            notifications.push({
              donor: donor._id,
              method: 'email'
            });
          }

          // Send SMS notification (if phone available and SMS service configured)
          if (donor.phone && this.isSMSEnabled()) {
            await this.sendSMSToDonor(donor, bloodRequest);
            notifications.push({
              donor: donor._id,
              method: 'sms'
            });
          }

          // Add small delay to avoid overwhelming email server
          await this.delay(100);

        } catch (donorError) {
          console.error(`Failed to notify donor ${donor._id}:`, donorError);
        }
      }

      // Update blood request with notification records
      bloodRequest.notifiedDonors = notifications;
      await bloodRequest.save();

      return {
        donorsNotified: notifications.length,
        methods: ['email', 'sms']
      };

    } catch (error) {
      console.error('Error notifying nearby donors:', error);
      throw error;
    }
  }

  /**
   * Send email notification to donor
   */
  async sendEmailToDonor(donor, bloodRequest) {
    // Skip email sending if notifications are disabled
    if (process.env.DISABLE_NOTIFICATIONS === 'true') {
      console.log(`Email notification skipped for ${donor.name} (development mode)`);
      return { success: true };
    }
    
    const subject = `🩸 Urgent Blood Donation Request - ${bloodRequest.bloodGroup}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #dc2626; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .urgency-high { color: #dc2626; font-weight: bold; }
          .urgency-critical { color: #991b1b; font-weight: bold; animation: blink 1s infinite; }
          .details { background-color: white; padding: 15px; margin: 10px 0; border-radius: 5px; }
          .button { display: inline-block; background-color: #dc2626; color: white; padding: 12px 24px; 
                   text-decoration: none; border-radius: 5px; margin: 10px 0; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
          @keyframes blink { 50% { opacity: 0.5; } }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🩸 Blood Donation Request</h1>
          </div>
          
          <div class="content">
            <h2>Dear ${donor.name},</h2>
            
            <p>A blood donation request has been made near your location that matches your blood group.</p>
            
            <div class="details">
              <h3>Request Details:</h3>
              <p><strong>Patient:</strong> ${bloodRequest.patientName}</p>
              <p><strong>Blood Group Needed:</strong> ${bloodRequest.bloodGroup}</p>
              <p><strong>Units Required:</strong> ${bloodRequest.unitsNeeded}</p>
              <p><strong>Urgency:</strong> 
                <span class="urgency-${bloodRequest.urgency}">${bloodRequest.urgency.toUpperCase()}</span>
              </p>
              <p><strong>Required By:</strong> ${new Date(bloodRequest.requiredBy).toLocaleString()}</p>
              <p><strong>Medical Reason:</strong> ${bloodRequest.medicalReason}</p>
            </div>
            
            <div class="details">
              <h3>Hospital Information:</h3>
              <p><strong>Hospital:</strong> ${bloodRequest.hospital.name}</p>
              <p><strong>Address:</strong> ${bloodRequest.hospital.address}</p>
              <p><strong>Phone:</strong> ${bloodRequest.hospital.phone}</p>
            </div>
            
            <div class="details">
              <h3>Contact Information:</h3>
              <p><strong>Primary Contact:</strong> ${bloodRequest.contactInfo.primaryPhone}</p>
              ${bloodRequest.contactInfo.alternatePhone ? 
                `<p><strong>Alternate Contact:</strong> ${bloodRequest.contactInfo.alternatePhone}</p>` : ''}
              <p><strong>Doctor:</strong> ${bloodRequest.doctorInfo.name} - ${bloodRequest.doctorInfo.phone}</p>
            </div>
            
            <p>Your blood group (${donor.bloodGroup}) is compatible with this request.</p>
            
            ${donor.canDonate() ? 
              `<p style="color: green;"><strong>✅ You are eligible to donate!</strong></p>
               <a href="${process.env.FRONTEND_URL}/blood-requests/${bloodRequest._id}" class="button">
                 Respond to Request
               </a>` :
              `<p style="color: orange;"><strong>⚠️ Please check your donation eligibility</strong></p>
               <p>It's been less than 56 days since your last donation. Please verify your eligibility before responding.</p>`
            }
            
            <p><strong>Distance:</strong> Approximately within 20km of your location</p>
            
            <p>Thank you for being a registered blood donor. Your willingness to help saves lives!</p>
          </div>
          
          <div class="footer">
            <p>Blood Donation Request System</p>
            <p>This is an automated notification. Please do not reply to this email.</p>
            <p>If you no longer wish to receive these notifications, please update your preferences in your profile.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const mailOptions = {
      from: `"Blood Donation System" <${process.env.SMTP_USER}>`,
      to: donor.email,
      subject,
      html
    };

    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      await this.emailTransporter.sendMail(mailOptions);
      console.log(`Email sent to donor: ${donor.email}`);
    } else {
      console.log('SMTP not configured, email would be sent to:', donor.email);
      console.log('Subject:', subject);
    }
  }

  /**
   * Send SMS notification to donor
   */
  async sendSMSToDonor(donor, bloodRequest) {
    const message = `🩸 URGENT: Blood donation needed near you! ${bloodRequest.bloodGroup} - ${bloodRequest.unitsNeeded} units. Urgency: ${bloodRequest.urgency.toUpperCase()}. Hospital: ${bloodRequest.hospital.name}. Contact: ${bloodRequest.contactInfo.primaryPhone}. Details: ${process.env.FRONTEND_URL}/blood-requests/${bloodRequest._id}`;

    // In a real implementation, you would use SMS service like Twilio:
    // await this.smsClient.messages.create({
    //   body: message,
    //   from: process.env.TWILIO_PHONE,
    //   to: donor.phone
    // });

    console.log(`SMS would be sent to ${donor.phone}: ${message}`);
  }

  /**
   * Notify requester about donor response
   */
  async notifyRequesterOfResponse(bloodRequest, donor, responseStatus) {
    try {
      await bloodRequest.populate('requester');
      const requester = bloodRequest.requester;

      const subject = `Blood Donation Response - ${donor.name}`;
      
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #059669; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; }
            .donor-info { background-color: #f0f9ff; padding: 15px; margin: 10px 0; border-radius: 5px; }
            .status-interested { color: #059669; font-weight: bold; }
            .status-confirmed { color: #dc2626; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🩸 Donor Response Received</h1>
            </div>
            
            <div class="content">
              <h2>Dear ${requester.name},</h2>
              
              <p>Good news! A donor has responded to your blood donation request for ${bloodRequest.patientName}.</p>
              
              <div class="donor-info">
                <h3>Donor Information:</h3>
                <p><strong>Name:</strong> ${donor.name}</p>
                <p><strong>Blood Group:</strong> ${donor.bloodGroup}</p>
                <p><strong>Status:</strong> 
                  <span class="status-${responseStatus}">${responseStatus.toUpperCase()}</span>
                </p>
                <p><strong>Total Donations:</strong> ${donor.totalDonations}</p>
                <p><strong>Rating:</strong> ⭐ ${donor.rating}/5</p>
              </div>
              
              <p><strong>Next Steps:</strong></p>
              <ul>
                ${responseStatus === 'confirmed' ? 
                  '<li>The donor has confirmed their availability</li><li>Please coordinate directly with the donor</li>' :
                  '<li>The donor has expressed interest</li><li>Please follow up to confirm their availability</li>'
                }
                <li>Arrange for the donation at ${bloodRequest.hospital.name}</li>
                <li>Ensure all necessary paperwork is prepared</li>
              </ul>
              
              <p>Please contact the donor directly to coordinate the donation.</p>
              
              <p>Thank you for using our blood donation system!</p>
            </div>
          </div>
        </body>
        </html>
      `;

      const mailOptions = {
        from: `"Blood Donation System" <${process.env.SMTP_USER}>`,
        to: requester.email,
        subject,
        html
      };

      if (process.env.SMTP_USER && process.env.SMTP_PASS) {
        await this.emailTransporter.sendMail(mailOptions);
        console.log(`Response notification sent to requester: ${requester.email}`);
      } else {
        console.log('SMTP not configured, email would be sent to:', requester.email);
      }

    } catch (error) {
      console.error('Error notifying requester of response:', error);
      throw error;
    }
  }

  /**
   * Send verification email
   */
  async sendVerificationEmail(user, verificationToken) {
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
    
    const subject = 'Verify Your Blood Donation Account';
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #dc2626; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; }
          .button { display: inline-block; background-color: #dc2626; color: white; padding: 12px 24px; 
                   text-decoration: none; border-radius: 5px; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to Blood Donation System</h1>
          </div>
          
          <div class="content">
            <h2>Dear ${user.name},</h2>
            
            <p>Thank you for registering as a ${user.role} in our blood donation system!</p>
            
            <p>To activate your account and start ${user.role === 'donor' ? 'helping save lives' : 'making blood requests'}, 
               please verify your email address by clicking the button below:</p>
            
            <a href="${verificationUrl}" class="button">Verify Email Address</a>
            
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p>${verificationUrl}</p>
            
            <p>This verification link will expire in 24 hours.</p>
            
            <p>If you didn't create this account, please ignore this email.</p>
            
            <p>Thank you for joining our mission to save lives through blood donation!</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const mailOptions = {
      from: `"Blood Donation System" <${process.env.SMTP_USER}>`,
      to: user.email,
      subject,
      html
    };

    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      await this.emailTransporter.sendMail(mailOptions);
    } else {
      console.log('Verification email would be sent to:', user.email);
    }
  }

  /**
   * Check if SMS service is enabled
   */
  isSMSEnabled() {
    // In a real implementation, check if SMS service (Twilio, etc.) is configured
    return false; // Disabled for demo
  }

  /**
   * Utility function to add delay
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Send bulk notifications (for admin use)
   */
  async sendBulkNotification(userIds, subject, message) {
    const users = await User.find({ _id: { $in: userIds } });
    const results = [];

    for (const user of users) {
      try {
        await this.sendCustomEmail(user.email, subject, message);
        results.push({ userId: user._id, status: 'sent' });
      } catch (error) {
        results.push({ userId: user._id, status: 'failed', error: error.message });
      }
    }

    return results;
  }

  /**
   * Send custom email
   */
  async sendCustomEmail(email, subject, htmlContent) {
    const mailOptions = {
      from: `"Blood Donation System" <${process.env.SMTP_USER}>`,
      to: email,
      subject,
      html: htmlContent
    };

    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      await this.emailTransporter.sendMail(mailOptions);
    } else {
      console.log(`Custom email would be sent to: ${email}`);
    }
  }
}

module.exports = new NotificationService();