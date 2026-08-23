import { AuthTokenPayload } from '@codecollab/shared';

declare global {
  namespace Express {
    interface Request {
      user?: AuthTokenPayload;
      requestId?: string;
    }
  }
}

export {};
