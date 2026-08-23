import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export function httpLoggerMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - startTime;
    const { method, originalUrl } = req;
    const { statusCode } = res;
    const requestId = req.requestId || 'unknown';

    logger.info(`${method} ${originalUrl} ${statusCode} ${durationMs}ms`, {
      requestId,
      statusCode,
      durationMs,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  });

  next();
}
