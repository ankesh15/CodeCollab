import { Request, Response, NextFunction } from 'express';
import { ApiResponse, PaginatedMessagesResponseData } from '@codecollab/shared';
import { getRoomMessagesQuerySchema } from '../schemas/message.schema';
import { getRoomMessagesService, deleteMessageService } from '../services/message.service';
import { broadcastMessageDeleted } from '../socket/message.handlers';

export async function getRoomMessagesController(
  req: Request,
  res: Response<ApiResponse<PaginatedMessagesResponseData>>,
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

    const { roomId } = req.params;
    if (!roomId) {
      res.status(400).json({
        success: false,
        message: 'roomId parameter is required.',
        error: 'BAD_REQUEST',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const parseResult = getRoomMessagesQuerySchema.safeParse(req.query);
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

    const result = await getRoomMessagesService({
      userId: req.user.userId,
      roomId,
      limit: parseResult.data.limit,
      cursor: parseResult.data.cursor,
    });

    res.status(200).json({
      success: true,
      message: 'Room messages retrieved successfully.',
      data: result,
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

export async function deleteMessageController(
  req: Request,
  res: Response<ApiResponse<{ messageId: string }>>,
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

    const { messageId } = req.params;
    if (!messageId) {
      res.status(400).json({
        success: false,
        message: 'messageId parameter is required.',
        error: 'BAD_REQUEST',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const deleted = await deleteMessageService({
      userId: req.user.userId,
      messageId,
    });

    // Broadcast message:delete socket event to room
    broadcastMessageDeleted(deleted.roomId, deleted.messageId);

    res.status(200).json({
      success: true,
      message: 'Message deleted successfully.',
      data: { messageId: deleted.messageId },
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
