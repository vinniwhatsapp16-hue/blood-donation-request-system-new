// User Types
export interface User {
  _id: string;
  name: string;
  email: string;
  phone: string;
  role: 'donor' | 'requester' | 'admin';
  bloodGroup?: BloodGroup;
  location: Location;
  city?: string;
  state?: string;
  isAvailable: boolean;
  lastDonation?: string;
  medicalHistory?: string;
  isVerified: boolean;
  totalDonations: number;
  rating: number;
  createdAt: string;
  updatedAt: string;
}

// Location Type
export interface Location {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
  address: string;
  city: string;
  state: string;
}

// Blood Group Type
export type BloodGroup = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';

// Blood Request Types
export interface BloodRequest {
  _id: string;
  requester: User | string;
  patientName: string;
  bloodGroup: BloodGroup;
  unitsNeeded: number;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  hospital: Hospital;
  location: Location;
  contactInfo: ContactInfo;
  medicalReason: string;
  doctorInfo: DoctorInfo;
  requiredBy: string;
  status: 'active' | 'fulfilled' | 'expired' | 'cancelled';
  responses: BloodResponse[];
  notifiedDonors: NotifiedDonor[];
  fulfillmentDetails: FulfillmentDetails;
  fraudCheck: FraudCheck;
  priority: number;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  // Additional properties for backward compatibility
  hospitalName?: string;
  hospitalAddress?: string;
  contactPerson?: string;
  contactPhone?: string;
  medicalCondition?: string;
  additionalNotes?: string;
  distance?: number;
  interestedDonors?: string[];
  fraudScore?: number;
  fraudReasons?: string[];
}

export interface Hospital {
  _id?: string;
  name: string;
  address: string;
  phone: string;
}

export interface ContactInfo {
  primaryPhone: string;
  alternatePhone?: string;
  email?: string;
  person?: string;
  phone?: string;
}

export interface DoctorInfo {
  name: string;
  phone: string;
  license?: string;
}

export interface BloodResponse {
  _id: string;
  donor: User | string;
  message?: string;
  responseDate: string;
  status: 'interested' | 'confirmed' | 'donated' | 'declined';
}

export interface NotifiedDonor {
  donor: User | string;
  notificationDate: string;
  method: 'email' | 'sms' | 'push';
}

export interface FulfillmentDetails {
  donatedUnits: number;
  donors: {
    donor: User | string;
    units: number;
    donationDate: string;
  }[];
  fulfilledDate?: string;
}

export interface FraudCheck {
  score: number;
  factors: {
    factor: string;
    weight: number;
  }[];
  isReviewed: boolean;
  reviewedBy?: User | string;
  reviewDate?: string;
  reviewNotes?: string;
}

// Form Types
export interface RegisterFormData {
  name: string;
  email: string;
  password: string;
  confirmPassword?: string;
  phone: string;
  role: 'donor' | 'requester';
  bloodGroup?: BloodGroup;
  location: {
    coordinates: [number, number];
    address: string;
    city: string;
    state: string;
  };
  medicalHistory?: string;
}

export interface LoginFormData {
  email: string;
  password: string;
}

export interface BloodRequestFormData {
  patientName: string;
  bloodGroup: BloodGroup;
  unitsNeeded: number;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  hospital: {
    name: string;
    address: string;
    phone: string;
  };
  location: {
    coordinates: [number, number];
    address: string;
    city: string;
    state: string;
  };
  contactInfo: {
    primaryPhone: string;
    alternatePhone?: string;
    email?: string;
  };
  medicalReason: string;
  doctorInfo: {
    name: string;
    phone: string;
    license?: string;
  };
  requiredBy: string;
}

// API Response Types
export interface ApiResponse<T> {
  message: string;
  data?: T;
  error?: string;
}

export interface AuthResponse {
  message: string;
  token: string;
  user: User;
}

export interface PaginationInfo {
  page: number;
  pages: number;
  total: number;
  limit: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface BloodRequestsResponse {
  bloodRequests: BloodRequest[];
  pagination: PaginationInfo;
}

export interface DonorsResponse {
  donors: User[];
  pagination?: PaginationInfo;
  count?: number;
}

// Filter Types
export interface BloodRequestFilters {
  bloodGroup?: BloodGroup;
  urgency?: 'low' | 'medium' | 'high' | 'critical';
  status?: 'active' | 'fulfilled' | 'expired' | 'cancelled';
  lat?: number;
  lng?: number;
  radius?: number;
  page?: number;
  limit?: number;
}

export interface DonorFilters {
  bloodGroup?: BloodGroup;
  city?: string;
  state?: string;
  available?: boolean;
  lat?: number;
  lng?: number;
  radius?: number;
  page?: number;
  limit?: number;
}

// Admin Types
export interface AdminDashboard {
  users: {
    donors: number;
    requesters: number;
    admins: number;
  };
  requests: {
    active: number;
    fulfilled: number;
    expired: number;
    cancelled: number;
  };
  recentRequests: BloodRequest[];
  fraudulentRequests: BloodRequest[];
  totalUsers: number;
  totalRequests: number;
}

export interface AdminAnalytics {
  userGrowth: Array<{
    _id: { date: string; role: string };
    count: number;
  }>;
  requestTrends: Array<{
    _id: { date: string; status: string };
    count: number;
  }>;
  responseRates: {
    totalRequests: number;
    requestsWithResponses: number;
    totalResponses: number;
  };
  fraudStats: {
    highFraud: number;
    mediumFraud: number;
    lowFraud: number;
    reviewed: number;
  };
}

// Toast/Notification Types
export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
}

// Map Types
export interface MapLocation {
  lat: number;
  lng: number;
  address?: string;
}

export interface MapMarker {
  id: string;
  position: [number, number];
  type: 'user' | 'request' | 'hospital' | 'donor';
  data: any;
  popup?: string;
}

// Statistics Types
export interface DonorStats {
  overall: {
    totalDonors: number;
    availableDonors: number;
    totalDonations: number;
    avgRating: number;
  };
  byBloodGroup: Array<{
    _id: BloodGroup;
    count: number;
    available: number;
  }>;
  byLocation: Array<{
    _id: string;
    count: number;
  }>;
}