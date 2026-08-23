import { Request, Response, NextFunction } from 'express';
import { ApiResponse, RunCodeResponseData, SubmissionSummary } from '@codecollab/shared';
import { runCodeSchema, submitCodeSchema } from '../schemas/submission.schema';
import {
  runCodeService,
  submitCodeService,
  getUserSubmissionsService,
  getSubmissionService,
} from '../services/submission.service';

export async function runCodeController(
  req: Request,
  res: Response<ApiResponse<RunCodeResponseData>>,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required.',
        error: 'UNAUTHORIZED',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const parseResult = runCodeSchema.safeParse(req.body);
    if (!parseResult.success) {
      const formattedErrors = parseResult.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));

      res.status(400).json({
        success: false,
        message: 'Validation failed for run code request.',
        error: 'VALIDATION_FAILED',
        errors: formattedErrors,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const result = await runCodeService({
      userId: req.user.userId,
      ...parseResult.data,
    });

    res.status(200).json({
      success: true,
      message: 'Code run execution completed successfully.',
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const errorObj = err as Error & { statusCode?: number };
    if (errorObj.statusCode) {
      res.status(errorObj.statusCode).json({
        success: false,
        message: errorObj.message,
        error: errorObj.statusCode === 404 ? 'NOT_FOUND' : 'BAD_REQUEST',
        timestamp: new Date().toISOString(),
      });
      return;
    }
    next(err);
  }
}

export async function createSubmissionController(
  req: Request,
  res: Response<ApiResponse<{ submission: SubmissionSummary }>>,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required.',
        error: 'UNAUTHORIZED',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const parseResult = submitCodeSchema.safeParse(req.body);
    if (!parseResult.success) {
      const formattedErrors = parseResult.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));

      res.status(400).json({
        success: false,
        message: 'Validation failed for code submission request.',
        error: 'VALIDATION_FAILED',
        errors: formattedErrors,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const submission = await submitCodeService({
      userId: req.user.userId,
      ...parseResult.data,
    });

    res.status(201).json({
      success: true,
      message: 'Code submission evaluated and stored successfully.',
      data: { submission },
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const errorObj = err as Error & { statusCode?: number };
    if (errorObj.statusCode) {
      res.status(errorObj.statusCode).json({
        success: false,
        message: errorObj.message,
        error: errorObj.statusCode === 404 ? 'NOT_FOUND' : errorObj.statusCode === 403 ? 'FORBIDDEN' : 'BAD_REQUEST',
        timestamp: new Date().toISOString(),
      });
      return;
    }
    next(err);
  }
}

export async function getUserSubmissionsController(
  req: Request,
  res: Response<ApiResponse<{ submissions: SubmissionSummary[] }>>,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required.',
        error: 'UNAUTHORIZED',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const { problemId } = req.params;
    if (!problemId) {
      res.status(400).json({
        success: false,
        message: 'problemId is required.',
        error: 'BAD_REQUEST',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const submissions = await getUserSubmissionsService(req.user.userId, problemId);

    res.status(200).json({
      success: true,
      message: 'User submissions retrieved successfully.',
      data: { submissions },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

export async function getSubmissionController(
  req: Request,
  res: Response<ApiResponse<{ submission: SubmissionSummary }>>,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required.',
        error: 'UNAUTHORIZED',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const { submissionId } = req.params;
    if (!submissionId) {
      res.status(400).json({
        success: false,
        message: 'submissionId is required.',
        error: 'BAD_REQUEST',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const submission = await getSubmissionService(submissionId, req.user.userId);

    res.status(200).json({
      success: true,
      message: 'Submission details retrieved successfully.',
      data: { submission },
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const errorObj = err as Error & { statusCode?: number };
    if (errorObj.statusCode) {
      res.status(errorObj.statusCode).json({
        success: false,
        message: errorObj.message,
        error: errorObj.statusCode === 404 ? 'NOT_FOUND' : 'FORBIDDEN',
        timestamp: new Date().toISOString(),
      });
      return;
    }
    next(err);
  }
}
