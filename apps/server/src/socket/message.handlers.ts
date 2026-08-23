import { Server } from 'socket.io';
import {
  SOCKET_EVENTS,
  MessageSendPayload,
  MessageDeletePayload,
} from '@codecollab/shared';
import { AuthenticatedSocket } from './socket.types';
import { createMessageService, deleteMessageService } from '../services/message.service';

let ioInstance: Server | null = null;

// Track last message timestamp per socket ID for spam protection
const lastMessageTimes = new Map<string, number>();

export function registerMessageSocketServer(io: Server): void {
  ioInstance = io;
}

export function broadcastMessageDeleted(roomId: string, messageId: string): void {
  if (!ioInstance) return;
  ioInstance.to(roomId).emit(SOCKET_EVENTS.MESSAGE_DELETE, { messageId, roomId });
}

export function registerMessageHandlers(io: Server, socket: AuthenticatedSocket): void {
  // Clean up timestamp on socket disconnect
  socket.on('disconnect', () => {
    lastMessageTimes.delete(socket.id);
  });

  // 1. Client sends a room message
  socket.on(SOCKET_EVENTS.MESSAGE_SEND, async (payload: MessageSendPayload) => {
    try {
      if (!socket.user) {
        socket.emit(SOCKET_EVENTS.ERROR, {
          code: 'UNAUTHORIZED',
          message: 'Authentication required to send messages.',
        });
        return;
      }

      if (!payload || !payload.roomId || !payload.content) {
        socket.emit(SOCKET_EVENTS.ERROR, {
          code: 'INVALID_PAYLOAD',
          message: 'roomId and non-empty content are required.',
        });
        return;
      }

      // Payload size limit check (Max 2000 characters)
      if (payload.content.trim().length > 2000) {
        socket.emit(SOCKET_EVENTS.ERROR, {
          code: 'PAYLOAD_TOO_LARGE',
          message: 'Message length exceeds maximum limit of 2000 characters.',
        });
        return;
      }

      // Server-side spam guard (Minimum 300ms between messages per socket)
      const now = Date.now();
      const lastTime = lastMessageTimes.get(socket.id) || 0;
      if (now - lastTime < 300) {
        socket.emit(SOCKET_EVENTS.ERROR, {
          code: 'RATE_LIMITED',
          message: 'You are sending messages too quickly. Please slow down.',
        });
        return;
      }
      lastMessageTimes.set(socket.id, now);

      // Create & persist message using centralized service
      const message = await createMessageService({
        userId: socket.user.userId,
        roomId: payload.roomId,
        content: payload.content,
      });

      // Broadcast to room (including sender)
      io.to(payload.roomId).emit(SOCKET_EVENTS.MESSAGE_NEW, { message });
    } catch (err: unknown) {
      const errorObj = err as Error & { statusCode?: number };
      socket.emit(SOCKET_EVENTS.ERROR, {
        code: errorObj.statusCode === 403 ? 'FORBIDDEN' : 'MESSAGE_ERROR',
        message: errorObj.message || 'Failed to send message.',
      });
    }
  });

  // 2. Client deletes a room message
  socket.on(SOCKET_EVENTS.MESSAGE_DELETE, async (payload: MessageDeletePayload) => {
    try {
      if (!socket.user) {
        socket.emit(SOCKET_EVENTS.ERROR, {
          code: 'UNAUTHORIZED',
          message: 'Authentication required to delete messages.',
        });
        return;
      }

      if (!payload || !payload.messageId) {
        socket.emit(SOCKET_EVENTS.ERROR, {
          code: 'INVALID_PAYLOAD',
          message: 'messageId is required.',
        });
        return;
      }

      const deleted = await deleteMessageService({
        userId: socket.user.userId,
        messageId: payload.messageId,
      });

      // Broadcast message deletion to room
      io.to(deleted.roomId).emit(SOCKET_EVENTS.MESSAGE_DELETE, {
        messageId: deleted.messageId,
        roomId: deleted.roomId,
      });
    } catch (err: unknown) {
      const errorObj = err as Error & { statusCode?: number };
      socket.emit(SOCKET_EVENTS.ERROR, {
        code: errorObj.statusCode === 403 ? 'FORBIDDEN' : 'DELETE_ERROR',
        message: errorObj.message || 'Failed to delete message.',
      });
    }
  });
}
