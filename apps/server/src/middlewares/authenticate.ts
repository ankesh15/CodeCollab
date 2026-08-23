import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '@codecollab/shared';
import { verifyToken } from '../utils/jwt';

export function authenticate(
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      message: 'Authentication required. Authorization header missing or malformed.',
      error: 'UNAUTHORIZED',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const token = authHeader.substring(7).trim();

  try {
    const payload = verifyToken(token);
    req.user = payload;
    next();
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Invalid or expired token';
    res.status(401).json({
      success: false,
      message: 'Authentication failed. Invalid or expired token.',
      error: errorMessage,
      timestamp: new Date().toISOString(),
    });
  }
}

export function optionalAuthenticate(
  req: Request,
  _res: Response<ApiResponse>,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    try {
      const payload = verifyToken(token);
      req.user = payload;
    } catch {
      // Ignore token errors for optional authentication
    }
  }

  next();
}
