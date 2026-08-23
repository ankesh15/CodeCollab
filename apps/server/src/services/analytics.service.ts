import { prisma } from '../config/db';
import {
  UserStatistics,
  ActivityPoint,
  LeaderboardEntry,
  PaginatedLeaderboardResponseData,
  RoomLeaderboardEntry,
  RoomLeaderboardResponseData,
  ProblemStatistics,
} from '@codecollab/shared';

export class AppError extends Error {
  constructor(
    public override message: string,
    public statusCode: number,
    public errorCode: string
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/**
 * Calculate user statistics from PostgreSQL database
 */
export async function getUserStatisticsService(userId: string): Promise<UserStatistics> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError('User not found.', 404, 'USER_NOT_FOUND');
  }

  // 1. Total & Evaluated Submissions
  const totalSubmissions = await prisma.submission.count({
    where: { userId },
  });

  const acceptedSubmissions = await prisma.submission.count({
    where: { userId, status: 'ACCEPTED' },
  });

  const unevaluatedSubmissions = await prisma.submission.count({
    where: {
      userId,
      status: { in: ['QUEUED', 'RUNNING'] },
    },
  });

  const evaluatedSubmissions = Math.max(0, totalSubmissions - unevaluatedSubmissions);
  const acceptanceRate =
    evaluatedSubmissions > 0
      ? Math.round((acceptedSubmissions / evaluatedSubmissions) * 10000) / 100
      : 0;

  // 2. Distinct Solved Problems & Difficulty Breakdown
  const distinctSolved = await prisma.submission.findMany({
    where: { userId, status: 'ACCEPTED' },
    distinct: ['problemId'],
    select: {
      problemId: true,
      problem: {
        select: {
          difficulty: true,
        },
      },
    },
  });

  const problemsSolved = distinctSolved.length;
  const difficulty = {
    easy: distinctSolved.filter((s) => s.problem.difficulty === 'EASY').length,
    medium: distinctSolved.filter((s) => s.problem.difficulty === 'MEDIUM').length,
    hard: distinctSolved.filter((s) => s.problem.difficulty === 'HARD').length,
  };

  // 3. Runtime & Memory Metrics (for ACCEPTED submissions)
  const runtimeAggregate = await prisma.submission.aggregate({
    where: {
      userId,
      status: 'ACCEPTED',
      executionTime: { not: null },
    },
    _avg: { executionTime: true },
    _min: { executionTime: true },
    _max: { executionTime: true },
  });

  const memoryAggregate = await prisma.submission.aggregate({
    where: {
      userId,
      status: 'ACCEPTED',
      memoryUsed: { not: null },
    },
    _avg: { memoryUsed: true },
  });

  const runtime = {
    averageMs: runtimeAggregate._avg.executionTime ? Math.round(runtimeAggregate._avg.executionTime) : 0,
    bestMs: runtimeAggregate._min.executionTime ? Math.round(runtimeAggregate._min.executionTime) : 0,
  };

  const memory = {
    averageMb: memoryAggregate._avg.memoryUsed ? Math.round(memoryAggregate._avg.memoryUsed) : 0,
  };

  return {
    totalSubmissions,
    acceptedSubmissions,
    problemsSolved,
    acceptanceRate,
    difficulty,
    runtime,
    memory,
  };
}

/**
 * Calculate user 30-day activity points
 */
export async function getUserActivityService(userId: string, days = 30): Promise<ActivityPoint[]> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - (days - 1));
  startDate.setUTCHours(0, 0, 0, 0);

  const submissions = await prisma.submission.findMany({
    where: {
      userId,
      createdAt: { gte: startDate },
    },
    select: {
      createdAt: true,
    },
  });

  // Group by YYYY-MM-DD
  const countsByDate: Record<string, number> = {};

  for (const s of submissions) {
    const dateStr = s.createdAt.toISOString().split('T')[0] || '';
    if (dateStr) {
      countsByDate[dateStr] = (countsByDate[dateStr] || 0) + 1;
    }
  }

  // Populate 30 days array
  const activity: ActivityPoint[] = [];
  const curr = new Date(startDate);

  for (let i = 0; i < days; i++) {
    const dateStr = curr.toISOString().split('T')[0] || '';
    activity.push({
      date: dateStr,
      submissions: countsByDate[dateStr] || 0,
    });
    curr.setDate(curr.getDate() + 1);
  }

  return activity;
}

/**
 * Calculate all users ranked according to Phase 8 tie-breaking rules
 */
async function getAllCalculatedUserRanks() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      avatar: true,
    },
  });

  // Get distinct solved problem counts per user
  const solvedGroup = await prisma.submission.findMany({
    where: { status: 'ACCEPTED' },
    distinct: ['userId', 'problemId'],
    select: {
      userId: true,
      problemId: true,
    },
  });

  const solvedMap: Record<string, number> = {};
  for (const s of solvedGroup) {
    solvedMap[s.userId] = (solvedMap[s.userId] || 0) + 1;
  }

  // Get total & accepted submission counts per user
  const totalSubmissionsGroup = await prisma.submission.groupBy({
    by: ['userId'],
    _count: { id: true },
  });
  const totalSubMap: Record<string, number> = {};
  for (const g of totalSubmissionsGroup) {
    totalSubMap[g.userId] = g._count.id;
  }

  const acceptedSubmissionsGroup = await prisma.submission.groupBy({
    by: ['userId'],
    where: { status: 'ACCEPTED' },
    _count: { id: true },
  });
  const acceptedSubMap: Record<string, number> = {};
  for (const g of acceptedSubmissionsGroup) {
    acceptedSubMap[g.userId] = g._count.id;
  }

  const unevaluatedGroup = await prisma.submission.groupBy({
    by: ['userId'],
    where: { status: { in: ['QUEUED', 'RUNNING'] } },
    _count: { id: true },
  });
  const unevaluatedMap: Record<string, number> = {};
  for (const g of unevaluatedGroup) {
    unevaluatedMap[g.userId] = g._count.id;
  }

  // Calculate metrics for each user
  const userStatsList = users.map((u) => {
    const totalSub = totalSubMap[u.id] || 0;
    const acceptedSub = acceptedSubMap[u.id] || 0;
    const unevaluated = unevaluatedMap[u.id] || 0;
    const evaluated = Math.max(0, totalSub - unevaluated);
    const acceptanceRate =
      evaluated > 0 ? Math.round((acceptedSub / evaluated) * 10000) / 100 : 0;
    const problemsSolved = solvedMap[u.id] || 0;

    return {
      user: u,
      problemsSolved,
      acceptedSubmissions: acceptedSub,
      acceptanceRate,
    };
  });

  // Sort according to Phase 8 tie-breaking:
  // 1. problemsSolved DESC
  // 2. acceptanceRate DESC
  // 3. acceptedSubmissions DESC
  // 4. username ASC
  userStatsList.sort((a, b) => {
    if (b.problemsSolved !== a.problemsSolved) {
      return b.problemsSolved - a.problemsSolved;
    }
    if (b.acceptanceRate !== a.acceptanceRate) {
      return b.acceptanceRate - a.acceptanceRate;
    }
    if (b.acceptedSubmissions !== a.acceptedSubmissions) {
      return b.acceptedSubmissions - a.acceptedSubmissions;
    }
    return a.user.username.localeCompare(b.user.username);
  });

  // Assign 1-based ranks
  return userStatsList.map((item, index) => ({
    rank: index + 1,
    ...item,
  }));
}

/**
 * Get authenticated user rank in global leaderboard
 */
export async function getUserRankService(userId: string): Promise<number | null> {
  const rankedUsers = await getAllCalculatedUserRanks();
  const found = rankedUsers.find((r) => r.user.id === userId);
  if (!found || (found.problemsSolved === 0 && found.acceptedSubmissions === 0)) {
    return null;
  }
  return found.rank;
}

/**
 * Get Paginated Global Leaderboard
 */
export async function getGlobalLeaderboardService(
  limit = 20,
  cursor?: string,
  currentUserId?: string
): Promise<PaginatedLeaderboardResponseData> {
  const rankedUsers = await getAllCalculatedUserRanks();

  let startIndex = 0;
  if (cursor) {
    const cursorRank = parseInt(cursor, 10);
    if (!isNaN(cursorRank)) {
      startIndex = cursorRank;
    } else {
      const idx = rankedUsers.findIndex((r) => r.user.id === cursor);
      if (idx !== -1) {
        startIndex = idx + 1;
      }
    }
  }

  const paginatedSlice = rankedUsers.slice(startIndex, startIndex + limit);
  const nextCursor =
    startIndex + limit < rankedUsers.length ? (startIndex + limit).toString() : null;

  const currentUserRank = currentUserId ? await getUserRankService(currentUserId) : null;

  const leaderboard: LeaderboardEntry[] = paginatedSlice.map((r) => ({
    rank: r.rank,
    user: {
      id: r.user.id,
      username: r.user.username,
      avatar: r.user.avatar,
    },
    problemsSolved: r.problemsSolved,
    acceptedSubmissions: r.acceptedSubmissions,
    acceptanceRate: r.acceptanceRate,
  }));

  return {
    leaderboard,
    currentUserRank,
    nextCursor,
    totalCount: rankedUsers.length,
  };
}

/**
 * Get Room Leaderboard (Room-isolated statistics for room members)
 */
export async function getRoomLeaderboardService(
  roomId: string
): Promise<RoomLeaderboardResponseData> {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              username: true,
              avatar: true,
            },
          },
        },
      },
    },
  });

  if (!room) {
    throw new AppError('Room not found.', 404, 'ROOM_NOT_FOUND');
  }

  const memberIds = room.members.map((m) => m.userId);

  // Distinct problems solved within this room for memberIds
  const roomSolvedGroup = await prisma.submission.findMany({
    where: {
      roomId,
      userId: { in: memberIds },
      status: 'ACCEPTED',
    },
    distinct: ['userId', 'problemId'],
    select: {
      userId: true,
      problemId: true,
    },
  });

  const roomSolvedMap: Record<string, number> = {};
  for (const s of roomSolvedGroup) {
    roomSolvedMap[s.userId] = (roomSolvedMap[s.userId] || 0) + 1;
  }

  // Total & Accepted submissions within this room for memberIds
  const roomTotalGroup = await prisma.submission.groupBy({
    by: ['userId'],
    where: { roomId, userId: { in: memberIds } },
    _count: { id: true },
  });
  const roomTotalMap: Record<string, number> = {};
  for (const g of roomTotalGroup) {
    roomTotalMap[g.userId] = g._count.id;
  }

  const roomAcceptedGroup = await prisma.submission.groupBy({
    by: ['userId'],
    where: { roomId, userId: { in: memberIds }, status: 'ACCEPTED' },
    _count: { id: true },
  });
  const roomAcceptedMap: Record<string, number> = {};
  for (const g of roomAcceptedGroup) {
    roomAcceptedMap[g.userId] = g._count.id;
  }

  const roomUnevaluatedGroup = await prisma.submission.groupBy({
    by: ['userId'],
    where: {
      roomId,
      userId: { in: memberIds },
      status: { in: ['QUEUED', 'RUNNING'] },
    },
    _count: { id: true },
  });
  const roomUnevaluatedMap: Record<string, number> = {};
  for (const g of roomUnevaluatedGroup) {
    roomUnevaluatedMap[g.userId] = g._count.id;
  }

  // Calculate metrics for each room member
  const memberStatsList = room.members.map((m) => {
    const totalSub = roomTotalMap[m.userId] || 0;
    const acceptedSub = roomAcceptedMap[m.userId] || 0;
    const unevaluated = roomUnevaluatedMap[m.userId] || 0;
    const evaluated = Math.max(0, totalSub - unevaluated);
    const acceptanceRate =
      evaluated > 0 ? Math.round((acceptedSub / evaluated) * 10000) / 100 : 0;
    const problemsSolved = roomSolvedMap[m.userId] || 0;

    return {
      user: m.user,
      problemsSolved,
      acceptedSubmissions: acceptedSub,
      acceptanceRate,
    };
  });

  // Sort according to tie-breakers
  memberStatsList.sort((a, b) => {
    if (b.problemsSolved !== a.problemsSolved) {
      return b.problemsSolved - a.problemsSolved;
    }
    if (b.acceptanceRate !== a.acceptanceRate) {
      return b.acceptanceRate - a.acceptanceRate;
    }
    if (b.acceptedSubmissions !== a.acceptedSubmissions) {
      return b.acceptedSubmissions - a.acceptedSubmissions;
    }
    return a.user.username.localeCompare(b.user.username);
  });

  const leaderboard: RoomLeaderboardEntry[] = memberStatsList.map((item, idx) => ({
    rank: idx + 1,
    user: item.user,
    problemsSolved: item.problemsSolved,
    acceptedSubmissions: item.acceptedSubmissions,
    acceptanceRate: item.acceptanceRate,
  }));

  return {
    roomId,
    leaderboard,
  };
}

/**
 * Get Problem Statistics (Aggregated statistics for a specific problem)
 */
export async function getProblemStatisticsService(problemId: string): Promise<ProblemStatistics> {
  const problem = await prisma.problem.findUnique({
    where: { id: problemId },
  });

  if (!problem) {
    throw new AppError('Problem not found.', 404, 'PROBLEM_NOT_FOUND');
  }

  const attempts = await prisma.submission.count({
    where: { problemId },
  });

  const accepted = await prisma.submission.count({
    where: { problemId, status: 'ACCEPTED' },
  });

  const unevaluated = await prisma.submission.count({
    where: { problemId, status: { in: ['QUEUED', 'RUNNING'] } },
  });

  const evaluated = Math.max(0, attempts - unevaluated);
  const acceptanceRate =
    evaluated > 0 ? Math.round((accepted / evaluated) * 10000) / 100 : 0;

  // Unique users attempted
  const uniqueAttemptedGroup = await prisma.submission.findMany({
    where: { problemId },
    distinct: ['userId'],
    select: { userId: true },
  });
  const uniqueUsers = uniqueAttemptedGroup.length;

  // Unique users solved
  const uniqueSolvedGroup = await prisma.submission.findMany({
    where: { problemId, status: 'ACCEPTED' },
    distinct: ['userId'],
    select: { userId: true },
  });
  const solvedBy = uniqueSolvedGroup.length;

  // Average runtime for ACCEPTED submissions
  const runtimeAgg = await prisma.submission.aggregate({
    where: { problemId, status: 'ACCEPTED', executionTime: { not: null } },
    _avg: { executionTime: true },
  });

  const averageRuntimeMs = runtimeAgg._avg.executionTime ? Math.round(runtimeAgg._avg.executionTime) : 0;

  return {
    problemId: problem.id,
    title: problem.title,
    attempts,
    accepted,
    uniqueUsers,
    solvedBy,
    acceptanceRate,
    averageRuntimeMs,
  };
}
