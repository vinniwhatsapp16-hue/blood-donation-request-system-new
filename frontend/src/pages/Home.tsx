import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Heart, Users, Shield, MapPin, Phone, Clock } from 'lucide-react';

const Home: React.FC = () => {
  const { isAuthenticated, user } = useAuth();

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blood-600 to-blood-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center">
            <div className="flex justify-center mb-8">
              <Heart className="h-20 w-20 text-white animate-pulse-slow" />
            </div>
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              Save Lives with Blood Donation
            </h1>
            <p className="text-xl md:text-2xl mb-8 max-w-3xl mx-auto text-blood-100">
              Connect blood donors with those in need across rural communities. 
              Fast, secure, and life-saving coordination system.
            </p>
            
            {!isAuthenticated ? (
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  to="/register"
                  className="bg-white text-blood-600 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-gray-100 transition-colors"
                >
                  Join as Donor
                </Link>
                <Link
                  to="/register"
                  className="border-2 border-white text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-white hover:text-blood-600 transition-colors"
                >
                  Request Blood
                </Link>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  to="/dashboard"
                  className="bg-white text-blood-600 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-gray-100 transition-colors"
                >
                  Go to Dashboard
                </Link>
                {(user?.role === 'requester' || user?.role === 'admin') && (
                  <Link
                    to="/blood-requests/create"
                    className="border-2 border-white text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-white hover:text-blood-600 transition-colors"
                  >
                    Create Request
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              How It Works
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Our platform makes blood donation coordination simple, fast, and effective
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="text-center">
              <div className="bg-blood-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                <Users className="h-8 w-8 text-blood-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Register as Donor</h3>
              <p className="text-gray-600">
                Sign up with your blood group, location, and contact information to join our donor network
              </p>
            </div>

            <div className="text-center">
              <div className="bg-blood-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                <MapPin className="h-8 w-8 text-blood-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Location-Based Matching</h3>
              <p className="text-gray-600">
                Our system automatically finds compatible donors within 20km of blood requests
              </p>
            </div>

            <div className="text-center">
              <div className="bg-blood-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                <Phone className="h-8 w-8 text-blood-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Instant Notifications</h3>
              <p className="text-gray-600">
                Donors receive immediate email and SMS alerts for urgent blood requests nearby
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Statistics Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Making a Difference
            </h2>
            <p className="text-xl text-gray-600">
              Join thousands of donors already saving lives
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-4xl md:text-5xl font-bold text-blood-600 mb-2">1000+</div>
              <div className="text-gray-600">Registered Donors</div>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-bold text-blood-600 mb-2">500+</div>
              <div className="text-gray-600">Lives Saved</div>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-bold text-blood-600 mb-2">50+</div>
              <div className="text-gray-600">Partner Hospitals</div>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-bold text-blood-600 mb-2">24/7</div>
              <div className="text-gray-600">System Availability</div>
            </div>
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
                Secure & Trusted Platform
              </h2>
              <p className="text-lg text-gray-600 mb-8">
                Your safety and privacy are our top priorities. Our advanced fraud detection 
                system ensures only legitimate blood requests reach our donor community.
              </p>
              
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <Shield className="h-6 w-6 text-blood-600 mt-1" />
                  <div>
                    <h3 className="font-semibold text-gray-900">Advanced Fraud Detection</h3>
                    <p className="text-gray-600">ML-powered system to identify suspicious requests</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <Clock className="h-6 w-6 text-blood-600 mt-1" />
                  <div>
                    <h3 className="font-semibold text-gray-900">Real-time Verification</h3>
                    <p className="text-gray-600">Hospital and doctor information verified instantly</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <Heart className="h-6 w-6 text-blood-600 mt-1" />
                  <div>
                    <h3 className="font-semibold text-gray-900">Donor Safety</h3>
                    <p className="text-gray-600">Complete donation history and eligibility tracking</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="lg:text-right">
              <div className="bg-gradient-to-br from-blood-100 to-blood-200 p-8 rounded-2lg">
                <div className="text-6xl font-bold text-blood-600 mb-2">99.9%</div>
                <div className="text-xl text-blood-700 mb-4">System Uptime</div>
                <div className="text-gray-600">
                  Reliable platform ensuring blood requests are processed without delays
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-blood-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Ready to Save Lives?
          </h2>
          <p className="text-xl text-blood-100 mb-8 max-w-2xl mx-auto">
            Join thousands of donors making a difference in rural communities across the country
          </p>
          
          {!isAuthenticated ? (
            <Link
              to="/register"
              className="bg-white text-blood-600 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-gray-100 transition-colors inline-block"
            >
              Get Started Today
            </Link>
          ) : (
            <Link
              to="/dashboard"
              className="bg-white text-blood-600 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-gray-100 transition-colors inline-block"
            >
              View Dashboard
            </Link>
          )}
        </div>
      </section>
    </div>
  );
};

export default Home;