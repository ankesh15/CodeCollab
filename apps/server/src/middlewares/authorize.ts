import { Request, Response, NextFunction } from 'express';
import { RoomRole } from '@prisma/client';
import { ApiResponse } from '@codecollab/shared';
import { prisma } from '../config/db';

const ROLE_RANK: Record<RoomRole, number> = {
  [RoomRole.OWNER]: 3,
  [RoomRole.ADMIN]: 2,
  [RoomRole.MEMBER]: 1,
};

export function requireRoomRole(
  allowedRoles: RoomRole[] = [],
  options?: { allowPublicRead?: boolean }
) {
  return async (req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required prior to room authorization.',
        error: 'UNAUTHORIZED',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const roomId = (req.params['roomId'] || req.body['roomId'] || req.query['roomId']) as string | undefined;

    if (!roomId) {
      res.status(400).json({
        success: false,
        message: 'Room ID is required for room access authorization.',
        error: 'BAD_REQUEST',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    try {
      const room = await prisma.room.findUnique({
        where: { id: roomId },
        select: { id: true, isPrivate: true, ownerId: true },
      });

      if (!room) {
        res.status(404).json({
          success: false,
          message: 'Requested coding room does not exist.',
          error: 'ROOM_NOT_FOUND',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Check membership
      const membership = await prisma.roomMember.findUnique({
        where: {
          roomId_userId: {
            roomId,
            userId: req.user.userId,
          },
        },
        select: { role: true },
      });

      // If room is private and user is not a member -> 403 Forbidden
      if (room.isPrivate && !membership) {
        res.status(403).json({
          success: false,
          message: 'Access forbidden. You are not a member of this private room.',
          error: 'FORBIDDEN',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Public Room Access: If room is public, allowPublicRead is enabled, and request is GET
      if (options?.allowPublicRead && !room.isPrivate && req.method === 'GET') {
        next();
        return;
      }

      // If allowedRoles is specified, verify member role satisfies required role level
      if (allowedRoles.length > 0) {
        if (!membership) {
          res.status(403).json({
            success: false,
            message: 'Access forbidden. You do not belong to this room.',
            error: 'FORBIDDEN',
            timestamp: new Date().toISOString(),
          });
          return;
        }

        const userRank = ROLE_RANK[membership.role];
        const roleRanks = allowedRoles
          .map((r) => ROLE_RANK[r])
          .filter((rank): rank is number => rank !== undefined);
        const minRequiredRank = roleRanks.length > 0 ? Math.min(...roleRanks) : 0;

        if (userRank === undefined || userRank < minRequiredRank) {
          res.status(403).json({
            success: false,
            message: `Insufficient room permissions. Required role level: ${allowedRoles.join(' or ')}.`,
            error: 'INSUFFICIENT_PERMISSIONS',
            timestamp: new Date().toISOString(),
          });
          return;
        }
      }

      next();
    } catch (err) {
      console.error('[Room Authorization Error]:', err);
      res.status(500).json({
        success: false,
        message: 'Internal server error during room authorization.',
        error: 'INTERNAL_SERVER_ERROR',
        timestamp: new Date().toISOString(),
      });
    }
  };
}

export async function requireAdmin(
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: 'Authentication required prior to admin access.',
      error: 'UNAUTHORIZED',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Fetch current role directly from database to enforce database as single source of truth
  const dbUser = await prisma.user.findUnique({
    where: { id: req.user.userId },
    select: { role: true },
  });

  if (!dbUser || dbUser.role !== 'ADMIN') {
    res.status(403).json({
      success: false,
      message: 'Access forbidden. Administrator permissions required.',
      error: 'FORBIDDEN',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  next();
}
