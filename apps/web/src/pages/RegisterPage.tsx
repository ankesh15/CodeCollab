import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../lib/api';
import {
  Code2,
  User,
  Mail,
  Lock,
  AlertCircle,
  Eye,
  EyeOff,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  ShieldCheck,
  Zap,
  BarChart3,
  Loader2,
} from 'lucide-react';

export const RegisterPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();

  const redirectParam = searchParams.get('redirect');
  const fromState = location.state?.from?.pathname
    ? `${location.state.from.pathname}${location.state.from.search || ''}`
    : null;
  const rawTarget = redirectParam || fromState || '/profile';
  const targetPath =
    rawTarget.startsWith('/') && !rawTarget.startsWith('//') ? rawTarget : '/profile';

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Client-side password helpers
  const isMinLength = password.length >= 8;
  const isMatch = password === confirmPassword;
  const isConfirmTouched = confirmPassword.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    if (!isMinLength) {
      setErrorMsg('Password must be at least 8 characters long.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || 'Registration failed');
      }

      login(data.data.token, data.data.user);
      navigate(targetPath, { replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(
        msg.includes('Failed to fetch')
          ? 'Unable to connect to server. Please check your network connection.'
          : msg
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-500 selection:text-white flex flex-col">
      {/* MINIMAL NAVIGATION BAR */}
      <header className="bg-white border-b border-slate-200 px-4 sm:px-8 py-3.5 flex items-center justify-between z-10">
        <Link to="/" className="flex items-center gap-2.5 text-slate-900 hover:opacity-90 transition-opacity">
          <div className="p-1.5 bg-indigo-600 text-white rounded-lg shadow-xs">
            <Code2 className="w-5 h-5" />
          </div>
          <span className="font-bold text-base tracking-tight">CodeCollab</span>
        </Link>

        <Link
          to="/"
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-indigo-600 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Home</span>
        </Link>
      </header>

      {/* MAIN TWO-COLUMN CONTAINER */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-[calc(100vh-57px)]">
        {/* LEFT COLUMN: BRANDING & PRODUCT HIGHLIGHTS (DESKTOP ONLY) */}
        <div className="hidden lg:flex lg:col-span-6 bg-slate-100/70 border-r border-slate-200 p-12 flex-col justify-between relative overflow-hidden">
          {/* Subtle Accent Shapes */}
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-indigo-100/60 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-emerald-100/50 rounded-full blur-3xl pointer-events-none" />

          {/* Top Brand Message */}
          <div className="space-y-6 relative z-10 max-w-lg">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold tracking-wide uppercase shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>Real-Time Developer SaaS</span>
            </div>

            <div className="space-y-3">
              <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
                Build together.{' '}
                <span className="text-indigo-600 block">Learn together.</span>
              </h1>
              <p className="text-sm text-slate-600 leading-relaxed font-normal">
                Create an account and start solving coding problems in real time with your team.
              </p>
            </div>

            {/* 3 Key Benefits */}
            <div className="space-y-3.5 pt-4">
              <div className="flex items-center gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                <div className="p-2 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-lg">
                  <Zap className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-slate-800">
                  Real-time collaborative Monaco code editing
                </span>
              </div>

              <div className="flex items-center gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                <div className="p-2 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-lg">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-slate-800">
                  Secure sandboxed code execution environment
                </span>
              </div>

              <div className="flex items-center gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                <div className="p-2 bg-amber-50 border border-amber-100 text-amber-600 rounded-lg">
                  <BarChart3 className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-slate-800">
                  Developer progress tracking & leaderboards
                </span>
              </div>
            </div>
          </div>

          {/* Abstract Code Snippet Card */}
          <div className="relative z-10 bg-slate-900 rounded-2xl p-4 font-mono text-[11px] text-slate-300 space-y-1.5 border border-slate-800 shadow-lg max-w-lg">
            <div className="flex items-center justify-between text-slate-500 pb-2 border-b border-slate-800 text-[10px]">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Create Account & Join Room
              </span>
              <span className="text-indigo-400">CodeCollab v1.0</span>
            </div>
            <div>
              <span className="text-purple-400">struct</span> <span className="text-yellow-300 font-bold">Developer</span> {'{'}
            </div>
            <div>
              <span className="pl-4 text-blue-400">string</span> username;
            </div>
            <div>
              <span className="pl-4 text-blue-400">bool</span> isCollaborating = <span className="text-amber-400">true</span>;
            </div>
            <div>{'}'};</div>
          </div>
        </div>

        {/* RIGHT COLUMN: REGISTER FORM CARD */}
        <div className="lg:col-span-6 flex items-center justify-center p-6 sm:p-12 bg-white sm:bg-slate-50">
          <div className="w-full max-w-md bg-white border-0 sm:border sm:border-slate-200 rounded-2xl p-6 sm:p-8 sm:shadow-md space-y-6">
            {/* Form Header */}
            <div className="space-y-2 text-left">
              <div className="inline-flex p-2.5 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-xl mb-1">
                <Code2 className="w-5 h-5" />
              </div>
              <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Create your account</h2>
              <p className="text-xs text-slate-500">Start collaborating on coding problems with CodeCollab.</p>
            </div>

            {/* Error Notification Banner */}
            {errorMsg && (
              <div className="bg-rose-50 border border-rose-200 p-3.5 rounded-xl flex items-start gap-3 text-rose-700 text-xs font-medium animate-fadeIn">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">Unable to create account</span>
                  <span className="text-rose-600">{errorMsg}</span>
                </div>
              </div>
            )}

            {/* Registration Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Username Input */}
              <div className="space-y-1.5 text-left">
                <label htmlFor="username" className="text-xs font-bold text-slate-700 block">
                  Username
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                  <input
                    id="username"
                    type="text"
                    required
                    autoComplete="username"
                    placeholder="dev_hero"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 transition-all font-sans"
                  />
                </div>
              </div>

              {/* Email Input */}
              <div className="space-y-1.5 text-left">
                <label htmlFor="email" className="text-xs font-bold text-slate-700 block">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="developer@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 transition-all font-sans"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1.5 text-left">
                <label htmlFor="password" className="text-xs font-bold text-slate-700 block">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl pl-10 pr-10 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 transition-all font-sans"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600 focus:outline-none transition-colors"
                    title={showPassword ? 'Hide password' : 'Show password'}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {password.length > 0 && (
                  <div className="pt-1 flex items-center gap-1.5 text-[11px]">
                    <CheckCircle2 className={`w-3.5 h-3.5 ${isMinLength ? 'text-emerald-600' : 'text-slate-300'}`} />
                    <span className={isMinLength ? 'text-emerald-700 font-semibold' : 'text-slate-500'}>
                      At least 8 characters
                    </span>
                  </div>
                )}
              </div>

              {/* Confirm Password Input */}
              <div className="space-y-1.5 text-left">
                <label htmlFor="confirmPassword" className="text-xs font-bold text-slate-700 block">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                  <input
                    id="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    placeholder="••••••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`w-full bg-white border ${
                      isConfirmTouched && !isMatch ? 'border-rose-400' : 'border-slate-300'
                    } rounded-xl pl-10 pr-10 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 transition-all font-sans`}
                  />
                </div>
                {isConfirmTouched && !isMatch && (
                  <p className="text-[11px] font-semibold text-rose-600 pt-0.5">Passwords do not match.</p>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || (isConfirmTouched && !isMatch)}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold py-3 rounded-xl text-sm transition-all shadow-xs active:scale-95 flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Creating account...</span>
                  </>
                ) : (
                  <>
                    <span>Create Account</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Login CTA */}
            <div className="pt-2 border-t border-slate-100 text-center text-xs text-slate-500">
              Already have an account?{' '}
              <Link
                to={targetPath !== '/profile' ? `/login?redirect=${encodeURIComponent(targetPath)}` : '/login'}
                className="text-indigo-600 font-bold hover:text-indigo-700 hover:underline"
              >
                Sign in →
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
