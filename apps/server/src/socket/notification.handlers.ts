import { Server } from 'socket.io';
import { NotificationSummary, SOCKET_EVENTS } from '@codecollab/shared';

let ioInstance: Server | null = null;

export function registerNotificationSocketServer(io: Server): void {
  ioInstance = io;
}

export function broadcastNotificationToUser(userId: string, notification: NotificationSummary): void {
  if (!ioInstance) {
    return;
  }
  ioInstance.to(`user:${userId}`).emit(SOCKET_EVENTS.NOTIFICATION_NEW, { notification });
}

export function broadcastUnreadCountToUser(userId: string, unreadCount: number): void {
  if (!ioInstance) {
    return;
  }
  ioInstance.to(`user:${userId}`).emit(SOCKET_EVENTS.NOTIFICATION_COUNT, { unreadCount });
}
