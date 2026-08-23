import { Request, Response, NextFunction } from 'express';
import {
  ApiResponse,
  PaginatedNotificationsResponseData,
  UnreadCountResponseData,
  NotificationSummary,
} from '@codecollab/shared';
import { getNotificationsQuerySchema } from '../schemas/notification.schema';
import {
  getUserNotificationsService,
  getUnreadCountService,
  markNotificationReadService,
  markAllNotificationsReadService,
} from '../services/notification.service';

export async function getUserNotificationsController(
  req: Request,
  res: Response<ApiResponse<PaginatedNotificationsResponseData>>,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required.',
        error: 'UNAUTHORIZED',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const parseResult = getNotificationsQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      const formattedErrors = parseResult.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));

      res.status(400).json({
        success: false,
        message: 'Validation failed for query parameters.',
        error: 'VALIDATION_FAILED',
        errors: formattedErrors,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const result = await getUserNotificationsService({
      userId: req.user.userId,
      limit: parseResult.data.limit,
      cursor: parseResult.data.cursor,
    });

    res.status(200).json({
      success: true,
      message: 'User notifications retrieved successfully.',
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

export async function getUnreadCountController(
  req: Request,
  res: Response<ApiResponse<UnreadCountResponseData>>,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required.',
        error: 'UNAUTHORIZED',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const result = await getUnreadCountService(req.user.userId);

    res.status(200).json({
      success: true,
      message: 'Unread notification count retrieved successfully.',
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

export async function markNotificationReadController(
  req: Request,
  res: Response<ApiResponse<{ notification: NotificationSummary }>>,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required.',
        error: 'UNAUTHORIZED',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const { notificationId } = req.params;
    if (!notificationId) {
      res.status(400).json({
        success: false,
        message: 'notificationId parameter is required.',
        error: 'BAD_REQUEST',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const notification = await markNotificationReadService({
      userId: req.user.userId,
      notificationId,
    });

    res.status(200).json({
      success: true,
      message: 'Notification marked as read.',
      data: { notification },
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const errorObj = err as Error & { statusCode?: number };
    if (errorObj.statusCode) {
      res.status(errorObj.statusCode).json({
        success: false,
        message: errorObj.message,
        error: errorObj.statusCode === 404 ? 'NOT_FOUND' : errorObj.statusCode === 403 ? 'FORBIDDEN' : 'BAD_REQUEST',
        timestamp: new Date().toISOString(),
      });
      return;
    }
    next(err);
  }
}

export async function markAllNotificationsReadController(
  req: Request,
  res: Response<ApiResponse<{ count: number }>>,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required.',
        error: 'UNAUTHORIZED',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const result = await markAllNotificationsReadService(req.user.userId);

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read.',
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}
