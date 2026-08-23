import { z } from 'zod';

export const runCodeSchema = z.object({
  problemId: z.string().uuid({ message: 'Valid problemId UUID is required.' }),
  language: z.string().min(1, { message: 'Language is required.' }),
  code: z.string().min(1, { message: 'Source code cannot be empty.' }),
});

export const submitCodeSchema = z.object({
  problemId: z.string().uuid({ message: 'Valid problemId UUID is required.' }),
  roomId: z.string().uuid({ message: 'Valid roomId UUID is required.' }).optional().nullable(),
  language: z.string().min(1, { message: 'Language is required.' }),
  code: z.string().min(1, { message: 'Source code cannot be empty.' }),
});

export type RunCodeSchemaType = z.infer<typeof runCodeSchema>;
export type SubmitCodeSchemaType = z.infer<typeof submitCodeSchema>;
