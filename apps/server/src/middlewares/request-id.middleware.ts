import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const existingId = req.headers['x-request-id'];
  const requestId = typeof existingId === 'string' && existingId ? existingId : `req_${crypto.randomBytes(8).toString('hex')}`;

  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
}
