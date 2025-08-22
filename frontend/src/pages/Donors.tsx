import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api } from '../services/api';
import type { BloodRequest } from '../types';
import { formatDate, getUrgencyColor, getCurrentLocation, validateBloodGroupCompatibility } from '../utils';

const Donors: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  
  const [bloodRequests, setBloodRequests] = useState<BloodRequest[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<BloodRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [locationLoading, setLocationLoading] = useState(false);
  
  // Filter states
  const [filters, setFilters] = useState({
    bloodGroup: '',
    urgency: '',
    maxDistance: 20,
    sortBy: 'urgency' as 'urgency' | 'distance' | 'date',
    showCompatibleOnly: user?.bloodGroup ? true : false
  });

  const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  const urgencyLevels = ['low', 'medium', 'high', 'critical'];

  useEffect(() => {
    loadBloodRequests();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [bloodRequests, filters]);

  const loadBloodRequests = async () => {
    setLoading(true);
    try {
      // Load nearby blood requests for donors to see
      const response = await api.getNearbyRequests();
      if (response.nearbyRequests) {
        setBloodRequests(response.nearbyRequests);
      } else {
        // If no nearby requests or not authenticated, show empty array
        setBloodRequests([]);
        showToast('No nearby blood requests found', 'info');
      }
    } catch (error: any) {
      console.error('Error loading blood requests:', error);
      setBloodRequests([]);
      if (error.response?.status === 401) {
        showToast('Please login to view nearby requests', 'warning');
      } else {
        showToast('Unable to load blood requests at this time', 'warning');
      }
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...bloodRequests];

    // Filter by blood group compatibility
    if (filters.showCompatibleOnly && user?.bloodGroup) {
      filtered = filtered.filter(request => 
        user.bloodGroup && validateBloodGroupCompatibility(user.bloodGroup, request.bloodGroup)
      );
    } else if (filters.bloodGroup) {
      filtered = filtered.filter(request => request.bloodGroup === filters.bloodGroup);
    }

    // Filter by urgency
    if (filters.urgency) {
      filtered = filtered.filter(request => request.urgency === filters.urgency);
    }

    // Filter by distance
    if (filters.maxDistance && filters.maxDistance < 50) {
      filtered = filtered.filter(request => 
        !request.distance || request.distance <= filters.maxDistance
      );
    }

    // Sort results
    filtered.sort((a, b) => {
      switch (filters.sortBy) {
        case 'urgency':
          const urgencyOrder = { critical: 4, high: 3, medium: 2, low: 1 };
          return urgencyOrder[b.urgency] - urgencyOrder[a.urgency];
        case 'distance':
          return (a.distance || 999) - (b.distance || 999);
        case 'date':
          return new Date(a.requiredBy).getTime() - new Date(b.requiredBy).getTime();
        default:
          return 0;
      }
    });

    setFilteredRequests(filtered);
  };

  const handleFilterChange = (filterName: string, value: any) => {
    setFilters(prev => ({
      ...prev,
      [filterName]: value
    }));
  };

  const handleRefreshLocation = async () => {
    setLocationLoading(true);
    try {
      await getCurrentLocation();
      showToast('Location updated. Refreshing nearby requests...', 'success');
      await loadBloodRequests();
    } catch (error) {
      console.error('Location error:', error);
      showToast('Unable to get location. Please ensure location access is enabled.', 'error');
    } finally {
      setLocationLoading(false);
    }
  };

  const handleExpressInterest = async (requestId: string) => {
    try {
      await api.expressInterest(requestId);
      showToast('Interest expressed successfully! The requester will be notified.', 'success');
      // Update the request in the state to show interest expressed
      setBloodRequests(prev => prev.map(req => 
        req._id === requestId 
          ? { ...req, interestedDonors: [...(req.interestedDonors || []), user?._id || ''] }
          : req
      ));
    } catch (error: any) {
      console.error('Express interest error:', error);
      if (error.response?.status === 409) {
        showToast('You have already expressed interest in this request.', 'warning');
      } else {
        showToast('Failed to express interest. Please try again.', 'error');
      }
    }
  };

  const getUrgencyIcon = (urgency: string) => {
    switch (urgency) {
      case 'critical':
        return <svg className="h-5 w-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>;
      case 'high':
        return <svg className="h-5 w-5 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 8l2.55 3.4A1 1 0 0116 13H6a1 1 0 00-1 1v3a1 1 0 11-2 0V6z" clipRule="evenodd" />
        </svg>;
      case 'medium':
        return <svg className="h-5 w-5 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
        </svg>;
      default:
        return <svg className="h-5 w-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading blood requests...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Blood Donation Requests</h1>
              <p className="mt-2 text-gray-600">
                Find blood requests near you and save lives by donating blood.
              </p>
            </div>
            <div className="flex space-x-4">
              <button
                onClick={handleRefreshLocation}
                disabled={locationLoading}
                className={`inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 ${
                  locationLoading
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {locationLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Updating...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh Location
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Filter & Search</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Blood Group</label>
              <select
                value={filters.bloodGroup}
                onChange={(e) => handleFilterChange('bloodGroup', e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm"
              >
                <option value="">All blood groups</option>
                {bloodGroups.map(group => (
                  <option key={group} value={group}>{group}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Urgency</label>
              <select
                value={filters.urgency}
                onChange={(e) => handleFilterChange('urgency', e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm"
              >
                <option value="">All urgency levels</option>
                {urgencyLevels.map(level => (
                  <option key={level} value={level}>
                    {level.charAt(0).toUpperCase() + level.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Max Distance</label>
              <select
                value={filters.maxDistance}
                onChange={(e) => handleFilterChange('maxDistance', parseInt(e.target.value))}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm"
              >
                <option value={50}>Any distance</option>
                <option value={5}>Within 5 km</option>
                <option value={10}>Within 10 km</option>
                <option value={20}>Within 20 km</option>
                <option value={30}>Within 30 km</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
              <select
                value={filters.sortBy}
                onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm"
              >
                <option value="urgency">Urgency</option>
                <option value="distance">Distance</option>
                <option value="date">Required Date</option>
              </select>
            </div>
          </div>

          {user?.bloodGroup && (
            <div className="flex items-center">
              <input
                id="compatible-only"
                type="checkbox"
                checked={filters.showCompatibleOnly}
                onChange={(e) => handleFilterChange('showCompatibleOnly', e.target.checked)}
                className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
              />
              <label htmlFor="compatible-only" className="ml-2 block text-sm text-gray-900">
                Show only requests compatible with my blood group ({user.bloodGroup})
              </label>
            </div>
          )}
        </div>

        {/* Results Summary */}
        <div className="bg-white shadow rounded-lg p-4 mb-6">
          <p className="text-sm text-gray-600">
            Showing {filteredRequests.length} of {bloodRequests.length} requests
            {filters.maxDistance < 50 && ` within ${filters.maxDistance} km`}
          </p>
        </div>

        {/* Blood Requests List */}
        {filteredRequests.length > 0 ? (
          <div className="space-y-6">
            {filteredRequests.map((request) => (
              <div key={request._id} className="bg-white shadow rounded-lg overflow-hidden">
                <div className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        {getUrgencyIcon(request.urgency)}
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getUrgencyColor(request.urgency)}`}>
                          {request.urgency.toUpperCase()}
                        </span>
                        {request.distance && (
                          <span className="text-sm text-gray-500">
                            • {request.distance.toFixed(1)} km away
                          </span>
                        )}
                      </div>

                      <h3 className="text-xl font-semibold text-gray-900 mb-2">
                        Blood needed for {request.patientName}
                      </h3>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div className="flex items-center space-x-2">
                          <svg className="h-5 w-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                          </svg>
                          <span className="font-medium text-gray-900">{request.bloodGroup}</span>
                        </div>

                        <div className="flex items-center space-x-2">
                          <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                          <span className="text-gray-700">{request.hospitalName || request.hospital?.name}</span>
                        </div>

                        <div className="flex items-center space-x-2">
                          <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-gray-700">
                            Required by {formatDate(request.requiredBy)}
                          </span>
                        </div>
                      </div>

                      <div className="mb-4">
                        <p className="text-sm text-gray-600">
                          <strong>Units needed:</strong> {request.unitsNeeded}
                        </p>
                        <p className="text-sm text-gray-600">
                          <strong>Medical condition:</strong> {request.medicalCondition || request.medicalReason}
                        </p>
                        <p className="text-sm text-gray-600">
                          <strong>Contact:</strong> {request.contactPerson || request.contactInfo?.person} - {request.contactPhone || request.contactInfo?.phone}
                        </p>
                        <p className="text-sm text-gray-600">
                          <strong>Location:</strong> {request.hospitalAddress || request.hospital?.address}
                        </p>
                      </div>

                      {request.additionalNotes && (
                        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                          <p className="text-sm text-gray-700">
                            <strong>Additional notes:</strong> {request.additionalNotes}
                          </p>
                        </div>
                      )}

                      <div className="flex items-center space-x-2 text-sm text-gray-500">
                        <span>Posted {formatDate(request.createdAt)}</span>
                        {request.interestedDonors && request.interestedDonors.length > 0 && (
                          <>
                            <span>•</span>
                            <span>{request.interestedDonors.length} donor(s) interested</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="ml-6 flex flex-col space-y-3">
                      <button
                        onClick={() => handleExpressInterest(request._id)}
                        disabled={request.interestedDonors?.includes(user?._id || '')}
                        className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                          request.interestedDonors?.includes(user?._id || '')
                            ? 'bg-green-100 text-green-800 cursor-not-allowed'
                            : 'text-white bg-red-600 hover:bg-red-700 focus:ring-red-500'
                        }`}
                      >
                        {request.interestedDonors?.includes(user?._id || '') ? (
                          <>
                            <svg className="mr-2 h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            Interest Expressed
                          </>
                        ) : (
                          <>
                            <svg className="mr-2 h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                            </svg>
                            Express Interest
                          </>
                        )}
                      </button>

                      <a
                        href={`tel:${request.contactPhone || request.contactInfo?.phone}`}
                        className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                      >
                        <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        Call Hospital
                      </a>

                      <a
                        href={`https://maps.google.com/?q=${encodeURIComponent(request.hospitalAddress || request.hospital?.address || '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                      >
                        <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        View on Map
                      </a>
                    </div>
                  </div>
                </div>

                {user?.bloodGroup && validateBloodGroupCompatibility(user.bloodGroup, request.bloodGroup) && (
                  <div className="bg-green-50 px-6 py-3 border-t border-green-200">
                    <div className="flex items-center">
                      <svg className="h-5 w-5 text-green-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <p className="text-sm font-medium text-green-800">
                        Your blood group ({user.bloodGroup}) is compatible with this request!
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white shadow rounded-lg p-12 text-center">
            <svg className="mx-auto h-16 w-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <h3 className="text-xl font-medium text-gray-900 mb-2">No blood requests found</h3>
            <p className="text-gray-600 mb-4">
              There are no blood requests matching your current filters in your area.
            </p>
            <div className="flex justify-center space-x-4">
              <button
                onClick={() => setFilters(prev => ({ ...prev, maxDistance: 50, bloodGroup: '', urgency: '' }))}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Clear Filters
              </button>
              <button
                onClick={loadBloodRequests}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Refresh Requests
              </button>
            </div>
          </div>
        )}

        {/* Help Section */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">
                How to help donors
              </h3>
              <div className="mt-2 text-sm text-blue-700">
                <ul className="list-disc list-inside space-y-1">
                  <li>Express interest in requests you can fulfill</li>
                  <li>Contact the hospital directly for urgent cases</li>
                  <li>Check your eligibility before expressing interest</li>
                  <li>Ensure you haven't donated blood in the last 3 months</li>
                  <li>Bring a valid ID and be prepared for basic health screening</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Donors;