import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate';
import {
  getUserNotificationsController,
  getUnreadCountController,
  markNotificationReadController,
  markAllNotificationsReadController,
} from '../controllers/notification.controller';

export const notificationRouter = Router();

// Notification Endpoints (Protected)
notificationRouter.get('/', authenticate, getUserNotificationsController);
notificationRouter.get('/unread-count', authenticate, getUnreadCountController);
notificationRouter.patch('/read-all', authenticate, markAllNotificationsReadController);
notificationRouter.patch('/:notificationId/read', authenticate, markNotificationReadController);
