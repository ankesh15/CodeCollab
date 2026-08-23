import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PublicOnlyRoute } from './components/PublicOnlyRoute';
import { ErrorBoundary } from './components/ErrorBoundary';

import { useAuth } from './context/AuthContext';

// Eager load critical initial routes
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';

// Lazy load secondary routes (including Monaco Editor dependencies)
const RoomsPage = lazy(() => import('./pages/RoomsPage').then((m) => ({ default: m.RoomsPage })));
const RoomPage = lazy(() => import('./pages/RoomPage').then((m) => ({ default: m.RoomPage })));
const ProblemsPage = lazy(() => import('./pages/ProblemsPage').then((m) => ({ default: m.ProblemsPage })));
const ProblemDetailPage = lazy(() => import('./pages/ProblemDetailPage').then((m) => ({ default: m.ProblemDetailPage })));
const SoloEditorPage = lazy(() => import('./pages/SoloEditorPage').then((m) => ({ default: m.SoloEditorPage })));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage').then((m) => ({ default: m.NotificationsPage })));
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage').then((m) => ({ default: m.LeaderboardPage })));
const ProfilePage = lazy(() => import('./pages/ProfilePage').then((m) => ({ default: m.ProfilePage })));
const AdminProblemsPage = lazy(() => import('./pages/AdminProblemsPage').then((m) => ({ default: m.AdminProblemsPage })));
const AdminProblemEditPage = lazy(() => import('./pages/AdminProblemEditPage').then((m) => ({ default: m.AdminProblemEditPage })));
const AdminProblemImportPage = lazy(() => import('./pages/AdminProblemImportPage').then((m) => ({ default: m.AdminProblemImportPage })));
const DevPage = lazy(() => import('./pages/DevPage').then((m) => ({ default: m.DevPage })));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })));

const PageLoader: React.FC = () => (
  <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center space-y-4 text-slate-600">
    <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest animate-pulse">
      Loading CodeCollab Workspace...
    </p>
  </div>
);

const DevRouteGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  if (!import.meta.env.DEV) {
    return <NotFoundPage />;
  }
  return <>{children}</>;
};

const AdminRouteGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <PageLoader />;
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  if (user?.role !== 'ADMIN') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mb-4 shadow-sm">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900 mb-2">403 — Access Denied</h1>
        <p className="text-sm text-slate-600 max-w-md mb-6 leading-relaxed">
          Administrator privileges are required to access this area. Your account ({user?.email || user?.username}) does not have admin permissions.
        </p>
        <a
          href="/profile"
          className="inline-flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm"
        >
          Return to Profile
        </a>
      </div>
    );
  }
  return <>{children}</>;
};

export function App(): React.JSX.Element {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Public Product Routes */}
              <Route path="/" element={<LandingPage />} />
              <Route
                path="/login"
                element={
                  <PublicOnlyRoute>
                    <LoginPage />
                  </PublicOnlyRoute>
                }
              />
              <Route
                path="/register"
                element={
                  <PublicOnlyRoute>
                    <RegisterPage />
                  </PublicOnlyRoute>
                }
              />
              <Route path="/problems" element={<ProblemsPage />} />
              <Route path="/problems/:problemId" element={<ProblemDetailPage />} />
              <Route path="/leaderboard" element={<LeaderboardPage />} />
              <Route
                path="/dev"
                element={
                  <DevRouteGuard>
                    <DevPage />
                  </DevRouteGuard>
                }
              />

              {/* Legacy /dashboard route redirects to /profile */}
              <Route path="/dashboard" element={<Navigate to="/profile" replace />} />

              {/* Authenticated Protected Routes */}
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <ProfilePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/problems/:problemId/solve"
                element={
                  <ProtectedRoute>
                    <SoloEditorPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/rooms"
                element={
                  <ProtectedRoute>
                    <RoomsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/rooms/:roomId"
                element={
                  <ProtectedRoute>
                    <RoomPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/notifications"
                element={
                  <ProtectedRoute>
                    <NotificationsPage />
                  </ProtectedRoute>
                }
              />

              {/* Admin Protected Routes */}
              <Route
                path="/admin/problems"
                element={
                  <AdminRouteGuard>
                    <AdminProblemsPage />
                  </AdminRouteGuard>
                }
              />
              <Route
                path="/admin/problems/new"
                element={
                  <AdminRouteGuard>
                    <AdminProblemEditPage />
                  </AdminRouteGuard>
                }
              />
              <Route
                path="/admin/problems/:problemId/edit"
                element={
                  <AdminRouteGuard>
                    <AdminProblemEditPage />
                  </AdminRouteGuard>
                }
              />
              <Route
                path="/admin/problems/import"
                element={
                  <AdminRouteGuard>
                    <AdminProblemImportPage />
                  </AdminRouteGuard>
                }
              />

              {/* 404 Fallback for Unknown Routes */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}
