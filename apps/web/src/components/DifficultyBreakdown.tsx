import React from 'react';
import { DifficultyBreakdown as DifficultyType } from '@codecollab/shared';

interface DifficultyBreakdownProps {
  difficulty: DifficultyType;
  totalSolved: number;
}

export const DifficultyBreakdown: React.FC<DifficultyBreakdownProps> = ({
  difficulty,
  totalSolved,
}) => {
  const getPercentage = (count: number) => {
    if (totalSolved === 0) return 0;
    return Math.min(100, Math.round((count / totalSolved) * 100));
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-slate-900 tracking-tight">Difficulty Breakdown</h3>
        <span className="text-xs font-semibold text-slate-500">
          {totalSolved} Distinct Solved
        </span>
      </div>

      <div className="space-y-4">
        {/* Easy */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-emerald-600">Easy</span>
            <span className="font-mono text-slate-700 font-bold">
              {difficulty.easy} <span className="text-slate-400 font-normal">({getPercentage(difficulty.easy)}%)</span>
            </span>
          </div>
          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${getPercentage(difficulty.easy)}%` }}
            />
          </div>
        </div>

        {/* Medium */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-amber-600">Medium</span>
            <span className="font-mono text-slate-700 font-bold">
              {difficulty.medium} <span className="text-slate-400 font-normal">({getPercentage(difficulty.medium)}%)</span>
            </span>
          </div>
          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200">
            <div
              className="h-full bg-amber-500 rounded-full transition-all duration-500"
              style={{ width: `${getPercentage(difficulty.medium)}%` }}
            />
          </div>
        </div>

        {/* Hard */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-rose-600">Hard</span>
            <span className="font-mono text-slate-700 font-bold">
              {difficulty.hard} <span className="text-slate-400 font-normal">({getPercentage(difficulty.hard)}%)</span>
            </span>
          </div>
          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200">
            <div
              className="h-full bg-rose-500 rounded-full transition-all duration-500"
              style={{ width: `${getPercentage(difficulty.hard)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
