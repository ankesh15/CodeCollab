import { Router } from 'express';
import {
  registerController,
  loginController,
  refreshController,
  logoutController,
  changePasswordController,
  deactivateController,
  getMeController,
  updateMeController,
} from '../controllers/auth.controller';
import { authenticate, optionalAuthenticate } from '../middlewares/authenticate';

const router = Router();

router.post('/auth/register', registerController);
router.post('/auth/login', loginController);
router.post('/auth/refresh', refreshController);
router.post('/auth/logout', optionalAuthenticate, logoutController);
router.post('/auth/change-password', authenticate, changePasswordController);
router.post('/auth/deactivate', authenticate, deactivateController);
router.get('/auth/me', authenticate, getMeController);
router.patch('/auth/me', authenticate, updateMeController);

export default router;
