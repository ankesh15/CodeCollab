import { RoomUser } from '@codecollab/shared';

/**
 * Development & Single-Instance In-Memory Room Presence Manager.
 *
 * NOTE: This in-memory Map structure is designed for single-instance Node.js deployments.
 * When scaling horizontally across multiple backend nodes in production, this state
 * layer should be migrated to a Redis store (e.g. Redis Hashes & Pub/Sub).
 */
export class RoomPresenceManager {
  // Map<roomId, Map<userId, RoomUser>>
  private roomUsers = new Map<string, Map<string, RoomUser>>();

  public addUserToRoom(roomId: string, user: RoomUser): void {
    if (!this.roomUsers.has(roomId)) {
      this.roomUsers.set(roomId, new Map<string, RoomUser>());
    }
    const roomMap = this.roomUsers.get(roomId)!;
    roomMap.set(user.userId, {
      ...user,
      joinedAt: user.joinedAt || new Date().toISOString(),
    });
  }

  public removeUserFromRoom(roomId: string, userId: string): RoomUser | null {
    const roomMap = this.roomUsers.get(roomId);
    if (!roomMap) return null;

    const user = roomMap.get(userId) || null;
    roomMap.delete(userId);

    if (roomMap.size === 0) {
      this.roomUsers.delete(roomId);
    }

    return user;
  }

  public getRoomUsers(roomId: string): RoomUser[] {
    const roomMap = this.roomUsers.get(roomId);
    if (!roomMap) return [];
    return Array.from(roomMap.values());
  }

  public removeUserFromAllRooms(userId: string): Array<{ roomId: string; user: RoomUser }> {
    const removedList: Array<{ roomId: string; user: RoomUser }> = [];

    for (const [roomId, roomMap] of this.roomUsers.entries()) {
      if (roomMap.has(userId)) {
        const user = roomMap.get(userId)!;
        roomMap.delete(userId);
        removedList.push({ roomId, user });

        if (roomMap.size === 0) {
          this.roomUsers.delete(roomId);
        }
      }
    }

    return removedList;
  }
}

export const presenceManager = new RoomPresenceManager();
