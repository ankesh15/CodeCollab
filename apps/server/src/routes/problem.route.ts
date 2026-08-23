import { Router } from 'express';
import { listProblemsController, getProblemController } from '../controllers/problem.controller';

const router = Router();

// Public routes for practice problems
router.get('/problems', listProblemsController);
router.get('/problems/:problemId', getProblemController);

export default router;
