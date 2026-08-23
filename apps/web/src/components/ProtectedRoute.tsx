import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500 font-medium">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-semibold">Verifying session...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    const fullPath = `${location.pathname}${location.search}`;
    const loginTarget = `/login?redirect=${encodeURIComponent(fullPath)}`;
    return <Navigate to={loginTarget} state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
