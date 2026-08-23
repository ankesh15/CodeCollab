import { Server } from 'socket.io';
import {
  SOCKET_EVENTS,
  EditorChangePayload,
  EditorCursorPayload,
  EditorLanguagePayload,
  SocketErrorPayload,
} from '@codecollab/shared';
import { AuthenticatedSocket } from './socket.types';
import { prisma } from '../config/db';
import { ensureDocument, updateDocument, updateDocumentLanguage } from '../services/document.service';

// Debounce timer map for PostgreSQL document persistence
const persistenceDebounceMap = new Map<string, NodeJS.Timeout>();
// In-memory version cache for real-time conflict checking
const documentVersionCache = new Map<string, number>();

export function clearVersionCache(): void {
  documentVersionCache.clear();
}

export function registerEditorHandlers(_io: Server, socket: AuthenticatedSocket): void {
  // 1. Handle editor:change
  socket.on(SOCKET_EVENTS.EDITOR_CHANGE, async (data: EditorChangePayload) => {
    try {
      if (!socket.user) {
        const errorPayload: SocketErrorPayload = {
          code: 'UNAUTHORIZED',
          message: 'Authentication required for editor synchronization.',
        };
        socket.emit(SOCKET_EVENTS.ERROR, errorPayload);
        return;
      }

      if (!data || !data.roomId || typeof data.content !== 'string' || typeof data.version !== 'number') {
        const errorPayload: SocketErrorPayload = {
          code: 'INVALID_PAYLOAD',
          message: 'Invalid editor:change payload. roomId, content, and version are required.',
        };
        socket.emit(SOCKET_EVENTS.ERROR, errorPayload);
        return;
      }

      const { roomId, content, version } = data;

      // Server-side authorization check: verify socket user belongs to room
      const room = await prisma.room.findUnique({
        where: { id: roomId },
        select: { id: true, isPrivate: true },
      });

      if (!room) {
        const errorPayload: SocketErrorPayload = {
          code: 'ROOM_NOT_FOUND',
          message: 'Requested room does not exist.',
        };
        socket.emit(SOCKET_EVENTS.ERROR, errorPayload);
        return;
      }

      const membership = await prisma.roomMember.findUnique({
        where: {
          roomId_userId: {
            roomId,
            userId: socket.user.userId,
          },
        },
      });

      if (room.isPrivate && !membership) {
        const errorPayload: SocketErrorPayload = {
          code: 'FORBIDDEN',
          message: 'Forbidden. You are not authorized to edit code in this private room.',
        };
        socket.emit(SOCKET_EVENTS.ERROR, errorPayload);
        return;
      }

      // Retrieve current version from cache or database
      let currentVersion = documentVersionCache.get(roomId);
      if (currentVersion === undefined) {
        const currentDoc = await ensureDocument(roomId);
        currentVersion = currentDoc.version;
        documentVersionCache.set(roomId, currentVersion);
      }

      // Version Conflict Check: Reject if incoming version is less than current version
      if (version < currentVersion) {
        const errorPayload: SocketErrorPayload = {
          code: 'DOCUMENT_VERSION_CONFLICT',
          message: `Document version conflict. Current version is ${currentVersion}, received ${version}.`,
        };
        socket.emit(SOCKET_EVENTS.ERROR, errorPayload);
        return;
      }

      const nextVersion = Math.max(currentVersion + 1, version);
      documentVersionCache.set(roomId, nextVersion);

      // Broadcast change to all OTHER sockets in room
      const broadcastPayload: EditorChangePayload = {
        roomId,
        content,
        version: nextVersion,
        user: {
          userId: socket.user.userId,
          username: socket.user.username,
        },
      };

      socket.to(roomId).emit(SOCKET_EVENTS.EDITOR_CHANGE, broadcastPayload);

      // Debounce PostgreSQL DB persistence write (~300ms)
      if (persistenceDebounceMap.has(roomId)) {
        clearTimeout(persistenceDebounceMap.get(roomId)!);
      }

      const timer = setTimeout(async () => {
        try {
          await updateDocument(roomId, content, nextVersion);
          persistenceDebounceMap.delete(roomId);
        } catch (dbErr) {
          console.error(`[DB Persistence Error for room ${roomId}]:`, dbErr);
        }
      }, 300);

      persistenceDebounceMap.set(roomId, timer);
    } catch (err) {
      console.error('[Socket editor:change Error]:', err);
      const errorPayload: SocketErrorPayload = {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred during editor change processing.',
      };
      socket.emit(SOCKET_EVENTS.ERROR, errorPayload);
    }
  });

  // 2. Handle editor:cursor
  socket.on(SOCKET_EVENTS.EDITOR_CURSOR, async (data: EditorCursorPayload) => {
    try {
      if (!socket.user || !data?.roomId || !data?.position) return;

      const { roomId, position } = data;

      // Broadcast cursor position to all other room members
      const broadcastPayload: EditorCursorPayload = {
        roomId,
        user: {
          userId: socket.user.userId,
          username: socket.user.username,
        },
        position,
      };

      socket.to(roomId).emit(SOCKET_EVENTS.EDITOR_CURSOR, broadcastPayload);
    } catch (err) {
      console.error('[Socket editor:cursor Error]:', err);
    }
  });

  // 3. Handle editor:language
  socket.on(SOCKET_EVENTS.EDITOR_LANGUAGE, async (data: EditorLanguagePayload) => {
    try {
      if (!socket.user || !data?.roomId || !data?.language) return;

      const { roomId, language } = data;

      const updatedDoc = await updateDocumentLanguage(roomId, language);

      const broadcastPayload: EditorLanguagePayload = {
        roomId,
        language: updatedDoc.language,
        user: {
          userId: socket.user.userId,
          username: socket.user.username,
        },
      };

      socket.to(roomId).emit(SOCKET_EVENTS.EDITOR_LANGUAGE, broadcastPayload);
    } catch (err) {
      console.error('[Socket editor:language Error]:', err);
    }
  });
}
