import { Request, Response, NextFunction } from 'express';
import { ApiResponse, RoomSummary } from '@codecollab/shared';
import { prisma } from '../config/db';

export async function getRoomController(
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const { roomId } = req.params;

    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        owner: { select: { id: true, username: true, avatar: true } },
        members: { include: { user: { select: { id: true, username: true, avatar: true } } } },
      },
    });

    if (!room) {
      res.status(404).json({
        success: false,
        message: 'Room not found.',
        error: 'NOT_FOUND',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Coding room details retrieved successfully.',
      data: room,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

export async function listRoomsController(
  req: Request,
  res: Response<ApiResponse<{ rooms: RoomSummary[] }>>,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.userId;

    const rooms = await prisma.room.findMany({
      where: {
        OR: [
          { isPrivate: false },
          ...(userId
            ? [
                {
                  members: {
                    some: { userId },
                  },
                },
              ]
            : []),
        ],
      },
      include: {
        owner: { select: { id: true, username: true } },
        members: { select: { userId: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const formattedRooms: RoomSummary[] = rooms.map((room) => {
      const userMembership = room.members.find((m) => m.userId === userId);
      return {
        id: room.id,
        name: room.name,
        language: room.language,
        isPrivate: room.isPrivate,
        ownerId: room.owner.id,
        ownerUsername: room.owner.username,
        memberCount: room.members.length,
        role: userMembership?.role,
        createdAt: room.createdAt.toISOString(),
      };
    });

    res.status(200).json({
      success: true,
      message: 'Coding rooms list retrieved successfully.',
      data: { rooms: formattedRooms },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}
