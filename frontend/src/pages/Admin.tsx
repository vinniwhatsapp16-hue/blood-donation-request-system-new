import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api } from '../services/api';
import type { BloodRequest, User } from '../types';
import { formatDate, getUrgencyColor, formatDateTime } from '../utils';

interface AdminStats {
  totalUsers: number;
  totalRequests: number;
  activeRequests: number;
  completedRequests: number;
  totalDonors: number;
  totalRequesters: number;
  criticalRequests: number;
  fraudulentRequests: number;
}

const Admin: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    totalRequests: 0,
    activeRequests: 0,
    completedRequests: 0,
    totalDonors: 0,
    totalRequesters: 0,
    criticalRequests: 0,
    fraudulentRequests: 0
  });
  
  const [recentRequests, setRecentRequests] = useState<BloodRequest[]>([]);
  const [recentUsers, setRecentUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'requests' | 'users' | 'fraud'>('overview');

  useEffect(() => {
    if (user?.role === 'admin') {
      loadAdminData();
    }
  }, [user]);

  const loadAdminData = async () => {
    setLoading(true);
    try {
      // Load dashboard stats - using mock data since API might not be fully connected
      const mockRequests = [
        {
          _id: '1',
          patientName: 'John Doe',
          bloodGroup: 'O+',
          unitsNeeded: 2,
          urgency: 'critical',
          status: 'active',
          createdAt: new Date().toISOString(),
          requiredBy: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          hospital: { _id: '1', name: 'City Hospital', address: '123 Main St', phone: '9876543210' },
          contactInfo: { primaryPhone: '9876543210', person: 'Jane Smith', phone: '9876543210' },
          medicalReason: 'Surgery required',
          fraudScore: 15
        } as BloodRequest,
        {
          _id: '2',
          patientName: 'Alice Wilson',
          bloodGroup: 'A+',
          unitsNeeded: 1,
          urgency: 'high',
          status: 'active',
          createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          requiredBy: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
          hospital: { _id: '2', name: 'Rural Health Center', address: '456 Village Rd', phone: '8765432109' },
          contactInfo: { primaryPhone: '8765432109', person: 'Bob Johnson', phone: '8765432109' },
          medicalReason: 'Accident victim',
          fraudScore: 85
        } as BloodRequest
      ] as BloodRequest[];
      
      const mockUsers: User[] = [
        {
          _id: '1',
          name: 'Dr. Smith',
          email: 'smith@hospital.com',
          phone: '9876543210',
          role: 'requester',
          bloodGroup: 'B+',
          location: {
            type: 'Point',
            coordinates: [77.5946, 12.9716],
            address: '123 Hospital St',
            city: 'Bangalore',
            state: 'Karnataka'
          },
          isAvailable: true,
          isVerified: true,
          totalDonations: 0,
          rating: 4.5,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          _id: '2',
          name: 'Mary Donor',
          email: 'mary@email.com',
          phone: '8765432109',
          role: 'donor',
          bloodGroup: 'O+',
          location: {
            type: 'Point',
            coordinates: [77.6413, 12.9141],
            address: '456 Donor Ave',
            city: 'Bangalore',
            state: 'Karnataka'
          },
          isAvailable: true,
          isVerified: false,
          totalDonations: 3,
          rating: 4.8,
          createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        }
      ];
      
      setRecentRequests(mockRequests);
      setRecentUsers(mockUsers);
      
      // Calculate stats from mock data
      setStats({
        totalRequests: mockRequests.length,
        activeRequests: mockRequests.filter(r => r.status === 'active').length,
        completedRequests: mockRequests.filter(r => r.status === 'fulfilled').length,
        criticalRequests: mockRequests.filter(r => r.urgency === 'critical').length,
        fraudulentRequests: mockRequests.filter(r => r.fraudScore && r.fraudScore > 70).length,
        totalUsers: mockUsers.length,
        totalDonors: mockUsers.filter(u => u.role === 'donor').length,
        totalRequesters: mockUsers.filter(u => u.role === 'requester').length
      });
    } catch (error) {
      console.error('Error loading admin data:', error);
      showToast('Error loading admin dashboard data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRequestStatus = async (requestId: string, newStatus: string) => {
    try {
      await api.updateRequestStatus(requestId, newStatus);
      showToast(`Request status updated to ${newStatus}`, 'success');
      loadAdminData(); // Refresh data
    } catch (error) {
      console.error('Error updating request status:', error);
      showToast('Failed to update request status', 'error');
    }
  };

  const handleVerifyUser = async (userId: string, isVerified: boolean) => {
    try {
      await api.verifyUser(userId, isVerified);
      showToast(`User ${isVerified ? 'verified' : 'unverified'} successfully`, 'success');
      loadAdminData(); // Refresh data
    } catch (error) {
      console.error('Error verifying user:', error);
      showToast('Failed to verify user', 'error');
    }
  };

  const handleReviewFraud = async (requestId: string, action: 'approve' | 'reject') => {
    try {
      await api.reviewFraud(requestId, { isReviewed: true, reviewNotes: `${action}ed by admin` });
      showToast(`Fraud review ${action}d successfully`, 'success');
      loadAdminData(); // Refresh data
    } catch (error) {
      console.error('Error reviewing fraud:', error);
      showToast('Failed to review fraud case', 'error');
    }
  };

  if (user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  const StatCard: React.FC<{ title: string; value: number; icon: React.ReactNode; color: string }> = ({ title, value, icon, color }) => (
    <div className="bg-white overflow-hidden shadow rounded-lg">
      <div className="p-5">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <div className={`p-3 rounded-md ${color}`}>
              {icon}
            </div>
          </div>
          <div className="ml-5 w-0 flex-1">
            <dl>
              <dt className="text-sm font-medium text-gray-500 truncate">{title}</dt>
              <dd className="text-lg font-medium text-gray-900">{value}</dd>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="mt-2 text-gray-600">
                Monitor and manage blood donation requests and users
              </p>
            </div>
            <button
              onClick={loadAdminData}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Total Users"
            value={stats.totalUsers}
            color="bg-blue-500"
            icon={<svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
            </svg>}
          />
          
          <StatCard
            title="Active Requests"
            value={stats.activeRequests}
            color="bg-yellow-500"
            icon={<svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>}
          />
          
          <StatCard
            title="Critical Requests"
            value={stats.criticalRequests}
            color="bg-red-500"
            icon={<svg className="h-6 w-6 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>}
          />
          
          <StatCard
            title="Completed Requests"
            value={stats.completedRequests}
            color="bg-green-500"
            icon={<svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>}
          />
        </div>

        {/* Tab Navigation */}
        <div className="bg-white shadow rounded-lg mb-8">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex">
              {[
                { id: 'overview', name: 'Overview', icon: '📊' },
                { id: 'requests', name: 'Recent Requests', icon: '🩸' },
                { id: 'users', name: 'Recent Users', icon: '👥' },
                { id: 'fraud', name: 'Fraud Detection', icon: '🛡️' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm flex items-center space-x-2`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.name}</span>
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">User Distribution</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Donors</span>
                        <span className="text-sm font-medium text-gray-900">{stats.totalDonors}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Requesters</span>
                        <span className="text-sm font-medium text-gray-900">{stats.totalRequesters}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Total Users</span>
                        <span className="text-sm font-medium text-gray-900">{stats.totalUsers}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Request Analytics</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Success Rate</span>
                        <span className="text-sm font-medium text-gray-900">
                          {stats.totalRequests > 0 ? Math.round((stats.completedRequests / stats.totalRequests) * 100) : 0}%
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Fraud Detection Rate</span>
                        <span className="text-sm font-medium text-gray-900">
                          {stats.totalRequests > 0 ? Math.round((stats.fraudulentRequests / stats.totalRequests) * 100) : 0}%
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Critical Requests</span>
                        <span className="text-sm font-medium text-red-600">{stats.criticalRequests}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Recent Requests Tab */}
            {activeTab === 'requests' && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Blood Requests</h3>
                <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                  <table className="min-w-full divide-y divide-gray-300">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Patient</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Blood Group</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Urgency</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {recentRequests.map((request) => (
                        <tr key={request._id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {request.patientName}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              {request.bloodGroup}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getUrgencyColor(request.urgency)}`}>
                              {request.urgency}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              request.status === 'active' ? 'bg-yellow-100 text-yellow-800' :
                              request.status === 'fulfilled' ? 'bg-green-100 text-green-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {request.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(request.createdAt)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex space-x-2">
                              {request.status === 'active' && (
                                <button
                                  onClick={() => handleUpdateRequestStatus(request._id, 'fulfilled')}
                                  className="text-green-600 hover:text-green-900"
                                >
                                  Complete
                                </button>
                              )}
                              <button
                                onClick={() => handleUpdateRequestStatus(request._id, 'cancelled')}
                                className="text-red-600 hover:text-red-900"
                              >
                                Cancel
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Recent Users Tab */}
            {activeTab === 'users' && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Users</h3>
                <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                  <table className="min-w-full divide-y divide-gray-300">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Blood Group</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {recentUsers.map((userItem) => (
                        <tr key={userItem._id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {userItem.name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {userItem.email}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              userItem.role === 'donor' ? 'bg-green-100 text-green-800' :
                              userItem.role === 'requester' ? 'bg-blue-100 text-blue-800' :
                              'bg-purple-100 text-purple-800'
                            }`}>
                              {userItem.role}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {userItem.bloodGroup}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              userItem.isVerified ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {userItem.isVerified ? 'Verified' : 'Pending'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            {!userItem.isVerified && (
                              <button
                                onClick={() => handleVerifyUser(userItem._id, true)}
                                className="text-green-600 hover:text-green-900 mr-2"
                              >
                                Verify
                              </button>
                            )}
                            {userItem.isVerified && (
                              <button
                                onClick={() => handleVerifyUser(userItem._id, false)}
                                className="text-yellow-600 hover:text-yellow-900 mr-2"
                              >
                                Unverify
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Fraud Detection Tab */}
            {activeTab === 'fraud' && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Potential Fraudulent Requests</h3>
                <div className="space-y-4">
                  {recentRequests
                    .filter(request => request.fraudScore && request.fraudScore > 50)
                    .map((request) => (
                    <div key={request._id} className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h4 className="text-lg font-medium text-gray-900">{request.patientName}</h4>
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              Fraud Score: {request.fraudScore}%
                            </span>
                          </div>
                          <div className="text-sm text-gray-600 space-y-1">
                            <p><strong>Blood Group:</strong> {request.bloodGroup}</p>
                            <p><strong>Hospital:</strong> {request.hospital?.name || 'N/A'}</p>
                            <p><strong>Urgency:</strong> {request.urgency}</p>
                            <p><strong>Created:</strong> {formatDateTime(request.createdAt)}</p>
                            {request.fraudReasons && (
                              <div>
                                <strong>Fraud Indicators:</strong>
                                <ul className="list-disc list-inside ml-2 mt-1">
                                  {request.fraudReasons.map((reason, index) => (
                                    <li key={index} className="text-red-600">{reason}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex space-x-2 ml-4">
                          <button
                            onClick={() => handleReviewFraud(request._id, 'approve')}
                            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleReviewFraud(request._id, 'reject')}
                            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {recentRequests.filter(request => request.fraudScore && request.fraudScore > 50).length === 0 && (
                    <div className="text-center py-8">
                      <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <h3 className="mt-2 text-sm font-medium text-gray-900">No fraud detected</h3>
                      <p className="mt-1 text-sm text-gray-500">All recent requests appear to be legitimate.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Admin;