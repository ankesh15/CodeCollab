import { Router } from 'express';
import { RoomRole } from '@prisma/client';
import { getRoomController, listRoomsController } from '../controllers/room.controller';
import { authenticate } from '../middlewares/authenticate';
import { requireRoomRole } from '../middlewares/authorize';

const router = Router();

// GET /api/rooms - List public rooms & user's joined rooms
router.get('/rooms', authenticate, listRoomsController);

// GET /api/rooms/:roomId - Protected route enforcing room authentication & member/privacy authorization
router.get(
  '/rooms/:roomId',
  authenticate,
  requireRoomRole([RoomRole.OWNER, RoomRole.ADMIN, RoomRole.MEMBER]),
  getRoomController
);

export default router;
