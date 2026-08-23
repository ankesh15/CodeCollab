import { MessageSummary, PaginatedMessagesResponseData } from '@codecollab/shared';
import { prisma } from '../config/db';

export async function createMessageService(params: {
  userId: string;
  roomId: string;
  content: string;
}): Promise<MessageSummary> {
  const { userId, roomId, content } = params;

  const trimmedContent = content.trim();
  if (!trimmedContent) {
    const error = new Error('Message content cannot be empty.') as Error & { statusCode?: number };
    error.statusCode = 400;
    throw error;
  }

  if (trimmedContent.length > 2000) {
    const error = new Error('Message content exceeds 2000 character limit.') as Error & { statusCode?: number };
    error.statusCode = 400;
    throw error;
  }

  // Verify room existence & user access
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    select: { id: true, isPrivate: true, ownerId: true },
  });

  if (!room) {
    const error = new Error('Room not found.') as Error & { statusCode?: number };
    error.statusCode = 404;
    throw error;
  }

  if (room.isPrivate) {
    const membership = await prisma.roomMember.findUnique({
      where: {
        roomId_userId: {
          roomId,
          userId,
        },
      },
    });

    if (!membership && room.ownerId !== userId) {
      const error = new Error('Forbidden. You are not a member of this private room.') as Error & { statusCode?: number };
      error.statusCode = 403;
      throw error;
    }
  }

  // Create message in PostgreSQL
  const message = await prisma.message.create({
    data: {
      roomId,
      userId,
      content: trimmedContent,
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          avatar: true,
        },
      },
    },
  });

  return {
    id: message.id,
    roomId: message.roomId,
    userId: message.userId,
    username: message.user.username,
    userAvatar: message.user.avatar,
    content: message.content,
    createdAt: message.createdAt.toISOString(),
  };
}

export async function getRoomMessagesService(params: {
  userId: string;
  roomId: string;
  limit?: number;
  cursor?: string;
}): Promise<PaginatedMessagesResponseData> {
  const { userId, roomId, limit = 50, cursor } = params;

  // Verify room existence & access
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    select: { id: true, isPrivate: true, ownerId: true },
  });

  if (!room) {
    const error = new Error('Room not found.') as Error & { statusCode?: number };
    error.statusCode = 404;
    throw error;
  }

  if (room.isPrivate) {
    const membership = await prisma.roomMember.findUnique({
      where: {
        roomId_userId: {
          roomId,
          userId,
        },
      },
    });

    if (!membership && room.ownerId !== userId) {
      const error = new Error('Forbidden. You do not have access to view messages in this private room.') as Error & { statusCode?: number };
      error.statusCode = 403;
      throw error;
    }
  }

  // Fetch limit + 1 items ordered by createdAt desc for cursor pagination
  const fetchLimit = Math.min(Math.max(limit, 1), 100);
  const messages = await prisma.message.findMany({
    where: { roomId },
    take: fetchLimit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: { createdAt: 'desc' },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          avatar: true,
        },
      },
    },
  });

  let nextCursor: string | null = null;
  if (messages.length > fetchLimit) {
    const nextItem = messages.pop();
    if (nextItem) {
      nextCursor = nextItem.id;
    }
  }

  // Format messages and reverse order so client receives oldest -> newest chronologically
  const formattedMessages: MessageSummary[] = messages
    .map((m) => ({
      id: m.id,
      roomId: m.roomId,
      userId: m.userId,
      username: m.user.username,
      userAvatar: m.user.avatar,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    }))
    .reverse();

  return {
    messages: formattedMessages,
    nextCursor,
  };
}

export async function deleteMessageService(params: {
  userId: string;
  messageId: string;
}): Promise<{ messageId: string; roomId: string }> {
  const { userId, messageId } = params;

  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: {
      room: {
        select: { ownerId: true },
      },
    },
  });

  if (!message) {
    const error = new Error('Message not found.') as Error & { statusCode?: number };
    error.statusCode = 404;
    throw error;
  }

  // Authorization check: User must be message sender or room owner/admin
  let isAuthorized = message.userId === userId || message.room.ownerId === userId;

  if (!isAuthorized) {
    const membership = await prisma.roomMember.findUnique({
      where: {
        roomId_userId: {
          roomId: message.roomId,
          userId,
        },
      },
    });
    if (membership && (membership.role === 'OWNER' || membership.role === 'ADMIN')) {
      isAuthorized = true;
    }
  }

  if (!isAuthorized) {
    const error = new Error('Forbidden. You do not have permission to delete this message.') as Error & { statusCode?: number };
    error.statusCode = 403;
    throw error;
  }

  await prisma.message.delete({
    where: { id: messageId },
  });

  return {
    messageId: message.id,
    roomId: message.roomId,
  };
}
