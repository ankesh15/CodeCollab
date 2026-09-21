import { Request, Response, NextFunction } from 'express';
import { ApiResponse, RoomSummary, RoomDetailsData } from '@codecollab/shared';
import { prisma } from '../config/db';
import { createRoomSchema, updateRoomSchema } from '../schemas/room.schema';

/**
 * POST /api/rooms
 * Create a new room with owner membership and initial code document in a single transaction.
 */
export async function createRoomController(
  req: Request,
  res: Response<ApiResponse<{ room: RoomSummary }>>,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required to create a room.',
        error: 'UNAUTHORIZED',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const parseResult = createRoomSchema.safeParse(req.body);
    if (!parseResult.success) {
      const formattedErrors = parseResult.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));

      res.status(400).json({
        success: false,
        message: 'Validation failed for room creation.',
        error: 'VALIDATION_FAILED',
        errors: formattedErrors,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const { name, language, isPrivate } = parseResult.data;
    const userId = req.user.userId;

    const createdRoom = await prisma.$transaction(async (tx) => {
      // 1. Create Room record
      const room = await tx.room.create({
        data: {
          name,
          ownerId: userId,
          language: language || 'javascript',
          isPrivate: Boolean(isPrivate),
        },
        include: {
          owner: { select: { id: true, username: true } },
          members: { select: { userId: true, role: true } },
        },
      });

      // 2. Create RoomMember record with OWNER role
      await tx.roomMember.create({
        data: {
          roomId: room.id,
          userId,
          role: 'OWNER',
        },
      });

      // 3. Create initial CodeDocument
      const defaultContent =
        language === 'cpp'
          ? `#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    // Write C++ code here\n    cout << "Hello CodeCollab!" << endl;\n    return 0;\n}`
          : language === 'python'
          ? `# Python Workspace\nprint("Hello CodeCollab!")`
          : `// JavaScript Workspace\nconsole.log("Hello CodeCollab!");`;

      await tx.codeDocument.create({
        data: {
          roomId: room.id,
          language: language || 'javascript',
          content: defaultContent,
          version: 1,
        },
      });

      return room;
    });

    const summary: RoomSummary = {
      id: createdRoom.id,
      name: createdRoom.name,
      language: createdRoom.language,
      isPrivate: createdRoom.isPrivate,
      ownerId: createdRoom.owner.id,
      ownerUsername: createdRoom.owner.username,
      memberCount: 1,
      role: 'OWNER',
      createdAt: createdRoom.createdAt.toISOString(),
    };

    res.status(201).json({
      success: true,
      message: 'Coding room created successfully.',
      data: { room: summary },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/rooms/:roomId
 * Retrieve room details. Public rooms can be viewed by any authenticated user;
 * private rooms require active room membership.
 */
export async function getRoomController(
  req: Request,
  res: Response<ApiResponse<{ room: RoomDetailsData }>>,
  next: NextFunction
): Promise<void> {
  try {
    const { roomId } = req.params;

    if (!roomId) {
      res.status(400).json({
        success: false,
        message: 'Room ID is required.',
        error: 'BAD_REQUEST',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        owner: { select: { id: true, username: true, avatar: true } },
        members: {
          include: { user: { select: { id: true, username: true, avatar: true } } },
          orderBy: { joinedAt: 'asc' },
        },
      },
    });

    if (!room) {
      res.status(404).json({
        success: false,
        message: 'Room not found.',
        error: 'ROOM_NOT_FOUND',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Authorization check for private rooms
    const userId = req.user?.userId;
    const isMember = room.members.some((m) => m.userId === userId);

    if (room.isPrivate && !isMember) {
      res.status(403).json({
        success: false,
        message: 'Access forbidden. You are not a member of this private room.',
        error: 'FORBIDDEN',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const formattedRoom: RoomDetailsData = {
      id: room.id,
      name: room.name,
      language: room.language,
      isPrivate: room.isPrivate,
      ownerId: room.ownerId,
      owner: room.owner,
      members: room.members.map((m) => ({
        id: m.id,
        roomId: m.roomId,
        userId: m.userId,
        role: m.role,
        joinedAt: m.joinedAt.toISOString(),
        user: m.user,
      })),
      createdAt: room.createdAt.toISOString(),
      updatedAt: room.updatedAt.toISOString(),
    };

    res.status(200).json({
      success: true,
      message: 'Coding room details retrieved successfully.',
      data: { room: formattedRoom },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/rooms
 * List public rooms and private rooms the authenticated user belongs to.
 */
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

/**
 * POST /api/rooms/:roomId/join
 * Join a room. Public rooms allow any authenticated user to join (idempotent upsert).
 * Private rooms require prior authorization / membership.
 */
export async function joinRoomController(
  req: Request,
  res: Response<ApiResponse<{ roomId: string; role: string }>>,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required to join room.',
        error: 'UNAUTHORIZED',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const roomId = req.params.roomId;
    if (!roomId) {
      res.status(400).json({
        success: false,
        message: 'Room ID parameter is required.',
        error: 'BAD_REQUEST',
        timestamp: new Date().toISOString(),
      });
      return;
    }
    const userId = req.user.userId;

    const room = await prisma.room.findUnique({
      where: { id: roomId },
      select: { id: true, isPrivate: true, ownerId: true },
    });

    if (!room) {
      res.status(404).json({
        success: false,
        message: 'Room not found.',
        error: 'ROOM_NOT_FOUND',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Check existing membership
    const existingMembership = await prisma.roomMember.findUnique({
      where: {
        roomId_userId: { roomId, userId },
      },
    });

    if (room.isPrivate && !existingMembership) {
      res.status(403).json({
        success: false,
        message: 'Access forbidden. This room is private and requires an invitation.',
        error: 'FORBIDDEN',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Idempotent upsert: prevent duplicate membership error
    const membership = await prisma.roomMember.upsert({
      where: {
        roomId_userId: { roomId, userId },
      },
      update: {},
      create: {
        roomId,
        userId,
        role: 'MEMBER',
      },
    });

    res.status(200).json({
      success: true,
      message: 'Successfully joined coding room.',
      data: { roomId, role: membership.role },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/rooms/:roomId/leave
 * Leave a room safely.
 * If owner leaves a multi-member room, ownership transfers to the oldest member.
 * If owner is the sole member, the room is deleted cleanly.
 */
export async function leaveRoomController(
  req: Request,
  res: Response<ApiResponse<{ message: string; action?: 'left' | 'transferred' | 'deleted'; newOwnerId?: string; roomDeleted?: boolean }>>,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required to leave room.',
        error: 'UNAUTHORIZED',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const roomId = req.params.roomId;
    if (!roomId) {
      res.status(400).json({
        success: false,
        message: 'Room ID parameter is required.',
        error: 'BAD_REQUEST',
        timestamp: new Date().toISOString(),
      });
      return;
    }
    const userId = req.user.userId;

    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        members: { orderBy: { joinedAt: 'asc' } },
      },
    });

    if (!room) {
      res.status(404).json({
        success: false,
        message: 'Room not found.',
        error: 'ROOM_NOT_FOUND',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const userMembership = room.members.find((m) => m.userId === userId);
    if (!userMembership) {
      res.status(404).json({
        success: false,
        message: 'You are not a member of this room.',
        error: 'NOT_A_MEMBER',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (userMembership.role === 'OWNER') {
      const otherMembers = room.members.filter((m) => m.userId !== userId);

      if (otherMembers.length > 0) {
        // Transfer ownership to the next oldest member
        const newOwner = otherMembers[0];
        if (!newOwner) {
          res.status(500).json({
            success: false,
            message: 'Failed to determine next room owner.',
            error: 'INTERNAL_SERVER_ERROR',
            timestamp: new Date().toISOString(),
          });
          return;
        }

        await prisma.$transaction(async (tx) => {
          await tx.roomMember.update({
            where: { id: newOwner.id },
            data: { role: 'OWNER' },
          });

          await tx.room.update({
            where: { id: roomId },
            data: { ownerId: newOwner.userId },
          });

          await tx.roomMember.delete({
            where: { id: userMembership.id },
          });
        });

        res.status(200).json({
          success: true,
          message: 'Ownership transferred to next collaborator and left room successfully.',
          data: {
            message: 'Ownership transferred; left room.',
            action: 'transferred',
            newOwnerId: newOwner.userId,
            roomDeleted: false,
          },
          timestamp: new Date().toISOString(),
        });
        return;
      } else {
        // Sole owner leaving: safely delete room and all associated cascade data
        await prisma.room.delete({
          where: { id: roomId },
        });

        res.status(200).json({
          success: true,
          message: 'Sole owner left; room was safely deleted.',
          data: {
            message: 'Room deleted.',
            action: 'deleted',
            roomDeleted: true,
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }
    }

    // Regular member leaving
    await prisma.roomMember.delete({
      where: { id: userMembership.id },
    });

    res.status(200).json({
      success: true,
      message: 'Successfully left coding room.',
      data: {
        message: 'Left room.',
        action: 'left',
        roomDeleted: false,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/rooms/:roomId
 * Delete a room. Only authorized room owner or system administrator can delete a room.
 * Cascades deletion of members, code document, and messages.
 */
export async function deleteRoomController(
  req: Request,
  res: Response<ApiResponse<{ message: string }>>,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required to delete room.',
        error: 'UNAUTHORIZED',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const roomId = req.params.roomId;
    if (!roomId) {
      res.status(400).json({
        success: false,
        message: 'Room ID parameter is required.',
        error: 'BAD_REQUEST',
        timestamp: new Date().toISOString(),
      });
      return;
    }
    const userId = req.user.userId;

    const room = await prisma.room.findUnique({
      where: { id: roomId },
      select: { id: true, ownerId: true },
    });

    if (!room) {
      res.status(404).json({
        success: false,
        message: 'Room not found.',
        error: 'ROOM_NOT_FOUND',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const isOwner = room.ownerId === userId;
    const isSystemAdmin = req.user.role === 'ADMIN';

    if (!isOwner && !isSystemAdmin) {
      res.status(403).json({
        success: false,
        message: 'Access forbidden. Only the room owner or an administrator can delete this room.',
        error: 'FORBIDDEN',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Cascade delete room
    await prisma.room.delete({
      where: { id: roomId },
    });

    res.status(200).json({
      success: true,
      message: 'Room deleted successfully.',
      data: { message: 'Room and associated resources deleted successfully.' },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/rooms/:roomId
 * Update room settings. Whitelists name, language, and isPrivate.
 * Only room owner or admin can update room settings.
 */
export async function updateRoomController(
  req: Request,
  res: Response<ApiResponse<{ room: RoomSummary }>>,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required to update room settings.',
        error: 'UNAUTHORIZED',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const roomId = req.params.roomId;
    if (!roomId) {
      res.status(400).json({
        success: false,
        message: 'Room ID parameter is required.',
        error: 'BAD_REQUEST',
        timestamp: new Date().toISOString(),
      });
      return;
    }
    const userId = req.user.userId;

    const parseResult = updateRoomSchema.safeParse(req.body);
    if (!parseResult.success) {
      const formattedErrors = parseResult.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));

      res.status(400).json({
        success: false,
        message: 'Validation failed for room settings update.',
        error: 'VALIDATION_FAILED',
        errors: formattedErrors,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        owner: { select: { id: true, username: true } },
        members: { select: { userId: true, role: true } },
      },
    });

    if (!room) {
      res.status(404).json({
        success: false,
        message: 'Room not found.',
        error: 'ROOM_NOT_FOUND',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const membership = room.members.find((m) => m.userId === userId);
    const isOwner = room.ownerId === userId;
    const isRoomAdmin = membership?.role === 'ADMIN';
    const isSystemAdmin = req.user.role === 'ADMIN';

    if (!isOwner && !isRoomAdmin && !isSystemAdmin) {
      res.status(403).json({
        success: false,
        message: 'Access forbidden. Only room owners or admins can update settings.',
        error: 'FORBIDDEN',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const { name, language, isPrivate } = parseResult.data;
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (language !== undefined) updateData.language = language;
    if (isPrivate !== undefined) updateData.isPrivate = isPrivate;

    const updated = await prisma.$transaction(async (tx) => {
      const updatedRoom = await tx.room.update({
        where: { id: roomId },
        data: updateData,
        include: {
          owner: { select: { id: true, username: true } },
          members: { select: { userId: true, role: true } },
        },
      });

      if (language) {
        await tx.codeDocument.updateMany({
          where: { roomId },
          data: { language },
        });
      }

      return updatedRoom;
    });

    const userMembership = updated.members.find((m) => m.userId === userId);
    const summary: RoomSummary = {
      id: updated.id,
      name: updated.name,
      language: updated.language,
      isPrivate: updated.isPrivate,
      ownerId: updated.owner.id,
      ownerUsername: updated.owner.username,
      memberCount: updated.members.length,
      role: userMembership?.role,
      createdAt: updated.createdAt.toISOString(),
    };

    res.status(200).json({
      success: true,
      message: 'Room settings updated successfully.',
      data: { room: summary },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}
