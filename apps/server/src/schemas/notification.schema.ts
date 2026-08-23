import { z } from 'zod';

export const getNotificationsQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  cursor: z.string().uuid({ message: 'Valid cursor UUID is required.' }).optional(),
});

export type GetNotificationsQueryType = z.infer<typeof getNotificationsQuerySchema>;
