import { Server } from 'socket.io';
import {
  SOCKET_EVENTS,
  RoomJoinPayload,
  RoomLeavePayload,
  RoomUser,
  RoomStatePayload,
  RoomUserJoinedPayload,
  RoomUserLeftPayload,
  DocumentStatePayload,
  SocketErrorPayload,
} from '@codecollab/shared';
import { AuthenticatedSocket } from './socket.types';
import { presenceManager } from './presence';
import { prisma } from '../config/db';
import { ensureDocument } from '../services/document.service';

// Rate limiting: sliding window per socket
const joinRateLimitMap = new Map<string, number[]>();

function checkRateLimit(map: Map<string, number[]>, key: string, maxLimit: number, windowMs: number): boolean {
  const now = Date.now();
  const timestamps = (map.get(key) || []).filter((t) => now - t < windowMs);
  if (timestamps.length >= maxLimit) {
    return false;
  }
  timestamps.push(now);
  map.set(key, timestamps);
  return true;
}

export function registerRoomHandlers(_io: Server, socket: AuthenticatedSocket): void {
  // Handle room:join
  socket.on(SOCKET_EVENTS.ROOM_JOIN, async (data: RoomJoinPayload) => {
    try {
      if (!socket.user) {
        const errorPayload: SocketErrorPayload = {
          code: 'UNAUTHORIZED',
          message: 'Authentication required to join room.',
        };
        socket.emit(SOCKET_EVENTS.ERROR, errorPayload);
        return;
      }

      // Rate limit check: 10 joins per 10 seconds
      if (!checkRateLimit(joinRateLimitMap, socket.id, 10, 10000)) {
        const errorPayload: SocketErrorPayload = {
          code: 'RATE_LIMITED',
          message: 'Too many room join attempts. Please slow down.',
        };
        socket.emit(SOCKET_EVENTS.ERROR, errorPayload);
        return;
      }

      if (!data || !data.roomId || typeof data.roomId !== 'string') {
        const errorPayload: SocketErrorPayload = {
          code: 'INVALID_ROOM_ID',
          message: 'Room ID is required and must be a valid string.',
        };
        socket.emit(SOCKET_EVENTS.ERROR, errorPayload);
        return;
      }

      const { roomId } = data;

      // Verify room existence in PostgreSQL
      const room = await prisma.room.findUnique({
        where: { id: roomId },
        select: { id: true, name: true, isPrivate: true },
      });

      if (!room) {
        const errorPayload: SocketErrorPayload = {
          code: 'ROOM_NOT_FOUND',
          message: 'Requested coding room does not exist.',
        };
        socket.emit(SOCKET_EVENTS.ERROR, errorPayload);
        return;
      }

      // Verify RoomMember membership
      let membership = await prisma.roomMember.findUnique({
        where: {
          roomId_userId: {
            roomId,
            userId: socket.user.userId,
          },
        },
      });

      // Authorization rule: Private rooms require active RoomMember record
      if (room.isPrivate && !membership) {
        const errorPayload: SocketErrorPayload = {
          code: 'FORBIDDEN',
          message: 'Access forbidden. You are not a member of this private room.',
        };
        socket.emit(SOCKET_EVENTS.ERROR, errorPayload);
        return;
      }

      // If public room and not yet a member, persist membership
      if (!room.isPrivate && !membership) {
        membership = await prisma.roomMember.upsert({
          where: {
            roomId_userId: {
              roomId,
              userId: socket.user.userId,
            },
          },
          update: {},
          create: {
            roomId,
            userId: socket.user.userId,
            role: 'MEMBER',
          },
        });
      }

      // Join Socket.IO room isolation channel
      await socket.join(roomId);

      const roomUser: RoomUser = {
        userId: socket.user.userId,
        username: socket.user.username,
        email: socket.user.email,
        joinedAt: new Date().toISOString(),
      };

      // Add to in-memory presence manager
      presenceManager.addUserToRoom(roomId, roomUser);

      // Emit room:state to joining socket
      const currentUsers = presenceManager.getRoomUsers(roomId);
      const statePayload: RoomStatePayload = {
        roomId,
        users: currentUsers,
      };
      socket.emit(SOCKET_EVENTS.ROOM_STATE, statePayload);

      // Broadcast room:user_joined to all other sockets in room
      const joinedPayload: RoomUserJoinedPayload = {
        roomId,
        user: roomUser,
      };
      socket.to(roomId).emit(SOCKET_EVENTS.ROOM_USER_JOINED, joinedPayload);

      // Ensure CodeDocument exists and send document:state payload
      const doc = await ensureDocument(roomId);
      const documentStatePayload: DocumentStatePayload = {
        roomId,
        document: {
          id: doc.id,
          roomId: doc.roomId,
          content: doc.content,
          language: doc.language,
          version: doc.version,
          createdAt: doc.createdAt.toISOString(),
          updatedAt: doc.updatedAt.toISOString(),
        },
      };
      socket.emit(SOCKET_EVENTS.DOCUMENT_STATE, documentStatePayload);

      console.log(`📡 [Socket] User ${socket.user.username} (${socket.user.userId}) joined room ${roomId}`);
    } catch (err) {
      console.error('[Socket room:join Error]:', err);
      const errorPayload: SocketErrorPayload = {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while joining the room.',
      };
      socket.emit(SOCKET_EVENTS.ERROR, errorPayload);
    }
  });

  // Handle room:leave
  socket.on(SOCKET_EVENTS.ROOM_LEAVE, (data: RoomLeavePayload) => {
    try {
      if (!socket.user || !data?.roomId) return;

      const { roomId } = data;
      socket.leave(roomId);

      const removedUser = presenceManager.removeUserFromRoom(roomId, socket.user.userId);
      const roomUser: RoomUser = removedUser || {
        userId: socket.user.userId,
        username: socket.user.username,
      };

      const leftPayload: RoomUserLeftPayload = {
        roomId,
        user: roomUser,
      };
      socket.to(roomId).emit(SOCKET_EVENTS.ROOM_USER_LEFT, leftPayload);

      console.log(`📡 [Socket] User ${socket.user.username} left room ${roomId}`);
    } catch (err) {
      console.error('[Socket room:leave Error]:', err);
    }
  });

  // Handle automatic socket disconnect
  socket.on('disconnect', () => {
    joinRateLimitMap.delete(socket.id);
    if (!socket.user) return;

    const removedEntries = presenceManager.removeUserFromAllRooms(socket.user.userId);
    for (const { roomId, user } of removedEntries) {
      const leftPayload: RoomUserLeftPayload = {
        roomId,
        user,
      };
      socket.to(roomId).emit(SOCKET_EVENTS.ROOM_USER_LEFT, leftPayload);
    }

    console.log(`📡 [Socket] Disconnected user ${socket.user.username} (${socket.user.userId})`);
  });
}
