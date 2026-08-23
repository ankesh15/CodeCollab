import React from 'react';
import { Link } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { useAuth } from '../context/AuthContext';
import { FileQuestion, ArrowRight, User, Home } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-500 selection:text-white flex flex-col justify-between">
      <Navbar />

      <main className="max-w-3xl mx-auto px-4 py-16 sm:py-24 text-center space-y-6 flex-1 flex flex-col items-center justify-center">
        <div className="p-4 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-3xl shadow-xs">
          <FileQuestion className="w-12 h-12" />
        </div>

        <div className="space-y-2">
          <span className="text-xs font-extrabold text-indigo-600 uppercase tracking-widest bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
            404 Error
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Page Not Found
          </h1>
          <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
            The page you are looking for doesn't exist, may have been moved, or is temporarily unavailable.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link
            to="/"
            className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>Go Home</span>
          </Link>

          {isAuthenticated ? (
            <Link
              to="/profile"
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer"
            >
              <User className="w-4 h-4" />
              <span>Profile Home</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          ) : (
            <Link
              to="/login"
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer"
            >
              <span>Sign In</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};
