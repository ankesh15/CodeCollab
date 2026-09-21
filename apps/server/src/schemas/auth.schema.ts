import { z } from 'zod';

export const registerSchema = z
  .object({
    username: z
      .string({ message: 'Username is required' })
      .min(3, 'Username must be at least 3 characters long')
      .max(30, 'Username must be at most 30 characters long')
      .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
    email: z
      .string({ message: 'Email is required' })
      .email('Invalid email address format')
      .max(255, 'Email cannot exceed 255 characters')
      .transform((val) => val.toLowerCase().trim()),
    password: z
      .string({ message: 'Password is required' })
      .min(8, 'Password must be at least 8 characters long')
      .max(128, 'Password cannot exceed 128 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
  })
  .strict();

export const loginSchema = z
  .object({
    email: z
      .string({ message: 'Email or username is required' })
      .min(1, 'Email or username is required')
      .max(255, 'Email or username cannot exceed 255 characters')
      .transform((val) => val.trim()),
    password: z
      .string({ message: 'Password is required' })
      .min(1, 'Password cannot be empty')
      .max(128, 'Password cannot exceed 128 characters'),
  })
  .strict();

export const refreshTokenSchema = z
  .object({
    refreshToken: z
      .string({ message: 'Refresh token is required' })
      .min(10, 'Invalid refresh token format'),
  })
  .strict();

export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string({ message: 'Current password is required' })
      .min(1, 'Current password is required')
      .max(128, 'Current password cannot exceed 128 characters'),
    newPassword: z
      .string({ message: 'New password is required' })
      .min(8, 'New password must be at least 8 characters long')
      .max(128, 'New password cannot exceed 128 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
  })
  .strict();

export const updateProfileSchema = z
  .object({
    bio: z.string().max(500, 'Bio cannot exceed 500 characters').nullable().optional(),
    avatar: z
      .string()
      .url('Avatar must be a valid URL')
      .max(1024, 'Avatar URL cannot exceed 1024 characters')
      .nullable()
      .optional()
      .or(z.literal('')),
  })
  .strict();

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

