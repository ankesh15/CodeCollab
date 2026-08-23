import {
  NotificationSummary,
  NotificationType,
  PaginatedNotificationsResponseData,
  UnreadCountResponseData,
} from '@codecollab/shared';
import { prisma } from '../config/db';
import { broadcastNotificationToUser, broadcastUnreadCountToUser } from '../socket/notification.handlers';

export async function createNotificationService(params: {
  userId: string;
  type: NotificationType;
  message: string;
}): Promise<NotificationSummary> {
  const { userId, type, message } = params;

  const notification = await prisma.notification.create({
    data: {
      userId,
      type,
      message,
      read: false,
    },
  });

  const formattedNotification: NotificationSummary = {
    id: notification.id,
    userId: notification.userId,
    type: notification.type as NotificationType,
    message: notification.message,
    read: notification.read,
    createdAt: notification.createdAt.toISOString(),
  };

  // Broadcast real-time notification & count to user-specific channel (user:${userId})
  broadcastNotificationToUser(userId, formattedNotification);

  // Get new unread count and broadcast
  const unreadCount = await getUnreadCountService(userId);
  broadcastUnreadCountToUser(userId, unreadCount.unreadCount);

  return formattedNotification;
}

export async function getUserNotificationsService(params: {
  userId: string;
  limit?: number;
  cursor?: string;
}): Promise<PaginatedNotificationsResponseData> {
  const { userId, limit = 20, cursor } = params;

  const fetchLimit = Math.min(Math.max(limit, 1), 100);
  const notifications = await prisma.notification.findMany({
    where: { userId },
    take: fetchLimit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: { createdAt: 'desc' },
  });

  let nextCursor: string | null = null;
  if (notifications.length > fetchLimit) {
    const nextItem = notifications.pop();
    if (nextItem) {
      nextCursor = nextItem.id;
    }
  }

  const formattedNotifications: NotificationSummary[] = notifications.map((n) => ({
    id: n.id,
    userId: n.userId,
    type: n.type as NotificationType,
    message: n.message,
    read: n.read,
    createdAt: n.createdAt.toISOString(),
  }));

  return {
    notifications: formattedNotifications,
    nextCursor,
  };
}

export async function getUnreadCountService(userId: string): Promise<UnreadCountResponseData> {
  const count = await prisma.notification.count({
    where: {
      userId,
      read: false,
    },
  });

  return { unreadCount: count };
}

export async function markNotificationReadService(params: {
  userId: string;
  notificationId: string;
}): Promise<NotificationSummary> {
  const { userId, notificationId } = params;

  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification) {
    const error = new Error('Notification not found.') as Error & { statusCode?: number };
    error.statusCode = 404;
    throw error;
  }

  if (notification.userId !== userId) {
    const error = new Error('Forbidden. You do not have permission to modify this notification.') as Error & { statusCode?: number };
    error.statusCode = 403;
    throw error;
  }

  const updated = await prisma.notification.update({
    where: { id: notificationId },
    data: { read: true },
  });

  const formattedNotification: NotificationSummary = {
    id: updated.id,
    userId: updated.userId,
    type: updated.type as NotificationType,
    message: updated.message,
    read: updated.read,
    createdAt: updated.createdAt.toISOString(),
  };

  // Broadcast updated unread count to user's connected sockets
  const unreadCount = await getUnreadCountService(userId);
  broadcastUnreadCountToUser(userId, unreadCount.unreadCount);

  return formattedNotification;
}

export async function markAllNotificationsReadService(userId: string): Promise<{ count: number }> {
  const result = await prisma.notification.updateMany({
    where: {
      userId,
      read: false,
    },
    data: {
      read: true,
    },
  });

  // Broadcast unread count (0) to user's connected sockets
  broadcastUnreadCountToUser(userId, 0);

  return { count: result.count };
}
