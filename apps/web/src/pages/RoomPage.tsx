import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CodeEditor } from '../components/CodeEditor';
import { RoomChat } from '../components/RoomChat';
import { useAuth } from '../context/AuthContext';
import { connectSocket } from '../lib/socket';
import {
  fetchRoomDetails,
  fetchProblems,
  fetchDocument,
  updateDocumentLanguageApi,
  runCodeApi,
  submitCodeApi,
  fetchSubmissionsApi,
  fetchRoomLeaderboardApi,
} from '../lib/api';
import { LeaderboardTable } from '../components/LeaderboardTable';
import {
  SOCKET_EVENTS,
  RoomUser,
  RoomStatePayload,
  RoomUserJoinedPayload,
  RoomUserLeftPayload,
  DocumentStatePayload,
  EditorChangePayload,
  EditorCursorPayload,
  EditorLanguagePayload,
  SubmissionCompletedPayload,
  SocketErrorPayload,
  ProblemSummary,
  RunCodeResponseData,
  SubmissionSummary,
  SubmissionStatusType,
  RoomLeaderboardEntry,
} from '@codecollab/shared';
import {
  ArrowLeft,
  Users,
  Lock,
  Globe,
  AlertTriangle,
  Play,
  Send,
  CheckCircle2,
  XCircle,
  FileCode2,
  BookOpen,
  History,
  Clock,
  Cpu,
  Loader2,
  Terminal,
  MessageSquare,
  Trophy,
  Code2,
  Info,
  X,
  DoorOpen,
  WifiOff,
} from 'lucide-react';

interface ToastNotification {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

export const RoomPage: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const { token, user } = useAuth();
  const navigate = useNavigate();

  // Room & Document State
  const [roomDetails, setRoomDetails] = useState<{ name: string; isPrivate: boolean; language: string; ownerId?: string } | null>(null);
  const [codeContent, setCodeContent] = useState<string>('');
  const [language, setLanguage] = useState<string>('cpp');
  const [documentVersion, setDocumentVersion] = useState<number>(1);
  const [onlineUsers, setOnlineUsers] = useState<RoomUser[]>([]);
  const [userCursors, setUserCursors] = useState<Record<string, { lineNumber: number; column: number }>>({});
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<'Synced' | 'Syncing...' | 'Error'>('Synced');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [accessError, setAccessError] = useState<'404' | '403' | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);

  // Problem Library & Active Problem State
  const [problems, setProblems] = useState<ProblemSummary[]>([]);
  const [selectedProblem, setSelectedProblem] = useState<ProblemSummary | null>(null);

  // Active Panel Tab: 'problem' | 'results' | 'history' | 'chat' | 'leaderboard'
  const [activeTab, setActiveTab] = useState<'problem' | 'results' | 'history' | 'chat' | 'leaderboard'>('problem');
  const [roomLeaderboard, setRoomLeaderboard] = useState<RoomLeaderboardEntry[]>([]);
  const [loadingRoomLeaderboard, setLoadingRoomLeaderboard] = useState<boolean>(false);

  // Toasts
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  const addToast = useCallback((message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev.slice(-3), { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Fetch Room Leaderboard when tab becomes active
  useEffect(() => {
    if (activeTab === 'leaderboard' && roomId) {
      setLoadingRoomLeaderboard(true);
      fetchRoomLeaderboardApi(roomId)
        .then((data) => setRoomLeaderboard(data.leaderboard))
        .catch((err) => console.error('Failed to fetch room leaderboard:', err))
        .finally(() => setLoadingRoomLeaderboard(false));
    }
  }, [activeTab, roomId]);

  // Code Execution & Submission State
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [runResult, setRunResult] = useState<RunCodeResponseData | null>(null);
  const [latestSubmission, setLatestSubmission] = useState<SubmissionSummary | null>(null);
  const [submissionHistory, setSubmissionHistory] = useState<SubmissionSummary[]>([]);

  // Socket reference & debounced change timeout
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const socketRef = useRef<any>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isRemoteChangeRef = useRef<boolean>(false);

  // 1. Fetch Room Details, Document, and Problems via REST API
  useEffect(() => {
    if (!roomId || !token) return;

    setIsInitialLoading(true);

    Promise.all([
      fetchRoomDetails(roomId)
        .then((room) => {
          setRoomDetails({
            name: room.name,
            isPrivate: room.isPrivate,
            language: room.language,
            ownerId: room.ownerId,
          });
          setLanguage(room.language || 'cpp');
        })
        .catch((err: Error & { status?: number }) => {
          if (err.status === 404 || err.message?.includes('404')) {
            setAccessError('404');
          } else if (err.status === 403 || err.message?.includes('403')) {
            setAccessError('403');
          } else {
            setErrorMsg(err.message || 'Failed to fetch room details.');
          }
        }),

      fetchDocument(roomId)
        .then((doc) => {
          setCodeContent(doc.content);
          setLanguage(doc.language);
          setDocumentVersion(doc.version);
        })
        .catch((err) => console.error('REST Document Fetch fallback error:', err)),

      fetchProblems()
        .then((probs) => {
          setProblems(probs);
          if (probs.length > 0) {
            const queryParams = new URLSearchParams(window.location.search);
            const targetProblemId = queryParams.get('problemId');
            const targetProblem = targetProblemId
              ? probs.find((p) => p.id === targetProblemId)
              : null;
            setSelectedProblem(targetProblem || probs[0] || null);
          }
        })
        .catch((err) => console.error('Failed to fetch problems:', err)),
    ]).finally(() => {
      setIsInitialLoading(false);
    });
  }, [roomId, token]);

  // Fetch Submissions History when selected problem changes
  useEffect(() => {
    if (!selectedProblem) return;
    fetchSubmissionsApi(selectedProblem.id)
      .then((history) => setSubmissionHistory(history))
      .catch((err) => console.error('Failed to fetch submission history:', err));
  }, [selectedProblem]);

  // 2. Connect Real-Time Socket.IO & Listeners
  useEffect(() => {
    if (!token || !roomId) return;

    let socketInstance: ReturnType<typeof connectSocket>;

    try {
      socketInstance = connectSocket(token);
      socketRef.current = socketInstance;

      const handleConnect = () => {
        setIsConnected(true);
        socketInstance.emit(SOCKET_EVENTS.ROOM_JOIN, { roomId });
      };

      if (socketInstance.connected) {
        handleConnect();
      } else {
        socketInstance.on('connect', handleConnect);
      }

      // Socket Event Listeners
      socketInstance.on(SOCKET_EVENTS.ROOM_STATE, (payload: RoomStatePayload) => {
        if (payload.roomId === roomId) {
          setOnlineUsers(payload.users);
        }
      });

      socketInstance.on(SOCKET_EVENTS.ROOM_USER_JOINED, (payload: RoomUserJoinedPayload) => {
        if (payload.roomId === roomId) {
          setOnlineUsers((prev) => {
            const exists = prev.some((u) => u.userId === payload.user.userId);
            if (exists) return prev;
            return [...prev, payload.user];
          });
          addToast(`${payload.user.username} joined the room`, 'info');
        }
      });

      socketInstance.on(SOCKET_EVENTS.ROOM_USER_LEFT, (payload: RoomUserLeftPayload) => {
        if (payload.roomId === roomId) {
          setOnlineUsers((prev) => prev.filter((u) => u.userId !== payload.user.userId));
          setUserCursors((prev) => {
            const updated = { ...prev };
            delete updated[payload.user.userId];
            return updated;
          });
          addToast(`${payload.user.username} left the room`, 'info');
        }
      });

      socketInstance.on(SOCKET_EVENTS.DOCUMENT_STATE, (payload: DocumentStatePayload) => {
        if (payload.roomId === roomId) {
          isRemoteChangeRef.current = true;
          setCodeContent(payload.document.content);
          setLanguage(payload.document.language);
          setDocumentVersion(payload.document.version);
          setSyncStatus('Synced');
        }
      });

      socketInstance.on(SOCKET_EVENTS.EDITOR_CHANGE, (payload: EditorChangePayload) => {
        if (payload.roomId === roomId) {
          isRemoteChangeRef.current = true;
          setCodeContent(payload.content);
          setDocumentVersion(payload.version);
          setSyncStatus('Synced');
        }
      });

      socketInstance.on(SOCKET_EVENTS.EDITOR_CURSOR, (payload: EditorCursorPayload) => {
        if (payload.roomId === roomId && payload.user) {
          setUserCursors((prev) => ({
            ...prev,
            [payload.user.userId]: payload.position,
          }));
        }
      });

      socketInstance.on(SOCKET_EVENTS.EDITOR_LANGUAGE, (payload: EditorLanguagePayload) => {
        if (payload.roomId === roomId) {
          setLanguage(payload.language);
        }
      });

      // Real-Time Room Submission Notification
      socketInstance.on(SOCKET_EVENTS.SUBMISSION_COMPLETED, (payload: SubmissionCompletedPayload) => {
        if (payload.roomId === roomId) {
          const isAccepted = payload.status === 'ACCEPTED';
          addToast(
            `${payload.user.username} submitted solution: ${payload.status} (${payload.passedTestCases || 0}/${payload.totalTestCases || 0} passed)`,
            isAccepted ? 'success' : 'warning'
          );
        }
      });

      socketInstance.on(SOCKET_EVENTS.ERROR, (payload: SocketErrorPayload) => {
        if (payload.code === 'DOCUMENT_VERSION_CONFLICT') {
          setSyncStatus('Error');
          fetchDocument(roomId).then((doc) => {
            isRemoteChangeRef.current = true;
            setCodeContent(doc.content);
            setDocumentVersion(doc.version);
            setSyncStatus('Synced');
          });
        } else {
          setErrorMsg(`[${payload.code}] ${payload.message}`);
        }
      });

      socketInstance.on('disconnect', () => {
        setIsConnected(false);
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
    }

    return () => {
      if (socketInstance && socketInstance.connected) {
        socketInstance.emit(SOCKET_EVENTS.ROOM_LEAVE, { roomId });
      }
    };
  }, [roomId, token, addToast]);

  // 3. Handle Editor Content Change & Socket Emit (Debounced ~250ms)
  const handleEditorChange = useCallback(
    (newVal: string) => {
      if (isRemoteChangeRef.current) {
        isRemoteChangeRef.current = false;
        return;
      }

      setCodeContent(newVal);
      setSyncStatus('Syncing...');

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        if (socketRef.current && roomId) {
          const nextVersion = documentVersion + 1;
          setDocumentVersion(nextVersion);

          socketRef.current.emit(SOCKET_EVENTS.EDITOR_CHANGE, {
            roomId,
            content: newVal,
            version: nextVersion,
          });

          setSyncStatus('Synced');
        }
      }, 250);
    },
    [roomId, documentVersion]
  );

  // 4. Handle Local Cursor Position Emissions
  const handleCursorChange = useCallback(
    (position: { lineNumber: number; column: number }) => {
      if (socketRef.current && roomId) {
        socketRef.current.emit(SOCKET_EVENTS.EDITOR_CURSOR, {
          roomId,
          position,
        });
      }
    },
    [roomId]
  );

  // 5. Handle Language Selection Change
  const handleLanguageChange = async (newLang: string) => {
    setLanguage(newLang);
    if (!roomId) return;

    try {
      await updateDocumentLanguageApi(roomId, newLang);
      if (socketRef.current) {
        socketRef.current.emit(SOCKET_EVENTS.EDITOR_LANGUAGE, {
          roomId,
          language: newLang,
        });
      }
    } catch (err) {
      console.error('Failed to change room language:', err);
    }
  };

  // 6. Handle Run Code Execution (Public Test Cases Only)
  const handleRunCode = async () => {
    if (!selectedProblem || isExecuting) return;
    setIsExecuting(true);
    setErrorMsg(null);
    setLatestSubmission(null);

    try {
      const data = await runCodeApi(selectedProblem.id, language, codeContent);
      setRunResult(data);
      setActiveTab('results');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(`Run execution failed: ${msg}`);
    } finally {
      setIsExecuting(false);
    }
  };

  // 7. Handle Code Submission (Public + Hidden Test Cases)
  const handleSubmitCode = async () => {
    if (!selectedProblem || isExecuting) return;
    setIsExecuting(true);
    setErrorMsg(null);
    setRunResult(null);

    try {
      const submission = await submitCodeApi(selectedProblem.id, roomId || null, language, codeContent);
      setLatestSubmission(submission);
      setActiveTab('results');

      // Refresh Submission History
      const updatedHistory = await fetchSubmissionsApi(selectedProblem.id);
      setSubmissionHistory(updatedHistory);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(`Submission failed: ${msg}`);
    } finally {
      setIsExecuting(false);
    }
  };

  // Helper badge color renderer for status
  const getStatusBadge = (status: SubmissionStatusType) => {
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

  // 404 Room Not Found Error Screen
  if (accessError === '404') {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col items-center justify-center p-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 max-w-md w-full text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-500">
            <DoorOpen className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-extrabold text-slate-900">Room Not Found</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            The coding room you are looking for does not exist or may have been deleted.
          </p>
          <button
            onClick={() => navigate('/rooms')}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2.5 rounded-xl transition-all shadow-sm"
          >
            Back to Coding Rooms
          </button>
        </div>
      </div>
    );
  }

  // 403 Forbidden Access Screen
  if (accessError === '403') {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col items-center justify-center p-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 max-w-md w-full text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 bg-rose-50 rounded-full flex items-center justify-center mx-auto text-rose-600">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-extrabold text-slate-900">Access Denied</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            You don't have permission to access this private workspace room.
          </p>
          <button
            onClick={() => navigate('/rooms')}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2.5 rounded-xl transition-all shadow-sm"
          >
            Back to Coding Rooms
          </button>
        </div>
      </div>
    );
  }

  // Loading Skeleton State
  if (isInitialLoading) {
    return (
      <div className="h-screen bg-slate-50 text-slate-900 flex flex-col overflow-hidden">
        {/* Header Skeleton */}
        <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
          <div className="h-6 w-48 bg-slate-200 rounded animate-pulse" />
          <div className="h-6 w-64 bg-slate-200 rounded animate-pulse" />
        </header>

        {/* Workspace Grid Skeleton */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 p-3">
          <div className="lg:col-span-3 bg-white border border-slate-200 rounded-xl p-4 animate-pulse space-y-4">
            <div className="h-8 bg-slate-200 rounded" />
            <div className="h-32 bg-slate-100 rounded" />
            <div className="h-20 bg-slate-100 rounded" />
          </div>
          <div className="lg:col-span-6 bg-slate-900 rounded-xl p-4 animate-pulse" />
          <div className="lg:col-span-3 bg-white border border-slate-200 rounded-xl p-4 animate-pulse space-y-3">
            <div className="h-6 bg-slate-200 rounded w-1/2" />
            <div className="h-12 bg-slate-100 rounded" />
            <div className="h-12 bg-slate-100 rounded" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-50 text-slate-900 overflow-hidden relative font-sans">
      {/* 1. ROOM HEADER */}
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between shadow-sm z-20 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/rooms')}
            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors border border-slate-200"
            title="Leave Room"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-indigo-600 text-white rounded-lg shadow-sm">
              <Code2 className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">CodeCollab</span>
                <span className="text-slate-300">•</span>
                <h1 className="text-sm font-bold text-slate-900 tracking-tight">
                  Room: {roomDetails?.name || 'Algo-Masterclass'}
                </h1>
                {roomDetails?.isPrivate ? (
                  <span className="px-2 py-0.5 text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 rounded-md flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Private
                  </span>
                ) : (
                  <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md flex items-center gap-1">
                    <Globe className="w-3 h-3" /> Public
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          {/* Socket Connection Status Badge */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-mono">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
              }`}
            />
            <span className="font-semibold text-slate-700">
              {isConnected ? '● Connected' : '● Disconnected'}
            </span>
          </div>

          {/* Collaborators Count */}
          <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-600 font-medium">
            <Users className="w-4 h-4 text-indigo-600" />
            <span>Collaborators: <strong className="text-slate-900">{onlineUsers.length}</strong></span>
          </div>

          {/* Language Indicator */}
          <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-600 font-medium">
            <FileCode2 className="w-4 h-4 text-indigo-600" />
            <span>Language: <strong className="text-slate-900 font-mono">{language === 'cpp' ? 'C++' : language === 'python' ? 'Python' : 'JavaScript'}</strong></span>
          </div>

          {/* Leave Room Button */}
          <button
            onClick={() => navigate('/rooms')}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-3 py-1.5 rounded-lg text-xs transition-colors border border-slate-200"
          >
            Leave Room
          </button>
        </div>
      </header>

      {/* 2. REALTIME DISCONNECTION NON-BLOCKING BANNER */}
      {!isConnected && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between text-amber-800 text-xs font-semibold z-10 animate-pulse">
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Realtime connection lost. Reconnecting to room server...</span>
          </div>
        </div>
      )}

      {/* 3. SUBTLE TOAST NOTIFICATION STACK */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto p-3 rounded-xl border text-xs font-semibold shadow-lg flex items-center justify-between gap-3 transition-all transform translate-y-0 ${
              t.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                : t.type === 'warning'
                ? 'bg-amber-50 text-amber-900 border-amber-200'
                : t.type === 'error'
                ? 'bg-rose-50 text-rose-900 border-rose-200'
                : 'bg-white text-slate-800 border-slate-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {t.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
              {t.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />}
              {t.type === 'error' && <XCircle className="w-4 h-4 text-rose-600 shrink-0" />}
              {t.type === 'info' && <Info className="w-4 h-4 text-indigo-600 shrink-0" />}
              <span>{t.message}</span>
            </div>
            <button onClick={() => removeToast(t.id)} className="text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Error Alert */}
      {errorMsg && (
        <div className="bg-rose-50 border-b border-rose-200 px-4 py-2 flex items-center justify-between text-rose-700 text-xs font-semibold z-10">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-rose-800 underline text-[11px]">
            Dismiss
          </button>
        </div>
      )}

      {/* 4. MAIN WORKSPACE 3-PANEL IDE LAYOUT */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 p-3 overflow-hidden">
        {/* LEFT PANEL: TABBED NAVIGATION (Problem / Results / History / Chat / Leaderboard) */}
        <div className="lg:col-span-4 xl:col-span-3 bg-white border border-slate-200 rounded-xl flex flex-col overflow-hidden shadow-sm">
          {/* Tabs Navigation Header */}
          <div className="p-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-1">
            <div className="flex items-center gap-1 bg-slate-200/60 p-1 rounded-lg border border-slate-200 w-full overflow-x-auto custom-scrollbar">
              <button
                onClick={() => setActiveTab('problem')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-all shrink-0 ${
                  activeTab === 'problem'
                    ? 'bg-white text-indigo-600 shadow-sm font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                <span>Problem</span>
              </button>

              <button
                onClick={() => setActiveTab('results')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-all shrink-0 ${
                  activeTab === 'results'
                    ? 'bg-white text-indigo-600 shadow-sm font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Terminal className="w-3.5 h-3.5 text-emerald-600" />
                <span>Results</span>
              </button>

              <button
                onClick={() => setActiveTab('history')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-all shrink-0 ${
                  activeTab === 'history'
                    ? 'bg-white text-indigo-600 shadow-sm font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <History className="w-3.5 h-3.5 text-amber-600" />
                <span>History</span>
              </button>

              <button
                onClick={() => setActiveTab('chat')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-all shrink-0 ${
                  activeTab === 'chat'
                    ? 'bg-white text-indigo-600 shadow-sm font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5 text-purple-600" />
                <span>Chat</span>
              </button>

              <button
                onClick={() => setActiveTab('leaderboard')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-all shrink-0 ${
                  activeTab === 'leaderboard'
                    ? 'bg-white text-indigo-600 shadow-sm font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Trophy className="w-3.5 h-3.5 text-amber-600" />
                <span>Ranks</span>
              </button>
            </div>
          </div>

          {/* Left Panel Active Tab Content Container */}
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            {/* PROBLEM TAB */}
            {activeTab === 'problem' && (
              <div className="space-y-4">
                {problems.length > 1 && (
                  <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-200 text-xs">
                    <span className="text-slate-500 font-semibold">Select Problem:</span>
                    <select
                      value={selectedProblem?.id || ''}
                      onChange={(e) => {
                        const found = problems.find((p) => p.id === e.target.value);
                        if (found) setSelectedProblem(found);
                      }}
                      className="bg-white text-slate-800 font-medium border border-slate-300 rounded px-2 py-1 focus:outline-none"
                    >
                      {problems.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {selectedProblem ? (
                  <>
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                      <h2 className="text-base font-bold text-slate-900 leading-snug">{selectedProblem.title}</h2>
                      <span
                        className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${
                          selectedProblem.difficulty === 'EASY'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : selectedProblem.difficulty === 'MEDIUM'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}
                      >
                        {selectedProblem.difficulty}
                      </span>
                    </div>

                    <div className="prose prose-slate prose-xs text-slate-700 leading-relaxed bg-slate-50 border border-slate-200 p-3.5 rounded-xl">
                      <p className="whitespace-pre-line text-xs">{selectedProblem.description}</p>
                    </div>

                    {selectedProblem.constraints && (
                      <div className="space-y-1.5">
                        <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Constraints:</h4>
                        <pre className="text-xs bg-slate-50 p-3 rounded-xl border border-slate-200 font-mono text-indigo-700 whitespace-pre-line font-medium leading-relaxed">
                          {selectedProblem.constraints}
                        </pre>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-12 space-y-2">
                    <BookOpen className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="text-xs text-slate-500 font-medium">No problem selected.</p>
                  </div>
                )}
              </div>
            )}

            {/* RESULTS TAB */}
            {activeTab === 'results' && (
              <div className="space-y-4">
                {latestSubmission ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2.5 py-1 text-xs font-bold rounded-lg border ${getStatusBadge(
                            latestSubmission.status
                          )}`}
                        >
                          {latestSubmission.status}
                        </span>
                        <span className="text-xs font-mono text-slate-600">
                          {latestSubmission.passedTestCases}/{latestSubmission.totalTestCases} Test Cases Passed
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs font-mono text-slate-600">
                        {latestSubmission.executionTime && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-indigo-600" />
                            {latestSubmission.executionTime} ms
                          </span>
                        )}
                        {latestSubmission.memoryUsed && (
                          <span className="flex items-center gap-1">
                            <Cpu className="w-3 h-3 text-amber-600" />
                            {latestSubmission.memoryUsed} MB
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      {latestSubmission.testResults?.map((t) => (
                        <div
                          key={t.testIndex}
                          className="bg-slate-50 border border-slate-200 p-3 rounded-xl space-y-1 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                              {t.status === 'ACCEPTED' ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <XCircle className="w-3.5 h-3.5 text-rose-600" />
                              )}
                              Test Case #{t.testIndex} {t.isHidden ? '(Hidden Test)' : '(Sample Test)'}
                            </span>
                            <span className="font-mono text-[10px] text-slate-500 font-bold">{t.status}</span>
                          </div>

                          {!t.isHidden && (
                            <div className="pt-1.5 space-y-1 font-mono text-[11px]">
                              <div className="text-slate-600">
                                Input: <span className="text-indigo-600 font-semibold">{t.input}</span>
                              </div>
                              <div className="text-slate-600">
                                Expected: <span className="text-emerald-600 font-semibold">{t.expectedOutput}</span>
                              </div>
                              <div className="text-slate-600">
                                Actual: <span className="text-amber-600 font-semibold">{t.actualOutput || 'N/A'}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : runResult ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <span
                        className={`px-2.5 py-1 text-xs font-bold rounded-lg border ${getStatusBadge(
                          runResult.overallStatus
                        )}`}
                      >
                        Run Output: {runResult.overallStatus}
                      </span>
                      <span className="text-xs font-mono text-slate-600">
                        {runResult.passedTestCases}/{runResult.totalTestCases} Sample Tests Passed
                      </span>
                    </div>

                    <div className="space-y-2">
                      {runResult.testResults.map((t) => (
                        <div
                          key={t.testIndex}
                          className="bg-slate-50 border border-slate-200 p-3 rounded-xl space-y-1.5 text-xs font-mono"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                              {t.status === 'ACCEPTED' ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <XCircle className="w-3.5 h-3.5 text-rose-600" />
                              )}
                              Sample Test #{t.testIndex}
                            </span>
                            <span className="text-[10px] text-slate-500 font-bold">{t.status}</span>
                          </div>

                          <div className="text-slate-600">
                            Input: <span className="text-indigo-600 font-semibold">{t.input}</span>
                          </div>
                          <div className="text-slate-600">
                            Expected: <span className="text-emerald-600 font-semibold">{t.expectedOutput}</span>
                          </div>
                          <div className="text-slate-600">
                            Output: <span className="text-amber-600 font-semibold">{t.actualOutput || 'N/A'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 space-y-2">
                    <Terminal className="w-8 h-8 text-slate-300 mx-auto" />
                    <h3 className="text-xs font-semibold text-slate-700">No evaluation results</h3>
                    <p className="text-[11px] text-slate-500">
                      Run or submit your solution to see results.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* HISTORY TAB */}
            {activeTab === 'history' && (
              <div className="space-y-3">
                {submissionHistory.length > 0 ? (
                  <div className="space-y-2">
                    {submissionHistory.map((s) => (
                      <div
                        key={s.id}
                        className="bg-slate-50 border border-slate-200 p-3 rounded-xl flex items-center justify-between text-xs"
                      >
                        <div className="space-y-1">
                          <span
                            className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded border ${getStatusBadge(
                              s.status
                            )}`}
                          >
                            {s.status}
                          </span>
                          <div className="text-[11px] text-slate-600 font-mono">
                            Language: <span className="text-slate-800 font-semibold">{s.language}</span>
                          </div>
                        </div>

                        <div className="text-right text-[11px] text-slate-600 font-mono">
                          <div>{s.executionTime ? `${s.executionTime} ms` : '—'}</div>
                          <div className="text-[10px] text-slate-500">
                            {new Date(s.createdAt).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 space-y-2">
                    <History className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="text-xs text-slate-500 font-medium">No submissions yet.</p>
                  </div>
                )}
              </div>
            )}

            {/* CHAT TAB */}
            {activeTab === 'chat' && (
              <div className="h-full min-h-[400px]">
                <RoomChat
                  roomId={roomId!}
                  currentUserId={user?.id || ''}
                  socket={socketRef.current}
                />
              </div>
            )}

            {/* LEADERBOARD TAB */}
            {activeTab === 'leaderboard' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
                    <Trophy className="w-4 h-4 text-amber-500" />
                    Room Leaderboard
                  </h3>
                </div>

                <LeaderboardTable
                  entries={roomLeaderboard.map((r) => ({
                    rank: r.rank,
                    user: r.user,
                    problemsSolved: r.problemsSolved,
                    acceptedSubmissions: r.acceptedSubmissions,
                    acceptanceRate: r.acceptanceRate,
                  }))}
                  currentUserId={user?.id}
                  isLoading={loadingRoomLeaderboard}
                />
              </div>
            )}
          </div>
        </div>

        {/* CENTER PANEL: MONACO COLLABORATIVE EDITOR */}
        <div className="lg:col-span-5 xl:col-span-6 flex flex-col space-y-2 overflow-hidden">
          {/* Monaco Header / Toolbar */}
          <div className="bg-slate-900 border border-slate-800 rounded-t-xl px-4 py-2 flex items-center justify-between text-xs text-slate-400 font-mono shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
              <span className="ml-2 font-bold text-slate-200">
                {language === 'cpp' ? 'main.cpp' : language === 'python' ? 'main.py' : 'solution.js'}
              </span>
            </div>

            <div className="flex items-center gap-4">
              {/* Language Selector */}
              <div className="flex items-center gap-1.5">
                <span>Lang:</span>
                <select
                  value={language}
                  onChange={(e) => handleLanguageChange(e.target.value)}
                  className="bg-slate-800 text-slate-200 border border-slate-700 rounded px-2 py-0.5 text-xs font-semibold cursor-pointer focus:outline-none"
                >
                  <option value="cpp">C++ (GCC 13)</option>
                  <option value="javascript">JavaScript (Node 20)</option>
                  <option value="python">Python (3.11)</option>
                </select>
              </div>

              {/* Sync Status Badge */}
              <div className="flex items-center gap-1.5">
                <CheckCircle2
                  className={`w-3.5 h-3.5 ${
                    syncStatus === 'Synced'
                      ? 'text-emerald-400'
                      : syncStatus === 'Syncing...'
                      ? 'text-amber-400 animate-spin'
                      : 'text-rose-400'
                  }`}
                />
                <span className={syncStatus === 'Synced' ? 'text-emerald-400 font-medium' : 'text-slate-300'}>
                  {syncStatus === 'Synced' ? '✓ Synced' : syncStatus === 'Syncing...' ? '↻ Syncing...' : '⚠ Disconnected'}
                </span>
              </div>
            </div>
          </div>

          {/* Code Editor Container */}
          <div className="flex-1 min-h-[350px] relative rounded-b-xl overflow-hidden border-x border-b border-slate-800 bg-slate-900 shadow-sm">
            <CodeEditor
              value={codeContent}
              language={language}
              onChange={handleEditorChange}
              onCursorChange={handleCursorChange}
            />
          </div>

          {/* RUN / SUBMIT BOTTOM BAR */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between shadow-sm shrink-0">
            <div className="flex items-center gap-3 text-xs text-slate-500 font-mono">
              <span>Doc Version: <strong className="text-indigo-600 font-bold">v{documentVersion}</strong></span>
              <span>•</span>
              <span className="hidden sm:inline">Status: <strong className="text-emerald-600 font-bold">{syncStatus}</strong></span>
            </div>

            <div className="flex items-center gap-3">
              {/* Run Code Button */}
              <button
                onClick={handleRunCode}
                disabled={isExecuting || !selectedProblem}
                className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-4 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm active:scale-95"
                title="Run code against sample public test cases"
              >
                {isExecuting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                    <span>Running...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current text-emerald-600" />
                    <span>Run</span>
                  </>
                )}
              </button>

              {/* Submit Code Button */}
              <button
                onClick={handleSubmitCode}
                disabled={isExecuting || !selectedProblem}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm active:scale-95"
                title="Submit code for evaluation against all test cases"
              >
                {isExecuting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Submit</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: COLLABORATORS LIST (DESKTOP DEDICATED PANEL) */}
        <div className="lg:col-span-3 xl:col-span-3 bg-white border border-slate-200 rounded-xl p-4 flex flex-col shadow-sm overflow-hidden">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 shrink-0">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-600" />
              Collaborators ({onlineUsers.length})
            </h3>
          </div>

          <div className="flex-1 overflow-y-auto py-3 space-y-2.5 custom-scrollbar">
            {onlineUsers.map((u) => {
              const cursor = userCursors[u.userId];
              const isSelf = u.userId === user?.id;
              return (
                <div
                  key={u.userId}
                  className={`p-2.5 rounded-xl border flex items-center justify-between transition-colors ${
                    isSelf ? 'bg-indigo-50/50 border-indigo-200' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                        {u.username}
                        {isSelf && <span className="text-[10px] text-indigo-600 font-bold">(You)</span>}
                      </span>
                      <span className="text-[10px] text-slate-500 uppercase font-mono font-semibold">
                        {roomDetails?.ownerId === u.userId ? 'Owner' : 'Member'}
                      </span>
                    </div>
                  </div>

                  {cursor && (
                    <span className="text-[10px] font-mono bg-white px-2 py-0.5 rounded border border-slate-200 text-indigo-600 font-medium shadow-xs">
                      L{cursor.lineNumber} : C{cursor.column}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="pt-3 border-t border-slate-200 text-[10px] text-slate-400 font-mono text-center shrink-0">
            ⚡ Real-time presence synced via Socket.IO
          </div>
        </div>
      </div>
    </div>
  );
};
