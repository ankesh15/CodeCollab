import { Request, Response, NextFunction } from 'express';
import { ApiResponse, ProblemSummary } from '@codecollab/shared';
import { prisma } from '../config/db';

export async function listProblemsController(
  _req: Request,
  res: Response<ApiResponse<{ problems: ProblemSummary[] }>>,
  next: NextFunction
): Promise<void> {
  try {
    const problems = await prisma.problem.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        description: true,
        difficulty: true,
        constraints: true,
        inputFormat: true,
        outputFormat: true,
        source: true,
        sourceId: true,
        sourceUrl: true,
        externalRating: true,
        status: true,
        tags: true,
        createdAt: true,
        testCases: {
          where: { isHidden: false },
          select: {
            id: true,
            input: true,
            expectedOutput: true,
            isHidden: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    const formattedProblems: ProblemSummary[] = problems.map((p) => ({
      ...p,
      createdAt: p.createdAt.toISOString(),
      testCases: p.testCases,
    }));

    res.status(200).json({
      success: true,
      message: 'Problems list retrieved successfully.',
      data: { problems: formattedProblems },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

export async function getProblemController(
  req: Request,
  res: Response<ApiResponse<{ problem: ProblemSummary }>>,
  next: NextFunction
): Promise<void> {
  try {
    const { problemId } = req.params;

    const problem = await prisma.problem.findUnique({
      where: { id: problemId },
      include: {
        testCases: {
          where: { isHidden: false },
          select: {
            id: true,
            input: true,
            expectedOutput: true,
            isHidden: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!problem || problem.status !== 'PUBLISHED') {
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
      message: 'Problem details retrieved successfully.',
      data: {
        problem: {
          ...problem,
          createdAt: problem.createdAt.toISOString(),
          testCases: problem.testCases,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}
