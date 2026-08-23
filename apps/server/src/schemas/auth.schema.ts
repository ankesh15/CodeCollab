import { z } from 'zod';

export const registerSchema = z.object({
  username: z
    .string({ message: 'Username is required' })
    .min(3, 'Username must be at least 3 characters long')
    .max(30, 'Username must be at most 30 characters long')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  email: z
    .string({ message: 'Email is required' })
    .email('Invalid email address format')
    .transform((val) => val.toLowerCase().trim()),
  password: z
    .string({ message: 'Password is required' })
    .min(8, 'Password must be at least 8 characters long'),
});

export const loginSchema = z.object({
  email: z
    .string({ message: 'Email or username is required' })
    .min(1, 'Email or username is required')
    .transform((val) => val.trim()),
  password: z
    .string({ message: 'Password is required' })
    .min(1, 'Password cannot be empty'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
