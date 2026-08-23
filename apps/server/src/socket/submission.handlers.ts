import { Server } from 'socket.io';
import { SOCKET_EVENTS, SubmissionCompletedPayload } from '@codecollab/shared';

let ioInstance: Server | null = null;

export function registerSubmissionSocketServer(io: Server): void {
  ioInstance = io;
}

export function broadcastSubmissionCompleted(
  roomId: string,
  payload: SubmissionCompletedPayload
): void {
  if (!ioInstance) {
    console.warn('[Socket] Submission broadcast skipped: ioInstance not set.');
    return;
  }

  // Broadcast submission completed event to all active room members
  ioInstance.to(roomId).emit(SOCKET_EVENTS.SUBMISSION_COMPLETED, payload);
}
