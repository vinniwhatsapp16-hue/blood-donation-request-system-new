import React, { createContext, useContext, useReducer, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { User, LoginFormData, RegisterFormData } from '../types';
import apiService from '../services/api';

// Auth State Interface
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

// Auth Actions
type AuthAction =
  | { type: 'AUTH_START' }
  | { type: 'AUTH_SUCCESS'; payload: User }
  | { type: 'AUTH_FAILURE'; payload: string }
  | { type: 'LOGOUT' }
  | { type: 'UPDATE_USER'; payload: User }
  | { type: 'CLEAR_ERROR' };

// Initial State
const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
};

// Auth Reducer
const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case 'AUTH_START':
      return {
        ...state,
        isLoading: true,
        error: null,
      };
    case 'AUTH_SUCCESS':
      return {
        ...state,
        user: action.payload,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      };
    case 'AUTH_FAILURE':
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: action.payload,
      };
    case 'LOGOUT':
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      };
    case 'UPDATE_USER':
      return {
        ...state,
        user: action.payload,
      };
    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
      };
    default:
      return state;
  }
};

// Auth Context Interface
interface AuthContextType extends AuthState {
  login: (credentials: LoginFormData) => Promise<void>;
  register: (userData: RegisterFormData) => Promise<void>;
  logout: () => void;
  updateProfile: (userData: Partial<User>) => Promise<void>;
  changePassword: (data: { currentPassword: string; newPassword: string }) => Promise<void>;
  clearError: () => void;
  checkAuth: () => Promise<void>;
}

// Create Context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Auth Provider Props
interface AuthProviderProps {
  children: ReactNode;
}

// Auth Provider Component
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Check authentication status on app load
  useEffect(() => {
    checkAuth();
  }, []);

  // Check if user is authenticated
  const checkAuth = async () => {
    try {
      const token = apiService.getAuthToken();
      if (!token) {
        dispatch({ type: 'LOGOUT' });
        return;
      }

      dispatch({ type: 'AUTH_START' });
      const user = await apiService.getCurrentUser();
      dispatch({ type: 'AUTH_SUCCESS', payload: user });
    } catch (error: any) {
      console.error('Auth check failed:', error);
      apiService.removeAuthToken();
      dispatch({ type: 'AUTH_FAILURE', payload: 'Authentication failed' });
    }
  };

  // Login function
  const login = async (credentials: LoginFormData) => {
    try {
      dispatch({ type: 'AUTH_START' });
      const response = await apiService.login(credentials);
      
      // Store token and user data
      apiService.setAuthToken(response.token);
      localStorage.setItem('userData', JSON.stringify(response.user));
      
      dispatch({ type: 'AUTH_SUCCESS', payload: response.user });
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Login failed';
      dispatch({ type: 'AUTH_FAILURE', payload: errorMessage });
      throw new Error(errorMessage);
    }
  };

  // Register function
  const register = async (userData: RegisterFormData) => {
    try {
      dispatch({ type: 'AUTH_START' });
      const response = await apiService.register(userData);
      
      // Store token and user data
      apiService.setAuthToken(response.token);
      localStorage.setItem('userData', JSON.stringify(response.user));
      
      dispatch({ type: 'AUTH_SUCCESS', payload: response.user });
    } catch (error: any) {
      console.error('Registration error details:', error);
      const errorMessage = error.response?.data?.message || 'Registration failed';
      dispatch({ type: 'AUTH_FAILURE', payload: errorMessage });
      // Preserve the original axios error for better debugging
      throw error;
    }
  };

  // Logout function
  const logout = () => {
    apiService.removeAuthToken();
    dispatch({ type: 'LOGOUT' });
  };

  // Update profile function
  const updateProfile = async (userData: Partial<User>) => {
    try {
      const response = await apiService.updateProfile(userData);
      if (response.data) {
        localStorage.setItem('userData', JSON.stringify(response.data));
        dispatch({ type: 'UPDATE_USER', payload: response.data });
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Profile update failed';
      throw new Error(errorMessage);
    }
  };

  // Change password function
  const changePassword = async (data: { currentPassword: string; newPassword: string }) => {
    try {
      await apiService.changePassword(data);
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Password change failed';
      throw new Error(errorMessage);
    }
  };

  // Clear error function
  const clearError = () => {
    dispatch({ type: 'CLEAR_ERROR' });
  };

  // Context value
  const contextValue: AuthContextType = {
    ...state,
    login,
    register,
    logout,
    updateProfile,
    changePassword,
    clearError,
    checkAuth,
  };

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
};

// Custom hook to use auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Higher-order component for protected routes
export const withAuth = <P extends object>(Component: React.ComponentType<P>) => {
  return (props: P) => {
    const { isAuthenticated, isLoading } = useAuth();

    if (isLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="spinner h-12 w-12"></div>
        </div>
      );
    }

    if (!isAuthenticated) {
      window.location.href = '/login';
      return null;
    }

    return <Component {...props} />;
  };
};

// Role-based access control HOC
export const withRole = <P extends object>(
  Component: React.ComponentType<P>,
  allowedRoles: Array<'donor' | 'requester' | 'admin'>
) => {
  return (props: P) => {
    const { user, isAuthenticated, isLoading } = useAuth();

    if (isLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="spinner h-12 w-12"></div>
        </div>
      );
    }

    if (!isAuthenticated || !user) {
      window.location.href = '/login';
      return null;
    }

    if (!allowedRoles.includes(user.role)) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
            <p className="text-gray-600">You don't have permission to access this page.</p>
          </div>
        </div>
      );
    }

    return <Component {...props} />;
  };
};