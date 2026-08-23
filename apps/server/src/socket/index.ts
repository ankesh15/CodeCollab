import http from 'http';
import { Server } from 'socket.io';
import { config } from '../config/env';
import { AuthenticatedSocket } from './socket.types';
import { socketAuthMiddleware } from './socket.auth';
import { registerRoomHandlers } from './room.handlers';
import { registerEditorHandlers } from './editor.handlers';
import { registerSubmissionSocketServer } from './submission.handlers';
import { registerNotificationSocketServer } from './notification.handlers';
import { registerMessageHandlers, registerMessageSocketServer } from './message.handlers';

export function initSocketServer(httpServer: http.Server): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: [config.corsOrigin, 'http://localhost:5173', 'http://127.0.0.1:5173'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Register socket server instances for server-side broadcasts
  registerSubmissionSocketServer(io);
  registerNotificationSocketServer(io);
  registerMessageSocketServer(io);

  // Socket authentication middleware
  io.use(socketAuthMiddleware);

  // Connection lifecycle
  io.on('connection', (socket: AuthenticatedSocket) => {
    if (socket.user) {
      console.log(`🔌 [Socket] Authenticated user connected: ${socket.user.username} (Socket ID: ${socket.id})`);

      // Join user-specific socket channel for private notifications (user:${userId})
      const userRoom = `user:${socket.user.userId}`;
      socket.join(userRoom);
    }

    // Register room, editor, and message event handlers
    registerRoomHandlers(io, socket);
    registerEditorHandlers(io, socket);
    registerMessageHandlers(io, socket);
  });

  return io;
}
