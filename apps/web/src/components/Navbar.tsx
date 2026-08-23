import React, { useState, useEffect, useRef } from 'react';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { io, Socket } from 'socket.io-client';
import {
  NotificationSummary,
  SOCKET_EVENTS,
  NotificationNewPayload,
  NotificationCountPayload,
} from '@codecollab/shared';
import {
  Code2,
  Menu,
  X,
  Bell,
  CheckCheck,
  User,
  LogOut,
  ChevronDown,
  BookOpen,
  DoorOpen,
  Trophy,
  ShieldAlert,
} from 'lucide-react';
import {
  fetchUnreadCountApi,
  fetchNotificationsApi,
  markNotificationReadApi,
  markAllNotificationsReadApi,
} from '../lib/api';

function getInitials(name?: string): string {
  if (!name) return 'U';
  const parts = name.trim().split(/[\s_-]+/);
  const p0 = parts[0];
  const p1 = parts[1];
  if (parts.length >= 2 && p0 && p1 && p0[0] && p1[0]) {
    return (p0[0] + p1[0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export const Navbar: React.FC = () => {
  const { user, isAuthenticated, isLoading, token, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [userMenuOpen, setUserMenuOpen] = useState<boolean>(false);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState<boolean>(false);

  // Notifications state
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [notifications, setNotifications] = useState<NotificationSummary[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState<boolean>(false);

  const userMenuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);

  // Close menus on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setUserMenuOpen(false);
    setNotifDropdownOpen(false);
  }, [location.pathname]);

  // Close dropdowns on outside click or Escape key
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifDropdownOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setUserMenuOpen(false);
        setNotifDropdownOpen(false);
        setMobileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // 1. Fetch initial unread count for authenticated user
  useEffect(() => {
    if (!isAuthenticated) {
      setUnreadCount(0);
      setNotifications([]);
      return;
    }

    fetchUnreadCountApi()
      .then((data) => setUnreadCount(data.unreadCount))
      .catch((err) => console.error('Failed to fetch unread notification count:', err));
  }, [isAuthenticated]);

  // 2. Real-time notification socket listener
  useEffect(() => {
    if (!isAuthenticated || !token) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    const socketUrl =
      import.meta.env.VITE_WS_URL ||
      import.meta.env.VITE_API_BASE_URL?.replace(/\/api\/?$/, '') ||
      'http://localhost:5000';

    const socket = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on(SOCKET_EVENTS.NOTIFICATION_NEW, (payload: NotificationNewPayload) => {
      setNotifications((prev) => [payload.notification, ...prev]);
      setUnreadCount((count) => count + 1);
    });

    socket.on(SOCKET_EVENTS.NOTIFICATION_COUNT, (payload: NotificationCountPayload) => {
      setUnreadCount(payload.unreadCount);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isAuthenticated, token]);

  // Toggle notification dropdown
  const toggleNotifDropdown = async () => {
    const nextState = !notifDropdownOpen;
    setNotifDropdownOpen(nextState);
    if (userMenuOpen) setUserMenuOpen(false);

    if (nextState) {
      setLoadingNotifications(true);
      try {
        const data = await fetchNotificationsApi(10);
        setNotifications(data.notifications);
      } catch (err) {
        console.error('Failed to load notifications:', err);
      } finally {
        setLoadingNotifications(false);
      }
    }
  };

  const handleMarkAsRead = async (notifId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const updated = await markNotificationReadApi(notifId);
      setNotifications((prev) => prev.map((n) => (n.id === notifId ? updated : n)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsReadApi();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all notifications read:', err);
    }
  };

  const handleLogout = () => {
    setUserMenuOpen(false);
    setMobileMenuOpen(false);
    logout();
    navigate('/');
  };

  // NavLink style helper
  const getNavLinkClass = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
      isActive
        ? 'bg-indigo-50 text-indigo-600'
        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
    }`;

  // Skeleton Navbar during initial Auth loading to prevent flashing
  if (isLoading) {
    return (
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200 h-16 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-indigo-100 rounded-xl animate-pulse" />
            <div className="w-28 h-5 bg-slate-200 rounded animate-pulse" />
          </div>
          <div className="hidden md:flex items-center gap-4">
            <div className="w-20 h-4 bg-slate-100 rounded animate-pulse" />
            <div className="w-20 h-4 bg-slate-100 rounded animate-pulse" />
            <div className="w-24 h-4 bg-slate-100 rounded animate-pulse" />
          </div>
          <div className="w-8 h-8 bg-slate-100 rounded-full animate-pulse" />
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs transition-all h-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full">
        <div className="flex items-center justify-between h-full">
          {/* LEFT: LOGO */}
          <Link
            to={isAuthenticated ? '/profile' : '/'}
            className="flex items-center gap-2.5 group shrink-0"
          >
            <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs shadow-indigo-500/20 group-hover:bg-indigo-700 transition-colors">
              <Code2 className="w-5 h-5" />
            </div>
            <span className="text-lg font-extrabold tracking-tight text-slate-900 group-hover:text-indigo-600 transition-colors">
              CodeCollab
            </span>
          </Link>

          {/* CENTER: DESKTOP NAVIGATION LINKS */}
          <nav className="hidden md:flex items-center gap-1.5 text-xs">
            <NavLink to="/problems" className={getNavLinkClass}>
              <BookOpen className="w-3.5 h-3.5" />
              <span>Problems</span>
            </NavLink>

            {isAuthenticated && (
              <>
                <NavLink to="/rooms" className={getNavLinkClass}>
                  <DoorOpen className="w-3.5 h-3.5" />
                  <span>Rooms</span>
                </NavLink>

                <NavLink to="/leaderboard" className={getNavLinkClass}>
                  <Trophy className="w-3.5 h-3.5" />
                  <span>Leaderboard</span>
                </NavLink>
              </>
            )}
          </nav>

          {/* RIGHT: DESKTOP ACTIONS */}
          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated ? (
              <>
                {/* Notification Bell */}
                <div className="relative" ref={notifRef}>
                  <button
                    onClick={toggleNotifDropdown}
                    className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all border border-slate-200/80 cursor-pointer"
                    title="Notifications"
                  >
                    <Bell className="w-4.5 h-4.5" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-indigo-600 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full shadow-xs border border-white">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </button>

                  {/* Notification Dropdown Menu */}
                  {notifDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
                      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Bell className="w-4 h-4 text-indigo-600" />
                          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                            Notifications
                          </h4>
                        </div>
                        {unreadCount > 0 && (
                          <button
                            onClick={handleMarkAllRead}
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <CheckCheck className="w-3.5 h-3.5" />
                            Mark all read
                          </button>
                        )}
                      </div>

                      <div className="max-h-80 overflow-y-auto custom-scrollbar divide-y divide-slate-100">
                        {loadingNotifications ? (
                          <div className="p-6 text-center text-xs text-slate-500 flex items-center justify-center space-x-2">
                            <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                            <span>Loading notifications...</span>
                          </div>
                        ) : notifications.length === 0 ? (
                          <div className="p-8 text-center text-slate-500 text-xs flex flex-col items-center space-y-1">
                            <Bell className="w-6 h-6 text-slate-400 mb-1" />
                            <span>No notifications yet</span>
                          </div>
                        ) : (
                          notifications.map((notif) => (
                            <div
                              key={notif.id}
                              className={`p-3 text-xs transition-colors flex items-start justify-between gap-3 ${
                                notif.read
                                  ? 'bg-white text-slate-500'
                                  : 'bg-indigo-50/60 text-slate-900 border-l-2 border-indigo-600'
                              }`}
                            >
                              <div className="flex-1 space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-[10px] uppercase tracking-wider text-indigo-600">
                                    {notif.type.replace('_', ' ')}
                                  </span>
                                  <span className="text-[10px] text-slate-400">
                                    {new Date(notif.createdAt).toLocaleTimeString([], {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </span>
                                </div>
                                <p className="text-slate-700 leading-snug">{notif.message}</p>
                              </div>
                              {!notif.read && (
                                <button
                                  onClick={(e) => handleMarkAsRead(notif.id, e)}
                                  title="Mark read"
                                  className="text-slate-400 hover:text-indigo-600 p-1 rounded transition-colors shrink-0 cursor-pointer"
                                >
                                  ✓
                                </button>
                              )}
                            </div>
                          ))
                        )}
                      </div>

                      <div className="p-2.5 bg-slate-50 border-t border-slate-200 text-center">
                        <Link
                          to="/notifications"
                          onClick={() => setNotifDropdownOpen(false)}
                          className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors block w-full py-1"
                        >
                          View all notifications →
                        </Link>
                      </div>
                    </div>
                  )}
                </div>

                {/* Profile Pill & Dropdown Menu */}
                <div className="relative" ref={userMenuRef}>
                  <button
                    onClick={() => {
                      setUserMenuOpen(!userMenuOpen);
                      if (notifDropdownOpen) setNotifDropdownOpen(false);
                    }}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer ${
                      userMenuOpen
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                        : 'bg-slate-50 hover:bg-slate-100 border-slate-200/80 text-slate-700'
                    }`}
                  >
                    {user?.avatar ? (
                      <img
                        src={user.avatar}
                        alt={user.username}
                        className="w-6 h-6 rounded-lg object-cover border border-indigo-100"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white font-extrabold text-[11px] flex items-center justify-center tracking-wider shadow-2xs">
                        {getInitials(user?.username)}
                      </div>
                    )}
                    <span className="text-xs font-bold text-slate-800">{user?.username}</span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                        userMenuOpen ? 'rotate-180 text-indigo-600' : ''
                      }`}
                    />
                  </button>

                  {/* Compact Profile Dropdown */}
                  {userMenuOpen && (
                    <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl p-1.5 z-50 animate-in fade-in slide-in-from-top-2">
                      <div className="px-3 py-2 border-b border-slate-100 mb-1">
                        <p className="text-xs font-bold text-slate-900 truncate">{user?.username}</p>
                        <p className="text-[11px] text-slate-500 font-mono truncate">
                          @{user?.username}
                        </p>
                      </div>

                      <NavLink
                        to="/profile"
                        onClick={() => setUserMenuOpen(false)}
                        className={({ isActive }) =>
                          `flex items-center gap-2.5 px-3 py-2 text-xs rounded-xl transition-colors font-medium ${
                            isActive
                              ? 'bg-indigo-50 text-indigo-600 font-semibold'
                              : 'text-slate-700 hover:bg-slate-100'
                          }`
                        }
                      >
                        <User className="w-4 h-4 text-slate-400" />
                        <span>Profile</span>
                      </NavLink>

                      <NavLink
                        to="/notifications"
                        onClick={() => setUserMenuOpen(false)}
                        className={({ isActive }) =>
                          `flex items-center justify-between px-3 py-2 text-xs rounded-xl transition-colors font-medium ${
                            isActive
                              ? 'bg-indigo-50 text-indigo-600 font-semibold'
                              : 'text-slate-700 hover:bg-slate-100'
                          }`
                        }
                      >
                        <div className="flex items-center gap-2.5">
                          <Bell className="w-4 h-4 text-slate-400" />
                          <span>Notifications</span>
                        </div>
                        {unreadCount > 0 && (
                          <span className="bg-indigo-600 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                            {unreadCount}
                          </span>
                        )}
                      </NavLink>

                      {user?.role === 'ADMIN' && (
                        <NavLink
                          to="/admin/problems"
                          onClick={() => setUserMenuOpen(false)}
                          className={({ isActive }) =>
                            `flex items-center gap-2.5 px-3 py-2 text-xs rounded-xl transition-colors font-medium ${
                              isActive
                                ? 'bg-indigo-50 text-indigo-600 font-semibold'
                                : 'text-slate-700 hover:bg-slate-100'
                            }`
                          }
                        >
                          <ShieldAlert className="w-4 h-4 text-indigo-600" />
                          <span>Admin Panel</span>
                        </NavLink>
                      )}

                      <div className="my-1 border-t border-slate-100" />

                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-xl transition-colors text-left cursor-pointer"
                      >
                        <LogOut className="w-4 h-4 text-rose-500" />
                        <span>Logout</span>
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-xs font-bold text-slate-700 hover:text-indigo-600 transition-colors px-3 py-2"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>

          {/* MOBILE MENU TOGGLE BUTTON */}
          <div className="md:hidden flex items-center space-x-2">
            {isAuthenticated && (
              <Link
                to="/notifications"
                className="relative p-2 text-slate-600 hover:text-slate-900"
                title="Notifications"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-indigo-600 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </Link>
            )}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-slate-600 hover:text-slate-900 p-2 rounded-xl border border-slate-200"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* MOBILE MENU DROPDOWN */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-slate-200 px-4 pt-3 pb-5 space-y-2 shadow-lg animate-in fade-in slide-in-from-top-2">
          {isAuthenticated ? (
            <>
              <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between text-xs text-slate-500 mb-1">
                <span>Logged in as</span>
                <strong className="text-indigo-600 font-bold">@{user?.username}</strong>
              </div>

              <NavLink
                to="/problems"
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `block px-3 py-2 text-xs rounded-xl font-medium transition-colors ${
                    isActive ? 'bg-indigo-50 text-indigo-600 font-semibold' : 'text-slate-700 hover:bg-slate-100'
                  }`
                }
              >
                Problems
              </NavLink>

              <NavLink
                to="/rooms"
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `block px-3 py-2 text-xs rounded-xl font-medium transition-colors ${
                    isActive ? 'bg-indigo-50 text-indigo-600 font-semibold' : 'text-slate-700 hover:bg-slate-100'
                  }`
                }
              >
                Rooms
              </NavLink>

              <NavLink
                to="/leaderboard"
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `block px-3 py-2 text-xs rounded-xl font-medium transition-colors ${
                    isActive ? 'bg-indigo-50 text-indigo-600 font-semibold' : 'text-slate-700 hover:bg-slate-100'
                  }`
                }
              >
                Leaderboard
              </NavLink>

              <NavLink
                to="/notifications"
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3 py-2 text-xs rounded-xl font-medium transition-colors ${
                    isActive ? 'bg-indigo-50 text-indigo-600 font-semibold' : 'text-slate-700 hover:bg-slate-100'
                  }`
                }
              >
                <span>Notifications</span>
                {unreadCount > 0 && (
                  <span className="bg-indigo-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                    {unreadCount}
                  </span>
                )}
              </NavLink>

              <NavLink
                to="/profile"
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `block px-3 py-2 text-xs rounded-xl font-medium transition-colors ${
                    isActive ? 'bg-indigo-50 text-indigo-600 font-semibold' : 'text-slate-700 hover:bg-slate-100'
                  }`
                }
              >
                Profile
              </NavLink>

              <div className="pt-2 border-t border-slate-100">
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                >
                  Logout
                </button>
              </div>
            </>
          ) : (
            <>
              <NavLink
                to="/problems"
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `block px-3 py-2 text-xs rounded-xl font-medium transition-colors ${
                    isActive ? 'bg-indigo-50 text-indigo-600 font-semibold' : 'text-slate-700 hover:bg-slate-100'
                  }`
                }
              >
                Problems
              </NavLink>

              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 rounded-xl"
              >
                Login
              </Link>

              <Link
                to="/register"
                onClick={() => setMobileMenuOpen(false)}
                className="block w-full text-center bg-indigo-600 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-xs"
              >
                Get Started
              </Link>
            </>
          )}
        </div>
      )}
    </header>
  );
};
