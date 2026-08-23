import { AuthenticatedSocket } from './socket.types';
import { verifyToken } from '../utils/jwt';

export function socketAuthMiddleware(socket: AuthenticatedSocket, next: (err?: Error) => void): void {
  try {
    const authHeader = socket.handshake.headers.authorization;
    let token: string | undefined = socket.handshake.auth?.['token'] as string | undefined;

    if (!token && authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    }

    if (!token) {
      const err = new Error('UNAUTHORIZED: Authentication token missing.');
      return next(err);
    }

    const payload = verifyToken(token);
    socket.user = payload;
    next();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid or expired token.';
    const authErr = new Error(`UNAUTHORIZED: ${message}`);
    next(authErr);
  }
}
