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

  const minMs = runtimeAggregate._min.executionTime ? Math.round(runtimeAggregate._min.executionTime) : 0;
  const runtime = {
    averageMs: runtimeAggregate._avg.executionTime ? Math.round(runtimeAggregate._avg.executionTime) : 0,
    minMs,
    bestMs: minMs,
    maxMs: runtimeAggregate._max.executionTime ? Math.round(runtimeAggregate._max.executionTime) : 0,
  };

  const avgKb = memoryAggregate._avg.memoryUsed ? Math.round(memoryAggregate._avg.memoryUsed) : 0;
  const memory = {
    averageKb: avgKb,
    averageMb: Math.round((avgKb / 1024) * 100) / 100,
  };

  return {
    totalSubmissions,
    acceptedSubmissions,
    acceptanceRate,
    problemsSolved,
    difficulty,
    runtime,
    memory,
  };
}

/**
 * Get 30-day activity points for user using database-level date aggregation
 */
export async function getUserActivityService(
  userId: string,
  days = 30
): Promise<ActivityPoint[]> {
  const now = new Date();
  const startDate = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (days - 1), 0, 0, 0, 0)
  );

  // Group by UTC date directly in PostgreSQL
  const rows = await prisma.$queryRaw<Array<{ date: string; count: number | bigint }>>`
    SELECT
      TO_CHAR("createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD') as date,
      COUNT(*)::int as count
    FROM submissions
    WHERE "userId" = ${userId} AND "createdAt" >= ${startDate}
    GROUP BY TO_CHAR("createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD')
  `;

  const countsByDate: Record<string, number> = {};
  for (const row of rows) {
    countsByDate[row.date] = Number(row.count);
  }

  // Populate contiguous 30 UTC days array ending with today
  const activity: ActivityPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    const dateStr = d.toISOString().split('T')[0]!;
    activity.push({
      date: dateStr,
      submissions: countsByDate[dateStr] || 0,
    });
  }

  return activity;
}

/**
 * Get authenticated user rank in global leaderboard directly via PostgreSQL window functions
 */
export async function getUserRankService(userId: string): Promise<number | null> {
  const result = await prisma.$queryRaw<
    Array<{ rank: number | bigint; problemsSolved: number | bigint; acceptedSubmissions: number | bigint }>
  >`
    WITH user_rankings AS (
      SELECT
        u.id as "userId",
        u.username,
        COUNT(DISTINCT CASE WHEN s.status = 'ACCEPTED' THEN s."problemId" END)::int as "problemsSolved",
        COUNT(CASE WHEN s.status = 'ACCEPTED' THEN 1 END)::int as "acceptedSubmissions",
        (CASE
          WHEN COUNT(CASE WHEN s.status NOT IN ('QUEUED', 'RUNNING') THEN 1 END) > 0
          THEN ROUND((COUNT(CASE WHEN s.status = 'ACCEPTED' THEN 1 END)::numeric / COUNT(CASE WHEN s.status NOT IN ('QUEUED', 'RUNNING') THEN 1 END)::numeric) * 10000) / 100
          ELSE 0
        END)::float as "acceptanceRate",
        ROW_NUMBER() OVER (
          ORDER BY
            COUNT(DISTINCT CASE WHEN s.status = 'ACCEPTED' THEN s."problemId" END) DESC,
            (CASE
              WHEN COUNT(CASE WHEN s.status NOT IN ('QUEUED', 'RUNNING') THEN 1 END) > 0
              THEN ROUND((COUNT(CASE WHEN s.status = 'ACCEPTED' THEN 1 END)::numeric / COUNT(CASE WHEN s.status NOT IN ('QUEUED', 'RUNNING') THEN 1 END)::numeric) * 10000) / 100
              ELSE 0
            END) DESC,
            COUNT(CASE WHEN s.status = 'ACCEPTED' THEN 1 END) DESC,
            u.username ASC
        )::int as rank
      FROM users u
      LEFT JOIN submissions s ON s."userId" = u.id
      WHERE u."isActive" = true
      GROUP BY u.id, u.username
    )
    SELECT rank, "problemsSolved", "acceptedSubmissions"
    FROM user_rankings
    WHERE "userId" = ${userId}
  `;

  if (!result || result.length === 0) {
    return null;
  }
  const userRow = result[0];
  if (!userRow || (Number(userRow.problemsSolved) === 0 && Number(userRow.acceptedSubmissions) === 0)) {
    return null;
  }
  return Number(userRow.rank);
}

/**
 * Get Paginated Global Leaderboard using PostgreSQL Window Functions and Limit/Offset
 */
export async function getGlobalLeaderboardService(
  limit = 20,
  cursor?: string,
  currentUserId?: string
): Promise<PaginatedLeaderboardResponseData> {
  const safeLimit = Math.min(Math.max(1, limit), 100);

  // Determine starting offset
  let offset = 0;
  if (cursor) {
    const cursorRank = parseInt(cursor, 10);
    if (!isNaN(cursorRank)) {
      offset = Math.max(0, cursorRank);
    } else {
      const cursorUserRank = await getUserRankService(cursor);
      if (cursorUserRank !== null) {
        offset = cursorUserRank;
      }
    }
  }

  // Get total count of active users
  const totalCount = await prisma.user.count({
    where: { isActive: true },
  });

  // Query paginated leaderboard slice directly with PostgreSQL window functions
  const rows = await prisma.$queryRaw<
    Array<{
      rank: number | bigint;
      userId: string;
      username: string;
      avatar: string | null;
      problemsSolved: number | bigint;
      acceptedSubmissions: number | bigint;
      acceptanceRate: number | string;
    }>
  >`
    WITH user_rankings AS (
      SELECT
        u.id as "userId",
        u.username,
        u.avatar,
        COUNT(DISTINCT CASE WHEN s.status = 'ACCEPTED' THEN s."problemId" END)::int as "problemsSolved",
        COUNT(CASE WHEN s.status = 'ACCEPTED' THEN 1 END)::int as "acceptedSubmissions",
        (CASE
          WHEN COUNT(CASE WHEN s.status NOT IN ('QUEUED', 'RUNNING') THEN 1 END) > 0
          THEN ROUND((COUNT(CASE WHEN s.status = 'ACCEPTED' THEN 1 END)::numeric / COUNT(CASE WHEN s.status NOT IN ('QUEUED', 'RUNNING') THEN 1 END)::numeric) * 10000) / 100
          ELSE 0
        END)::float as "acceptanceRate",
        ROW_NUMBER() OVER (
          ORDER BY
            COUNT(DISTINCT CASE WHEN s.status = 'ACCEPTED' THEN s."problemId" END) DESC,
            (CASE
              WHEN COUNT(CASE WHEN s.status NOT IN ('QUEUED', 'RUNNING') THEN 1 END) > 0
              THEN ROUND((COUNT(CASE WHEN s.status = 'ACCEPTED' THEN 1 END)::numeric / COUNT(CASE WHEN s.status NOT IN ('QUEUED', 'RUNNING') THEN 1 END)::numeric) * 10000) / 100
              ELSE 0
            END) DESC,
            COUNT(CASE WHEN s.status = 'ACCEPTED' THEN 1 END) DESC,
            u.username ASC
        )::int as rank
      FROM users u
      LEFT JOIN submissions s ON s."userId" = u.id
      WHERE u."isActive" = true
      GROUP BY u.id, u.username, u.avatar
    )
    SELECT *
    FROM user_rankings
    ORDER BY rank ASC
    LIMIT ${safeLimit}
    OFFSET ${offset}
  `;

  const leaderboard: LeaderboardEntry[] = rows.map((r) => ({
    rank: Number(r.rank),
    user: {
      id: r.userId,
      username: r.username,
      avatar: r.avatar,
    },
    problemsSolved: Number(r.problemsSolved),
    acceptedSubmissions: Number(r.acceptedSubmissions),
    acceptanceRate: Number(r.acceptanceRate),
  }));

  const nextCursor =
    offset + safeLimit < totalCount ? (offset + safeLimit).toString() : null;

  // Determine currentUserRank without recalculating the entire ranking
  let currentUserRank: number | null = null;
  if (currentUserId) {
    const foundInSlice = leaderboard.find((e) => e.user.id === currentUserId);
    if (foundInSlice) {
      currentUserRank =
        foundInSlice.problemsSolved === 0 && foundInSlice.acceptedSubmissions === 0
          ? null
          : foundInSlice.rank;
    } else {
      currentUserRank = await getUserRankService(currentUserId);
    }
  }

  return {
    leaderboard,
    currentUserRank,
    nextCursor,
    totalCount,
  };
}

/**
 * Get Room Leaderboard (Room-isolated statistics for room members in a single SQL query)
 */
export async function getRoomLeaderboardService(
  roomId: string
): Promise<RoomLeaderboardResponseData> {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    select: { id: true },
  });

  if (!room) {
    throw new AppError('Room not found.', 404, 'ROOM_NOT_FOUND');
  }

  const rows = await prisma.$queryRaw<
    Array<{
      userId: string;
      username: string;
      avatar: string | null;
      problemsSolved: number | bigint;
      acceptedSubmissions: number | bigint;
      acceptanceRate: number | string;
    }>
  >`
    SELECT
      rm."userId",
      u.username,
      u.avatar,
      COUNT(DISTINCT CASE WHEN s.status = 'ACCEPTED' THEN s."problemId" END)::int as "problemsSolved",
      COUNT(CASE WHEN s.status = 'ACCEPTED' THEN 1 END)::int as "acceptedSubmissions",
      (CASE
        WHEN COUNT(CASE WHEN s.status NOT IN ('QUEUED', 'RUNNING') THEN 1 END) > 0
        THEN ROUND((COUNT(CASE WHEN s.status = 'ACCEPTED' THEN 1 END)::numeric / COUNT(CASE WHEN s.status NOT IN ('QUEUED', 'RUNNING') THEN 1 END)::numeric) * 10000) / 100
        ELSE 0
      END)::float as "acceptanceRate"
    FROM room_members rm
    JOIN users u ON u.id = rm."userId"
    LEFT JOIN submissions s ON s."userId" = rm."userId" AND s."roomId" = ${roomId}
    WHERE rm."roomId" = ${roomId}
    GROUP BY rm."userId", u.username, u.avatar
    ORDER BY
      "problemsSolved" DESC,
      "acceptanceRate" DESC,
      "acceptedSubmissions" DESC,
      u.username ASC
  `;

  const leaderboard: RoomLeaderboardEntry[] = rows.map((r, idx) => ({
    rank: idx + 1,
    user: {
      id: r.userId,
      username: r.username,
      avatar: r.avatar,
    },
    problemsSolved: Number(r.problemsSolved),
    acceptedSubmissions: Number(r.acceptedSubmissions),
    acceptanceRate: Number(r.acceptanceRate),
  }));

  return {
    roomId,
    leaderboard,
  };
}

/**
 * Get Problem Statistics (Aggregated statistics for a specific problem in a single query)
 */
export async function getProblemStatisticsService(problemId: string): Promise<ProblemStatistics> {
  const problem = await prisma.problem.findUnique({
    where: { id: problemId },
    select: { id: true, title: true },
  });

  if (!problem) {
    throw new AppError('Problem not found.', 404, 'PROBLEM_NOT_FOUND');
  }

  const rows = await prisma.$queryRaw<
    Array<{
      attempts: number | bigint;
      accepted: number | bigint;
      unevaluated: number | bigint;
      uniqueUsers: number | bigint;
      solvedBy: number | bigint;
      avgRuntime: number | null;
    }>
  >`
    SELECT
      COUNT(*)::int as attempts,
      COUNT(CASE WHEN status = 'ACCEPTED' THEN 1 END)::int as accepted,
      COUNT(CASE WHEN status IN ('QUEUED', 'RUNNING') THEN 1 END)::int as unevaluated,
      COUNT(DISTINCT "userId")::int as "uniqueUsers",
      COUNT(DISTINCT CASE WHEN status = 'ACCEPTED' THEN "userId" END)::int as "solvedBy",
      AVG(CASE WHEN status = 'ACCEPTED' THEN "executionTime" END)::float as "avgRuntime"
    FROM submissions
    WHERE "problemId" = ${problemId}
  `;

  const stats = rows[0] || {
    attempts: 0,
    accepted: 0,
    unevaluated: 0,
    uniqueUsers: 0,
    solvedBy: 0,
    avgRuntime: 0,
  };

  const attempts = Number(stats.attempts);
  const accepted = Number(stats.accepted);
  const unevaluated = Number(stats.unevaluated);
  const evaluated = Math.max(0, attempts - unevaluated);
  const acceptanceRate =
    evaluated > 0 ? Math.round((accepted / evaluated) * 10000) / 100 : 0;
  const averageRuntimeMs = stats.avgRuntime ? Math.round(Number(stats.avgRuntime)) : 0;

  return {
    problemId: problem.id,
    title: problem.title,
    attempts,
    accepted,
    uniqueUsers: Number(stats.uniqueUsers),
    solvedBy: Number(stats.solvedBy),
    acceptanceRate,
    averageRuntimeMs,
  };
}
