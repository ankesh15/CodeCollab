import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { fetchProblemDetails, fetchRooms } from '../lib/api';
import { ProblemSummary, RoomSummary } from '@codecollab/shared';
import { useAuth } from '../context/AuthContext';
import {
  BookOpen,
  Code2,
  Users,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  RefreshCw,
  X,
  User as UserIcon,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react';

export const ProblemDetailPage: React.FC = () => {
  const { problemId } = useParams<{ problemId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [problem, setProblem] = useState<ProblemSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Room Selection Modal State
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [availableRooms, setAvailableRooms] = useState<RoomSummary[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);

  useEffect(() => {
    if (!problemId) return;

    setIsLoading(true);
    setHasError(false);

    fetchProblemDetails(problemId)
      .then((data) => setProblem(data))
      .catch((err) => {
        console.error('Failed to fetch problem details:', err);
        setHasError(true);
      })
      .finally(() => setIsLoading(false));
  }, [problemId]);

  const handleOpenRoomModal = async () => {
    if (!user) {
      navigate('/login');
      return;
    }

    setShowRoomModal(true);
    setIsLoadingRooms(true);

    try {
      const rooms = await fetchRooms();
      setAvailableRooms(rooms);
    } catch (err) {
      console.error('Failed to fetch available rooms:', err);
    } finally {
      setIsLoadingRooms(false);
    }
  };

  const handlePracticeSolo = () => {
    if (!user) {
      navigate('/login');
      return;
    }
    navigate(`/problems/${problemId}/solve`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col justify-between">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex-1 w-full space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-8 animate-pulse space-y-4">
            <div className="h-6 w-32 bg-slate-200 rounded" />
            <div className="h-8 w-64 bg-slate-200 rounded" />
            <div className="h-24 bg-slate-100 rounded" />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (hasError || !problem) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col justify-between">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex-1 w-full flex items-center justify-center">
          <div className="bg-white border border-slate-200 rounded-2xl p-8 max-w-md w-full text-center space-y-4 shadow-xs">
            <div className="w-12 h-12 bg-rose-50 border border-rose-200 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
              <BookOpen className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-slate-900">Problem Not Found</h2>
              <p className="text-xs text-slate-500">
                The requested coding problem could not be loaded or does not exist.
              </p>
            </div>
            <Link
              to="/problems"
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs transition-all"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Problem Library
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-500 selection:text-white flex flex-col justify-between">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-8 flex-1 w-full">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          <Link to="/problems" className="hover:text-indigo-600 transition-colors flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Problem Library
          </Link>
          <span>/</span>
          <span className="text-slate-900 font-bold">{problem.title}</span>
        </div>

        {/* MAIN 2-COLUMN LAYOUT */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* LEFT COLUMN: PROBLEM DETAILS (7 COLS) */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xs">
            {/* Title & Badge Header */}
            <div className="space-y-4 border-b border-slate-100 pb-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`px-3 py-1 text-xs font-bold rounded-full border ${
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
                    <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                      Source: Codeforces
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                      Internal Problem
                    </span>
                  )}

                  {problem.externalRating && (
                    <span className="px-2.5 py-1 text-xs font-mono font-bold rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                      Rating: {problem.externalRating}
                    </span>
                  )}
                </div>

                <span className="text-xs font-mono text-slate-400">ID: {problem.sourceId || problem.id.slice(0, 8)}</span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  {problem.title}
                </h1>

                {problem.sourceUrl && (
                  <a
                    href={problem.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-xl hover:bg-indigo-100 transition-colors w-fit"
                  >
                    <span>Open original problem ↗</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>

              {/* Problem Tags */}
              {problem.tags && problem.tags.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-xs font-medium text-slate-400 mr-1">Tags:</span>
                  {problem.tags.map((t, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-0.5 text-xs bg-slate-100 text-slate-700 rounded-md border border-slate-200 font-medium"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Test Cases Warning Banner for imported problems without local test cases */}
            {(!problem.testCases || problem.testCases.length === 0) && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 text-amber-900 text-xs">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-bold">Code Execution Tests Not Configured</div>
                  <div>
                    Code execution tests are not configured for this imported problem yet. You can still practice solving this problem solo or in a collaborative room.
                  </div>
                </div>
              </div>
            )}

            {/* Description */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Description</h3>
              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line font-normal">
                {problem.description}
              </p>
            </div>

            {/* Input & Output Formats */}
            {(problem.inputFormat || problem.outputFormat) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {problem.inputFormat && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-1">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Input Format</h4>
                    <p className="text-xs text-slate-600 leading-relaxed font-mono">{problem.inputFormat}</p>
                  </div>
                )}
                {problem.outputFormat && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-1">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Output Format</h4>
                    <p className="text-xs text-slate-600 leading-relaxed font-mono">{problem.outputFormat}</p>
                  </div>
                )}
              </div>
            )}

            {/* Constraints */}
            {problem.constraints && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Constraints</h3>
                <pre className="text-xs bg-slate-50 p-4 rounded-xl border border-slate-200 font-mono text-indigo-700 whitespace-pre-line font-medium leading-relaxed">
                  {problem.constraints}
                </pre>
              </div>
            )}

            {/* Sample Test Cases / Examples */}
            {problem.testCases && problem.testCases.filter((tc) => !tc.isHidden).length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Public Examples</h3>
                <div className="space-y-3">
                  {problem.testCases
                    .filter((tc) => !tc.isHidden)
                    .map((tc, idx) => (
                      <div key={tc.id} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 font-mono text-xs">
                        <div className="font-bold text-slate-700">Example {idx + 1}:</div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                          <div className="bg-white border border-slate-200 p-2.5 rounded-lg">
                            <span className="text-[10px] text-slate-400 block font-sans font-bold">Input:</span>
                            <span className="text-slate-800 font-bold">{tc.input}</span>
                          </div>
                          <div className="bg-white border border-slate-200 p-2.5 rounded-lg">
                            <span className="text-[10px] text-slate-400 block font-sans font-bold">Expected Output:</span>
                            <span className="text-emerald-700 font-bold">{tc.expectedOutput}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: CHOICE CARDS (5 COLS) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xs">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-md">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Choose Your Workspace</span>
                </div>
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">How do you want to solve this?</h2>
                <p className="text-xs text-slate-500">Select solo mode for independent practice or open in a collaborative room.</p>
              </div>

              {/* CARD 1: PRACTICE SOLO */}
              <div className="bg-slate-50 border border-slate-200 hover:border-indigo-300 rounded-2xl p-6 space-y-4 transition-all shadow-xs group">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center shrink-0 shadow-xs">
                    <Code2 className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-bold text-base text-slate-900 group-hover:text-indigo-600 transition-colors">
                      💻 Practice Solo
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Solve the problem by yourself in your own dedicated coding workspace with full execution and submission features.
                    </p>
                  </div>
                </div>

                <button
                  onClick={handlePracticeSolo}
                  className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-3 rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer"
                >
                  <span>Practice Solo</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              {/* CARD 2: OPEN IN ROOM */}
              <div className="bg-slate-50 border border-slate-200 hover:border-emerald-300 rounded-2xl p-6 space-y-4 transition-all shadow-xs group">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-emerald-600 text-white rounded-xl flex items-center justify-center shrink-0 shadow-xs">
                    <Users className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-bold text-base text-slate-900 group-hover:text-emerald-700 transition-colors">
                      👥 Open in Room
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Collaborate with other developers in a real-time collaborative coding room with shared editor and live chat.
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleOpenRoomModal}
                  className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-3 rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer"
                >
                  <span>Open in Room</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ROOM SELECTION MODAL */}
      {showRoomModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-xl relative">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900">Open "{problem.title}" in a Room</h3>
                <p className="text-xs text-slate-500">Select an active room to carry this problem into.</p>
              </div>
              <button
                onClick={() => setShowRoomModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isLoadingRooms ? (
              <div className="p-8 text-center text-xs text-slate-500 space-y-2">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-600" />
                <p>Loading active coding rooms...</p>
              </div>
            ) : availableRooms.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-3">
                <Users className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs text-slate-600 font-semibold">No active coding rooms found.</p>
                <Link
                  to="/rooms"
                  className="inline-block bg-indigo-600 text-white font-bold text-xs px-4 py-2 rounded-xl"
                >
                  Explore / Create Room
                </Link>
              </div>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                {availableRooms.map((room) => (
                  <div
                    key={room.id}
                    className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl flex items-center justify-between hover:border-indigo-300 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-xs text-slate-900">{room.name}</h4>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            room.isPrivate
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {room.isPrivate ? 'PRIVATE' : 'PUBLIC'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-2">
                        <span><UserIcon className="w-3 h-3 inline text-slate-400" /> {room.ownerUsername}</span>
                        <span>•</span>
                        <span>{room.memberCount} Members</span>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setShowRoomModal(false);
                        navigate(`/rooms/${room.id}?problemId=${problem.id}`);
                      }}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-3 py-1.5 rounded-xl transition-all shadow-xs cursor-pointer"
                    >
                      Join & Solve →
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <Link
                to="/rooms"
                className="text-xs font-bold text-indigo-600 hover:underline"
              >
                Browse All Rooms →
              </Link>
              <button
                onClick={() => setShowRoomModal(false)}
                className="text-xs text-slate-500 hover:text-slate-800 font-semibold cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};
