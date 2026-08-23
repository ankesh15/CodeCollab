import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate';
import { getRoomMessagesController, deleteMessageController } from '../controllers/message.controller';

export const messageRouter = Router();

// Room Messages (Protected)
messageRouter.get('/rooms/:roomId/messages', authenticate, getRoomMessagesController);

// Delete Message (Protected)
messageRouter.delete('/messages/:messageId', authenticate, deleteMessageController);
