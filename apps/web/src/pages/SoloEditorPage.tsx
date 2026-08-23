import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { CodeEditor } from '../components/CodeEditor';
import {
  fetchProblemDetails,
  runCodeApi,
  submitCodeApi,
  fetchSubmissionsApi,
} from '../lib/api';
import {
  ProblemSummary,
  RunCodeResponseData,
  SubmissionSummary,
  SubmissionStatusType,
} from '@codecollab/shared';
import {
  ArrowLeft,
  BookOpen,
  Terminal,
  Play,
  Send,
  History,
  Clock,
  Cpu,
  AlertTriangle,
  Code2,
  Loader2,
  FileCode2,
  ExternalLink,
  CheckCircle2,
  XCircle,
  X,
} from 'lucide-react';

const STARTER_TEMPLATES: Record<string, string> = {
  cpp: `#include <bits/stdc++.h>
using namespace std;

int main() {
    // Write your C++ solution here
    return 0;
}
`,
  javascript: `/**
 * @param {any} input
 * @return {any}
 */
function solve() {
    // Write your JavaScript solution here
}
`,
  python: `# Write your Python solution here
def solve():
    pass
`,
};

type ActiveViewTab = 'problem' | 'results' | 'history';
type StatusState = 'idle' | 'running' | 'submitting' | 'success' | 'error';

export const SoloEditorPage: React.FC = () => {
  const { problemId } = useParams<{ problemId: string }>();
  const navigate = useNavigate();

  // Problem & Loading State
  const [problem, setProblem] = useState<ProblemSummary | null>(null);
  const [isLoadingProblem, setIsLoadingProblem] = useState(true);

  // Editor & Language State
  const [language, setLanguage] = useState<string>('cpp');
  const [codeContent, setCodeContent] = useState<string>(STARTER_TEMPLATES['cpp'] || '');
  const [pendingLanguage, setPendingLanguage] = useState<string | null>(null);
  const [showLanguageModal, setShowLanguageModal] = useState<boolean>(false);

  // Active View Tabs & Mobile View State
  const [activeTab, setActiveTab] = useState<ActiveViewTab>('problem');
  const [mobileTab, setMobileTab] = useState<'problem' | 'editor' | 'results'>('editor');

  // Execution & Submission State
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [executionType, setExecutionType] = useState<'run' | 'submit' | null>(null);
  const [editorStatus, setEditorStatus] = useState<StatusState>('idle');
  const [runResult, setRunResult] = useState<RunCodeResponseData | null>(null);
  const [latestSubmission, setLatestSubmission] = useState<SubmissionSummary | null>(null);
  const [submissionHistory, setSubmissionHistory] = useState<SubmissionSummary[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch Problem Details & Submission History
  useEffect(() => {
    if (!problemId) return;

    setIsLoadingProblem(true);
    setErrorMsg(null);

    Promise.all([
      fetchProblemDetails(problemId),
      fetchSubmissionsApi(problemId).catch(() => []),
    ])
      .then(([prob, history]) => {
        setProblem(prob);
        setSubmissionHistory(history);
      })
      .catch((err) => {
        console.error('Failed to load solo workspace:', err);
        setErrorMsg('Failed to load problem details.');
      })
      .finally(() => setIsLoadingProblem(false));
  }, [problemId]);

  // Unsaved Edits Warning on Window Close / Refresh
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const defaultTemplate = STARTER_TEMPLATES[language] || '';
      if (codeContent.trim() !== defaultTemplate.trim() && codeContent.trim().length > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [codeContent, language]);

  // Language Change Confirmation
  const handleLanguageSelect = (newLang: string) => {
    if (newLang === language) return;

    const currentDefault = STARTER_TEMPLATES[language] || '';
    const isModified = codeContent.trim() !== currentDefault.trim() && codeContent.trim().length > 0;

    if (isModified) {
      setPendingLanguage(newLang);
      setShowLanguageModal(true);
    } else {
      setLanguage(newLang);
      setCodeContent(STARTER_TEMPLATES[newLang] || '');
    }
  };

  const confirmLanguageChange = () => {
    if (pendingLanguage) {
      setLanguage(pendingLanguage);
      setCodeContent(STARTER_TEMPLATES[pendingLanguage] || '');
      setPendingLanguage(null);
    }
    setShowLanguageModal(false);
  };

  // Handle Run Code (Sample Tests)
  const handleRunCode = useCallback(async () => {
    if (!problem || isExecuting) return;

    setIsExecuting(true);
    setExecutionType('run');
    setEditorStatus('running');
    setErrorMsg(null);
    setLatestSubmission(null);

    try {
      const data = await runCodeApi(problem.id, language, codeContent);
      setRunResult(data);
      setEditorStatus(data.overallStatus === 'ACCEPTED' ? 'success' : 'error');
      setActiveTab('results');
      setMobileTab('results');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(`Run failed: ${msg}`);
      setEditorStatus('error');
    } finally {
      setIsExecuting(false);
      setExecutionType(null);
    }
  }, [problem, isExecuting, language, codeContent]);

  // Handle Submit Code (Full Evaluation)
  const handleSubmitCode = useCallback(async () => {
    if (!problem || isExecuting) return;

    setIsExecuting(true);
    setExecutionType('submit');
    setEditorStatus('submitting');
    setErrorMsg(null);
    setRunResult(null);

    try {
      const submission = await submitCodeApi(problem.id, null, language, codeContent);
      setLatestSubmission(submission);
      setEditorStatus(submission.status === 'ACCEPTED' ? 'success' : 'error');
      setActiveTab('results');
      setMobileTab('results');

      // Refresh Submission History
      const updatedHistory = await fetchSubmissionsApi(problem.id);
      setSubmissionHistory(updatedHistory);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(`Submission failed: ${msg}`);
      setEditorStatus('error');
    } finally {
      setIsExecuting(false);
      setExecutionType(null);
    }
  }, [problem, isExecuting, language, codeContent]);

  // Keyboard Shortcuts (Ctrl+Enter -> Run, Ctrl+Shift+Enter -> Submit)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) {
          handleSubmitCode();
        } else {
          handleRunCode();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleRunCode, handleSubmitCode]);

  const getStatusBadgeClass = (status: SubmissionStatusType | string) => {
    switch (status) {
      case 'ACCEPTED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'WRONG_ANSWER':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'COMPILATION_ERROR':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'TIME_LIMIT_EXCEEDED':
      case 'MEMORY_LIMIT_EXCEEDED':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const hasConfiguredTests = problem && problem.testCases && problem.testCases.length > 0;

  if (isLoadingProblem) {
    return (
      <div className="h-screen bg-slate-50 text-slate-900 flex flex-col justify-between p-4 sm:p-6 font-sans">
        <div className="animate-pulse space-y-4 max-w-6xl mx-auto w-full">
          <div className="h-10 bg-slate-200 rounded-xl w-full" />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(100vh-120px)]">
            <div className="lg:col-span-4 bg-slate-200 rounded-2xl h-full" />
            <div className="lg:col-span-8 bg-slate-800 rounded-2xl h-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!problem) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col items-center justify-center p-6 font-sans">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 max-w-md w-full text-center space-y-4 shadow-xs">
          <div className="w-12 h-12 bg-rose-50 border border-rose-200 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
            <BookOpen className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-slate-900">Problem Not Found</h2>
            <p className="text-xs text-slate-500">The requested coding problem workspace could not be loaded.</p>
          </div>
          <Link
            to="/problems"
            className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-xs transition-all w-full"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Problem Library
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-50 text-slate-900 overflow-hidden relative font-sans">
      {/* 1. TOP IDE HEADER */}
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-2.5 flex items-center justify-between shadow-2xs z-20 shrink-0 h-14">
        {/* Left: Navigation & Problem Title */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate(`/problems/${problem.id}`)}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-3 py-1.5 rounded-xl transition-all shrink-0 cursor-pointer"
            title="Return to Problem Details"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Problem</span>
          </button>

          <div className="h-4 w-px bg-slate-200 shrink-0 hidden sm:block" />

          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-sm font-bold text-slate-900 truncate max-w-[200px] sm:max-w-xs md:max-w-md">
              {problem.title}
            </h1>

            <span
              className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full border shrink-0 ${
                problem.difficulty === 'EASY'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : problem.difficulty === 'MEDIUM'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}
            >
              {problem.difficulty}
            </span>

            {problem.source === 'CODEFORCES' && (
              <span className="hidden md:inline-flex items-center px-2 py-0.5 text-[10px] font-bold rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
                Codeforces
              </span>
            )}
          </div>
        </div>

        {/* Right: Language Selector & Status Indicator */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Status Indicator */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-xl">
            {editorStatus === 'running' || editorStatus === 'submitting' ? (
              <>
                <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-amber-700 font-bold">
                  {editorStatus === 'running' ? 'Running...' : 'Submitting...'}
                </span>
              </>
            ) : editorStatus === 'success' ? (
              <>
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-emerald-700 font-bold">✓ Ready</span>
              </>
            ) : editorStatus === 'error' ? (
              <>
                <span className="h-2 w-2 rounded-full bg-rose-500" />
                <span className="text-rose-700 font-bold">⚠ Error</span>
              </>
            ) : (
              <>
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span>Ready</span>
              </>
            )}
          </div>

          {/* Language Selector */}
          <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 px-3 py-1 rounded-xl text-xs font-semibold">
            <FileCode2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <select
              value={language}
              onChange={(e) => handleLanguageSelect(e.target.value)}
              className="bg-transparent text-slate-900 font-bold focus:outline-none cursor-pointer text-xs"
            >
              <option value="cpp">C++</option>
              <option value="javascript">JavaScript</option>
              <option value="python">Python</option>
            </select>
          </div>
        </div>
      </header>

      {/* ERROR ALERT BANNER */}
      {errorMsg && (
        <div className="bg-rose-50 border-b border-rose-200 px-4 py-2 flex items-center justify-between text-rose-700 text-xs font-semibold z-10 shrink-0">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            onClick={() => setErrorMsg(null)}
            className="text-rose-800 underline text-[11px] cursor-pointer hover:text-rose-950"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* MOBILE TABS SWITCHER (Visible only on small screens) */}
      <div className="lg:hidden bg-white border-b border-slate-200 px-3 py-1.5 flex items-center justify-around text-xs font-bold shrink-0">
        <button
          onClick={() => setMobileTab('problem')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
            mobileTab === 'problem'
              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" /> Problem
        </button>
        <button
          onClick={() => setMobileTab('editor')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
            mobileTab === 'editor'
              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Code2 className="w-3.5 h-3.5" /> Code Editor
        </button>
        <button
          onClick={() => setMobileTab('results')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
            mobileTab === 'results'
              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Terminal className="w-3.5 h-3.5" /> Results
        </button>
      </div>

      {/* 2. MAIN WORKSPACE CONTENT */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 p-3 overflow-hidden">
        {/* LEFT PANEL: PROBLEM STATEMENT & DETAILS (30-35% on Desktop) */}
        <div
          className={`lg:col-span-4 xl:col-span-4 bg-white border border-slate-200 rounded-2xl flex flex-col overflow-hidden shadow-2xs ${
            mobileTab === 'problem' ? 'flex' : 'hidden lg:flex'
          }`}
        >
          {/* Tabs Navigation Header */}
          <div className="p-2 border-b border-slate-200 bg-slate-50 flex items-center gap-1 shrink-0">
            <button
              onClick={() => setActiveTab('problem')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'problem'
                  ? 'bg-white text-indigo-600 shadow-2xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
              <span>Problem</span>
            </button>

            <button
              onClick={() => setActiveTab('results')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'results'
                  ? 'bg-white text-indigo-600 shadow-2xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Terminal className="w-3.5 h-3.5 text-emerald-600" />
              <span>Test Results</span>
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-white text-indigo-600 shadow-2xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <History className="w-3.5 h-3.5 text-amber-600" />
              <span>History</span>
            </button>
          </div>

          {/* Scrollable Tab Panel Content */}
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-5">
            {/* TAB 1: PROBLEM STATEMENT */}
            {activeTab === 'problem' && (
              <div className="space-y-5">
                {/* Header Metadata */}
                <div className="space-y-2 pb-3 border-b border-slate-100">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`px-2.5 py-0.5 text-xs font-bold rounded-full border ${
                        problem.difficulty === 'EASY'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : problem.difficulty === 'MEDIUM'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}
                    >
                      {problem.difficulty}
                    </span>

                    {problem.source === 'CODEFORCES' ? (
                      <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                        Source: Codeforces
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                        Internal
                      </span>
                    )}

                    {problem.externalRating && (
                      <span className="px-2.5 py-0.5 text-xs font-mono font-bold rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                        Rating: {problem.externalRating}
                      </span>
                    )}
                  </div>

                  <h2 className="text-lg font-extrabold text-slate-900 tracking-tight leading-snug">
                    {problem.title}
                  </h2>

                  {problem.sourceUrl && (
                    <a
                      href={problem.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:underline pt-1"
                    >
                      <span>Open original problem on Codeforces</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                {/* Problem Tags */}
                {problem.tags && problem.tags.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-xs text-slate-400 font-medium mr-1">Tags:</span>
                    {problem.tags.map((t, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-600 rounded border border-slate-200"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}

                {/* Warning if test cases are missing */}
                {!hasConfiguredTests && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-start gap-2.5 text-amber-900 text-xs">
                    <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div className="font-bold">Test Cases Not Configured</div>
                      <div className="text-[11px] leading-relaxed">
                        Execution tests are not configured for this problem yet. You can still write code solo and verify logic locally.
                      </div>
                    </div>
                  </div>
                )}

                {/* Description */}
                <div className="space-y-1.5">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Description</h3>
                  <div className="text-xs text-slate-700 leading-relaxed bg-slate-50/80 border border-slate-200/80 p-3.5 rounded-xl whitespace-pre-line font-normal">
                    {problem.description}
                  </div>
                </div>

                {/* Constraints */}
                {problem.constraints && (
                  <div className="space-y-1.5">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Constraints</h3>
                    <pre className="text-xs bg-slate-50 p-3 rounded-xl border border-slate-200 font-mono text-indigo-700 whitespace-pre-line font-medium leading-relaxed">
                      {problem.constraints}
                    </pre>
                  </div>
                )}

                {/* Public Examples */}
                {problem.testCases && problem.testCases.filter((tc) => !tc.isHidden).length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Sample Examples</h3>
                    <div className="space-y-2.5">
                      {problem.testCases
                        .filter((tc) => !tc.isHidden)
                        .map((tc, idx) => (
                          <div
                            key={tc.id}
                            className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2 font-mono text-xs"
                          >
                            <div className="font-sans font-bold text-slate-700 text-xs">Example {idx + 1}:</div>
                            <div className="grid grid-cols-1 gap-2 pt-0.5">
                              <div className="bg-white border border-slate-200 p-2 rounded-lg">
                                <span className="text-[10px] text-slate-400 block font-sans font-bold uppercase">Input:</span>
                                <span className="text-slate-800 font-bold">{tc.input}</span>
                              </div>
                              <div className="bg-white border border-slate-200 p-2 rounded-lg">
                                <span className="text-[10px] text-slate-400 block font-sans font-bold uppercase">Expected Output:</span>
                                <span className="text-emerald-700 font-bold">{tc.expectedOutput}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: TEST RESULTS */}
            {activeTab === 'results' && (
              <div className="space-y-4">
                {isExecuting ? (
                  <div className="p-8 text-center space-y-3 bg-slate-50 rounded-2xl border border-slate-200">
                    <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-slate-800">
                        {executionType === 'run' ? 'Running Sample Test Cases...' : 'Evaluating Full Submission Suite...'}
                      </p>
                      <p className="text-[11px] text-slate-500">Compiling and executing in isolated sandbox...</p>
                    </div>
                  </div>
                ) : runResult ? (
                  /* RUN RESULTS */
                  <div className="space-y-4">
                    <div className="flex items-center justify-between bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                      <div className="flex items-center gap-2">
                        {runResult.overallStatus === 'ACCEPTED' ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        ) : (
                          <XCircle className="w-5 h-5 text-rose-600" />
                        )}
                        <span
                          className={`px-2.5 py-1 text-xs font-bold rounded-lg border ${getStatusBadgeClass(
                            runResult.overallStatus
                          )}`}
                        >
                          {runResult.overallStatus}
                        </span>
                      </div>
                      <span className="text-xs font-mono font-bold text-slate-700">
                        {runResult.passedTestCases}/{runResult.totalTestCases} Sample Cases Passed
                      </span>
                    </div>

                    <div className="space-y-2.5">
                      {runResult.testResults.map((tr, idx) => (
                        <div
                          key={tr.testCaseId || idx}
                          className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs font-mono"
                        >
                          <div className="flex items-center justify-between font-sans pb-1 border-b border-slate-200/60">
                            <span className="font-bold text-slate-800">
                              {tr.isHidden ? `Hidden Test Case ${idx + 1}` : `Sample Test Case ${idx + 1}`}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                                tr.status === 'ACCEPTED'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-rose-50 text-rose-700 border-rose-200'
                              }`}
                            >
                              {tr.status}
                            </span>
                          </div>

                          {!tr.isHidden ? (
                            <div className="space-y-1.5 pt-1">
                              {tr.input && (
                                <div className="bg-white border border-slate-200 p-2 rounded-lg">
                                  <span className="text-[10px] text-slate-400 block font-sans font-bold">Input:</span>
                                  <span className="text-slate-800">{tr.input}</span>
                                </div>
                              )}
                              {tr.expectedOutput && (
                                <div className="bg-white border border-slate-200 p-2 rounded-lg">
                                  <span className="text-[10px] text-slate-400 block font-sans font-bold">Expected:</span>
                                  <span className="text-emerald-700 font-bold">{tr.expectedOutput}</span>
                                </div>
                              )}
                              {tr.actualOutput && (
                                <div className="bg-white border border-slate-200 p-2 rounded-lg">
                                  <span className="text-[10px] text-slate-400 block font-sans font-bold">Actual Output:</span>
                                  <span className="text-indigo-700 font-bold">{tr.actualOutput}</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-[11px] text-slate-500 font-sans italic pt-1">
                              Hidden test inputs and outputs are protected.
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : latestSubmission ? (
                  /* SUBMISSION RESULTS */
                  <div className="space-y-4">
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {latestSubmission.status === 'ACCEPTED' ? (
                            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                          ) : (
                            <XCircle className="w-6 h-6 text-rose-600" />
                          )}
                          <span
                            className={`px-3 py-1 text-xs font-bold rounded-lg border ${getStatusBadgeClass(
                              latestSubmission.status
                            )}`}
                          >
                            {latestSubmission.status}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-xs font-mono text-slate-600">
                          {latestSubmission.executionTime !== null && (
                            <span className="flex items-center gap-1 font-bold">
                              <Clock className="w-3.5 h-3.5 text-indigo-600" />
                              {latestSubmission.executionTime} ms
                            </span>
                          )}
                          {latestSubmission.memoryUsed !== null && (
                            <span className="flex items-center gap-1 font-bold">
                              <Cpu className="w-3.5 h-3.5 text-amber-600" />
                              {latestSubmission.memoryUsed} KB
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="bg-white border border-slate-200 p-3 rounded-xl text-xs font-mono text-slate-700 space-y-1">
                        <div>
                          Status: <strong>{latestSubmission.status}</strong>
                        </div>
                        <div>
                          Passed:{' '}
                          <strong>
                            {latestSubmission.passedTestCases || 0} / {latestSubmission.totalTestCases || 0}
                          </strong>{' '}
                          test cases
                        </div>
                        <div>
                          Language: <strong className="uppercase">{latestSubmission.language}</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl space-y-3">
                    <Terminal className="w-8 h-8 text-slate-300 mx-auto" />
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-slate-800">No Execution Results Yet</p>
                      <p className="text-[11px] text-slate-500">
                        Click <strong>Run</strong> to test sample cases or <strong>Submit Solution</strong> to evaluate your solution.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: SUBMISSION HISTORY */}
            {activeTab === 'history' && (
              <div className="space-y-3">
                {submissionHistory.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl space-y-3">
                    <History className="w-8 h-8 text-slate-300 mx-auto" />
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-slate-800">No Submissions Yet</p>
                      <p className="text-[11px] text-slate-500">
                        Submit your code solution to build your evaluation history for this problem.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {submissionHistory.map((sub) => (
                      <div
                        key={sub.id}
                        className="bg-slate-50 hover:bg-slate-100/80 border border-slate-200 p-3 rounded-xl flex items-center justify-between text-xs font-mono transition-colors"
                      >
                        <div className="space-y-1">
                          <span
                            className={`px-2 py-0.5 text-[10px] font-bold rounded border inline-block ${getStatusBadgeClass(
                              sub.status
                            )}`}
                          >
                            {sub.status}
                          </span>
                          <div className="text-[10px] text-slate-400 font-sans">
                            {new Date(sub.createdAt).toLocaleString()}
                          </div>
                        </div>

                        <div className="text-right text-slate-600 space-y-0.5">
                          <span className="uppercase font-bold text-indigo-700 text-xs">{sub.language}</span>
                          <div className="text-[10px] text-slate-500 font-mono">
                            {sub.executionTime !== null ? `${sub.executionTime} ms` : '—'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL: MONACO EDITOR & TOOLBAR (65-70% on Desktop) */}
        <div
          className={`lg:col-span-8 xl:col-span-8 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col overflow-hidden shadow-sm ${
            mobileTab === 'editor' || mobileTab === 'results' ? 'flex' : 'hidden lg:flex'
          }`}
        >
          {/* Monaco Code Editor Container */}
          <div className="flex-1 min-h-[320px] relative">
            <CodeEditor
              value={codeContent}
              onChange={(val) => setCodeContent(val)}
              language={language}
            />
          </div>

          {/* Bottom Execution Control Bar */}
          <div className="bg-slate-950 border-t border-slate-800 p-3.5 flex items-center justify-between gap-4 shrink-0">
            {/* Status & Keyboard Shortcut Tooltip */}
            <div className="hidden sm:flex items-center gap-3 text-xs font-mono text-slate-400">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
                <span>IDE Ready</span>
              </div>
              <span className="text-slate-700">•</span>
              <div className="text-[11px] text-slate-500">
                <kbd className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded border border-slate-700 font-sans">
                  Ctrl+Enter
                </kbd>{' '}
                Run |{' '}
                <kbd className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded border border-slate-700 font-sans">
                  Ctrl+Shift+Enter
                </kbd>{' '}
                Submit
              </div>
            </div>

            <div className="flex items-center gap-3 ml-auto">
              {/* ▶ Run Button */}
              <button
                onClick={handleRunCode}
                disabled={isExecuting || !hasConfiguredTests}
                title={!hasConfiguredTests ? 'Execution tests not configured' : 'Run sample test cases'}
                className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs px-4 py-2.5 rounded-xl border border-slate-700 transition-all shadow-xs disabled:opacity-40 cursor-pointer active:scale-95"
              >
                {isExecuting && executionType === 'run' ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                    <span>Running...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
                    <span>Run</span>
                  </>
                )}
              </button>

              {/* Submit Solution Button */}
              <button
                onClick={handleSubmitCode}
                disabled={isExecuting || !hasConfiguredTests}
                title={!hasConfiguredTests ? 'Execution tests not configured' : 'Submit solution for evaluation'}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-xs transition-all disabled:opacity-40 cursor-pointer active:scale-95"
              >
                {isExecuting && executionType === 'submit' ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Submit Solution</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* LANGUAGE SWITCH CONFIRMATION MODAL */}
      {showLanguageModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl relative">
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 bg-amber-50 border border-amber-200 text-amber-600 rounded-xl flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <button
                onClick={() => setShowLanguageModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-1">
              <h3 className="font-bold text-base text-slate-900">Change Programming Language?</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Changing language will reset your editor code to the default starter template for{' '}
                <strong className="uppercase text-slate-900">{pendingLanguage}</strong>.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowLanguageModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmLanguageChange}
                className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-xs cursor-pointer"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
