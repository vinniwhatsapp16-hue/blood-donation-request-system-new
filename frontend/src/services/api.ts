import axios from 'axios';
import type { AxiosInstance, AxiosResponse } from 'axios';
import type {
  User,
  BloodRequest,
  AuthResponse,
  BloodRequestsResponse,
  DonorsResponse,
  LoginFormData,
  RegisterFormData,
  BloodRequestFormData,
  BloodRequestFilters,
  DonorFilters,
  AdminDashboard,
  AdminAnalytics,
  DonorStats,
  ApiResponse,
} from '../types';

class ApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.api.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('authToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor to handle common errors
    this.api.interceptors.response.use(
      (response: AxiosResponse) => response,
      (error) => {
        if (error.response?.status === 401) {
          localStorage.removeItem('authToken');
          localStorage.removeItem('userData');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // Authentication APIs
  async login(data: LoginFormData): Promise<AuthResponse> {
    const response = await this.api.post<AuthResponse>('/auth/login', data);
    return response.data;
  }

  async register(data: RegisterFormData): Promise<AuthResponse> {
    const response = await this.api.post<AuthResponse>('/auth/register', data);
    return response.data;
  }

  async getCurrentUser(): Promise<User> {
    const response = await this.api.get<User>('/auth/me');
    return response.data;
  }

  async updateProfile(data: Partial<User>): Promise<ApiResponse<User>> {
    const response = await this.api.put<ApiResponse<User>>('/auth/profile', data);
    return response.data;
  }

  async changePassword(data: {
    currentPassword: string;
    newPassword: string;
  }): Promise<ApiResponse<void>> {
    const response = await this.api.post<ApiResponse<void>>('/auth/change-password', data);
    return response.data;
  }

  // Blood Request APIs
  async createBloodRequest(data: BloodRequestFormData): Promise<ApiResponse<BloodRequest>> {
    const response = await this.api.post<ApiResponse<BloodRequest>>('/blood-requests', data);
    return response.data;
  }

  async getBloodRequests(filters?: BloodRequestFilters): Promise<BloodRequestsResponse> {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
      });
    }
    const response = await this.api.get<BloodRequestsResponse>(`/blood-requests?${params}`);
    return response.data;
  }

  async getBloodRequest(id: string): Promise<BloodRequest> {
    const response = await this.api.get<BloodRequest>(`/blood-requests/${id}`);
    return response.data;
  }

  async getNearbyRequests(radius?: number): Promise<{ nearbyRequests: BloodRequest[]; donor: any }> {
    const params = radius ? `?radius=${radius}` : '';
    const response = await this.api.get<{ nearbyRequests: BloodRequest[]; donor: any }>(`/blood-requests/nearby${params}`);
    return response.data;
  }

  async getUserRequests(): Promise<ApiResponse<BloodRequest[]>> {
    const response = await this.api.get<ApiResponse<BloodRequest[]>>('/blood-requests/my-requests');
    return response.data;
  }

  async getAllRequests(): Promise<ApiResponse<BloodRequest[]>> {
    const response = await this.api.get<ApiResponse<BloodRequest[]>>('/blood-requests/all');
    return response.data;
  }

  async expressInterest(requestId: string): Promise<ApiResponse<void>> {
    const response = await this.api.post<ApiResponse<void>>(`/blood-requests/${requestId}/interest`);
    return response.data;
  }

  async respondToBloodRequest(
    requestId: string,
    data: { message?: string; status: 'interested' | 'confirmed' }
  ): Promise<ApiResponse<BloodRequest>> {
    const response = await this.api.post<ApiResponse<BloodRequest>>(
      `/blood-requests/${requestId}/respond`,
      data
    );
    return response.data;
  }

  async updateBloodRequest(
    requestId: string,
    data: Partial<BloodRequest>
  ): Promise<ApiResponse<BloodRequest>> {
    const response = await this.api.put<ApiResponse<BloodRequest>>(
      `/blood-requests/${requestId}`,
      data
    );
    return response.data;
  }

  // Donor APIs
  async getDonors(filters?: DonorFilters): Promise<DonorsResponse> {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
      });
    }
    const response = await this.api.get<DonorsResponse>(`/donors?${params}`);
    return response.data;
  }

  async getNearbyDonors(
    lat: number,
    lng: number,
    filters?: { bloodGroup?: string; radius?: number }
  ): Promise<DonorsResponse> {
    const params = new URLSearchParams({
      lat: lat.toString(),
      lng: lng.toString(),
    });
    if (filters?.bloodGroup) {
      params.append('bloodGroup', filters.bloodGroup);
    }
    if (filters?.radius) {
      params.append('radius', filters.radius.toString());
    }
    const response = await this.api.get<DonorsResponse>(`/donors/nearby?${params}`);
    return response.data;
  }

  async getDonorStats(): Promise<DonorStats> {
    const response = await this.api.get<DonorStats>('/donors/stats');
    return response.data;
  }

  // Admin APIs
  async getAdminDashboard(): Promise<AdminDashboard> {
    const response = await this.api.get<AdminDashboard>('/admin/dashboard');
    return response.data;
  }

  async getAdminUsers(filters?: {
    page?: number;
    limit?: number;
    role?: string;
    verified?: boolean;
    search?: string;
  }): Promise<{ users: User[]; pagination: any }> {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
      });
    }
    const response = await this.api.get(`/admin/users?${params}`);
    return response.data;
  }

  async getAdminRequests(filters?: {
    page?: number;
    limit?: number;
    status?: string;
    urgency?: string;
    bloodGroup?: string;
    fraudScore?: number;
  }): Promise<{ requests: BloodRequest[]; pagination: any }> {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
      });
    }
    const response = await this.api.get(`/admin/requests?${params}`);
    return response.data;
  }

  async verifyUser(userId: string, isVerified: boolean): Promise<ApiResponse<User>> {
    const response = await this.api.put<ApiResponse<User>>(`/admin/users/${userId}/verify`, {
      isVerified,
    });
    return response.data;
  }

  async reviewFraud(
    requestId: string,
    data: { isReviewed: boolean; reviewNotes?: string }
  ): Promise<ApiResponse<BloodRequest>> {
    const response = await this.api.put<ApiResponse<BloodRequest>>(
      `/admin/requests/${requestId}/review-fraud`,
      data
    );
    return response.data;
  }

  async updateRequestStatus(
    requestId: string,
    status: string
  ): Promise<ApiResponse<BloodRequest>> {
    const response = await this.api.put<ApiResponse<BloodRequest>>(
      `/admin/requests/${requestId}/status`,
      { status }
    );
    return response.data;
  }

  async getAdminDashboardStats(): Promise<any> {
    const response = await this.api.get('/admin/dashboard');
    return response.data;
  }

  async deleteUser(userId: string): Promise<ApiResponse<void>> {
    const response = await this.api.delete<ApiResponse<void>>(`/admin/users/${userId}`);
    return response.data;
  }

  async getAdminAnalytics(): Promise<AdminAnalytics> {
    const response = await this.api.get<AdminAnalytics>('/admin/analytics');
    return response.data;
  }

  // Utility methods
  setAuthToken(token: string): void {
    localStorage.setItem('authToken', token);
  }

  removeAuthToken(): void {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
  }

  getAuthToken(): string | null {
    return localStorage.getItem('authToken');
  }

  isAuthenticated(): boolean {
    return !!this.getAuthToken();
  }

  // Geolocation utilities
  async getCurrentLocation(): Promise<{ lat: number; lng: number }> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by this browser.'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000, // 5 minutes
        }
      );
    });
  }

  // Health check
  async healthCheck(): Promise<{ status: string; timestamp: string; uptime: number }> {
    const response = await this.api.get('/health');
    return response.data;
  }
}

// Create and export singleton instance
const apiService = new ApiService();
export default apiService;
export { apiService as api };