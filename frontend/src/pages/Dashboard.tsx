import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api } from '../services/api';
import type { BloodRequest } from '../types';
import { formatDate, getUrgencyColor } from '../utils';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  
  const [, setActiveRequests] = useState<BloodRequest[]>([]);
  const [myRequests, setMyRequests] = useState<BloodRequest[]>([]);
  const [nearbyRequests, setNearbyRequests] = useState<BloodRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalRequests: 0,
    successfulDonations: 0,
    pendingRequests: 0,
    nearbyActiveRequests: 0
  });

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Load user's own requests if requester
      if (user?.role === 'requester' || user?.role === 'admin') {
        const myRequestsResponse = await api.getUserRequests();
        if (myRequestsResponse.data) {
          setMyRequests(myRequestsResponse.data);
        }
      }

      // Load nearby requests for donors
      if (user?.role === 'donor' || user?.role === 'admin') {
        const nearbyResponse = await api.getNearbyRequests();
        if (nearbyResponse.nearbyRequests) {
          setNearbyRequests(nearbyResponse.nearbyRequests);
        }
      }

      // Load all active requests for admin
      if (user?.role === 'admin') {
        const allRequestsResponse = await api.getAllRequests();
        if (allRequestsResponse.data) {
          setActiveRequests(allRequestsResponse.data);
        }
      }

      // Calculate stats
      updateStats();
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      showToast('Error loading dashboard data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const updateStats = () => {
    setStats({
      totalRequests: myRequests.length,
      successfulDonations: myRequests.filter(req => req.status === 'fulfilled').length,
      pendingRequests: myRequests.filter(req => req.status === 'active').length,
      nearbyActiveRequests: nearbyRequests.filter(req => req.status === 'active').length
    });
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const getRoleBasedActions = () => {
    const actions = [];

    if (user?.role === 'donor') {
      actions.push(
        <Link
          key="find-requests"
          to="/donors"
          className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
        >
          <svg className="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          Find Blood Requests
        </Link>
      );
    }

    if (user?.role === 'requester') {
      actions.push(
        <Link
          key="create-request"
          to="/create-request"
          className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
        >
          <svg className="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Blood Request
        </Link>
      );
    }

    if (user?.role === 'admin') {
      actions.push(
        <Link
          key="admin-panel"
          to="/admin"
          className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <svg className="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Admin Panel
        </Link>
      );
    }

    return actions;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Welcome Section */}
        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {getGreeting()}, {user?.name}!
              </h1>
              <p className="mt-2 text-gray-600">
                Welcome to your BloodConnect dashboard. Here's what's happening today.
              </p>
            </div>
            <div className="flex space-x-4">
              {getRoleBasedActions()}
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {user?.role === 'requester' && (
            <>
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <svg className="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">Total Requests</dt>
                        <dd className="text-lg font-medium text-gray-900">{stats.totalRequests}</dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <svg className="h-6 w-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">Pending Requests</dt>
                        <dd className="text-lg font-medium text-gray-900">{stats.pendingRequests}</dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {user?.role === 'donor' && (
            <>
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <svg className="h-6 w-6 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">Nearby Requests</dt>
                        <dd className="text-lg font-medium text-gray-900">{stats.nearbyActiveRequests}</dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <svg className="h-6 w-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">Successful Donations</dt>
                        <dd className="text-lg font-medium text-gray-900">{stats.successfulDonations}</dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Your Location</dt>
                    <dd className="text-sm font-medium text-gray-900">{user?.city}, {user?.state}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* My Requests (for requesters) */}
          {(user?.role === 'requester' || user?.role === 'admin') && (
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-900">
                    {user?.role === 'admin' ? 'Recent Requests' : 'My Requests'}
                  </h3>
                  <Link
                    to="/create-request"
                    className="text-sm font-medium text-red-600 hover:text-red-500"
                  >
                    Create new
                  </Link>
                </div>
              </div>
              <div className="divide-y divide-gray-200">
                {myRequests.length > 0 ? (
                  myRequests.slice(0, 5).map((request) => (
                    <div key={request._id} className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{request.patientName}</p>
                          <p className="text-sm text-gray-500">
                            {request.bloodGroup} • {request.unitsNeeded} units • {request.hospitalName || request.hospital?.name}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            Created {formatDate(request.createdAt)}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getUrgencyColor(request.urgency)}`}>
                            {request.urgency}
                          </span>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            request.status === 'active' ? 'bg-yellow-100 text-yellow-800' :
                            request.status === 'fulfilled' ? 'bg-green-100 text-green-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {request.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-6 text-center">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 0 012 2" />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No requests</h3>
                    <p className="mt-1 text-sm text-gray-500">Get started by creating a blood request.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Nearby Requests (for donors) */}
          {(user?.role === 'donor' || user?.role === 'admin') && (
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-900">
                    {user?.role === 'admin' ? 'Active Requests' : 'Nearby Requests'}
                  </h3>
                  <Link
                    to="/donors"
                    className="text-sm font-medium text-red-600 hover:text-red-500"
                  >
                    View all
                  </Link>
                </div>
              </div>
              <div className="divide-y divide-gray-200">
                {nearbyRequests.length > 0 ? (
                  nearbyRequests.slice(0, 5).map((request) => (
                    <div key={request._id} className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{request.patientName}</p>
                          <p className="text-sm text-gray-500">
                            {request.bloodGroup} • {request.unitsNeeded} units • {request.hospitalName || request.hospital?.name}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            Required by {formatDate(request.requiredBy)}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getUrgencyColor(request.urgency)}`}>
                            {request.urgency}
                          </span>
                          {request.distance && (
                            <span className="text-xs text-gray-500">
                              {request.distance.toFixed(1)} km
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-6 text-center">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No nearby requests</h3>
                    <p className="mt-1 text-sm text-gray-500">Check back later for blood requests in your area.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="mt-8 bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link
              to="/donors"
              className="p-4 border border-gray-200 rounded-lg hover:border-red-300 hover:shadow-md transition-all"
            >
              <div className="flex items-center space-x-3">
                <svg className="h-8 w-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <div>
                  <p className="font-medium text-gray-900">Find Donors</p>
                  <p className="text-sm text-gray-500">Search nearby donors</p>
                </div>
              </div>
            </Link>

            <Link
              to="/profile"
              className="p-4 border border-gray-200 rounded-lg hover:border-red-300 hover:shadow-md transition-all"
            >
              <div className="flex items-center space-x-3">
                <svg className="h-8 w-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <div>
                  <p className="font-medium text-gray-900">Update Profile</p>
                  <p className="text-sm text-gray-500">Manage your information</p>
                </div>
              </div>
            </Link>

            <a
              href="tel:108"
              className="p-4 border border-gray-200 rounded-lg hover:border-red-300 hover:shadow-md transition-all"
            >
              <div className="flex items-center space-x-3">
                <svg className="h-8 w-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <div>
                  <p className="font-medium text-gray-900">Emergency</p>
                  <p className="text-sm text-gray-500">Call 108 for ambulance</p>
                </div>
              </div>
            </a>

            <div className="p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center space-x-3">
                <svg className="h-8 w-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="font-medium text-gray-900">Help & Support</p>
                  <p className="text-sm text-gray-500">Get assistance</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;