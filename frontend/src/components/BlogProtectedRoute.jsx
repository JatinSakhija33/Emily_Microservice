import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import BlogLogin from './BlogLogin';

const BlogProtectedRoute = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);
  const location = useLocation();

  useEffect(() => {
    // Check if user is logged in
    const checkAuth = () => {
      const auth = localStorage.getItem('blogAuth');
      const authTime = localStorage.getItem('blogAuthTime');
      
      if (auth === 'true' && authTime) {
        // Check if login is still valid (24 hours)
        const timeDiff = Date.now() - parseInt(authTime);
        const hoursDiff = timeDiff / (1000 * 60 * 60);
        
        if (hoursDiff < 24) {
          setIsAuthenticated(true);
        } else {
          // Expired, clear auth
          localStorage.removeItem('blogAuth');
          localStorage.removeItem('blogAuthTime');
          setIsAuthenticated(false);
        }
      } else {
        setIsAuthenticated(false);
      }
      setChecking(false);
    };

    checkAuth();

    // Listen for storage changes (when login happens in another tab/window)
    const handleStorageChange = (e) => {
      if (e.key === 'blogAuth' || e.key === 'blogAuthTime') {
        checkAuth();
      }
    };

    // Listen for custom auth change event
    const handleAuthChange = () => {
      checkAuth();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('blogAuthChange', handleAuthChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('blogAuthChange', handleAuthChange);
    };
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#9E005C] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Checking authentication...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <BlogLogin />;
  }

  return children;
};

export default BlogProtectedRoute;

