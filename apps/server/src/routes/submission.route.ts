import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate';
import {
  runCodeController,
  createSubmissionController,
  getUserSubmissionsController,
  getSubmissionController,
} from '../controllers/submission.controller';

export const submissionRouter = Router();

// 1. Run Code against public test cases (sample runner)
submissionRouter.post('/run', authenticate, runCodeController);

// 2. Submit Code against full test suite (public + hidden test cases)
submissionRouter.post('/', authenticate, createSubmissionController);

// 3. Get single submission details
submissionRouter.get('/:submissionId', authenticate, getSubmissionController);

// 4. Get authenticated user's submission history for a problem
submissionRouter.get('/problem/:problemId', authenticate, getUserSubmissionsController);
