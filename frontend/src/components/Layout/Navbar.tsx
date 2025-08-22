import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { 
  Heart, 
  Menu, 
  X, 
  User, 
  LogOut, 
  Settings, 
  Shield,
  Droplets,
  Search,
  Plus
} from 'lucide-react';

const Navbar: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const { isAuthenticated, user, logout } = useAuth();
  const { success } = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    success('Logged out successfully');
    navigate('/');
    setIsProfileDropdownOpen(false);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const isActivePath = (path: string) => {
    return location.pathname === path;
  };

  const publicNavItems = [
    { path: '/', label: 'Home', icon: Heart },
    { path: '/donors', label: 'Find Donors', icon: Search },
  ];

  const authenticatedNavItems = [
    { path: '/dashboard', label: 'Dashboard', icon: Heart },
    { path: '/blood-requests', label: 'Blood Requests', icon: Droplets },
    ...(user?.role === 'requester' || user?.role === 'admin' 
      ? [{ path: '/blood-requests/create', label: 'Create Request', icon: Plus }] 
      : []
    ),
    { path: '/donors', label: 'Find Donors', icon: Search },
  ];

  const adminNavItems = [
    { path: '/admin/dashboard', label: 'Admin', icon: Shield },
  ];

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link 
              to="/" 
              className="flex items-center space-x-2 text-blood-600 hover:text-blood-700 transition-colors"
            >
              <Heart className="h-8 w-8" />
              <span className="font-bold text-xl hidden sm:block">BloodDonate</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {isAuthenticated ? (
              <>
                {/* Authenticated Navigation */}
                {authenticatedNavItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        isActivePath(item.path)
                          ? 'text-blood-600 bg-blood-50'
                          : 'text-gray-700 hover:text-blood-600 hover:bg-gray-50'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}

                {/* Admin Navigation */}
                {user?.role === 'admin' && adminNavItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        location.pathname.startsWith('/admin')
                          ? 'text-blood-600 bg-blood-50'
                          : 'text-gray-700 hover:text-blood-600 hover:bg-gray-50'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </>
            ) : (
              <>
                {/* Public Navigation */}
                {publicNavItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        isActivePath(item.path)
                          ? 'text-blood-600 bg-blood-50'
                          : 'text-gray-700 hover:text-blood-600 hover:bg-gray-50'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </>
            )}
          </div>

          {/* Right side items */}
          <div className="hidden md:flex items-center space-x-4">
            {isAuthenticated ? (
              /* Profile Dropdown */
              <div className="relative">
                <button
                  onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                  className="flex items-center space-x-2 text-gray-700 hover:text-blood-600 focus:outline-none focus:ring-2 focus:ring-blood-500 focus:ring-offset-2 rounded-md p-2"
                >
                  <div className="h-8 w-8 bg-blood-100 rounded-full flex items-center justify-center">
                    <User className="h-5 w-5 text-blood-600" />
                  </div>
                  <span className="text-sm font-medium">{user?.name}</span>
                </button>

                {/* Dropdown Menu */}
                {isProfileDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200">
                    <div className="px-4 py-2 border-b border-gray-100">
                      <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                      <p className="text-xs text-gray-500">{user?.email}</p>
                      <p className="text-xs text-gray-400 capitalize">{user?.role}</p>
                    </div>
                    
                    <Link
                      to="/profile"
                      className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setIsProfileDropdownOpen(false)}
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Profile Settings
                    </Link>
                    
                    <button
                      onClick={handleLogout}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* Auth Buttons */
              <div className="flex items-center space-x-2">
                <Link
                  to="/login"
                  className="text-gray-700 hover:text-blood-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="btn-primary text-sm"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="text-gray-700 hover:text-blood-600 focus:outline-none focus:ring-2 focus:ring-blood-500 focus:ring-offset-2 rounded-md p-2"
            >
              {isMobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-gray-200 bg-white">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            {isAuthenticated ? (
              <>
                {/* User Info */}
                <div className="px-3 py-2 border-b border-gray-100 mb-2">
                  <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                  <p className="text-xs text-gray-500">{user?.email}</p>
                  <p className="text-xs text-gray-400 capitalize">{user?.role}</p>
                </div>

                {/* Authenticated Mobile Navigation */}
                {authenticatedNavItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium ${
                        isActivePath(item.path)
                          ? 'text-blood-600 bg-blood-50'
                          : 'text-gray-700 hover:text-blood-600 hover:bg-gray-50'
                      }`}
                      onClick={closeMobileMenu}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}

                {/* Admin Mobile Navigation */}
                {user?.role === 'admin' && adminNavItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium ${
                        location.pathname.startsWith('/admin')
                          ? 'text-blood-600 bg-blood-50'
                          : 'text-gray-700 hover:text-blood-600 hover:bg-gray-50'
                      }`}
                      onClick={closeMobileMenu}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}

                {/* Mobile Profile & Logout */}
                <div className="border-t border-gray-100 pt-2 mt-2">
                  <Link
                    to="/profile"
                    className="flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-blood-600 hover:bg-gray-50"
                    onClick={closeMobileMenu}
                  >
                    <Settings className="h-4 w-4" />
                    <span>Profile Settings</span>
                  </Link>
                  
                  <button
                    onClick={handleLogout}
                    className="flex items-center space-x-2 w-full px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-blood-600 hover:bg-gray-50"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Public Mobile Navigation */}
                {publicNavItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium ${
                        isActivePath(item.path)
                          ? 'text-blood-600 bg-blood-50'
                          : 'text-gray-700 hover:text-blood-600 hover:bg-gray-50'
                      }`}
                      onClick={closeMobileMenu}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}

                {/* Mobile Auth Buttons */}
                <div className="border-t border-gray-100 pt-2 mt-2 space-y-1">
                  <Link
                    to="/login"
                    className="block px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-blood-600 hover:bg-gray-50"
                    onClick={closeMobileMenu}
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/register"
                    className="block px-3 py-2 rounded-md text-sm font-medium bg-blood-600 text-white hover:bg-blood-700"
                    onClick={closeMobileMenu}
                  >
                    Sign Up
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Overlay for profile dropdown */}
      {isProfileDropdownOpen && (
        <div
          className="fixed inset-0 z-30"
          onClick={() => setIsProfileDropdownOpen(false)}
        />
      )}
    </nav>
  );
};

export default Navbar;