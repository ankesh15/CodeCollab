import { Socket } from 'socket.io';
import { AuthTokenPayload } from '@codecollab/shared';

export interface AuthenticatedSocket extends Socket {
  user?: AuthTokenPayload;
}
