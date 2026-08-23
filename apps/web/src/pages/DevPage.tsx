import React, { useState, useEffect } from 'react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { RoomPresenceTest } from '../components/RoomPresenceTest';
import { API_BASE_URL } from '../lib/api';
import { HealthResponse } from '@codecollab/shared';
import { Terminal, RefreshCw, CheckCircle2, XCircle, Database, Server, Cpu } from 'lucide-react';

export const DevPage: React.FC = () => {
  const [healthData, setHealthData] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/health`);
      const data = await res.json();
      setHealthData(data);
    } catch {
      setHealthData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10 flex-1 w-full">
        {/* Development Banner */}
        <div className="bg-white border border-purple-200 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-50 rounded-xl text-purple-600 border border-purple-100">
              <Terminal className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Developer Verification Dashboard</h1>
                <span className="px-2 py-0.5 text-xs font-mono bg-purple-50 text-purple-700 border border-purple-200 rounded">
                  Internal / Dev Tools
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Monitor system health, database connections, and run live Phase 4 Socket.IO room presence tests.
              </p>
            </div>
          </div>

          <button
            onClick={fetchHealth}
            disabled={loading}
            className="flex items-center gap-2 bg-white hover:bg-slate-100 text-slate-700 font-medium px-4 py-2 rounded-xl text-xs transition-all border border-slate-300 shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Health
          </button>
        </div>

        {/* System Health Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Frontend Service Card */}
          <div className="bg-white border border-slate-200 p-6 rounded-2xl space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
                <Cpu className="w-5 h-5 text-indigo-600" /> Frontend Service
              </div>
              <span className="px-2.5 py-0.5 text-xs font-mono bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md">
                Running (React + Vite)
              </span>
            </div>

            <div className="space-y-2 text-xs font-mono text-slate-600">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span>Framework</span>
                <span className="text-slate-900 font-semibold">React 18 + Vite 5</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span>Type System</span>
                <span className="text-slate-900 font-semibold">TypeScript (Strict)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span>Router</span>
                <span className="text-indigo-600 font-semibold">React Router v6</span>
              </div>
              <div className="flex justify-between py-1">
                <span>Styling</span>
                <span className="text-slate-900 font-semibold">Vanilla CSS / Tailwind</span>
              </div>
            </div>
          </div>

          {/* Backend Health API Card */}
          <div className="bg-white border border-slate-200 p-6 rounded-2xl space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
                <Server className="w-5 h-5 text-indigo-600" /> Backend REST & Database API
              </div>
              {healthData?.success ? (
                <span className="flex items-center gap-1 px-2.5 py-0.5 text-xs font-mono bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Healthy
                </span>
              ) : (
                <span className="flex items-center gap-1 px-2.5 py-0.5 text-xs font-mono bg-rose-50 text-rose-700 border border-rose-200 rounded-md">
                  <XCircle className="w-3.5 h-3.5" /> Unreachable
                </span>
              )}
            </div>

            <div className="space-y-2 text-xs font-mono text-slate-600">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span>REST API Status</span>
                <span className={healthData?.success ? 'text-emerald-700 font-semibold' : 'text-rose-700 font-semibold'}>
                  {healthData?.data?.status || 'Unknown'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span>PostgreSQL Database</span>
                <span className={healthData?.data?.database?.connected ? 'text-emerald-700 font-semibold' : 'text-rose-700 font-semibold'}>
                  {healthData?.data?.database?.connected ? 'Connected (Prisma ORM)' : 'Disconnected'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span>Uptime</span>
                <span className="text-slate-900 font-semibold">{healthData?.data?.uptime || 0}s</span>
              </div>
              <div className="flex justify-between py-1">
                <span>Environment</span>
                <span className="text-slate-900 font-semibold">{healthData?.data?.environment || 'development'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Phase 4 Socket.IO Presence Verification Component */}
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Database className="w-5 h-5 text-indigo-600" />
            Phase 4 — Real-Time Socket.IO Signaling Test Suite
          </h2>
          <RoomPresenceTest />
        </div>

        {/* Monorepo Architecture Map */}
        <div className="bg-white border border-slate-200 p-6 rounded-2xl space-y-4 shadow-sm">
          <h3 className="text-base font-bold text-slate-900">Monorepo Architecture Map</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <span className="text-indigo-600 font-bold">@codecollab/web</span>
              <p className="text-slate-600">Vite + React SPA with Product UI, Auth Context, and Socket.IO client.</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <span className="text-blue-600 font-bold">@codecollab/server</span>
              <p className="text-slate-600">Node.js + Express REST API, Prisma ORM PostgreSQL, and Socket.IO engine.</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <span className="text-purple-600 font-bold">@codecollab/shared</span>
              <p className="text-slate-600">Shared TypeScript DTO contracts, socket event constants, and payloads.</p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};
