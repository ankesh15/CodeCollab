import bcrypt from 'bcrypt';
import { SafeUser, AuthTokenPayload, AuthResponseData } from '@codecollab/shared';
import { prisma } from '../config/db';
import { RegisterInput, LoginInput } from '../schemas/auth.schema';
import { generateToken } from '../utils/jwt';

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
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export async function registerUser(input: RegisterInput): Promise<AuthResponseData> {
  // Check duplicate username
  const existingUsername = await prisma.user.findUnique({
    where: { username: input.username },
  });
  if (existingUsername) {
    throw new AppError('Username is already taken by another account.', 409, 'DUPLICATE_USERNAME', [
      { field: 'username', message: 'Username is already taken' },
    ]);
  }

  // Check duplicate email
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

  // Save to PostgreSQL
  const newUser = await prisma.user.create({
    data: {
      username: input.username,
      email: input.email,
      passwordHash,
    },
  });

  const safeUser = toSafeUser(newUser);

  const payload: AuthTokenPayload = {
    userId: safeUser.id,
    username: safeUser.username,
    email: safeUser.email,
    role: safeUser.role,
  };

  const token = generateToken(payload);

  return { user: safeUser, token };
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

  return { user: safeUser, token };
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

