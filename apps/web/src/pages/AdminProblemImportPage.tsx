import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Download,
  CheckSquare,
  Square,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  Search,
  Tag as TagIcon,
  ShieldAlert,
  SlidersHorizontal,
} from 'lucide-react';
import {
  fetchCodeforcesCandidateProblemsApi,
  importCodeforcesProblemsApi,
} from '../lib/api';
import {
  CodeforcesProblemCandidate,
  ImportCodeforcesProblemsResponseData,
} from '@codecollab/shared';
import { useAuth } from '../context/AuthContext';

const POPULAR_TAGS = [
  'arrays',
  'dp',
  'graphs',
  'greedy',
  'strings',
  'math',
  'implementation',
  'trees',
  'sorting',
  'binary search',
  'data structures',
];

export const AdminProblemImportPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Filters state
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [difficultyFilter, setDifficultyFilter] = useState<'ALL' | 'EASY' | 'MEDIUM' | 'HARD'>('ALL');
  const [limit, setLimit] = useState<number>(50);

  // Data & Loading state
  const [candidates, setCandidates] = useState<CodeforcesProblemCandidate[]>([]);
  const [totalFound, setTotalFound] = useState<number>(0);
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Selection state (Array of `${contestId}-${index}`)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Import Result Summary
  const [importResult, setImportResult] = useState<ImportCodeforcesProblemsResponseData | null>(null);

  // Admin access guard check
  useEffect(() => {
    if (user && user.role !== 'ADMIN') {
      navigate('/profile', { replace: true });
    }
  }, [user, navigate]);

  const handleFetch = useCallback(async () => {
    setIsFetching(true);
    setErrorMsg(null);
    setImportResult(null);

    try {
      const data = await fetchCodeforcesCandidateProblemsApi({
        tag: selectedTag.trim() || undefined,
        difficulty: difficultyFilter !== 'ALL' ? difficultyFilter : undefined,
        limit,
      });

      setCandidates(data.problems);
      setTotalFound(data.totalCount);
      setSelectedIds(new Set());
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to fetch candidate problems from server');
    } finally {
      setIsFetching(false);
    }
  }, [selectedTag, difficultyFilter, limit]);

  // Initial fetch on mount
  useEffect(() => {
    handleFetch();
  }, [handleFetch]);

  // Toggle selection for single problem
  const toggleSelect = (sourceId: string, isImported: boolean) => {
    if (isImported) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(sourceId)) {
        next.delete(sourceId);
      } else {
        next.add(sourceId);
      }
      return next;
    });
  };

  // Toggle Select All (only selects items not already imported)
  const toggleSelectAll = () => {
    const importableCandidates = candidates.filter((c) => !c.isImported);
    const allSelected = importableCandidates.every((c) => selectedIds.has(c.sourceId));

    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      const next = new Set<string>();
      importableCandidates.forEach((c) => next.add(c.sourceId));
      setSelectedIds(next);
    }
  };

  const handleImportSelected = async () => {
    if (selectedIds.size === 0) return;

    setIsImporting(true);
    setErrorMsg(null);
    setImportResult(null);

    try {
      const itemsToImport = candidates
        .filter((c) => selectedIds.has(c.sourceId))
        .map((c) => ({
          contestId: c.contestId,
          index: c.index,
        }));

      const data = await importCodeforcesProblemsApi(itemsToImport);

      setImportResult(data);
      // Refresh candidates table after import
      await handleFetch();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to import problems');
    } finally {
      setIsImporting(false);
    }
  };

  const importableCandidates = candidates.filter((c) => !c.isImported);
  const isAllSelected =
    importableCandidates.length > 0 && importableCandidates.every((c) => selectedIds.has(c.sourceId));

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pt-20 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header section */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 text-xs font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 rounded-full border border-indigo-200 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5" />
                Admin Portal
              </span>
              <span className="px-2.5 py-1 text-xs font-semibold bg-slate-100 text-slate-700 rounded-full border border-slate-200">
                Official Codeforces API
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mt-2">Problem Importer</h1>
            <p className="text-slate-600 text-sm mt-1">
              Fetch candidate competitive coding problems directly from official Codeforces metadata API and import them into PostgreSQL.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/problems')}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              View Problem Library
            </button>
          </div>
        </div>

        {/* Filters & Control Panel */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
            <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
            Filter & Ingestion Parameters
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Source */}
            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-slate-600 mb-1">Source Dataset</label>
              <select
                disabled
                className="w-full bg-slate-100 border border-slate-300 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 cursor-not-allowed"
              >
                <option>Codeforces API (Official)</option>
              </select>
            </div>

            {/* Difficulty */}
            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-slate-600 mb-1">Difficulty / Rating</label>
              <select
                value={difficultyFilter}
                onChange={(e) => setDifficultyFilter(e.target.value as any)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="ALL">All Ratings</option>
                <option value="EASY">Easy (&lt; 1200 rating)</option>
                <option value="MEDIUM">Medium (1200–1599 rating)</option>
                <option value="HARD">Hard (1600+ rating)</option>
              </select>
            </div>

            {/* Tag Search */}
            <div className="md:col-span-4">
              <label className="block text-xs font-medium text-slate-600 mb-1">Topic Tag</label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="e.g. dp, graphs, arrays, math..."
                  value={selectedTag}
                  onChange={(e) => setSelectedTag(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Limit */}
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Limit (Max 100)</label>
              <input
                type="number"
                min={10}
                max={100}
                value={limit}
                onChange={(e) => setLimit(Math.min(100, Math.max(1, parseInt(e.target.value, 10) || 50)))}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Quick Tag Pills */}
          <div className="flex flex-wrap items-center gap-1.5 pt-2">
            <span className="text-xs text-slate-500 font-medium mr-1 flex items-center gap-1">
              <TagIcon className="w-3 h-3" /> Quick Tags:
            </span>
            {POPULAR_TAGS.map((t) => (
              <button
                key={t}
                onClick={() => setSelectedTag(selectedTag === t ? '' : t)}
                className={`px-2.5 py-0.5 text-xs rounded-full font-medium transition-colors ${
                  selectedTag.toLowerCase() === t.toLowerCase()
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                {t}
              </button>
            ))}
            {selectedTag && (
              <button
                onClick={() => setSelectedTag('')}
                className="text-xs text-slate-500 underline hover:text-slate-800 ml-2"
              >
                Clear Tag
              </button>
            )}
          </div>

          {/* Action Row */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <div className="text-xs text-slate-500">
              Showing candidate problems from official problem set. Rate-limit enforced (≥2s).
            </div>
            <button
              onClick={handleFetch}
              disabled={isFetching}
              className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 transition-colors shadow-sm"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
              {isFetching ? 'Fetching Candidates...' : 'Fetch Problems'}
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {errorMsg && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 text-red-800 text-sm">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">Import Error</div>
              <div>{errorMsg}</div>
            </div>
          </div>
        )}

        {/* Import Results Summary Banner */}
        {importResult && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-emerald-900 font-bold text-base">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              Import Operation Summary
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="bg-white p-3 rounded-lg border border-emerald-100 shadow-2xs">
                <div className="text-2xl font-black text-emerald-600">{importResult.importedCount}</div>
                <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Successfully Imported</div>
              </div>
              <div className="bg-white p-3 rounded-lg border border-emerald-100 shadow-2xs">
                <div className="text-2xl font-black text-amber-600">{importResult.skippedCount}</div>
                <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Already Existed / Skipped</div>
              </div>
              <div className="bg-white p-3 rounded-lg border border-emerald-100 shadow-2xs">
                <div className="text-2xl font-black text-red-600">{importResult.failedCount}</div>
                <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Failed</div>
              </div>
            </div>

            {/* Individual result items */}
            {importResult.results.length > 0 && (
              <div className="mt-3 max-h-40 overflow-y-auto bg-white rounded-lg border border-slate-200 p-3 text-xs space-y-1">
                {importResult.results.map((r, i) => (
                  <div key={i} className="flex items-center justify-between border-b border-slate-50 pb-1">
                    <span className="font-mono font-medium text-slate-700">
                      [{r.sourceId}] {r.title}
                    </span>
                    <span
                      className={`font-semibold px-2 py-0.5 rounded text-[10px] ${
                        r.status === 'IMPORTED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : r.status === 'SKIPPED'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {r.status} {r.reason ? `(${r.reason})` : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Problems Table View */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={toggleSelectAll}
                disabled={candidates.length === 0 || importableCandidates.length === 0}
                className="flex items-center gap-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 px-3 py-1.5 rounded-md hover:bg-slate-100 disabled:opacity-50"
              >
                {isAllSelected ? (
                  <CheckSquare className="w-4 h-4 text-indigo-600" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400" />
                )}
                Select All Importable ({importableCandidates.length})
              </button>

              <span className="text-xs text-slate-500">
                Selected: <strong className="text-slate-900 font-semibold">{selectedIds.size}</strong> problem(s)
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500">
                Found {totalFound} candidate problems
              </span>
              <button
                onClick={handleImportSelected}
                disabled={selectedIds.size === 0 || isImporting}
                className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2 transition-colors shadow-sm"
              >
                <Download className={`w-4 h-4 ${isImporting ? 'animate-bounce' : ''}`} />
                {isImporting ? 'Importing Selected...' : `Import Selected (${selectedIds.size})`}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100/70 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  <th className="py-3 px-4 w-10 text-center">☐</th>
                  <th className="py-3 px-4 w-24">ID</th>
                  <th className="py-3 px-6">Title</th>
                  <th className="py-3 px-4">Difficulty</th>
                  <th className="py-3 px-6">Tags</th>
                  <th className="py-3 px-4 text-right">Rating</th>
                  <th className="py-3 px-4">Source</th>
                  <th className="py-3 px-4 text-center">Import Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {isFetching ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-600 mb-2" />
                      Fetching problem set candidates from Codeforces API...
                    </td>
                  </tr>
                ) : candidates.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500">
                      No candidate problems found matching the selected filters.
                    </td>
                  </tr>
                ) : (
                  candidates.map((c) => {
                    const isSelected = selectedIds.has(c.sourceId);

                    return (
                      <tr
                        key={c.sourceId}
                        onClick={() => toggleSelect(c.sourceId, c.isImported)}
                        className={`transition-colors ${
                          c.isImported
                            ? 'bg-slate-50/60 opacity-60 cursor-not-allowed'
                            : isSelected
                            ? 'bg-indigo-50/50 hover:bg-indigo-50 cursor-pointer'
                            : 'hover:bg-slate-50 cursor-pointer'
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="py-3 px-4 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected || c.isImported}
                            disabled={c.isImported}
                            onChange={() => toggleSelect(c.sourceId, c.isImported)}
                            onClick={(e) => e.stopPropagation()}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50 cursor-pointer"
                          />
                        </td>

                        {/* ID */}
                        <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-700">
                          {c.sourceId}
                        </td>

                        {/* Title */}
                        <td className="py-3 px-6 font-semibold text-slate-900">
                          <div className="flex items-center gap-2">
                            <span>{c.name}</span>
                            <a
                              href={c.sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-slate-400 hover:text-indigo-600"
                              title="View original problem on Codeforces"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        </td>

                        {/* Difficulty */}
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              c.difficulty === 'EASY'
                                ? 'bg-emerald-100 text-emerald-800'
                                : c.difficulty === 'MEDIUM'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {c.difficulty}
                          </span>
                        </td>

                        {/* Tags */}
                        <td className="py-3 px-6">
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {c.tags.slice(0, 3).map((t, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 text-[11px] bg-slate-100 text-slate-600 rounded border border-slate-200"
                              >
                                {t}
                              </span>
                            ))}
                            {c.tags.length > 3 && (
                              <span className="text-[10px] text-slate-400 font-medium">
                                +{c.tags.length - 3}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* External Rating */}
                        <td className="py-3 px-4 text-right font-mono text-xs font-bold text-slate-700">
                          {c.rating ?? 'N/A'}
                        </td>

                        {/* Source */}
                        <td className="py-3 px-4 text-xs font-medium text-slate-600">
                          Codeforces
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4 text-center">
                          {c.isImported ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-200 text-slate-700">
                              Already Imported
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Ready to Import
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
