import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '@codecollab/shared';
import { verifyToken } from '../utils/jwt';
import { prisma } from '../config/db';

export async function authenticate(
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
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

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, isActive: true },
    });

    if (!user || user.isActive === false) {
      res.status(401).json({
        success: false,
        message: 'Account is deactivated or does not exist.',
        error: 'ACCOUNT_DEACTIVATED',
        timestamp: new Date().toISOString(),
      });
      return;
    }

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

export async function optionalAuthenticate(
  req: Request,
  _res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    try {
      const payload = verifyToken(token);
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { id: true, isActive: true },
      });
      if (user && user.isActive) {
        req.user = payload;
      }
    } catch {
      // Ignore token errors for optional authentication
    }
  }

  next();
}
