import crypto from 'crypto';
import jwt, { Secret, SignOptions } from 'jsonwebtoken';
import { AuthTokenPayload } from '@codecollab/shared';
import { config } from '../config/env';

export function generateToken(payload: AuthTokenPayload): string {
  const secret: Secret = config.jwtSecret;
  const options: SignOptions = {
    expiresIn: config.jwtExpiresIn as unknown as number | undefined,
  };

  return jwt.sign(payload, secret, options);
}

export function verifyToken(token: string): AuthTokenPayload {
  const secret: Secret = config.jwtSecret;
  const decoded = jwt.verify(token, secret);

  if (typeof decoded !== 'object' || !decoded || !('userId' in decoded) || !('username' in decoded)) {
    throw new Error('Invalid token payload payload structure.');
  }

  return {
    userId: (decoded as Record<string, unknown>)['userId'] as string,
    username: (decoded as Record<string, unknown>)['username'] as string,
    email: ((decoded as Record<string, unknown>)['email'] as string) || '',
    role: ((decoded as Record<string, unknown>)['role'] as 'USER' | 'ADMIN') || 'USER',
  };
}

export function generateRefreshToken(payload: AuthTokenPayload): string {
  const secret: Secret = config.jwtRefreshSecret;
  const options: SignOptions = {
    expiresIn: config.jwtRefreshExpiresIn as unknown as number | undefined,
  };

  return jwt.sign({ ...payload, jti: crypto.randomUUID() }, secret, options);
}

export function verifyRefreshToken(token: string): AuthTokenPayload {
  const secret: Secret = config.jwtRefreshSecret;
  const decoded = jwt.verify(token, secret);

  if (typeof decoded !== 'object' || !decoded || !('userId' in decoded) || !('username' in decoded)) {
    throw new Error('Invalid refresh token payload structure.');
  }

  return {
    userId: (decoded as Record<string, unknown>)['userId'] as string,
    username: (decoded as Record<string, unknown>)['username'] as string,
    email: ((decoded as Record<string, unknown>)['email'] as string) || '',
    role: ((decoded as Record<string, unknown>)['role'] as 'USER' | 'ADMIN') || 'USER',
  };
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

