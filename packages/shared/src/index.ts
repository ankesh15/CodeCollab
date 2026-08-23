export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  errors?: Array<{ field: string; message: string }>;
  requestId?: string;
  timestamp: string;
}

export interface HealthCheckData {
  service: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  uptime: number;
  environment: string;
  database: {
    connected: boolean;
    provider: string;
    message?: string;
  };
  timestamp: string;
}

export type HealthResponse = ApiResponse<HealthCheckData>;

export type UserRole = 'USER' | 'ADMIN';
export type ProblemSource = 'INTERNAL' | 'CODEFORCES';
export type ProblemStatus = 'DRAFT' | 'PUBLISHED';
export type ProblemDifficulty = 'EASY' | 'MEDIUM' | 'HARD';

export interface SafeUser {
  id: string;
  username: string;
  email: string;
  avatar?: string | null;
  bio?: string | null;
  role?: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokenPayload {
  userId: string;
  username: string;
  email: string;
  role?: UserRole;
}

export interface AuthResponseData {
  user: SafeUser;
  token: string;
}

// Room & Problem DTOs (Phase 4.5)
export interface RoomSummary {
  id: string;
  name: string;
  language: string;
  isPrivate: boolean;
  ownerId: string;
  ownerUsername: string;
  memberCount: number;
  role?: string;
  createdAt: string;
}

export interface ProblemExample {
  input: string;
  expectedOutput: string;
  explanation?: string | null;
}

export interface ProblemSummary {
  id: string;
  title: string;
  description: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  constraints?: string | null;
  inputFormat?: string | null;
  outputFormat?: string | null;
  source?: ProblemSource;
  sourceId?: string | null;
  sourceUrl?: string | null;
  externalRating?: number | null;
  status?: ProblemStatus;
  tags?: string[];
  examples?: ProblemExample[];
  createdAt: string;
  testCases?: Array<{
    id: string;
    input: string;
    expectedOutput: string;
    isHidden: boolean;
  }>;
}

// Admin Problem Management DTOs
export interface AdminProblemSummary extends ProblemSummary {
  status: ProblemStatus;
  publicTestCasesCount: number;
  hiddenTestCasesCount: number;
  totalTestCasesCount: number;
}

export interface AdminProblemListResponseData {
  problems: AdminProblemSummary[];
  totalCount: number;
}

export interface AdminCreateProblemRequest {
  title: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  externalRating?: number | null;
  tags?: string[];
  description: string;
  constraints?: string;
  inputFormat?: string;
  outputFormat?: string;
  examples?: ProblemExample[];
  status?: ProblemStatus;
}

export interface AdminUpdateProblemRequest {
  title?: string;
  difficulty?: 'EASY' | 'MEDIUM' | 'HARD';
  externalRating?: number | null;
  tags?: string[];
  description?: string;
  constraints?: string;
  inputFormat?: string;
  outputFormat?: string;
  examples?: ProblemExample[];
  status?: ProblemStatus;
}

export interface AdminCreateTestCaseRequest {
  input: string;
  expectedOutput: string;
  isHidden?: boolean;
}

export interface AdminUpdateTestCaseRequest {
  input?: string;
  expectedOutput?: string;
  isHidden?: boolean;
}

// Codeforces Importer DTOs
export interface CodeforcesProblemCandidate {
  contestId: number;
  index: string;
  name: string;
  type: string;
  rating?: number | null;
  tags: string[];
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  isImported: boolean;
  sourceId: string;
  sourceUrl: string;
}

export interface FetchCodeforcesProblemsResponseData {
  problems: CodeforcesProblemCandidate[];
  totalCount: number;
}

export interface ImportCodeforcesProblemsRequest {
  problems: Array<{
    contestId: number;
    index: string;
  }>;
}

export interface ImportProblemResultItem {
  sourceId: string;
  title: string;
  status: 'IMPORTED' | 'SKIPPED' | 'FAILED';
  reason?: string;
}

export interface ImportCodeforcesProblemsResponseData {
  importedCount: number;
  skippedCount: number;
  failedCount: number;
  results: ImportProblemResultItem[];
}

// Code Document DTO (Phase 5)
export interface CodeDocumentSummary {
  id: string;
  roomId: string;
  content: string;
  language: string;
  version: number;
  createdAt?: string;
  updatedAt?: string;
}

// Code Execution & Submission DTOs (Phase 6)
export type SubmissionStatusType =
  | 'QUEUED'
  | 'RUNNING'
  | 'ACCEPTED'
  | 'WRONG_ANSWER'
  | 'COMPILATION_ERROR'
  | 'RUNTIME_ERROR'
  | 'TIME_LIMIT_EXCEEDED'
  | 'MEMORY_LIMIT_EXCEEDED'
  | 'SYSTEM_ERROR';

export interface ExecutionResult {
  status: SubmissionStatusType;
  stdout?: string | null;
  stderr?: string | null;
  compileOutput?: string | null;
  executionTime?: number | null;
  memory?: number | null;
  exitCode?: number | null;
}

export interface TestCaseResult {
  testCaseId: string;
  testIndex: number;
  isHidden: boolean;
  status: SubmissionStatusType;
  executionTime?: number | null;
  memory?: number | null;
  input?: string;          // Only included for public test cases
  expectedOutput?: string; // Only included for public test cases
  actualOutput?: string;   // Only included for public test cases
}

export interface SubmissionSummary {
  id: string;
  userId: string;
  username?: string;
  problemId: string;
  problemTitle?: string;
  roomId?: string | null;
  language: string;
  sourceCode: string;
  status: SubmissionStatusType;
  executionTime?: number | null;
  memoryUsed?: number | null;
  createdAt: string;
  testResults?: TestCaseResult[];
  failedTestIndex?: number | null;
  totalTestCases?: number;
  passedTestCases?: number;
}

export interface RunCodeRequest {
  problemId: string;
  language: string;
  code: string;
}

export interface RunCodeResponseData {
  problemId: string;
  language: string;
  overallStatus: SubmissionStatusType;
  testResults: TestCaseResult[];
  passedTestCases: number;
  totalTestCases: number;
}

export interface SubmitCodeRequest {
  problemId: string;
  roomId?: string | null;
  language: string;
  code: string;
}

export interface SubmitCodeResponseData {
  submission: SubmissionSummary;
}

// Real-Time Chat & Notification DTOs (Phase 7)
export interface MessageSummary {
  id: string;
  roomId: string;
  userId: string;
  username: string;
  userAvatar?: string | null;
  content: string;
  createdAt: string;
}

export interface PaginatedMessagesResponseData {
  messages: MessageSummary[];
  nextCursor: string | null;
}

export type NotificationType =
  | 'ROOM_INVITE'
  | 'SUBMISSION_RESULT'
  | 'SYSTEM_ANNOUNCEMENT'
  | 'ROOM_MESSAGE_MENTION';

export interface NotificationSummary {
  id: string;
  userId: string;
  type: NotificationType;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface PaginatedNotificationsResponseData {
  notifications: NotificationSummary[];
  nextCursor: string | null;
}

export interface UnreadCountResponseData {
  unreadCount: number;
}

// Real-Time Event Contracts & Types (Phases 4, 5, 6 & 7)
export const SOCKET_EVENTS = {
  // Client -> Server Room Events
  ROOM_JOIN: 'room:join',
  ROOM_LEAVE: 'room:leave',

  // Server -> Client Room Events
  ROOM_STATE: 'room:state',
  ROOM_USER_JOINED: 'room:user_joined',
  ROOM_USER_LEFT: 'room:user_left',

  // Editor Collaboration Events (Phase 5)
  EDITOR_CHANGE: 'editor:change',
  EDITOR_CURSOR: 'editor:cursor',
  EDITOR_LANGUAGE: 'editor:language',
  DOCUMENT_STATE: 'document:state',

  // Submission Events (Phase 6)
  SUBMISSION_CREATED: 'submission:created',
  SUBMISSION_COMPLETED: 'submission:completed',

  // Real-Time Room Chat Events (Phase 7)
  MESSAGE_SEND: 'message:send',
  MESSAGE_NEW: 'message:new',
  MESSAGE_DELETE: 'message:delete',

  // Real-Time Private Notification Events (Phase 7)
  NOTIFICATION_NEW: 'notification:new',
  NOTIFICATION_READ: 'notification:read',
  NOTIFICATION_COUNT: 'notification:count',

  ERROR: 'error',
} as const;

export type SocketEventType = (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS];

export interface RoomUser {
  userId: string;
  username: string;
  email?: string;
  joinedAt?: string;
}

export interface RoomJoinPayload {
  roomId: string;
}

export interface RoomLeavePayload {
  roomId: string;
}

export interface RoomStatePayload {
  roomId: string;
  users: RoomUser[];
}

export interface RoomUserJoinedPayload {
  roomId: string;
  user: RoomUser;
}

export interface RoomUserLeftPayload {
  roomId: string;
  user: RoomUser;
}

export interface EditorChangePayload {
  roomId: string;
  content: string;
  version: number;
  user?: {
    userId: string;
    username: string;
  };
}

export interface EditorCursorPayload {
  roomId: string;
  user: {
    userId: string;
    username: string;
  };
  position: {
    lineNumber: number;
    column: number;
  };
}

export interface EditorLanguagePayload {
  roomId: string;
  language: string;
  user?: {
    userId: string;
    username: string;
  };
}

export interface DocumentStatePayload {
  roomId: string;
  document: CodeDocumentSummary;
}

export interface SubmissionCreatedPayload {
  submissionId: string;
  roomId?: string | null;
  problemId: string;
  user: {
    userId: string;
    username: string;
  };
  status: SubmissionStatusType;
}

export interface SubmissionCompletedPayload {
  submissionId: string;
  roomId?: string | null;
  problemId: string;
  user: {
    userId: string;
    username: string;
  };
  status: SubmissionStatusType;
  executionTime?: number | null;
  memoryUsed?: number | null;
  passedTestCases?: number;
  totalTestCases?: number;
}

export interface MessageSendPayload {
  roomId: string;
  content: string;
}

export interface MessageNewPayload {
  message: MessageSummary;
}

export interface MessageDeletePayload {
  messageId: string;
  roomId: string;
}

export interface NotificationNewPayload {
  notification: NotificationSummary;
}

export interface NotificationReadPayload {
  notificationId: string;
  read: boolean;
}

export interface NotificationCountPayload {
  unreadCount: number;
}

export interface SocketErrorPayload {
  code: string;
  message: string;
}

// Leaderboard, User Statistics & Analytics DTOs (Phase 8)
export interface DifficultyBreakdown {
  easy: number;
  medium: number;
  hard: number;
}

export interface RuntimeMetrics {
  averageMs: number;
  bestMs: number;
}

export interface MemoryMetrics {
  averageMb: number;
}

export interface UserStatistics {
  totalSubmissions: number;
  acceptedSubmissions: number;
  problemsSolved: number;
  acceptanceRate: number;
  difficulty: DifficultyBreakdown;
  runtime: RuntimeMetrics;
  memory: MemoryMetrics;
}

export interface UserAnalyticsResponseData {
  statistics: UserStatistics;
  rank?: number | null;
}

export interface ActivityPoint {
  date: string;
  submissions: number;
}

export interface UserActivityResponseData {
  activity: ActivityPoint[];
}

export interface LeaderboardEntry {
  rank: number;
  user: {
    id: string;
    username: string;
    avatar?: string | null;
  };
  problemsSolved: number;
  acceptedSubmissions: number;
  acceptanceRate: number;
}

export interface PaginatedLeaderboardResponseData {
  leaderboard: LeaderboardEntry[];
  currentUserRank?: number | null;
  nextCursor?: string | null;
  totalCount?: number;
}

export interface RoomLeaderboardEntry {
  rank: number;
  user: {
    id: string;
    username: string;
    avatar?: string | null;
  };
  problemsSolved: number;
  acceptedSubmissions: number;
  acceptanceRate: number;
}

export interface RoomLeaderboardResponseData {
  roomId: string;
  leaderboard: RoomLeaderboardEntry[];
}

export interface ProblemStatistics {
  problemId: string;
  title: string;
  attempts: number;
  accepted: number;
  uniqueUsers: number;
  solvedBy: number;
  acceptanceRate: number;
  averageRuntimeMs: number;
}

export interface ProblemStatisticsResponseData {
  statistics: ProblemStatistics;
}

