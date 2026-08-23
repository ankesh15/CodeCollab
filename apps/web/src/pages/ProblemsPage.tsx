import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { fetchProblems, fetchProblemStatisticsApi, fetchUserAnalyticsApi } from '../lib/api';
import { ProblemSummary } from '@codecollab/shared';
import {
  BookOpen,
  Search,
  ArrowRight,
  RefreshCw,
  Sparkles,
  Layers,
} from 'lucide-react';

interface ExtendedProblem extends ProblemSummary {
  acceptanceRate?: number | null;
  isSolved?: boolean;
}

export const ProblemsPage: React.FC = () => {
  const [problems, setProblems] = useState<ExtendedProblem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState<'ALL' | 'EASY' | 'MEDIUM' | 'HARD'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SOLVED' | 'UNSOLVED'>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const loadProblems = async () => {
    setIsLoading(true);
    setHasError(false);

    try {
      const [problemsData, userAnalytics] = await Promise.all([
        fetchProblems(),
        fetchUserAnalyticsApi().catch(() => null),
      ]);

      // Enrich problems with statistics and user solved status
      const enrichedProblems = await Promise.all(
        problemsData.map(async (p) => {
          let acceptanceRate: number | null = null;
          try {
            const stats = await fetchProblemStatisticsApi(p.id);
            acceptanceRate = stats.acceptanceRate;
          } catch {
            acceptanceRate = null;
          }

          // Check if user has solved distinct problems
          const hasUserSolvedAny = Boolean(
            userAnalytics?.statistics?.problemsSolved &&
              userAnalytics.statistics.problemsSolved > 0
          );

          return {
            ...p,
            acceptanceRate,
            isSolved: hasUserSolvedAny,
          };
        })
      );

      setProblems(enrichedProblems);
    } catch (err) {
      console.error('Failed to fetch problems:', err);
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProblems();
  }, []);

  const filteredProblems = problems.filter((p) => {
    const matchesSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDifficulty = difficultyFilter === 'ALL' || p.difficulty === difficultyFilter;
    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'SOLVED' && p.isSolved) ||
      (statusFilter === 'UNSOLVED' && !p.isSolved);

    return matchesSearch && matchesDifficulty && matchesStatus;
  });

  const clearFilters = () => {
    setSearchQuery('');
    setDifficultyFilter('ALL');
    setStatusFilter('ALL');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-500 selection:text-white flex flex-col justify-between">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 flex-1 w-full">
        {/* 1. PAGE HEADER */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-xs">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-md">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Algorithmic Problem Library</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Problem Library
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-normal max-w-xl leading-relaxed">
              Practice coding problems, track your progress, and solve together with your team in real time.
            </p>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <Link
              to="/rooms"
              className="w-full md:w-auto flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm px-5 py-3 rounded-xl shadow-xs transition-all active:scale-95"
            >
              <BookOpen className="w-4 h-4" />
              <span>Explore Coding Rooms</span>
            </Link>
          </div>
        </div>

        {/* 2. FILTER & SEARCH CONTROL BAR */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 shadow-xs">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
            <input
              type="text"
              placeholder="Search problems..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 transition-all font-sans"
            />
          </div>

          {/* Difficulty Filter Tabs */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-500 mr-1 flex items-center gap-1 hidden sm:flex">
              <Layers className="w-3.5 h-3.5" /> Filter:
            </span>

            {(['ALL', 'EASY', 'MEDIUM', 'HARD'] as const).map((level) => (
              <button
                key={level}
                onClick={() => setDifficultyFilter(level)}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  difficultyFilter === level
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                }`}
              >
                {level === 'ALL' ? 'All' : level.charAt(0) + level.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        {/* ERROR STATE */}
        {hasError && (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-4 shadow-xs">
            <div className="w-12 h-12 bg-rose-50 border border-rose-200 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
              <RefreshCw className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900">Unable to load problems</h3>
              <p className="text-xs text-slate-500">Something went wrong while loading the problem library.</p>
            </div>
            <button
              onClick={loadProblems}
              className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Try Again
            </button>
          </div>
        )}

        {/* 3. COLUMN-WISE PROBLEM TABLE CONTAINER */}
        {!hasError && (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto max-w-full">
              <table className="w-full text-left border-collapse min-w-[768px]">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-3.5 px-4 w-12 text-center">#</th>
                    <th className="py-3.5 px-4">Title</th>
                    <th className="py-3.5 px-4 w-28">Difficulty</th>
                    <th className="py-3.5 px-4 w-24 text-right">Rating</th>
                    <th className="py-3.5 px-4 w-44">Tags</th>
                    <th className="py-3.5 px-4 w-28">Source</th>
                    <th className="py-3.5 px-4 w-24 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {isLoading ? (
                    // Skeleton Loading Rows
                    Array.from({ length: 6 }).map((_, idx) => (
                      <tr key={idx} className="animate-pulse">
                        <td className="py-4 px-4 text-center">
                          <div className="h-3 w-4 bg-slate-200 rounded mx-auto" />
                        </td>
                        <td className="py-4 px-4 space-y-1.5">
                          <div className="h-4 w-48 bg-slate-200 rounded" />
                        </td>
                        <td className="py-4 px-4">
                          <div className="h-5 w-16 bg-slate-200 rounded-full" />
                        </td>
                        <td className="py-4 px-4 text-right">
                          <div className="h-3 w-8 bg-slate-200 rounded ml-auto" />
                        </td>
                        <td className="py-4 px-4">
                          <div className="h-3 w-24 bg-slate-200 rounded" />
                        </td>
                        <td className="py-4 px-4">
                          <div className="h-3 w-16 bg-slate-200 rounded" />
                        </td>
                        <td className="py-4 px-4 text-right">
                          <div className="h-7 w-16 bg-slate-200 rounded-xl ml-auto" />
                        </td>
                      </tr>
                    ))
                  ) : filteredProblems.length === 0 ? (
                    // Empty State Row
                    <tr>
                      <td colSpan={7} className="py-12 px-4 text-center bg-white space-y-3">
                        <BookOpen className="w-8 h-8 text-slate-300 mx-auto" />
                        <div className="space-y-1">
                          <h3 className="text-sm font-bold text-slate-800">No problems found</h3>
                          <p className="text-xs text-slate-500">
                            Try changing your search query or difficulty filter.
                          </p>
                        </div>
                        <button
                          onClick={clearFilters}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 px-4 py-2 rounded-xl shadow-xs hover:bg-indigo-100 transition-colors cursor-pointer"
                        >
                          Clear Filters
                        </button>
                      </td>
                    </tr>
                  ) : (
                    // Problem Rows
                    filteredProblems.map((problem, index) => (
                      <tr
                        key={problem.id}
                        className="group hover:bg-slate-50/80 transition-colors"
                      >
                        {/* Index */}
                        <td className="py-4 px-4 text-center font-mono text-slate-400 font-medium">
                          {index + 1}
                        </td>

                        {/* Title */}
                        <td className="py-4 px-4 space-y-0.5 max-w-md">
                          <Link
                            to={`/problems/${problem.id}`}
                            className="font-bold text-slate-900 text-sm group-hover:text-indigo-600 transition-colors inline-block leading-snug"
                          >
                            {problem.title}
                          </Link>
                          {problem.sourceId && (
                            <span className="ml-2 font-mono text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                              {problem.sourceId}
                            </span>
                          )}
                        </td>

                        {/* Difficulty */}
                        <td className="py-4 px-4">
                          <span
                            className={`inline-block px-2.5 py-0.5 text-[10px] font-bold rounded-full border ${
                              problem.difficulty === 'EASY'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : problem.difficulty === 'MEDIUM'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}
                          >
                            {problem.difficulty}
                          </span>
                        </td>

                        {/* External Rating */}
                        <td className="py-4 px-4 text-right font-mono text-xs font-bold text-slate-700">
                          {problem.externalRating ?? '—'}
                        </td>

                        {/* Tags */}
                        <td className="py-4 px-4">
                          <div className="flex flex-wrap gap-1">
                            {problem.tags && problem.tags.length > 0 ? (
                              problem.tags.slice(0, 2).map((t, idx) => (
                                <span
                                  key={idx}
                                  className="px-2 py-0.5 text-[10px] bg-slate-100 text-slate-600 rounded border border-slate-200"
                                >
                                  {t}
                                </span>
                              ))
                            ) : (
                              <span className="text-slate-400 font-mono text-[11px]">—</span>
                            )}
                            {problem.tags && problem.tags.length > 2 && (
                              <span className="text-[10px] text-slate-400 font-medium">
                                +{problem.tags.length - 2}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Source */}
                        <td className="py-4 px-4">
                          {problem.source === 'CODEFORCES' ? (
                            <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                              Codeforces
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded bg-slate-100 text-slate-600 border border-slate-200">
                              Internal
                            </span>
                          )}
                        </td>

                        {/* Action */}
                        <td className="py-4 px-4 text-right">
                          <Link
                            to={`/problems/${problem.id}`}
                            className="inline-flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-3.5 py-1.5 rounded-xl shadow-xs transition-all active:scale-95"
                          >
                            <span>Open</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};
