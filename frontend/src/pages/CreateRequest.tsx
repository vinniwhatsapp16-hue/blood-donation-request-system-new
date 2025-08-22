import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api } from '../services/api';
import { getCurrentLocation } from '../utils';

interface FormData {
  patientName: string;
  bloodGroup: string;
  unitsNeeded: number;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  hospitalName: string;
  hospitalAddress: string;
  contactPerson: string;
  contactPhone: string;
  medicalCondition: string;
  requiredBy: string;
  additionalNotes: string;
  latitude?: number;
  longitude?: number;
}

const CreateRequest: React.FC = () => {
  const [formData, setFormData] = useState<FormData>({
    patientName: '',
    bloodGroup: '',
    unitsNeeded: 1,
    urgency: 'medium',
    hospitalName: '',
    hospitalAddress: '',
    contactPerson: '',
    contactPhone: '',
    medicalCondition: '',
    requiredBy: '',
    additionalNotes: '',
  });

  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  const urgencyLevels = [
    { value: 'low', label: 'Low', color: 'text-green-600', description: 'Within 7 days' },
    { value: 'medium', label: 'Medium', color: 'text-yellow-600', description: 'Within 3 days' },
    { value: 'high', label: 'High', color: 'text-orange-600', description: 'Within 24 hours' },
    { value: 'critical', label: 'Critical', color: 'text-red-600', description: 'Emergency - Immediate need' },
  ];

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.patientName.trim()) {
      newErrors.patientName = 'Patient name is required';
    }

    if (!formData.bloodGroup) {
      newErrors.bloodGroup = 'Blood group is required';
    }

    if (!formData.unitsNeeded || formData.unitsNeeded < 1 || formData.unitsNeeded > 10) {
      newErrors.unitsNeeded = 'Units needed must be between 1 and 10';
    }

    if (!formData.hospitalName.trim()) {
      newErrors.hospitalName = 'Hospital name is required';
    }

    if (!formData.hospitalAddress.trim()) {
      newErrors.hospitalAddress = 'Hospital address is required';
    }

    if (!formData.contactPerson.trim()) {
      newErrors.contactPerson = 'Contact person is required';
    }

    if (!formData.contactPhone) {
      newErrors.contactPhone = 'Contact phone is required';
    } else if (!/^\d{10}$/.test(formData.contactPhone.replace(/\D/g, ''))) {
      newErrors.contactPhone = 'Phone number must be 10 digits';
    }

    if (!formData.medicalCondition.trim()) {
      newErrors.medicalCondition = 'Medical condition is required';
    }

    if (!formData.requiredBy) {
      newErrors.requiredBy = 'Required by date is required';
    } else {
      const requiredDate = new Date(formData.requiredBy);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (requiredDate < today) {
        newErrors.requiredBy = 'Required by date cannot be in the past';
      }
    }

    if (!formData.latitude || !formData.longitude) {
      newErrors.location = 'Hospital location is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseInt(value) || 0 : value
    }));

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleGetLocation = async () => {
    setLocationLoading(true);
    try {
      const location = await getCurrentLocation();
      setFormData(prev => ({
        ...prev,
        latitude: location.latitude,
        longitude: location.longitude
      }));
      showToast('Hospital location obtained successfully!', 'success');
      
      // Clear location error
      if (errors.location) {
        setErrors(prev => ({
          ...prev,
          location: ''
        }));
      }
    } catch (error) {
      console.error('Location error:', error);
      showToast('Unable to get location. Please ensure location access is enabled.', 'error');
    } finally {
      setLocationLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      showToast('Please fix the errors and try again.', 'error');
      return;
    }

    setLoading(true);
    try {
      const requestData = {
        patientName: formData.patientName.trim(),
        bloodGroup: formData.bloodGroup,
        unitsNeeded: formData.unitsNeeded,
        urgency: formData.urgency,
        hospital: {
          name: formData.hospitalName.trim(),
          address: formData.hospitalAddress.trim(),
          phone: formData.contactPhone.replace(/\D/g, '')
        },
        contactInfo: {
          primaryPhone: formData.contactPhone.replace(/\D/g, ''),
          person: formData.contactPerson.trim(),
          phone: formData.contactPhone.replace(/\D/g, '')
        },
        medicalReason: formData.medicalCondition.trim(),
        doctorInfo: {
          name: 'Dr. ' + formData.contactPerson.trim(),
          phone: formData.contactPhone.replace(/\D/g, '')
        },
        requiredBy: formData.requiredBy,
        location: {
          type: 'Point' as const,
          coordinates: [formData.longitude!, formData.latitude!],
          address: formData.hospitalAddress.trim(),
          city: '',
          state: ''
        },
        // Additional properties for backward compatibility
        hospitalName: formData.hospitalName.trim(),
        hospitalAddress: formData.hospitalAddress.trim(),
        contactPerson: formData.contactPerson.trim(),
        contactPhone: formData.contactPhone.replace(/\D/g, ''),
        medicalCondition: formData.medicalCondition.trim(),
        additionalNotes: formData.additionalNotes.trim()
      } as any;

      const response = await api.createBloodRequest(requestData);
      
      if (response.data) {
        showToast('Blood request created successfully! Donors will be notified.', 'success');
        navigate('/dashboard');
      } else {
        showToast(response.message || 'Failed to create blood request.', 'error');
      }
    } catch (error: any) {
      console.error('Create request error:', error);
      
      if (error.response?.status === 400) {
        showToast(error.response.data.message || 'Invalid request data.', 'error');
      } else if (error.response?.status === 429) {
        showToast('Too many requests. Please wait before creating another request.', 'error');
      } else {
        showToast('Failed to create blood request. Please try again.', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    navigate('/login');
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow-xl rounded-lg">
          <div className="px-6 py-8 border-b border-gray-200">
            <h1 className="text-3xl font-bold text-gray-900">Create Blood Request</h1>
            <p className="mt-2 text-gray-600">
              Fill out this form to request blood donation. We'll notify nearby donors immediately.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="px-6 py-8 space-y-8">
            {/* Patient Information */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Patient Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="patientName" className="block text-sm font-medium text-gray-700">
                    Patient Name *
                  </label>
                  <input
                    type="text"
                    name="patientName"
                    id="patientName"
                    value={formData.patientName}
                    onChange={handleChange}
                    className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm ${
                      errors.patientName ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Enter patient's full name"
                  />
                  {errors.patientName && <p className="mt-1 text-sm text-red-600">{errors.patientName}</p>}
                </div>

                <div>
                  <label htmlFor="bloodGroup" className="block text-sm font-medium text-gray-700">
                    Blood Group Required *
                  </label>
                  <select
                    name="bloodGroup"
                    id="bloodGroup"
                    value={formData.bloodGroup}
                    onChange={handleChange}
                    className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm ${
                      errors.bloodGroup ? 'border-red-300' : 'border-gray-300'
                    }`}
                  >
                    <option value="">Select blood group</option>
                    {bloodGroups.map(group => (
                      <option key={group} value={group}>{group}</option>
                    ))}
                  </select>
                  {errors.bloodGroup && <p className="mt-1 text-sm text-red-600">{errors.bloodGroup}</p>}
                </div>

                <div>
                  <label htmlFor="unitsNeeded" className="block text-sm font-medium text-gray-700">
                    Units Needed *
                  </label>
                  <input
                    type="number"
                    name="unitsNeeded"
                    id="unitsNeeded"
                    min="1"
                    max="10"
                    value={formData.unitsNeeded}
                    onChange={handleChange}
                    className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm ${
                      errors.unitsNeeded ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Number of units needed"
                  />
                  {errors.unitsNeeded && <p className="mt-1 text-sm text-red-600">{errors.unitsNeeded}</p>}
                </div>

                <div>
                  <label htmlFor="urgency" className="block text-sm font-medium text-gray-700">
                    Urgency Level *
                  </label>
                  <select
                    name="urgency"
                    id="urgency"
                    value={formData.urgency}
                    onChange={handleChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm"
                  >
                    {urgencyLevels.map(level => (
                      <option key={level.value} value={level.value}>
                        {level.label} - {level.description}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label htmlFor="medicalCondition" className="block text-sm font-medium text-gray-700">
                    Medical Condition *
                  </label>
                  <textarea
                    name="medicalCondition"
                    id="medicalCondition"
                    rows={3}
                    value={formData.medicalCondition}
                    onChange={handleChange}
                    className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm ${
                      errors.medicalCondition ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Describe the medical condition requiring blood transfusion"
                  />
                  {errors.medicalCondition && <p className="mt-1 text-sm text-red-600">{errors.medicalCondition}</p>}
                </div>
              </div>
            </div>

            {/* Hospital Information */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Hospital Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="hospitalName" className="block text-sm font-medium text-gray-700">
                    Hospital Name *
                  </label>
                  <input
                    type="text"
                    name="hospitalName"
                    id="hospitalName"
                    value={formData.hospitalName}
                    onChange={handleChange}
                    className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm ${
                      errors.hospitalName ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Enter hospital name"
                  />
                  {errors.hospitalName && <p className="mt-1 text-sm text-red-600">{errors.hospitalName}</p>}
                </div>

                <div>
                  <label htmlFor="requiredBy" className="block text-sm font-medium text-gray-700">
                    Required By *
                  </label>
                  <input
                    type="datetime-local"
                    name="requiredBy"
                    id="requiredBy"
                    value={formData.requiredBy}
                    onChange={handleChange}
                    min={new Date().toISOString().slice(0, 16)}
                    className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm ${
                      errors.requiredBy ? 'border-red-300' : 'border-gray-300'
                    }`}
                  />
                  {errors.requiredBy && <p className="mt-1 text-sm text-red-600">{errors.requiredBy}</p>}
                </div>

                <div className="md:col-span-2">
                  <label htmlFor="hospitalAddress" className="block text-sm font-medium text-gray-700">
                    Hospital Address *
                  </label>
                  <textarea
                    name="hospitalAddress"
                    id="hospitalAddress"
                    rows={2}
                    value={formData.hospitalAddress}
                    onChange={handleChange}
                    className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm ${
                      errors.hospitalAddress ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Enter complete hospital address"
                  />
                  {errors.hospitalAddress && <p className="mt-1 text-sm text-red-600">{errors.hospitalAddress}</p>}
                </div>

                <div className="md:col-span-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-gray-700">
                      Hospital Location *
                    </label>
                    <button
                      type="button"
                      onClick={handleGetLocation}
                      disabled={locationLoading}
                      className={`inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 ${
                        locationLoading
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : formData.latitude && formData.longitude
                          ? 'bg-green-50 text-green-700 border-green-300'
                          : 'bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {locationLoading ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Getting location...
                        </>
                      ) : formData.latitude && formData.longitude ? (
                        <>
                          <svg className="h-4 w-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          Location obtained
                        </>
                      ) : (
                        <>
                          <svg className="h-4 w-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                          </svg>
                          Get hospital location
                        </>
                      )}
                    </button>
                  </div>
                  {errors.location && <p className="mt-1 text-sm text-red-600">{errors.location}</p>}
                  <p className="mt-1 text-xs text-gray-500">
                    Click the button to get the hospital's current location for accurate donor matching
                  </p>
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Contact Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="contactPerson" className="block text-sm font-medium text-gray-700">
                    Contact Person *
                  </label>
                  <input
                    type="text"
                    name="contactPerson"
                    id="contactPerson"
                    value={formData.contactPerson}
                    onChange={handleChange}
                    className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm ${
                      errors.contactPerson ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Name of contact person"
                  />
                  {errors.contactPerson && <p className="mt-1 text-sm text-red-600">{errors.contactPerson}</p>}
                </div>

                <div>
                  <label htmlFor="contactPhone" className="block text-sm font-medium text-gray-700">
                    Contact Phone *
                  </label>
                  <input
                    type="tel"
                    name="contactPhone"
                    id="contactPhone"
                    value={formData.contactPhone}
                    onChange={handleChange}
                    className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm ${
                      errors.contactPhone ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Contact phone number"
                  />
                  {errors.contactPhone && <p className="mt-1 text-sm text-red-600">{errors.contactPhone}</p>}
                </div>
              </div>
            </div>

            {/* Additional Information */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Additional Information</h3>
              <div>
                <label htmlFor="additionalNotes" className="block text-sm font-medium text-gray-700">
                  Additional Notes
                </label>
                <textarea
                  name="additionalNotes"
                  id="additionalNotes"
                  rows={4}
                  value={formData.additionalNotes}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm"
                  placeholder="Any additional information that might be helpful for donors..."
                />
                <p className="mt-1 text-xs text-gray-500">
                  Provide any additional details like visiting hours, parking information, or special instructions
                </p>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="px-6 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className={`px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 ${
                  loading
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Creating Request...
                  </>
                ) : (
                  'Create Blood Request'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateRequest;