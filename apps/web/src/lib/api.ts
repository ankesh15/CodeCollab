import {
  ApiResponse,
  SafeUser,
  RoomSummary,
  ProblemSummary,
  CodeDocumentSummary,
  RunCodeResponseData,
  SubmissionSummary,
  PaginatedMessagesResponseData,
  PaginatedNotificationsResponseData,
  UnreadCountResponseData,
  NotificationSummary,
  CreateRoomRequest,
  UpdateRoomRequest,
  RoomDetailsData,
} from '@codecollab/shared';

import { disconnectSocket } from './socket';

export const API_BASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.['VITE_API_BASE_URL']) ||
  'http://localhost:5000/api';

function getAuthHeaders(): HeadersInit {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('codecollab_token') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function checkResponseStatus(res: Response): void {
  if (res.status === 401) {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('codecollab_token');
      localStorage.removeItem('codecollab_refresh_token');
    }
    disconnectSocket();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('auth:unauthorized'));
    }
  }
}

export async function fetchRooms(): Promise<RoomSummary[]> {
  const res = await fetch(`${API_BASE_URL}/rooms`, {
    headers: getAuthHeaders(),
  });
  const json: ApiResponse<{ rooms: RoomSummary[] }> = await res.json();
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message || 'Failed to fetch rooms');
  }
  return json.data.rooms;
}

export async function fetchRoomDetails(roomId: string): Promise<RoomDetailsData> {
  const res = await fetch(`${API_BASE_URL}/rooms/${roomId}`, {
    headers: getAuthHeaders(),
  });
  const json: ApiResponse<{ room: RoomDetailsData }> = await res.json();
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message || 'Failed to fetch room details');
  }
  return json.data.room;
}

export async function createRoomApi(data: CreateRoomRequest): Promise<RoomDetailsData> {
  const res = await fetch(`${API_BASE_URL}/rooms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(data),
  });
  const json: ApiResponse<{ room: RoomDetailsData }> = await res.json();
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message || 'Failed to create room');
  }
  return json.data.room;
}

export async function joinRoomApi(roomId: string): Promise<{ roomId: string; role: string }> {
  const res = await fetch(`${API_BASE_URL}/rooms/${roomId}/join`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
  });
  const json: ApiResponse<{ roomId: string; role: string }> = await res.json();
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message || 'Failed to join room');
  }
  return json.data;
}

export async function leaveRoomApi(
  roomId: string
): Promise<{ action: 'deleted' | 'transferred' | 'left'; newOwnerId?: string }> {
  const res = await fetch(`${API_BASE_URL}/rooms/${roomId}/leave`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
  });
  const json: ApiResponse<{ action: 'deleted' | 'transferred' | 'left'; newOwnerId?: string }> = await res.json();
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message || 'Failed to leave room');
  }
  return json.data;
}

export async function deleteRoomApi(roomId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/rooms/${roomId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  const json: ApiResponse<unknown> = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message || 'Failed to delete room');
  }
}

export async function updateRoomSettingsApi(
  roomId: string,
  data: UpdateRoomRequest
): Promise<RoomSummary> {
  const res = await fetch(`${API_BASE_URL}/rooms/${roomId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(data),
  });
  const json: ApiResponse<{ room: RoomSummary }> = await res.json();
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message || 'Failed to update room settings');
  }
  return json.data.room;
}

export async function fetchProblems(): Promise<ProblemSummary[]> {
  const res = await fetch(`${API_BASE_URL}/problems`, {
    headers: getAuthHeaders(),
  });
  const json: ApiResponse<{ problems: ProblemSummary[] }> = await res.json();
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message || 'Failed to fetch problems');
  }
  return json.data.problems;
}

export async function fetchProblemDetails(problemId: string): Promise<ProblemSummary> {
  const res = await fetch(`${API_BASE_URL}/problems/${problemId}`, {
    headers: getAuthHeaders(),
  });
  const json: ApiResponse<{ problem: ProblemSummary }> = await res.json();
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message || 'Failed to fetch problem details');
  }
  return json.data.problem;
}

export async function fetchDocument(roomId: string): Promise<CodeDocumentSummary> {
  const res = await fetch(`${API_BASE_URL}/rooms/${roomId}/document`, {
    headers: getAuthHeaders(),
  });
  const json: ApiResponse<{ document: CodeDocumentSummary }> = await res.json();
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message || 'Failed to fetch code document');
  }
  return json.data.document;
}

export async function updateDocumentLanguageApi(
  roomId: string,
  language: string
): Promise<CodeDocumentSummary> {
  const res = await fetch(`${API_BASE_URL}/rooms/${roomId}/document/language`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ language }),
  });
  const json: ApiResponse<{ document: CodeDocumentSummary }> = await res.json();
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message || 'Failed to update document language');
  }
  return json.data.document;
}

// Phase 6 — Execution & Submission API Calls
export async function runCodeApi(
  problemId: string,
  language: string,
  code: string
): Promise<RunCodeResponseData> {
  const res = await fetch(`${API_BASE_URL}/submissions/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ problemId, language, code }),
  });
  const json: ApiResponse<RunCodeResponseData> = await res.json();
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message || 'Failed to execute run code');
  }
  return json.data;
}

export async function submitCodeApi(
  problemId: string,
  roomId: string | null,
  language: string,
  code: string
): Promise<SubmissionSummary> {
  const res = await fetch(`${API_BASE_URL}/submissions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ problemId, roomId, language, code }),
  });
  const json: ApiResponse<{ submission: SubmissionSummary }> = await res.json();
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message || 'Failed to submit code');
  }
  return json.data.submission;
}

export async function fetchSubmissionsApi(problemId: string): Promise<SubmissionSummary[]> {
  const res = await fetch(`${API_BASE_URL}/submissions/problem/${problemId}`, {
    headers: getAuthHeaders(),
  });
  const json: ApiResponse<{ submissions: SubmissionSummary[] }> = await res.json();
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message || 'Failed to fetch submission history');
  }
  return json.data.submissions;
}

// Phase 7 — Chat & Notification API Calls
export async function fetchRoomMessagesApi(
  roomId: string,
  limit = 50,
  cursor?: string
): Promise<PaginatedMessagesResponseData> {
  const url = new URL(`${API_BASE_URL}/rooms/${roomId}/messages`);
  url.searchParams.append('limit', limit.toString());
  if (cursor) url.searchParams.append('cursor', cursor);

  const res = await fetch(url.toString(), {
    headers: getAuthHeaders(),
  });
  const json: ApiResponse<PaginatedMessagesResponseData> = await res.json();
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message || 'Failed to fetch room messages');
  }
  return json.data;
}

export async function deleteMessageApi(messageId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/messages/${messageId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  const json: ApiResponse<{ messageId: string }> = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message || 'Failed to delete message');
  }
}

export async function fetchNotificationsApi(
  limit = 20,
  cursor?: string
): Promise<PaginatedNotificationsResponseData> {
  const url = new URL(`${API_BASE_URL}/notifications`);
  url.searchParams.append('limit', limit.toString());
  if (cursor) url.searchParams.append('cursor', cursor);

  const res = await fetch(url.toString(), {
    headers: getAuthHeaders(),
  });
  const json: ApiResponse<PaginatedNotificationsResponseData> = await res.json();
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message || 'Failed to fetch notifications');
  }
  return json.data;
}

export async function fetchUnreadCountApi(): Promise<UnreadCountResponseData> {
  const res = await fetch(`${API_BASE_URL}/notifications/unread-count`, {
    headers: getAuthHeaders(),
  });
  const json: ApiResponse<UnreadCountResponseData> = await res.json();
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message || 'Failed to fetch unread notification count');
  }
  return json.data;
}

export async function markNotificationReadApi(
  notificationId: string
): Promise<NotificationSummary> {
  const res = await fetch(`${API_BASE_URL}/notifications/${notificationId}/read`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
  });
  const json: ApiResponse<{ notification: NotificationSummary }> = await res.json();
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message || 'Failed to mark notification as read');
  }
  return json.data.notification;
}

export async function markAllNotificationsReadApi(): Promise<number> {
  const res = await fetch(`${API_BASE_URL}/notifications/read-all`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
  });
  const json: ApiResponse<{ count: number }> = await res.json();
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message || 'Failed to mark all notifications as read');
  }
  return json.data.count;
}

// Phase 8 — Leaderboard, User Statistics & Analytics API Calls
export async function fetchUserAnalyticsApi(): Promise<{
  statistics: import('@codecollab/shared').UserStatistics;
  rank?: number | null;
}> {
  const res = await fetch(`${API_BASE_URL}/analytics/me`, {
    headers: getAuthHeaders(),
  });
  const json: ApiResponse<{
    statistics: import('@codecollab/shared').UserStatistics;
    rank?: number | null;
  }> = await res.json();
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message || 'Failed to fetch user analytics');
  }
  return json.data;
}

export async function fetchUserActivityApi(days = 30): Promise<import('@codecollab/shared').ActivityPoint[]> {
  const res = await fetch(`${API_BASE_URL}/analytics/me/activity?days=${days}`, {
    headers: getAuthHeaders(),
  });
  const json: ApiResponse<{ activity: import('@codecollab/shared').ActivityPoint[] }> = await res.json();
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message || 'Failed to fetch user activity');
  }
  return json.data.activity;
}

export async function fetchLeaderboardApi(
  limit = 20,
  cursor?: string
): Promise<import('@codecollab/shared').PaginatedLeaderboardResponseData> {
  const url = new URL(`${API_BASE_URL}/leaderboard`);
  url.searchParams.append('limit', limit.toString());
  if (cursor) url.searchParams.append('cursor', cursor);

  const res = await fetch(url.toString(), {
    headers: getAuthHeaders(),
  });
  const json: ApiResponse<import('@codecollab/shared').PaginatedLeaderboardResponseData> = await res.json();
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message || 'Failed to fetch global leaderboard');
  }
  return json.data;
}

export async function fetchRoomLeaderboardApi(
  roomId: string
): Promise<import('@codecollab/shared').RoomLeaderboardResponseData> {
  const res = await fetch(`${API_BASE_URL}/rooms/${roomId}/leaderboard`, {
    headers: getAuthHeaders(),
  });
  const json: ApiResponse<import('@codecollab/shared').RoomLeaderboardResponseData> = await res.json();
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message || 'Failed to fetch room leaderboard');
  }
  return json.data;
}

export async function fetchProblemStatisticsApi(
  problemId: string
): Promise<import('@codecollab/shared').ProblemStatistics> {
  const res = await fetch(`${API_BASE_URL}/problems/${problemId}/statistics`, {
    headers: getAuthHeaders(),
  });
  const json: ApiResponse<{ statistics: import('@codecollab/shared').ProblemStatistics }> = await res.json();
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message || 'Failed to fetch problem statistics');
  }
  return json.data.statistics;
}

export async function updateUserProfileApi(data: {
  bio?: string | null;
  avatar?: string | null;
}): Promise<SafeUser> {
  const res = await fetch(`${API_BASE_URL}/auth/me`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(data),
  });
  const json: ApiResponse<{ user: SafeUser }> = await res.json();
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message || 'Failed to update user profile');
  }
  return json.data.user;
}

// Phase 9 — Admin Problem Importer API Calls
export async function fetchCodeforcesCandidateProblemsApi(params?: {
  tag?: string;
  difficulty?: 'EASY' | 'MEDIUM' | 'HARD';
  limit?: number;
}): Promise<import('@codecollab/shared').FetchCodeforcesProblemsResponseData> {
  const url = new URL(`${API_BASE_URL}/admin/problems/import/codeforces`);
  if (params?.tag) url.searchParams.append('tag', params.tag);
  if (params?.difficulty) url.searchParams.append('difficulty', params.difficulty);
  if (params?.limit) url.searchParams.append('limit', params.limit.toString());

  const res = await fetch(url.toString(), {
    headers: getAuthHeaders(),
  });
  const json: ApiResponse<import('@codecollab/shared').FetchCodeforcesProblemsResponseData> = await res.json();
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message || 'Failed to fetch candidate problems');
  }
  return json.data;
}

export async function importCodeforcesProblemsApi(
  problems: Array<{ contestId: number; index: string }>
): Promise<import('@codecollab/shared').ImportCodeforcesProblemsResponseData> {
  const res = await fetch(`${API_BASE_URL}/admin/problems/import/codeforces`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ problems }),
  });
  const json: ApiResponse<import('@codecollab/shared').ImportCodeforcesProblemsResponseData> = await res.json();
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message || 'Failed to import problems');
  }
  return json.data;
}

// Phase 10 — Admin Problem Management API Calls
export async function fetchAdminProblemsApi(params?: {
  search?: string;
  source?: string;
  difficulty?: string;
  status?: string;
}): Promise<import('@codecollab/shared').AdminProblemListResponseData> {
  const url = new URL(`${API_BASE_URL}/admin/problems`);
  if (params?.search) url.searchParams.append('search', params.search);
  if (params?.source) url.searchParams.append('source', params.source);
  if (params?.difficulty) url.searchParams.append('difficulty', params.difficulty);
  if (params?.status) url.searchParams.append('status', params.status);

  const res = await fetch(url.toString(), {
    headers: getAuthHeaders(),
  });
  const json: ApiResponse<import('@codecollab/shared').AdminProblemListResponseData> = await res.json();
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message || 'Failed to fetch admin problems');
  }
  return json.data;
}

export async function fetchAdminProblemDetailsApi(problemId: string): Promise<
  import('@codecollab/shared').ProblemSummary & {
    testCases: Array<{ id: string; input: string; expectedOutput: string; isHidden: boolean }>;
  }
> {
  const res = await fetch(`${API_BASE_URL}/admin/problems/${problemId}`, {
    headers: getAuthHeaders(),
  });
  const json: ApiResponse<{
    problem: import('@codecollab/shared').ProblemSummary & {
      testCases: Array<{ id: string; input: string; expectedOutput: string; isHidden: boolean }>;
    };
  }> = await res.json();
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message || 'Failed to fetch admin problem details');
  }
  return json.data.problem;
}

export async function createAdminProblemApi(
  data: import('@codecollab/shared').AdminCreateProblemRequest
): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/admin/problems`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(data),
  });
  const json: ApiResponse<{ problemId: string }> = await res.json();
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message || 'Failed to create problem');
  }
  return json.data.problemId;
}

export async function updateAdminProblemApi(
  problemId: string,
  data: import('@codecollab/shared').AdminUpdateProblemRequest
): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/admin/problems/${problemId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(data),
  });
  const json: ApiResponse<{ problemId: string }> = await res.json();
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message || 'Failed to update problem');
  }
  return json.data.problemId;
}

export async function deleteAdminProblemApi(problemId: string): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/admin/problems/${problemId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  const json: ApiResponse<{ deletedProblemId: string }> = await res.json();
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message || 'Failed to delete problem');
  }
  return json.data.deletedProblemId;
}

export async function addTestCaseApi(
  problemId: string,
  data: import('@codecollab/shared').AdminCreateTestCaseRequest
): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/admin/problems/${problemId}/test-cases`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(data),
  });
  const json: ApiResponse<{ testCaseId: string }> = await res.json();
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message || 'Failed to add test case');
  }
  return json.data.testCaseId;
}

export async function updateTestCaseApi(
  testCaseId: string,
  data: import('@codecollab/shared').AdminUpdateTestCaseRequest
): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/admin/test-cases/${testCaseId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(data),
  });
  const json: ApiResponse<{ testCaseId: string }> = await res.json();
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message || 'Failed to update test case');
  }
  return json.data.testCaseId;
}

export async function deleteTestCaseApi(testCaseId: string): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/admin/test-cases/${testCaseId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  const json: ApiResponse<{ deletedTestCaseId: string }> = await res.json();
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message || 'Failed to delete test case');
  }
  return json.data.deletedTestCaseId;
}

export async function publishProblemApi(problemId: string): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/admin/problems/${problemId}/publish`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
  });
  const json: ApiResponse<{ problemId: string }> = await res.json();
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message || 'Failed to publish problem');
  }
  return json.data.problemId;
}

export async function unpublishProblemApi(problemId: string): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/admin/problems/${problemId}/unpublish`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
  });
  const json: ApiResponse<{ problemId: string }> = await res.json();
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message || 'Failed to unpublish problem');
  }
  return json.data.problemId;
}




