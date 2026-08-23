import { Router } from 'express';
import { RoomRole } from '@prisma/client';
import { getDocumentController, updateLanguageController } from '../controllers/document.controller';
import { authenticate } from '../middlewares/authenticate';
import { requireRoomRole } from '../middlewares/authorize';

const router = Router();

// GET /api/rooms/:roomId/document - Protected endpoint requiring room member authorization
router.get(
  '/rooms/:roomId/document',
  authenticate,
  requireRoomRole([RoomRole.OWNER, RoomRole.ADMIN, RoomRole.MEMBER]),
  getDocumentController
);

// PATCH /api/rooms/:roomId/document/language - Protected endpoint for updating room document language
router.patch(
  '/rooms/:roomId/document/language',
  authenticate,
  requireRoomRole([RoomRole.OWNER, RoomRole.ADMIN, RoomRole.MEMBER]),
  updateLanguageController
);

export default router;
