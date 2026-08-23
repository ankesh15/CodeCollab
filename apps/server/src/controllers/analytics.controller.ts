import { Request, Response } from 'express';
import {
  getUserStatisticsService,
  getUserActivityService,
  getUserRankService,
  getGlobalLeaderboardService,
  getRoomLeaderboardService,
  getProblemStatisticsService,
  AppError,
} from '../services/analytics.service';
import { ApiResponse } from '@codecollab/shared';

export async function getUserAnalyticsController(req: Request, res: Response) {
  try {
    const userId = req.user!.userId;
    const statistics = await getUserStatisticsService(userId);
    const rank = await getUserRankService(userId);

    const response: ApiResponse = {
      success: true,
      message: 'User analytics retrieved successfully.',
      data: {
        statistics,
        rank,
      },
      timestamp: new Date().toISOString(),
    };

    return res.status(200).json(response);
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
        error: err.errorCode,
        timestamp: new Date().toISOString(),
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Internal server error while fetching user analytics.',
      error: 'SERVER_ERROR',
      timestamp: new Date().toISOString(),
    });
  }
}

export async function getUserActivityController(req: Request, res: Response) {
  try {
    const userId = req.user!.userId;
    const daysQuery = req.query['days'] ? parseInt(req.query['days'] as string, 10) : 30;
    const days = isNaN(daysQuery) || daysQuery <= 0 ? 30 : daysQuery;

    const activity = await getUserActivityService(userId, days);

    const response: ApiResponse = {
      success: true,
      message: 'User activity retrieved successfully.',
      data: {
        activity,
      },
      timestamp: new Date().toISOString(),
    };

    return res.status(200).json(response);
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
        error: err.errorCode,
        timestamp: new Date().toISOString(),
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Internal server error while fetching user activity.',
      error: 'SERVER_ERROR',
      timestamp: new Date().toISOString(),
    });
  }
}

export async function getGlobalLeaderboardController(req: Request, res: Response) {
  try {
    const limitQuery = req.query['limit'] ? parseInt(req.query['limit'] as string, 10) : 20;
    const limit = isNaN(limitQuery) || limitQuery <= 0 ? 20 : Math.min(limitQuery, 100);
    const cursor = req.query['cursor'] ? (req.query['cursor'] as string) : undefined;
    const currentUserId = req.user?.userId;

    const data = await getGlobalLeaderboardService(limit, cursor, currentUserId);

    const response: ApiResponse = {
      success: true,
      message: 'Global leaderboard retrieved successfully.',
      data,
      timestamp: new Date().toISOString(),
    };

    return res.status(200).json(response);
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
        error: err.errorCode,
        timestamp: new Date().toISOString(),
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Internal server error while fetching global leaderboard.',
      error: 'SERVER_ERROR',
      timestamp: new Date().toISOString(),
    });
  }
}

export async function getRoomLeaderboardController(req: Request, res: Response) {
  try {
    const { roomId } = req.params;
    if (!roomId) {
      return res.status(400).json({
        success: false,
        message: 'Room ID is required.',
        error: 'INVALID_INPUT',
        timestamp: new Date().toISOString(),
      });
    }

    const data = await getRoomLeaderboardService(roomId);

    const response: ApiResponse = {
      success: true,
      message: 'Room leaderboard retrieved successfully.',
      data,
      timestamp: new Date().toISOString(),
    };

    return res.status(200).json(response);
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
        error: err.errorCode,
        timestamp: new Date().toISOString(),
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Internal server error while fetching room leaderboard.',
      error: 'SERVER_ERROR',
      timestamp: new Date().toISOString(),
    });
  }
}

export async function getProblemStatisticsController(req: Request, res: Response) {
  try {
    const { problemId } = req.params;
    if (!problemId) {
      return res.status(400).json({
        success: false,
        message: 'Problem ID is required.',
        error: 'INVALID_INPUT',
        timestamp: new Date().toISOString(),
      });
    }

    const statistics = await getProblemStatisticsService(problemId);

    const response: ApiResponse = {
      success: true,
      message: 'Problem statistics retrieved successfully.',
      data: {
        statistics,
      },
      timestamp: new Date().toISOString(),
    };

    return res.status(200).json(response);
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
        error: err.errorCode,
        timestamp: new Date().toISOString(),
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Internal server error while fetching problem statistics.',
      error: 'SERVER_ERROR',
      timestamp: new Date().toISOString(),
    });
  }
}
