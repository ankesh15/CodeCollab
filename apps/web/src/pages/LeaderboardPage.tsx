import React, { useState, useEffect } from 'react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { LeaderboardTable } from '../components/LeaderboardTable';
import { fetchLeaderboardApi } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { LeaderboardEntry } from '@codecollab/shared';
import { Trophy, Award, ChevronLeft, ChevronRight } from 'lucide-react';

export const LeaderboardPage: React.FC = () => {
  const { user } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [currentUserRank, setCurrentUserRank] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const limit = 20;

  useEffect(() => {
    const loadLeaderboard = async () => {
      setIsLoading(true);
      try {
        const data = await fetchLeaderboardApi(limit);
        setEntries(data.leaderboard);
        if (data.currentUserRank !== undefined) setCurrentUserRank(data.currentUserRank);
        setNextCursor(data.nextCursor || null);
        if (data.totalCount !== undefined) setTotalCount(data.totalCount);
      } catch (err) {
        console.error('Failed to load global leaderboard:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadLeaderboard();
  }, []);

  const handleNextPage = async () => {
    if (!nextCursor) return;
    setIsLoading(true);
    try {
      const data = await fetchLeaderboardApi(limit, nextCursor);
      setEntries(data.leaderboard);
      setNextCursor(data.nextCursor || null);
      setPage((prev) => prev + 1);
    } catch (err) {
      console.error('Failed to fetch next leaderboard page:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrevPage = async () => {
    if (page <= 1) return;
    const prevCursor = ((page - 2) * limit).toString();
    setIsLoading(true);
    try {
      const data = await fetchLeaderboardApi(limit, prevCursor);
      setEntries(data.leaderboard);
      setNextCursor(data.nextCursor || null);
      setPage((prev) => prev - 1);
    } catch (err) {
      console.error('Failed to fetch previous leaderboard page:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 flex-1 w-full">
        {/* Leaderboard Header Banner */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 shadow-sm">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-amber-50 border border-amber-200 text-amber-600 rounded-xl">
                <Trophy className="w-6 h-6" />
              </div>
              <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                Global Leaderboard
              </h1>
            </div>
            <p className="text-sm text-slate-500 max-w-xl">
              Rankings based on distinct problems solved, overall submission accuracy, and evaluation statistics.
            </p>
          </div>

          {/* Current User Rank Callout */}
          {user && (
            <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-xl flex items-center gap-4 shadow-sm">
              <div className="p-3 bg-indigo-100 text-indigo-700 rounded-lg border border-indigo-200">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-indigo-900 uppercase tracking-wider">Your Current Rank</p>
                <p className="text-xl font-extrabold text-indigo-700">
                  {currentUserRank ? `#${currentUserRank}` : 'Unranked'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Global Leaderboard Table */}
        <LeaderboardTable
          entries={entries}
          currentUserId={user?.id}
          isLoading={isLoading}
        />

        {/* Pagination Controls */}
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-slate-500">
            Showing Page <span className="font-bold text-slate-900">{page}</span> ({totalCount} total engineers)
          </span>

          <div className="flex items-center gap-3">
            <button
              onClick={handlePrevPage}
              disabled={page <= 1 || isLoading}
              className="flex items-center gap-1 text-xs font-semibold px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>
            <button
              onClick={handleNextPage}
              disabled={!nextCursor || isLoading}
              className="flex items-center gap-1 text-xs font-semibold px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};
