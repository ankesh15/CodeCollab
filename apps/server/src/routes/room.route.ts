import { Router } from 'express';
import {
  createRoomController,
  getRoomController,
  listRoomsController,
  joinRoomController,
  leaveRoomController,
  deleteRoomController,
  updateRoomController,
} from '../controllers/room.controller';
import { authenticate } from '../middlewares/authenticate';

const router = Router();

// POST /api/rooms - Create a new coding room
router.post('/rooms', authenticate, createRoomController);

// GET /api/rooms - List public rooms & user's joined rooms
router.get('/rooms', authenticate, listRoomsController);

// GET /api/rooms/:roomId - Retrieve room details (public rooms accessible, private rooms member-only)
router.get('/rooms/:roomId', authenticate, getRoomController);

// POST /api/rooms/:roomId/join - Join a coding room
router.post('/rooms/:roomId/join', authenticate, joinRoomController);

// POST /api/rooms/:roomId/leave - Leave a coding room
router.post('/rooms/:roomId/leave', authenticate, leaveRoomController);

// DELETE /api/rooms/:roomId - Delete a coding room (Owner or Admin only)
router.delete('/rooms/:roomId', authenticate, deleteRoomController);

// PATCH /api/rooms/:roomId - Update room settings (Owner or Admin only)
router.patch('/rooms/:roomId', authenticate, updateRoomController);

export default router;
