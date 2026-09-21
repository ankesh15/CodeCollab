import bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { SafeUser, AuthTokenPayload, AuthResponseData } from '@codecollab/shared';
import { prisma } from '../config/db';
import { RegisterInput, LoginInput } from '../schemas/auth.schema';
import { generateToken, generateRefreshToken, verifyRefreshToken, hashToken } from '../utils/jwt';

export class AppError extends Error {
  constructor(
    public override message: string,
    public statusCode: number,
    public errorCode: string,
    public errors?: Array<{ field: string; message: string }>
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function toSafeUser(user: {
  id: string;
  username: string;
  email: string;
  avatar: string | null;
  bio: string | null;
  role?: 'USER' | 'ADMIN';
  isActive?: boolean;
  createdAt: Date;
  updatedAt: Date;
}): SafeUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    avatar: user.avatar,
    bio: user.bio,
    role: user.role || 'USER',
    isActive: user.isActive !== undefined ? user.isActive : true,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export async function registerUser(input: RegisterInput): Promise<AuthResponseData> {
  // Pre-check duplicate username
  const existingUsername = await prisma.user.findUnique({
    where: { username: input.username },
  });
  if (existingUsername) {
    throw new AppError('Username is already taken by another account.', 409, 'DUPLICATE_USERNAME', [
      { field: 'username', message: 'Username is already taken' },
    ]);
  }

  // Pre-check duplicate email
  const existingEmail = await prisma.user.findUnique({
    where: { email: input.email },
  });
  if (existingEmail) {
    throw new AppError('Email address is already registered.', 409, 'DUPLICATE_EMAIL', [
      { field: 'email', message: 'Email address is already registered' },
    ]);
  }

  // Hash password
  const passwordHash = await bcrypt.hash(input.password, 10);

  let newUser;
  try {
    newUser = await prisma.user.create({
      data: {
        username: input.username,
        email: input.email,
        passwordHash,
      },
    });
  } catch (err) {
    // Authoritative database uniqueness race condition handling
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const target = String(err.meta?.['target'] || '');
      if (target.includes('username')) {
        throw new AppError('Username is already taken by another account.', 409, 'DUPLICATE_USERNAME', [
          { field: 'username', message: 'Username is already taken' },
        ]);
      } else {
        throw new AppError('Email address is already registered.', 409, 'DUPLICATE_EMAIL', [
          { field: 'email', message: 'Email address is already registered' },
        ]);
      }
    }
    throw err;
  }

  const safeUser = toSafeUser(newUser);

  const payload: AuthTokenPayload = {
    userId: safeUser.id,
    username: safeUser.username,
    email: safeUser.email,
    role: safeUser.role,
  };

  const token = generateToken(payload);
  const refreshToken = generateRefreshToken(payload);
  const tokenHash = hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: {
      userId: safeUser.id,
      tokenHash,
      expiresAt,
    },
  });

  return { user: safeUser, token, refreshToken };
}

export async function loginUser(input: LoginInput): Promise<AuthResponseData> {
  const identifier = input.email.trim();

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: { equals: identifier, mode: 'insensitive' } },
        { username: { equals: identifier, mode: 'insensitive' } },
      ],
    },
  });

  if (!user) {
    throw new AppError('Invalid username/email or password.', 401, 'INVALID_CREDENTIALS');
  }

  if (user.isActive === false) {
    throw new AppError('User account is deactivated.', 401, 'ACCOUNT_DEACTIVATED');
  }

  const isPasswordValid = await bcrypt.compare(input.password, user.passwordHash);

  if (!isPasswordValid) {
    throw new AppError('Invalid username/email or password.', 401, 'INVALID_CREDENTIALS');
  }

  const safeUser = toSafeUser(user);

  const payload: AuthTokenPayload = {
    userId: safeUser.id,
    username: safeUser.username,
    email: safeUser.email,
    role: safeUser.role,
  };

  const token = generateToken(payload);
  const refreshToken = generateRefreshToken(payload);
  const tokenHash = hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: {
      userId: safeUser.id,
      tokenHash,
      expiresAt,
    },
  });

  return { user: safeUser, token, refreshToken };
}

export async function refreshAccessTokenService(
  refreshTokenString: string
): Promise<{ token: string; refreshToken: string }> {
  try {
    verifyRefreshToken(refreshTokenString);
  } catch {
    throw new AppError('Invalid or expired refresh token.', 401, 'INVALID_TOKEN');
  }

  const tokenHash = hashToken(refreshTokenString);
  const dbToken = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!dbToken) {
    throw new AppError('Invalid refresh token.', 401, 'INVALID_TOKEN');
  }

  // Token reuse detection: if token is already revoked, compromise detected!
  if (dbToken.revokedAt) {
    await prisma.refreshToken.updateMany({
      where: { userId: dbToken.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw new AppError('Refresh token has already been revoked. All sessions revoked for security.', 401, 'TOKEN_REVOKED');
  }

  if (dbToken.expiresAt < new Date()) {
    throw new AppError('Refresh token has expired.', 401, 'TOKEN_EXPIRED');
  }

  if (dbToken.user.isActive === false) {
    throw new AppError('User account is deactivated.', 401, 'ACCOUNT_DEACTIVATED');
  }

  const newPayload: AuthTokenPayload = {
    userId: dbToken.user.id,
    username: dbToken.user.username,
    email: dbToken.user.email,
    role: dbToken.user.role,
  };

  const newToken = generateToken(newPayload);
  const newRefreshToken = generateRefreshToken(newPayload);
  const newTokenHash = hashToken(newRefreshToken);
  const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  // Rotate tokens atomically in a transaction
  await prisma.$transaction([
    prisma.refreshToken.update({
      where: { id: dbToken.id },
      data: { revokedAt: new Date() },
    }),
    prisma.refreshToken.create({
      data: {
        userId: dbToken.userId,
        tokenHash: newTokenHash,
        expiresAt: newExpiresAt,
      },
    }),
  ]);

  return { token: newToken, refreshToken: newRefreshToken };
}

export async function logoutService(
  refreshTokenString?: string,
  userId?: string
): Promise<{ success: boolean; message: string }> {
  if (refreshTokenString) {
    const tokenHash = hashToken(refreshTokenString);
    await prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  } else if (userId) {
    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  return { success: true, message: 'Logged out successfully.' };
}

export async function changePasswordService(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; message: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError('User account not found.', 404, 'USER_NOT_FOUND');
  }

  const isCurrentValid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isCurrentValid) {
    throw new AppError('Current password is incorrect.', 400, 'INVALID_PASSWORD');
  }

  const newPasswordHash = await bcrypt.hash(newPassword, 10);

  // Update password and revoke all active refresh tokens atomically
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    }),
    prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  return { success: true, message: 'Password updated successfully. All active sessions have been invalidated.' };
}

export async function deactivateAccountService(userId: string): Promise<{ success: boolean; message: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError('User account not found.', 404, 'USER_NOT_FOUND');
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
    }),
    prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  return { success: true, message: 'Account deactivated successfully. All active sessions have been invalidated.' };
}

export async function getUserProfile(userId: string): Promise<SafeUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError('User account not found.', 404, 'USER_NOT_FOUND');
  }

  return toSafeUser(user);
}

export async function updateUserProfile(
  userId: string,
  data: { bio?: string | null; avatar?: string | null }
): Promise<SafeUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError('User account not found.', 404, 'USER_NOT_FOUND');
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(data.bio !== undefined && { bio: data.bio }),
      ...(data.avatar !== undefined && { avatar: data.avatar }),
    },
  });

  return toSafeUser(updatedUser);
}
