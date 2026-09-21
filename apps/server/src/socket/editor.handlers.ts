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
import { isLanguageSupported, SUPPORTED_LANGUAGE_IDS } from '../config/languages';

// Debounce timer map for PostgreSQL document persistence
const persistenceDebounceMap = new Map<string, NodeJS.Timeout>();
// In-memory version cache for real-time conflict checking
const documentVersionCache = new Map<string, number>();

// Rate limit tracking maps per socket
const changeRateLimitMap = new Map<string, number[]>();
const cursorRateLimitMap = new Map<string, number[]>();
const languageRateLimitMap = new Map<string, number[]>();

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

export function clearVersionCache(): void {
  documentVersionCache.clear();
}

export function registerEditorHandlers(_io: Server, socket: AuthenticatedSocket): void {
  // Clean up rate limiters on disconnect
  socket.on('disconnect', () => {
    changeRateLimitMap.delete(socket.id);
    cursorRateLimitMap.delete(socket.id);
    languageRateLimitMap.delete(socket.id);
  });

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

      // Verify socket has joined the room isolation channel
      if (!socket.rooms.has(roomId)) {
        const errorPayload: SocketErrorPayload = {
          code: 'ROOM_ACCESS_REQUIRED',
          message: 'You must join the room before synchronizing edits.',
        };
        socket.emit(SOCKET_EVENTS.ERROR, errorPayload);
        return;
      }

      // Rate limit check: max 50 edits per second
      if (!checkRateLimit(changeRateLimitMap, socket.id, 50, 1000)) {
        const errorPayload: SocketErrorPayload = {
          code: 'RATE_LIMITED',
          message: 'Editor updates sent too quickly. Please slow down.',
        };
        socket.emit(SOCKET_EVENTS.ERROR, errorPayload);
        return;
      }

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
        currentVersion = typeof currentDoc?.version === 'number' ? currentDoc.version : 1;
        documentVersionCache.set(roomId, currentVersion);
      }

      // Version Conflict Check: Reject if incoming version is less than or equal to current version
      if (version <= currentVersion) {
        const latestDoc = await ensureDocument(roomId);
        const errorPayload: SocketErrorPayload = {
          code: 'DOCUMENT_VERSION_CONFLICT',
          message: `Document version conflict. Current version is ${currentVersion}, received ${version}.`,
        };
        socket.emit(SOCKET_EVENTS.ERROR, errorPayload);

        // Deliver latest server document state for immediate resynchronization
        socket.emit(SOCKET_EVENTS.DOCUMENT_STATE, {
          roomId,
          document: {
            id: latestDoc.id,
            roomId: latestDoc.roomId,
            content: latestDoc.content,
            language: latestDoc.language,
            version: currentVersion,
            createdAt: latestDoc.createdAt.toISOString(),
            updatedAt: latestDoc.updatedAt.toISOString(),
          },
        });
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
      const existingTimer = persistenceDebounceMap.get(roomId);
      if (existingTimer) {
        clearTimeout(existingTimer);
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

      // Verify socket has joined room
      if (!socket.rooms.has(roomId)) return;

      // Rate limit cursor updates: max 30 per second
      if (!checkRateLimit(cursorRateLimitMap, socket.id, 30, 1000)) return;

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
      if (!socket.user) {
        socket.emit(SOCKET_EVENTS.ERROR, {
          code: 'UNAUTHORIZED',
          message: 'Authentication required to update language.',
        });
        return;
      }

      if (!data?.roomId || !data?.language) {
        socket.emit(SOCKET_EVENTS.ERROR, {
          code: 'INVALID_PAYLOAD',
          message: 'roomId and language are required.',
        });
        return;
      }

      const { roomId, language } = data;

      // Verify socket has joined room
      if (!socket.rooms.has(roomId)) {
        socket.emit(SOCKET_EVENTS.ERROR, {
          code: 'ROOM_ACCESS_REQUIRED',
          message: 'You must join the room before updating language.',
        });
        return;
      }

      // Rate limit check: max 5 changes per 10 seconds
      if (!checkRateLimit(languageRateLimitMap, socket.id, 5, 10000)) {
        socket.emit(SOCKET_EVENTS.ERROR, {
          code: 'RATE_LIMITED',
          message: 'Language changes sent too quickly. Please slow down.',
        });
        return;
      }

      // Validate language against allowed set
      if (!isLanguageSupported(language)) {
        socket.emit(SOCKET_EVENTS.ERROR, {
          code: 'UNSUPPORTED_LANGUAGE',
          message: `Language '${language}' is not supported. Supported languages: ${SUPPORTED_LANGUAGE_IDS.join(', ')}`,
        });
        return;
      }

      // Verify room existence and authorization
      const room = await prisma.room.findUnique({
        where: { id: roomId },
        select: { id: true, isPrivate: true },
      });

      if (!room) {
        socket.emit(SOCKET_EVENTS.ERROR, {
          code: 'ROOM_NOT_FOUND',
          message: 'Requested room does not exist.',
        });
        return;
      }

      if (room.isPrivate) {
        const membership = await prisma.roomMember.findUnique({
          where: {
            roomId_userId: {
              roomId,
              userId: socket.user.userId,
            },
          },
        });

        if (!membership) {
          socket.emit(SOCKET_EVENTS.ERROR, {
            code: 'FORBIDDEN',
            message: 'Forbidden. You are not authorized to update language in this private room.',
          });
          return;
        }
      }

      const updatedDoc = await updateDocumentLanguage(roomId, language);

      const broadcastPayload: EditorLanguagePayload = {
        roomId,
        language: updatedDoc.language,
        user: {
          userId: socket.user.userId,
          username: socket.user.username,
        },
      };

      // Broadcast to all sockets in room including sender or to others
      socket.to(roomId).emit(SOCKET_EVENTS.EDITOR_LANGUAGE, broadcastPayload);
      socket.emit(SOCKET_EVENTS.EDITOR_LANGUAGE, broadcastPayload);
    } catch (err) {
      console.error('[Socket editor:language Error]:', err);
      socket.emit(SOCKET_EVENTS.ERROR, {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred during language update.',
      });
    }
  });
}
