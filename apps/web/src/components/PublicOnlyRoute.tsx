import React from 'react';
import { Navigate, useSearchParams, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const PublicOnlyRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const [searchParams] = useSearchParams();
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

  if (isAuthenticated) {
    const redirectParam = searchParams.get('redirect');
    const fromState = location.state?.from?.pathname
      ? `${location.state.from.pathname}${location.state.from.search || ''}`
      : null;

    const rawTarget = redirectParam || fromState || '/profile';
    const targetPath =
      rawTarget.startsWith('/') && !rawTarget.startsWith('//') ? rawTarget : '/profile';

    return <Navigate to={targetPath} replace />;
  }

  return <>{children}</>;
};
