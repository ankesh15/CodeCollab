import React from 'react';
import { Link } from 'react-router-dom';
import { Code2 } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-white border-t border-slate-200 py-12 text-slate-600 text-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="space-y-4 md:col-span-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-600 text-white rounded-lg">
              <Code2 className="w-5 h-5" />
            </div>
            <span className="text-lg font-bold text-slate-900 tracking-tight">CodeCollab</span>
          </div>
          <p className="text-xs text-slate-500 max-w-sm leading-relaxed">
            Real-Time Collaborative Coding Platform for Software Developers. Practice algorithms, interview together,
            and build solutions in real-time rooms.
          </p>
        </div>

        <div>
          <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider mb-3">Platform</h4>
          <ul className="space-y-2 text-xs">
            <li>
              <Link to="/problems" className="hover:text-indigo-600 transition-colors">
                Problem Library
              </Link>
            </li>
            <li>
              <Link to="/rooms" className="hover:text-indigo-600 transition-colors">
                Coding Rooms
              </Link>
            </li>
            <li>
              <Link to="/leaderboard" className="hover:text-indigo-600 transition-colors">
                Global Leaderboard
              </Link>
            </li>
            {import.meta.env.DEV && (
              <li>
                <Link to="/dev" className="hover:text-indigo-600 transition-colors">
                  Dev & System Health
                </Link>
              </li>
            )}
          </ul>
        </div>

        <div>
          <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider mb-3">System & Tech</h4>
          <ul className="space-y-2 text-xs text-slate-500">
            <li>Production Developer Platform</li>
            <li>PostgreSQL + Prisma + Socket.IO</li>
            <li>Judge0 Code Execution Sandbox</li>
            <li>© 2026 CodeCollab. All rights reserved.</li>
          </ul>
        </div>
      </div>
    </footer>
  );
};
