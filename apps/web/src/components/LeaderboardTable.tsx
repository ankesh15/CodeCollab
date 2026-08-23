import React from 'react';
import { LeaderboardEntry } from '@codecollab/shared';
import { Trophy, User as UserIcon } from 'lucide-react';

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
  currentUserId?: string;
  isLoading?: boolean;
}

export const LeaderboardTable: React.FC<LeaderboardTableProps> = ({
  entries,
  currentUserId,
  isLoading = false,
}) => {
  const getRankBadge = (rank: number) => {
    if (rank === 1) {
      return (
        <span className="flex items-center justify-center w-7 h-7 rounded-full bg-amber-100 text-amber-800 border border-amber-300 font-bold text-xs">
          🥇 1
        </span>
      );
    }
    if (rank === 2) {
      return (
        <span className="flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 text-slate-700 border border-slate-300 font-bold text-xs">
          🥈 2
        </span>
      );
    }
    if (rank === 3) {
      return (
        <span className="flex items-center justify-center w-7 h-7 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-bold text-xs">
          🥉 3
        </span>
      );
    }
    return <span className="font-mono text-xs font-semibold text-slate-500 pl-2">#{rank}</span>;
  };

  if (isLoading) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-500 shadow-sm">
        Loading leaderboard rankings...
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-500 space-y-2 shadow-sm">
        <Trophy className="w-8 h-8 text-slate-400 mx-auto" />
        <p className="font-semibold text-sm text-slate-800">No leaderboard data available yet.</p>
        <p className="text-xs text-slate-500">Solve problems to start building rankings!</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <th className="py-3.5 px-4 w-20">Rank</th>
              <th className="py-3.5 px-4">User</th>
              <th className="py-3.5 px-4 text-center">Problems Solved</th>
              <th className="py-3.5 px-4 text-center">Accepted Submissions</th>
              <th className="py-3.5 px-4 text-right">Acceptance Rate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {entries.map((entry) => {
              const isCurrentUser = currentUserId && entry.user.id === currentUserId;

              return (
                <tr
                  key={entry.user.id}
                  className={`transition-colors ${
                    isCurrentUser
                      ? 'bg-indigo-50/70 border-l-4 border-l-indigo-600'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <td className="py-3.5 px-4">{getRankBadge(entry.rank)}</td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 font-bold text-xs">
                        {entry.user.avatar ? (
                          <img
                            src={entry.user.avatar}
                            alt={entry.user.username}
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          <UserIcon className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                      <span className="font-semibold text-slate-900 flex items-center gap-2">
                        {entry.user.username}
                        {isCurrentUser && (
                          <span className="px-2 py-0.5 text-[10px] font-extrabold bg-indigo-100 text-indigo-700 rounded border border-indigo-200">
                            YOU
                          </span>
                        )}
                      </span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-center font-bold text-emerald-600 font-mono">
                    {entry.problemsSolved}
                  </td>
                  <td className="py-3.5 px-4 text-center font-mono text-slate-700">
                    {entry.acceptedSubmissions}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-indigo-600">
                    {entry.acceptanceRate}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
