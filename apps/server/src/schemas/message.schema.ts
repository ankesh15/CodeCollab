import { z } from 'zod';

export const createMessageSchema = z.object({
  roomId: z.string().uuid({ message: 'Valid roomId UUID is required.' }),
  content: z
    .string()
    .trim()
    .min(1, { message: 'Message content cannot be empty.' })
    .max(2000, { message: 'Message content cannot exceed 2000 characters.' }),
});

export const getRoomMessagesQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  cursor: z.string().uuid({ message: 'Valid cursor UUID is required.' }).optional(),
});

export type CreateMessageSchemaType = z.infer<typeof createMessageSchema>;
export type GetRoomMessagesQueryType = z.infer<typeof getRoomMessagesQuerySchema>;
