import { z } from 'zod';
import { isLanguageSupported, SUPPORTED_LANGUAGE_IDS } from '../config/languages';

export const createRoomSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, { message: 'Room name cannot be empty.' })
      .max(100, { message: 'Room name cannot exceed 100 characters.' }),
    language: z
      .string()
      .trim()
      .refine((lang) => isLanguageSupported(lang), {
        message: `Unsupported programming language. Supported languages: ${SUPPORTED_LANGUAGE_IDS.join(', ')}`,
      })
      .optional()
      .default('javascript'),
    isPrivate: z.boolean().optional().default(false),
  })
  .strict();

export const updateRoomSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, { message: 'Room name cannot be empty.' })
      .max(100, { message: 'Room name cannot exceed 100 characters.' })
      .optional(),
    language: z
      .string()
      .trim()
      .refine((lang) => isLanguageSupported(lang), {
        message: `Unsupported programming language. Supported languages: ${SUPPORTED_LANGUAGE_IDS.join(', ')}`,
      })
      .optional(),
    isPrivate: z.boolean().optional(),
  })
  .strict()
  .refine(
    (data) => data.name !== undefined || data.language !== undefined || data.isPrivate !== undefined,
    {
      message: 'At least one field (name, language, or isPrivate) must be provided for update.',
    }
  );

export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type UpdateRoomInput = z.infer<typeof updateRoomSchema>;
