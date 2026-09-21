import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '@codecollab/shared';
import { AppError } from '../services/auth.service';
import { logger } from '../utils/logger';
import { config } from '../config/env';

export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response<ApiResponse>,
  _next: NextFunction
): void {
  const requestId = req.requestId || 'unknown';
  const timestamp = new Date().toISOString();

  // Log detailed error server-side
  logger.error(`[Unhandled API Error] ${err.message}`, {
    requestId,
    name: err.name,
    stack: config.nodeEnv === 'development' ? err.stack : undefined,
  });

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      error: err.errorCode,
      errors: err.errors,
      requestId,
      timestamp,
    });
    return;
  }

  if (err.message && err.message.includes('CORS policy rejection')) {
    res.status(403).json({
      success: false,
      message: 'CORS policy rejection: Origin not allowed.',
      error: 'FORBIDDEN',
      requestId,
      timestamp,
    });
    return;
  }

  // Generic Error handling
  const statusCode = (err as Error & { statusCode?: number }).statusCode || 500;
  const errorCode = statusCode === 404 ? 'NOT_FOUND' : statusCode === 403 ? 'FORBIDDEN' : statusCode === 401 ? 'UNAUTHORIZED' : 'INTERNAL_SERVER_ERROR';

  const clientMessage = config.nodeEnv === 'production' && statusCode === 500
    ? 'An internal server error occurred.'
    : err.message || 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    message: clientMessage,
    error: errorCode,
    requestId,
    timestamp,
  });
}
