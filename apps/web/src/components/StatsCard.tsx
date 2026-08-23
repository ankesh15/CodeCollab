import React from 'react';

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  accentColor?: 'cyan' | 'purple' | 'emerald' | 'amber' | 'indigo';
}

export const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  accentColor = 'indigo',
}) => {
  const iconBgMap = {
    cyan: 'bg-cyan-50 text-cyan-600 border-cyan-200',
    purple: 'bg-purple-50 text-purple-600 border-purple-200',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    amber: 'bg-amber-50 text-amber-600 border-amber-200',
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-200',
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center justify-between gap-4 transition-all hover:shadow-md hover:border-slate-300">
      <div className="space-y-1">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</p>
        <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">{value}</p>
        {subtitle && <p className="text-[11px] text-slate-500">{subtitle}</p>}
      </div>

      <div className={`p-3 rounded-xl border ${iconBgMap[accentColor]}`}>{icon}</div>
    </div>
  );
};
