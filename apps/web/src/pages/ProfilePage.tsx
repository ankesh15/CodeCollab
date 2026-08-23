import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { useAuth } from '../context/AuthContext';
import {
  fetchRooms,
  fetchProblems,
  fetchUserAnalyticsApi,
  fetchUserActivityApi,
  fetchSubmissionsApi,
  updateUserProfileApi,
} from '../lib/api';
import {
  RoomSummary,
  UserStatistics,
  ActivityPoint,
  SubmissionSummary,
  ProblemSummary,
} from '@codecollab/shared';
import { StatsCard } from '../components/StatsCard';
import { ActivityChart } from '../components/ActivityChart';
import { DifficultyBreakdown } from '../components/DifficultyBreakdown';
import {
  User as UserIcon,
  Mail,
  Calendar,
  Edit3,
  CheckCircle2,
  Trophy,
  Code2,
  Terminal,
  DoorOpen,
  ArrowRight,
  RefreshCw,
  X,
  AlertTriangle,
  Sparkles,
  ShieldAlert,
} from 'lucide-react';

export const ProfilePage: React.FC = () => {
  const { user, updateUser } = useAuth();

  // Data States
  const [statistics, setStatistics] = useState<UserStatistics | null>(null);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [activity, setActivity] = useState<ActivityPoint[]>([]);
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [recentSubmissions, setRecentSubmissions] = useState<SubmissionSummary[]>([]);

  // UI States
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasError, setHasError] = useState<boolean>(false);

  // Edit Profile Modal State
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [editBio, setEditBio] = useState<string>('');
  const [editAvatar, setEditAvatar] = useState<string>('');
  const [isSavingProfile, setIsSavingProfile] = useState<boolean>(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const loadProfileData = async () => {
    setIsLoading(true);
    setHasError(false);

    try {
      const [roomsData, problemsData, analyticsData, activityData] = await Promise.all([
        fetchRooms().catch(() => []),
        fetchProblems().catch(() => []),
        fetchUserAnalyticsApi().catch(() => ({ statistics: null, rank: null })),
        fetchUserActivityApi(30).catch(() => []),
      ]);

      // Filter out E2E verification test rooms
      const realRooms = roomsData.filter(
        (r) =>
          !r.name.startsWith('E2E-Workspace') &&
          !r.name.startsWith('E2E-Room') &&
          !r.name.includes('Chat-Test')
      );

      setRooms(realRooms);
      if (analyticsData.statistics) setStatistics(analyticsData.statistics);
      if (analyticsData.rank !== undefined) setUserRank(analyticsData.rank);
      setActivity(activityData);

      // Fetch recent submissions across problems
      if (problemsData.length > 0) {
        try {
          const submissionPromises = problemsData.slice(0, 5).map((p: ProblemSummary) =>
            fetchSubmissionsApi(p.id).catch(() => [])
          );
          const submissionsArrays = await Promise.all(submissionPromises);
          const combinedSubmissions = submissionsArrays
            .flat()
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 5);
          setRecentSubmissions(combinedSubmissions);
        } catch {
          setRecentSubmissions([]);
        }
      }
    } catch (err) {
      console.error('Failed to load profile data:', err);
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProfileData();
  }, []);

  // Open Edit Profile Modal
  const handleOpenEditModal = () => {
    setEditBio(user?.bio || '');
    setEditAvatar(user?.avatar || '');
    setEditError(null);
    setShowEditModal(true);
  };

  // Submit Edit Profile Form
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    setEditError(null);

    try {
      const updated = await updateUserProfileApi({
        bio: editBio.trim() || null,
        avatar: editAvatar.trim() || null,
      });
      updateUser(updated);
      setShowEditModal(false);
      setSuccessToast('Profile updated successfully!');
      setTimeout(() => setSuccessToast(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setEditError(msg);
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Initials Avatar Generator
  const getInitials = (name?: string) => {
    if (!name) return 'CC';
    const parts = name.trim().split(/[\s_-]+/);
    const p1 = parts[0]?.[0] || '';
    const p2 = parts[1]?.[0] || '';
    if (p1 && p2) {
      return (p1 + p2).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const isRanked = Boolean(statistics && statistics.problemsSolved > 0 && userRank !== null);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-500 selection:text-white flex flex-col justify-between">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-8 flex-1 w-full">
        {/* SUCCESS TOAST BANNER */}
        {successToast && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 px-4 py-3 rounded-2xl flex items-center justify-between text-xs font-bold shadow-xs animate-fadeIn">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successToast}</span>
            </div>
            <button onClick={() => setSuccessToast(null)} className="text-emerald-700 hover:text-emerald-900 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ERROR STATE BANNER */}
        {hasError && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center space-y-3 shadow-xs">
            <AlertTriangle className="w-8 h-8 text-rose-600 mx-auto" />
            <h3 className="text-sm font-bold text-rose-900">Unable to load developer profile</h3>
            <p className="text-xs text-rose-700 max-w-md mx-auto">
              There was an issue connecting to the service. Please verify your internet connection and try again.
            </p>
            <button
              onClick={loadProfileData}
              className="inline-flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-xs cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Try Again</span>
            </button>
          </div>
        )}

        {/* 1. PROFILE HEADER SECTION */}
        {isLoading ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 animate-pulse space-y-4 shadow-xs">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 bg-slate-200 rounded-2xl shrink-0" />
              <div className="space-y-2 flex-1">
                <div className="h-6 w-48 bg-slate-200 rounded" />
                <div className="h-4 w-32 bg-slate-100 rounded" />
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs relative overflow-hidden">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 w-full sm:w-auto">
                {/* Avatar */}
                {user?.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.username}
                    className="w-20 h-20 rounded-2xl object-cover border-2 border-indigo-100 shadow-xs shrink-0"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-700 text-white font-extrabold text-2xl flex items-center justify-center shadow-xs shrink-0 tracking-wider">
                    {getInitials(user?.username)}
                  </div>
                )}

                {/* Developer Info */}
                <div className="space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                      {user?.username}
                    </h1>
                    <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                      Active
                    </span>
                    {user?.role === 'ADMIN' && (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full">
                        <ShieldAlert className="w-3 h-3 text-indigo-600" />
                        ADMIN
                      </span>
                    )}
                  </div>

                  <p className="text-xs font-mono text-indigo-600 font-semibold">@{user?.username}</p>

                  {user?.bio ? (
                    <p className="text-xs text-slate-700 leading-relaxed font-normal pt-1 max-w-xl">
                      {user.bio}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-400 italic pt-0.5">
                      No bio set yet. Click Edit Profile to introduce yourself.
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-2 font-medium">
                    {user?.email && (
                      <span className="flex items-center gap-1.5 text-slate-600">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        {user.email}
                      </span>
                    )}
                    {user?.createdAt && (
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        Joined {new Date(user.createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Edit Profile CTA Button */}
              <button
                onClick={handleOpenEditModal}
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer shrink-0"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Profile</span>
              </button>
            </div>
          </div>
        )}

        {/* 2. STATISTICS KPI CARDS */}
        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-28 bg-white border border-slate-200 rounded-2xl animate-pulse p-4" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard
              title="Problems Solved"
              value={statistics ? statistics.problemsSolved : 0}
              subtitle="Accepted Solutions"
              icon={<CheckCircle2 className="w-5 h-5" />}
              accentColor="emerald"
            />
            <StatsCard
              title="Submissions"
              value={statistics ? statistics.totalSubmissions : 0}
              subtitle="Total Attempts"
              icon={<Code2 className="w-5 h-5" />}
              accentColor="indigo"
            />
            <StatsCard
              title="Acceptance Rate"
              value={`${statistics ? statistics.acceptanceRate : 0}%`}
              subtitle="Accuracy Ratio"
              icon={<Terminal className="w-5 h-5" />}
              accentColor="cyan"
            />
            <StatsCard
              title="Global Rank"
              value={isRanked ? `#${userRank}` : '—'}
              subtitle={isRanked ? 'Leaderboard Standing' : 'Not ranked yet'}
              icon={<Trophy className="w-5 h-5" />}
              accentColor="amber"
            />
          </div>
        )}

        {/* 3. ACTIVITY & DIFFICULTY BREAKDOWN GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Coding Activity Chart (8 cols) */}
          <div className="lg:col-span-8">
            <ActivityChart activity={activity} />
          </div>

          {/* Difficulty Breakdown (4 cols) */}
          <div className="lg:col-span-4">
            <DifficultyBreakdown
              difficulty={
                statistics
                  ? statistics.difficulty
                  : { easy: 0, medium: 0, hard: 0 }
              }
              totalSolved={statistics ? statistics.problemsSolved : 0}
            />
          </div>
        </div>

        {/* 4. RECENT SUBMISSIONS SECTION */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Terminal className="w-5 h-5 text-indigo-600" />
              Recent Submissions
            </h2>
            <Link to="/problems" className="text-xs font-bold text-indigo-600 hover:underline">
              View Problem Library →
            </Link>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-xs text-slate-400 animate-pulse">
              Loading recent submissions...
            </div>
          ) : recentSubmissions.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-3">
              <Terminal className="w-8 h-8 text-slate-300 mx-auto" />
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-800">No submissions yet</h3>
                <p className="text-xs text-slate-500">
                  Start solving problems in solo or room mode to build your submission history.
                </p>
              </div>
              <Link
                to="/problems"
                className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-xs transition-all"
              >
                <span>Browse Problems</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[500px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-3">Problem</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Language</th>
                    <th className="py-3 px-3">Runtime</th>
                    <th className="py-3 px-3">Memory</th>
                    <th className="py-3 px-3 text-right">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-mono">
                  {recentSubmissions.map((sub) => (
                    <tr key={sub.id} className="hover:bg-slate-50/80 transition-colors font-sans">
                      <td className="py-3.5 px-3 font-bold text-slate-900">{sub.problemTitle || 'Coding Problem'}</td>
                      <td className="py-3.5 px-3">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${sub.status === 'ACCEPTED'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : sub.status === 'WRONG_ANSWER'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}
                        >
                          {sub.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 font-mono text-slate-600 uppercase font-bold text-[11px]">
                        {sub.language}
                      </td>
                      <td className="py-3.5 px-3 font-mono text-slate-600">
                        {sub.executionTime ? `${sub.executionTime}ms` : '—'}
                      </td>
                      <td className="py-3.5 px-3 font-mono text-slate-600">
                        {sub.memoryUsed ? `${sub.memoryUsed}MB` : '—'}
                      </td>
                      <td className="py-3.5 px-3 text-right text-slate-400 font-sans text-[11px]">
                        {new Date(sub.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 5. CODING ROOMS & LEADERBOARD PREVIEW GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Coding Rooms (7 cols) */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <DoorOpen className="w-5 h-5 text-indigo-600" />
                Coding Rooms
              </h2>
              <Link to="/rooms" className="text-xs font-bold text-indigo-600 hover:underline">
                View All Rooms →
              </Link>
            </div>

            {isLoading ? (
              <div className="p-6 text-center text-xs text-slate-400 animate-pulse">Loading active rooms...</div>
            ) : rooms.length === 0 ? (
              <div className="p-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-2">
                <DoorOpen className="w-6 h-6 text-slate-300 mx-auto" />
                <p className="text-xs font-bold text-slate-700">No rooms joined yet</p>
                <p className="text-[11px] text-slate-500">Create or join a coding room to practice collaboratively.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {rooms.slice(0, 4).map((room) => (
                  <div
                    key={room.id}
                    className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl flex items-center justify-between hover:border-indigo-300 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-xs sm:text-sm text-slate-900 truncate">{room.name}</h3>
                        <span
                          className={`px-2 py-0.5 text-[9px] font-bold rounded ${room.isPrivate
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}
                        >
                          {room.isPrivate ? 'PRIVATE' : 'PUBLIC'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-2 font-medium">
                        <span><UserIcon className="w-3 h-3 inline text-slate-400" /> Owner: <strong>{room.ownerUsername}</strong></span>
                        <span>•</span>
                        <span>{room.memberCount} Members</span>
                      </div>
                    </div>

                    <Link
                      to={`/rooms/${room.id}`}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-3 py-1.5 rounded-xl transition-all shadow-xs flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <span>Open Room</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Leaderboard Preview Card (5 cols) */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-xs flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-500" />
                  Leaderboard
                </h2>
                <Sparkles className="w-4 h-4 text-amber-500" />
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-semibold">Current Standing:</span>
                  <span className="font-extrabold text-slate-900 text-sm">
                    {isRanked ? `#${userRank}` : 'Not ranked yet'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-semibold">Problems Solved:</span>
                  <span className="font-bold text-emerald-700">{statistics ? statistics.problemsSolved : 0}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-semibold">Acceptance Rate:</span>
                  <span className="font-bold text-indigo-700">{statistics ? `${statistics.acceptanceRate}%` : '0%'}</span>
                </div>
              </div>
            </div>

            <Link
              to="/leaderboard"
              className="w-full flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2.5 rounded-xl transition-all shadow-xs mt-4 cursor-pointer"
            >
              <span>View Full Leaderboard</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </main>

      {/* EDIT PROFILE MODAL */}
      {showEditModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-xl relative">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-base text-slate-900">Edit Profile</h3>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl text-xs font-semibold">
                {editError}
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-4">
              {/* Username (Disabled) */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Username</label>
                <input
                  type="text"
                  disabled
                  value={user?.username || ''}
                  className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-500 cursor-not-allowed"
                />
                <span className="text-[10px] text-slate-400 block">Usernames cannot be changed.</span>
              </div>

              {/* Bio Field */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Bio</label>
                <textarea
                  rows={3}
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  placeholder="Tell other developers about your skills and interests..."
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-colors"
                />
              </div>

              {/* Avatar Image URL Field */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Avatar Image URL</label>
                <input
                  type="url"
                  value={editAvatar}
                  onChange={(e) => setEditAvatar(e.target.value)}
                  placeholder="https://example.com/avatar.jpg"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-colors font-mono"
                />
                <span className="text-[10px] text-slate-400 block">Provide a direct link to an image file.</span>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-5 py-2 rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSavingProfile ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Profile</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};
