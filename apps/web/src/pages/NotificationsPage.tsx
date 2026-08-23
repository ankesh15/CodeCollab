import React, { useState, useEffect } from 'react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { NotificationSummary } from '@codecollab/shared';
import {
  fetchNotificationsApi,
  markNotificationReadApi,
  markAllNotificationsReadApi,
} from '../lib/api';
import { Bell, CheckCheck, Inbox, Check } from 'lucide-react';

export const NotificationsPage: React.FC = () => {
  const [notifications, setNotifications] = useState<NotificationSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchNotificationsApi(20)
      .then((data) => {
        setNotifications(data.notifications);
        setNextCursor(data.nextCursor);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load notifications');
        setLoading(false);
      });
  }, []);

  const handleLoadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await fetchNotificationsApi(20, nextCursor);
      setNotifications((prev) => [...prev, ...data.notifications]);
      setNextCursor(data.nextCursor);
    } catch (err) {
      console.error('Failed to load more notifications:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      const updated = await markNotificationReadApi(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? updated : n)));
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsReadApi();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between">
      <Navbar />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-200">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-2xl">
              <Bell className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Notifications</h1>
              <p className="text-xs text-slate-500">Activity and system notifications for your account</p>
            </div>
          </div>

          <button
            onClick={handleMarkAllRead}
            className="flex items-center space-x-1.5 px-4 py-2 bg-white hover:bg-slate-100 text-indigo-600 text-xs font-semibold rounded-xl border border-slate-200 transition-all shadow-sm"
          >
            <CheckCheck className="w-4 h-4" />
            <span>Mark all read</span>
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500 space-y-3">
            <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm">Loading notification history...</span>
          </div>
        ) : error ? (
          <div className="p-6 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-center text-sm">
            {error}
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500 space-y-3 bg-white border border-slate-200 rounded-3xl shadow-sm">
            <Inbox className="w-12 h-12 text-slate-300" />
            <h3 className="text-base font-semibold text-slate-800">You're all caught up 🎉</h3>
            <p className="text-xs text-slate-500">You don't have any unread notifications right now.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`p-4 rounded-2xl border transition-all flex items-start justify-between gap-4 shadow-sm ${
                  n.read
                    ? 'bg-white border-slate-200 text-slate-600'
                    : 'bg-indigo-50/50 border-indigo-200 text-slate-900'
                }`}
              >
                <div className="space-y-1 flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-700 border border-indigo-200">
                      {n.type.replace(/_/g, ' ')}
                    </span>
                    <span className="text-xs text-slate-500">
                      {new Date(n.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed">{n.message}</p>
                </div>

                {!n.read && (
                  <button
                    onClick={() => handleMarkRead(n.id)}
                    className="p-2 bg-white hover:bg-indigo-50 text-indigo-600 rounded-xl border border-slate-200 transition-all text-xs font-semibold flex items-center space-x-1 shrink-0 shadow-sm"
                    title="Mark as read"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Read</span>
                  </button>
                )}
              </div>
            ))}

            {nextCursor && (
              <div className="text-center pt-6">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="px-6 py-2.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl border border-slate-300 transition-all disabled:opacity-50 shadow-sm"
                >
                  {loadingMore ? 'Loading more...' : 'Load more notifications'}
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};
