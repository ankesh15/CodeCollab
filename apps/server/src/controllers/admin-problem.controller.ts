import { Request, Response, NextFunction } from 'express';
import {
  ApiResponse,
  AdminProblemSummary,
  AdminProblemListResponseData,
  ProblemSummary,
  ProblemDifficulty,
  ProblemStatus,
} from '@codecollab/shared';
import { prisma } from '../config/db';

/**
 * GET /api/admin/problems
 * List all problems (Draft + Published, Internal + Codeforces) with test case counts.
 */
export async function listAdminProblemsController(
  req: Request,
  res: Response<ApiResponse<AdminProblemListResponseData>>,
  next: NextFunction
): Promise<void> {
  try {
    const { search, source, difficulty, status } = req.query;

    const whereClause: Record<string, unknown> = {};

    if (search && typeof search === 'string') {
      whereClause.title = { contains: search, mode: 'insensitive' };
    }
    if (source && (source === 'INTERNAL' || source === 'CODEFORCES')) {
      whereClause.source = source;
    }
    if (difficulty && (difficulty === 'EASY' || difficulty === 'MEDIUM' || difficulty === 'HARD')) {
      whereClause.difficulty = difficulty;
    }
    if (status && (status === 'DRAFT' || status === 'PUBLISHED')) {
      whereClause.status = status;
    }

    const problems = await prisma.problem.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      include: {
        testCases: {
          select: {
            id: true,
            isHidden: true,
          },
        },
      },
    });

    const formattedProblems: AdminProblemSummary[] = problems.map((p) => {
      const publicCount = p.testCases.filter((tc) => !tc.isHidden).length;
      const hiddenCount = p.testCases.filter((tc) => tc.isHidden).length;

      return {
        id: p.id,
        title: p.title,
        description: p.description,
        difficulty: p.difficulty as ProblemDifficulty,
        constraints: p.constraints,
        inputFormat: p.inputFormat,
        outputFormat: p.outputFormat,
        source: p.source,
        sourceId: p.sourceId,
        sourceUrl: p.sourceUrl,
        externalRating: p.externalRating,
        status: p.status as ProblemStatus,
        tags: p.tags,
        createdAt: p.createdAt.toISOString(),
        publicTestCasesCount: publicCount,
        hiddenTestCasesCount: hiddenCount,
        totalTestCasesCount: p.testCases.length,
      };
    });

    res.status(200).json({
      success: true,
      message: 'Admin problems retrieved successfully.',
      data: {
        problems: formattedProblems,
        totalCount: formattedProblems.length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/admin/problems/:problemId
 * Fetch full problem details including ALL public and hidden test cases for editing.
 */
export async function getAdminProblemDetailsController(
  req: Request,
  res: Response<ApiResponse<{ problem: ProblemSummary & { testCases: Array<{ id: string; input: string; expectedOutput: string; isHidden: boolean }> } }>>,
  next: NextFunction
): Promise<void> {
  try {
    const problemId = req.params.problemId as string;

    const problem = await prisma.problem.findUnique({
      where: { id: problemId },
      include: {
        testCases: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!problem) {
      res.status(404).json({
        success: false,
        message: 'Problem not found.',
        error: 'NOT_FOUND',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Admin problem details retrieved successfully.',
      data: {
        problem: {
          ...problem,
          createdAt: problem.createdAt.toISOString(),
          status: problem.status as ProblemStatus,
          testCases: problem.testCases.map((tc) => ({
            id: tc.id,
            input: tc.input,
            expectedOutput: tc.expectedOutput,
            isHidden: tc.isHidden,
          })),
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/admin/problems
 * Create a new internal problem.
 */
export async function createAdminProblemController(
  req: Request,
  res: Response<ApiResponse<{ problemId: string }>>,
  next: NextFunction
): Promise<void> {
  try {
    const {
      title,
      difficulty,
      externalRating,
      tags,
      description,
      constraints,
      inputFormat,
      outputFormat,
      status,
    } = req.body;

    // Validation
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      res.status(400).json({
        success: false,
        message: 'Problem title is required.',
        error: 'VALIDATION_ERROR',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (title.length > 200) {
      res.status(400).json({
        success: false,
        message: 'Title must not exceed 200 characters.',
        error: 'VALIDATION_ERROR',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (!difficulty || !['EASY', 'MEDIUM', 'HARD'].includes(difficulty)) {
      res.status(400).json({
        success: false,
        message: 'Valid difficulty (EASY, MEDIUM, HARD) is required.',
        error: 'VALIDATION_ERROR',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      res.status(400).json({
        success: false,
        message: 'Problem description is required.',
        error: 'VALIDATION_ERROR',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Check duplicate title
    const existing = await prisma.problem.findUnique({
      where: { title: title.trim() },
    });

    if (existing) {
      res.status(400).json({
        success: false,
        message: 'A problem with this title already exists.',
        error: 'DUPLICATE_TITLE',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const newProblem = await prisma.problem.create({
      data: {
        title: title.trim(),
        difficulty: difficulty as ProblemDifficulty,
        externalRating: typeof externalRating === 'number' ? externalRating : null,
        tags: Array.isArray(tags) ? tags.map((t: string) => String(t).trim()).filter(Boolean).slice(0, 20) : [],
        description: description.trim(),
        constraints: typeof constraints === 'string' ? constraints.trim() : '',
        inputFormat: typeof inputFormat === 'string' ? inputFormat.trim() : '',
        outputFormat: typeof outputFormat === 'string' ? outputFormat.trim() : '',
        source: 'INTERNAL',
        status: status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT',
      },
    });

    res.status(201).json({
      success: true,
      message: 'Problem created successfully.',
      data: { problemId: newProblem.id },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/admin/problems/:problemId
 * Update an existing problem.
 */
export async function updateAdminProblemController(
  req: Request,
  res: Response<ApiResponse<{ problemId: string }>>,
  next: NextFunction
): Promise<void> {
  try {
    const problemId = req.params.problemId as string;
    const {
      title,
      difficulty,
      externalRating,
      tags,
      description,
      constraints,
      inputFormat,
      outputFormat,
      status,
    } = req.body;

    const problem = await prisma.problem.findUnique({
      where: { id: problemId },
    });

    if (!problem) {
      res.status(404).json({
        success: false,
        message: 'Problem not found.',
        error: 'NOT_FOUND',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const updateData: Record<string, unknown> = {};

    if (title !== undefined) {
      if (typeof title !== 'string' || title.trim().length === 0) {
        res.status(400).json({
          success: false,
          message: 'Problem title cannot be empty.',
          error: 'VALIDATION_ERROR',
          timestamp: new Date().toISOString(),
        });
        return;
      }
      if (title.length > 200) {
        res.status(400).json({
          success: false,
          message: 'Title must not exceed 200 characters.',
          error: 'VALIDATION_ERROR',
          timestamp: new Date().toISOString(),
        });
        return;
      }
      // Check title duplicate if changed
      if (title.trim() !== problem.title) {
        const existing = await prisma.problem.findUnique({
          where: { title: title.trim() },
        });
        if (existing) {
          res.status(400).json({
            success: false,
            message: 'A problem with this title already exists.',
            error: 'DUPLICATE_TITLE',
            timestamp: new Date().toISOString(),
          });
          return;
        }
      }
      updateData.title = title.trim();
    }

    if (difficulty !== undefined) {
      if (!['EASY', 'MEDIUM', 'HARD'].includes(difficulty)) {
        res.status(400).json({
          success: false,
          message: 'Invalid difficulty.',
          error: 'VALIDATION_ERROR',
          timestamp: new Date().toISOString(),
        });
        return;
      }
      updateData.difficulty = difficulty;
    }

    if (externalRating !== undefined) {
      updateData.externalRating = typeof externalRating === 'number' ? externalRating : null;
    }

    if (tags !== undefined && Array.isArray(tags)) {
      updateData.tags = tags.map((t: string) => String(t).trim()).filter(Boolean).slice(0, 20);
    }

    if (description !== undefined) {
      updateData.description = String(description).trim();
    }

    if (constraints !== undefined) {
      updateData.constraints = String(constraints).trim();
    }

    if (inputFormat !== undefined) {
      updateData.inputFormat = String(inputFormat).trim();
    }

    if (outputFormat !== undefined) {
      updateData.outputFormat = String(outputFormat).trim();
    }

    if (status !== undefined && ['DRAFT', 'PUBLISHED'].includes(status)) {
      updateData.status = status;
    }

    await prisma.problem.update({
      where: { id: problemId },
      data: updateData,
    });

    res.status(200).json({
      success: true,
      message: 'Problem updated successfully.',
      data: { problemId },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/admin/problems/:problemId
 * Safely delete a problem. Rejects deletion if historical submissions exist.
 */
export async function deleteAdminProblemController(
  req: Request,
  res: Response<ApiResponse<{ deletedProblemId: string }>>,
  next: NextFunction
): Promise<void> {
  try {
    const problemId = req.params.problemId as string;

    const problem = await prisma.problem.findUnique({
      where: { id: problemId },
      include: {
        _count: {
          select: { submissions: true },
        },
      },
    });

    if (!problem) {
      res.status(404).json({
        success: false,
        message: 'Problem not found.',
        error: 'NOT_FOUND',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (problem._count.submissions > 0) {
      res.status(400).json({
        success: false,
        message: `Cannot delete problem "${problem.title}" because it has ${problem._count.submissions} historical user submission(s).`,
        error: 'DEPENDENT_SUBMISSIONS_EXIST',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    await prisma.problem.delete({
      where: { id: problemId },
    });

    res.status(200).json({
      success: true,
      message: 'Problem deleted successfully.',
      data: { deletedProblemId: problemId },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/admin/problems/:problemId/test-cases
 * Add a test case to a problem.
 */
export async function addTestCaseController(
  req: Request,
  res: Response<ApiResponse<{ testCaseId: string }>>,
  next: NextFunction
): Promise<void> {
  try {
    const problemId = req.params.problemId as string;
    const { input, expectedOutput, isHidden } = req.body;

    const problem = await prisma.problem.findUnique({
      where: { id: problemId },
    });

    if (!problem) {
      res.status(404).json({
        success: false,
        message: 'Problem not found.',
        error: 'NOT_FOUND',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (input === undefined || input === null || expectedOutput === undefined || expectedOutput === null) {
      res.status(400).json({
        success: false,
        message: 'Input and Expected Output fields are required.',
        error: 'VALIDATION_ERROR',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const inputStr = String(input);
    const outputStr = String(expectedOutput);

    // Limit payload to 64KB
    if (inputStr.length > 65536 || outputStr.length > 65536) {
      res.status(400).json({
        success: false,
        message: 'Test case input/output cannot exceed 64 KB.',
        error: 'VALIDATION_ERROR',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const testCase = await prisma.testCase.create({
      data: {
        problemId,
        input: inputStr,
        expectedOutput: outputStr,
        isHidden: Boolean(isHidden),
      },
    });

    res.status(201).json({
      success: true,
      message: 'Test case added successfully.',
      data: { testCaseId: testCase.id },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/admin/test-cases/:testCaseId
 * Update an existing test case.
 */
export async function updateTestCaseController(
  req: Request,
  res: Response<ApiResponse<{ testCaseId: string }>>,
  next: NextFunction
): Promise<void> {
  try {
    const testCaseId = req.params.testCaseId as string;
    const { input, expectedOutput, isHidden } = req.body;

    const existing = await prisma.testCase.findUnique({
      where: { id: testCaseId },
    });

    if (!existing) {
      res.status(404).json({
        success: false,
        message: 'Test case not found.',
        error: 'NOT_FOUND',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const updateData: Record<string, unknown> = {};

    if (input !== undefined) {
      const inputStr = String(input);
      if (inputStr.length > 65536) {
        res.status(400).json({
          success: false,
          message: 'Test case input cannot exceed 64 KB.',
          error: 'VALIDATION_ERROR',
          timestamp: new Date().toISOString(),
        });
        return;
      }
      updateData.input = inputStr;
    }

    if (expectedOutput !== undefined) {
      const outputStr = String(expectedOutput);
      if (outputStr.length > 65536) {
        res.status(400).json({
          success: false,
          message: 'Test case output cannot exceed 64 KB.',
          error: 'VALIDATION_ERROR',
          timestamp: new Date().toISOString(),
        });
        return;
      }
      updateData.expectedOutput = outputStr;
    }

    if (isHidden !== undefined) {
      updateData.isHidden = Boolean(isHidden);
    }

    await prisma.testCase.update({
      where: { id: testCaseId },
      data: updateData,
    });

    res.status(200).json({
      success: true,
      message: 'Test case updated successfully.',
      data: { testCaseId },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/admin/test-cases/:testCaseId
 * Delete a test case.
 */
export async function deleteTestCaseController(
  req: Request,
  res: Response<ApiResponse<{ deletedTestCaseId: string }>>,
  next: NextFunction
): Promise<void> {
  try {
    const testCaseId = req.params.testCaseId as string;

    const existing = await prisma.testCase.findUnique({
      where: { id: testCaseId },
    });

    if (!existing) {
      res.status(404).json({
        success: false,
        message: 'Test case not found.',
        error: 'NOT_FOUND',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    await prisma.testCase.delete({
      where: { id: testCaseId },
    });

    res.status(200).json({
      success: true,
      message: 'Test case deleted successfully.',
      data: { deletedTestCaseId: testCaseId },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/admin/problems/:problemId/publish
 * Validate problem requirements and publish.
 */
export async function publishProblemController(
  req: Request,
  res: Response<ApiResponse<{ problemId: string; status: ProblemStatus }>>,
  next: NextFunction
): Promise<void> {
  try {
    const problemId = req.params.problemId as string;

    const problem = await prisma.problem.findUnique({
      where: { id: problemId },
      include: {
        testCases: true,
      },
    });

    if (!problem) {
      res.status(404).json({
        success: false,
        message: 'Problem not found.',
        error: 'NOT_FOUND',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const missingRequirements: string[] = [];

    if (!problem.title || problem.title.trim().length === 0) {
      missingRequirements.push('Title');
    }
    if (!problem.description || problem.description.trim().length === 0) {
      missingRequirements.push('Description');
    }
    if (!problem.difficulty) {
      missingRequirements.push('Difficulty');
    }

    const publicTestCases = problem.testCases.filter((tc) => !tc.isHidden);
    const hiddenTestCases = problem.testCases.filter((tc) => tc.isHidden);

    if (problem.testCases.length === 0) {
      missingRequirements.push('At least one test case');
    } else {
      if (publicTestCases.length === 0) {
        missingRequirements.push('At least 1 public test case');
      }
      if (hiddenTestCases.length === 0) {
        missingRequirements.push('At least 1 hidden test case');
      }
    }

    if (missingRequirements.length > 0) {
      res.status(400).json({
        success: false,
        message: `Cannot publish problem. Missing requirements: ${missingRequirements.join(', ')}`,
        error: 'PUBLISH_VALIDATION_FAILED',
        errors: missingRequirements.map((reqName) => ({
          field: reqName.toLowerCase().replace(/\s+/g, '_'),
          message: `${reqName} is required before publishing.`,
        })),
        timestamp: new Date().toISOString(),
      });
      return;
    }

    await prisma.problem.update({
      where: { id: problemId },
      data: { status: 'PUBLISHED' },
    });

    res.status(200).json({
      success: true,
      message: 'Problem published successfully.',
      data: { problemId, status: 'PUBLISHED' },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/admin/problems/:problemId/unpublish
 * Revert problem status to DRAFT.
 */
export async function unpublishProblemController(
  req: Request,
  res: Response<ApiResponse<{ problemId: string; status: ProblemStatus }>>,
  next: NextFunction
): Promise<void> {
  try {
    const problemId = req.params.problemId as string;

    const problem = await prisma.problem.findUnique({
      where: { id: problemId },
    });

    if (!problem) {
      res.status(404).json({
        success: false,
        message: 'Problem not found.',
        error: 'NOT_FOUND',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    await prisma.problem.update({
      where: { id: problemId },
      data: { status: 'DRAFT' },
    });

    res.status(200).json({
      success: true,
      message: 'Problem unpublished (moved to Draft) successfully.',
      data: { problemId, status: 'DRAFT' },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}
