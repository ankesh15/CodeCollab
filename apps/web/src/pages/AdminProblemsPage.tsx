import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import {
  AdminProblemSummary,
  ProblemDifficulty,
} from '@codecollab/shared';
import {
  fetchAdminProblemsApi,
  deleteAdminProblemApi,
  publishProblemApi,
  unpublishProblemApi,
} from '../lib/api';
import {
  Plus,
  Search,
  Download,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  CheckCircle2,
  Lock,
  FileCode,
  Globe,
  AlertCircle,
  X,
} from 'lucide-react';

export const AdminProblemsPage: React.FC = () => {
  const navigate = useNavigate();

  const [problems, setProblems] = useState<AdminProblemSummary[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedSource, setSelectedSource] = useState<string>('ALL');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // Modal State for Delete Confirmation
  const [problemToDelete, setProblemToDelete] = useState<AdminProblemSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Status Action Loader
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);

  const loadProblems = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params: { search?: string; source?: string; difficulty?: string; status?: string } = {};
      if (searchQuery.trim()) params.search = searchQuery.trim();
      if (selectedSource !== 'ALL') params.source = selectedSource;
      if (selectedDifficulty !== 'ALL') params.difficulty = selectedDifficulty;
      if (selectedStatus !== 'ALL') params.status = selectedStatus;

      const data = await fetchAdminProblemsApi(params);
      setProblems(data.problems);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load admin problems.');
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, selectedSource, selectedDifficulty, selectedStatus]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadProblems();
    }, 200);
    return () => clearTimeout(timer);
  }, [loadProblems]);

  const handleTogglePublish = async (problem: AdminProblemSummary) => {
    try {
      setStatusUpdatingId(problem.id);
      setError(null);
      if (problem.status === 'PUBLISHED') {
        await unpublishProblemApi(problem.id);
      } else {
        await publishProblemApi(problem.id);
      }
      await loadProblems();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update problem status.');
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!problemToDelete) return;
    try {
      setIsDeleting(true);
      setDeleteError(null);
      await deleteAdminProblemApi(problemToDelete.id);
      setProblemToDelete(null);
      await loadProblems();
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete problem.');
    } finally {
      setIsDeleting(false);
    }
  };

  const getDifficultyBadge = (difficulty: ProblemDifficulty) => {
    switch (difficulty) {
      case 'EASY':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'MEDIUM':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'HARD':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col font-sans">
      <Navbar />

      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Admin Problem Management
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Create, edit, delete, publish coding problems, and build test suites.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/admin/problems/import"
              className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
            >
              <Download className="w-4 h-4 text-indigo-600" />
              Import Codeforces
            </Link>
            <Link
              to="/admin/problems/new"
              className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Create Problem
            </Link>
          </div>
        </div>

        {/* Global Error Notice */}
        {error && (
          <div className="mt-6 p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm flex items-start justify-between">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-rose-500 hover:text-rose-700 font-bold ml-4"
            >
              ×
            </button>
          </div>
        )}

        {/* Search & Filter Bar */}
        <div className="mt-6 bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
          {/* Search Input */}
          <div className="relative flex-grow">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search problems by title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
            />
          </div>

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Source Filter */}
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
              <span>Source:</span>
              <select
                value={selectedSource}
                onChange={(e) => setSelectedSource(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ALL">All Sources</option>
                <option value="INTERNAL">Internal</option>
                <option value="CODEFORCES">Codeforces</option>
              </select>
            </div>

            {/* Difficulty Filter */}
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
              <span>Difficulty:</span>
              <select
                value={selectedDifficulty}
                onChange={(e) => setSelectedDifficulty(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ALL">All Difficulties</option>
                <option value="EASY">Easy</option>
                <option value="MEDIUM">Medium</option>
                <option value="HARD">Hard</option>
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
              <span>Status:</span>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="PUBLISHED">Published</option>
                <option value="DRAFT">Draft</option>
              </select>
            </div>
          </div>
        </div>

        {/* Problems Table */}
        <div className="mt-6 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center space-y-3">
              <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm font-medium">Loading problems table...</p>
            </div>
          ) : problems.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <FileCode className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-base font-semibold text-slate-700">No problems found</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Try adjusting your search criteria or create a new problem.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3.5 px-4">Problem</th>
                    <th className="py-3.5 px-4">Difficulty</th>
                    <th className="py-3.5 px-4">Rating</th>
                    <th className="py-3.5 px-4">Source</th>
                    <th className="py-3.5 px-4">Test Cases</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {problems.map((prob) => (
                    <tr key={prob.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Problem Title & ID */}
                      <td className="py-4 px-4 font-medium text-slate-900">
                        <div className="flex flex-col">
                          <Link
                            to={`/admin/problems/${prob.id}/edit`}
                            className="font-bold text-slate-900 hover:text-indigo-600 transition-colors"
                          >
                            {prob.title}
                          </Link>
                          {prob.tags && prob.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {prob.tags.slice(0, 3).map((tag) => (
                                <span
                                  key={tag}
                                  className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono"
                                >
                                  {tag}
                                </span>
                              ))}
                              {prob.tags.length > 3 && (
                                <span className="text-[10px] text-slate-400 font-mono">
                                  +{prob.tags.length - 3}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Difficulty */}
                      <td className="py-4 px-4">
                        <span
                          className={`inline-block px-2.5 py-1 text-xs font-bold rounded-full border ${getDifficultyBadge(
                            prob.difficulty
                          )}`}
                        >
                          {prob.difficulty}
                        </span>
                      </td>

                      {/* Rating */}
                      <td className="py-4 px-4 font-mono text-xs text-slate-600">
                        {prob.externalRating ? (
                          <span className="font-semibold text-slate-800">{prob.externalRating}</span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* Source */}
                      <td className="py-4 px-4">
                        {prob.source === 'CODEFORCES' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-md text-xs font-semibold">
                            <Globe className="w-3.5 h-3.5 text-amber-600" />
                            Codeforces
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md text-xs font-semibold">
                            <FileCode className="w-3.5 h-3.5 text-indigo-600" />
                            Internal
                          </span>
                        )}
                      </td>

                      {/* Test Cases */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 font-semibold">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            {prob.publicTestCasesCount} Public
                          </span>
                          <span className="inline-flex items-center gap-1 text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 font-semibold">
                            <Lock className="w-3 h-3 text-slate-500" />
                            {prob.hiddenTestCasesCount} Hidden
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4">
                        {prob.status === 'PUBLISHED' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            Published
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                            Draft
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Toggle Publish */}
                          <button
                            onClick={() => handleTogglePublish(prob)}
                            disabled={statusUpdatingId === prob.id}
                            title={prob.status === 'PUBLISHED' ? 'Unpublish (Make Draft)' : 'Publish Problem'}
                            className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors disabled:opacity-50"
                          >
                            {prob.status === 'PUBLISHED' ? (
                              <EyeOff className="w-4 h-4 text-amber-600" />
                            ) : (
                              <Eye className="w-4 h-4 text-emerald-600" />
                            )}
                          </button>

                          {/* Edit */}
                          <button
                            onClick={() => navigate(`/admin/problems/${prob.id}/edit`)}
                            title="Edit Problem & Test Cases"
                            className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => setProblemToDelete(prob)}
                            title="Delete Problem"
                            className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Delete Confirmation Modal */}
      {problemToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-6 h-6 text-rose-600" />
              </div>
              <button
                onClick={() => {
                  setProblemToDelete(null);
                  setDeleteError(null);
                }}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <h3 className="text-lg font-bold text-slate-900 mt-4">
              Delete "{problemToDelete.title}"?
            </h3>
            <p className="text-sm text-slate-600 mt-2">
              This action will permanently delete the problem and its associated test cases. Problems with existing user submission history cannot be deleted.
            </p>

            {deleteError && (
              <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs">
                {deleteError}
              </div>
            )}

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setProblemToDelete(null);
                  setDeleteError(null);
                }}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-semibold text-white bg-rose-600 rounded-lg hover:bg-rose-700 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
              >
                {isDeleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};
