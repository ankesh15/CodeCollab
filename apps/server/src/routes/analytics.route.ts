import { Router } from 'express';
import {
  getUserAnalyticsController,
  getUserActivityController,
  getGlobalLeaderboardController,
  getRoomLeaderboardController,
  getProblemStatisticsController,
} from '../controllers/analytics.controller';
import { authenticate, optionalAuthenticate } from '../middlewares/authenticate';
import { requireRoomRole } from '../middlewares/authorize';
import { RoomRole } from '@prisma/client';

export const analyticsRouter = Router();

// User Statistics & Activity
analyticsRouter.get('/analytics/me', authenticate, getUserAnalyticsController);
analyticsRouter.get('/analytics/me/activity', authenticate, getUserActivityController);

// Global Leaderboard (Optional authentication to attach currentUserRank)
analyticsRouter.get('/leaderboard', optionalAuthenticate, getGlobalLeaderboardController);

// Room Leaderboard (Room member authorization required)
analyticsRouter.get(
  '/rooms/:roomId/leaderboard',
  authenticate,
  requireRoomRole([RoomRole.OWNER, RoomRole.ADMIN, RoomRole.MEMBER]),
  getRoomLeaderboardController
);

// Problem Statistics
analyticsRouter.get('/problems/:problemId/statistics', optionalAuthenticate, getProblemStatisticsController);
