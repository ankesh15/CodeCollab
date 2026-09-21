import { z } from 'zod';
import { isLanguageSupported, SUPPORTED_LANGUAGE_IDS } from '../config/languages';
import { EXECUTION_CONFIG } from '../config/execution';

export const runCodeSchema = z
  .object({
    problemId: z.string().uuid({ message: 'Valid problemId UUID is required.' }),
    language: z
      .string()
      .trim()
      .min(1, { message: 'Language is required.' })
      .refine(
        (lang) => isLanguageSupported(lang),
        {
          message: `Unsupported language. Supported languages are: ${SUPPORTED_LANGUAGE_IDS.join(', ')}`,
        }
      ),
    code: z
      .string()
      .min(1, { message: 'Source code cannot be empty.' })
      .max(EXECUTION_CONFIG.MAX_CODE_SIZE_BYTES, {
        message: `Source code exceeds maximum allowed size of ${EXECUTION_CONFIG.MAX_CODE_SIZE_BYTES} bytes.`,
      }),
  })
  .strict();

export const submitCodeSchema = z
  .object({
    problemId: z.string().uuid({ message: 'Valid problemId UUID is required.' }),
    roomId: z.string().uuid({ message: 'Valid roomId UUID is required.' }).optional().nullable(),
    language: z
      .string()
      .trim()
      .min(1, { message: 'Language is required.' })
      .refine(
        (lang) => isLanguageSupported(lang),
        {
          message: `Unsupported language. Supported languages are: ${SUPPORTED_LANGUAGE_IDS.join(', ')}`,
        }
      ),
    code: z
      .string()
      .min(1, { message: 'Source code cannot be empty.' })
      .max(EXECUTION_CONFIG.MAX_CODE_SIZE_BYTES, {
        message: `Source code exceeds maximum allowed size of ${EXECUTION_CONFIG.MAX_CODE_SIZE_BYTES} bytes.`,
      }),
  })
  .strict();

export type RunCodeSchemaType = z.infer<typeof runCodeSchema>;
export type SubmitCodeSchemaType = z.infer<typeof submitCodeSchema>;
