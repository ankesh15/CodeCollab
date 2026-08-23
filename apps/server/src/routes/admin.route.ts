import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate';
import { requireAdmin } from '../middlewares/authorize';
import {
  getCodeforcesCandidateProblemsController,
  importCodeforcesProblemsController,
} from '../controllers/admin.controller';
import {
  listAdminProblemsController,
  getAdminProblemDetailsController,
  createAdminProblemController,
  updateAdminProblemController,
  deleteAdminProblemController,
  addTestCaseController,
  updateTestCaseController,
  deleteTestCaseController,
  publishProblemController,
  unpublishProblemController,
} from '../controllers/admin-problem.controller';

export const adminRouter = Router();

// Protect all admin routes with authentication and admin role enforcement
adminRouter.use(authenticate);
adminRouter.use(requireAdmin);

// Codeforces Importer Endpoints
adminRouter.get('/problems/import/codeforces', getCodeforcesCandidateProblemsController);
adminRouter.post('/problems/import/codeforces', importCodeforcesProblemsController);

// Problem Management Endpoints
adminRouter.get('/problems', listAdminProblemsController);
adminRouter.post('/problems', createAdminProblemController);
adminRouter.get('/problems/:problemId', getAdminProblemDetailsController);
adminRouter.patch('/problems/:problemId', updateAdminProblemController);
adminRouter.delete('/problems/:problemId', deleteAdminProblemController);

// Test Case Management Endpoints
adminRouter.post('/problems/:problemId/test-cases', addTestCaseController);
adminRouter.patch('/test-cases/:testCaseId', updateTestCaseController);
adminRouter.delete('/test-cases/:testCaseId', deleteTestCaseController);

// Publish & Unpublish Endpoints
adminRouter.patch('/problems/:problemId/publish', publishProblemController);
adminRouter.patch('/problems/:problemId/unpublish', unpublishProblemController);
