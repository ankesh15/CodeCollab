import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ActivityPoint } from '@codecollab/shared';
import { Activity } from 'lucide-react';

interface ActivityChartProps {
  activity: ActivityPoint[];
}

export const ActivityChart: React.FC<ActivityChartProps> = ({ activity }) => {
  const [hoveredPoint, setHoveredPoint] = useState<ActivityPoint | null>(null);

  const maxSubmissions = Math.max(1, ...activity.map((p) => p.submissions));
  const totalPeriodSubmissions = activity.reduce((sum, p) => sum + p.submissions, 0);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-600" />
            Activity — Last 30 Days
          </h3>
          <p className="text-xs text-slate-500">
            {totalPeriodSubmissions > 0
              ? `${totalPeriodSubmissions} total submission${totalPeriodSubmissions !== 1 ? 's' : ''} in the past 30 days`
              : 'Track your submission frequency over the past 30 days'}
          </p>
        </div>

        {totalPeriodSubmissions > 0 && (
          hoveredPoint ? (
            <div className="text-xs bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-lg text-indigo-700 font-mono">
              {hoveredPoint.date}: <span className="font-bold text-indigo-900">{hoveredPoint.submissions}</span> submission{hoveredPoint.submissions !== 1 ? 's' : ''}
            </div>
          ) : (
            <div className="text-xs text-slate-400 italic">Hover bars to view daily stats</div>
          )
        )}
      </div>

      {totalPeriodSubmissions === 0 ? (
        <div className="h-40 bg-slate-50/70 border border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center p-6 text-center space-y-2">
          <Activity className="w-8 h-8 text-slate-300" />
          <h4 className="text-sm font-semibold text-slate-700">No activity yet</h4>
          <p className="text-xs text-slate-500 max-w-sm">
            Start solving problems to build your 30-day submission activity history.
          </p>
          <Link
            to="/problems"
            className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 bg-white border border-indigo-200 px-3 py-1.5 rounded-lg shadow-sm hover:bg-indigo-50 transition-colors mt-1"
          >
            Browse Problem Library →
          </Link>
        </div>
      ) : (
        <div className="h-36 flex items-end justify-between gap-1 pt-6 px-1 border-b border-slate-200">
          {activity.map((point, index) => {
            const heightPercent = Math.max(8, Math.round((point.submissions / maxSubmissions) * 100));
            const hasActivity = point.submissions > 0;

            return (
              <div
                key={point.date || index}
                className="flex-1 flex flex-col items-center group relative cursor-pointer"
                onMouseEnter={() => setHoveredPoint(point)}
                onMouseLeave={() => setHoveredPoint(null)}
              >
                <div
                  className={`w-full rounded-t-md transition-all duration-200 ${
                    hasActivity
                      ? 'bg-indigo-600 group-hover:bg-indigo-700 shadow-sm'
                      : 'bg-slate-100 group-hover:bg-slate-200'
                  }`}
                  style={{ height: `${heightPercent}%` }}
                />
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono pt-1">
        <span>30 days ago</span>
        <span>Today</span>
      </div>
    </div>
  );
};
