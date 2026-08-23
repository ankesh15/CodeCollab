import { Router } from 'express';
import { registerController, loginController, getMeController, updateMeController } from '../controllers/auth.controller';
import { authenticate } from '../middlewares/authenticate';

const router = Router();

router.post('/auth/register', registerController);
router.post('/auth/login', loginController);
router.get('/auth/me', authenticate, getMeController);
router.patch('/auth/me', authenticate, updateMeController);

export default router;

