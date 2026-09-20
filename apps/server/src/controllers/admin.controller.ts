import { Request, Response, NextFunction } from 'express';
import {
  ApiResponse,
  FetchCodeforcesProblemsResponseData,
  ImportCodeforcesProblemsResponseData,
} from '@codecollab/shared';
import { problemImportService } from '../services/problem-import.service';

export async function getCodeforcesCandidateProblemsController(
  req: Request,
  res: Response<ApiResponse<FetchCodeforcesProblemsResponseData>>,
  _next: NextFunction
): Promise<void> {
  try {
    const tag = typeof req.query['tag'] === 'string' ? req.query['tag'] : undefined;
    const difficultyRaw = typeof req.query['difficulty'] === 'string' ? req.query['difficulty'] : undefined;
    const limitRaw = typeof req.query['limit'] === 'string' ? parseInt(req.query['limit'], 10) : 50;

    let difficulty: 'EASY' | 'MEDIUM' | 'HARD' | undefined = undefined;
    if (difficultyRaw === 'EASY' || difficultyRaw === 'MEDIUM' || difficultyRaw === 'HARD') {
      difficulty = difficultyRaw;
    }

    const limit = Number.isNaN(limitRaw) ? 50 : limitRaw;

    const data = await problemImportService.fetchCandidateProblems({
      tag,
      difficulty,
      limit,
    });

    res.status(200).json({
      success: true,
      message: 'Fetched Codeforces candidate problems successfully.',
      data,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    console.error('[Codeforces Fetch Controller Error]:', err);
    res.status(502).json({
      success: false,
      message: err instanceof Error ? err.message : 'Failed to fetch candidate problems from Codeforces API',
      error: 'BAD_GATEWAY',
      timestamp: new Date().toISOString(),
    });
  }
}

export async function importCodeforcesProblemsController(
  req: Request,
  res: Response<ApiResponse<ImportCodeforcesProblemsResponseData>>,
  _next: NextFunction
): Promise<void> {
  try {
    const { problems } = req.body;

    if (!Array.isArray(problems) || problems.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Request body must include a non-empty problems array.',
        error: 'BAD_REQUEST',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const validItems: Array<{ contestId: number; index: string }> = [];
    for (const item of problems) {
      if (
        item &&
        typeof item.contestId === 'number' &&
        typeof item.index === 'string' &&
        item.index.trim().length > 0
      ) {
        validItems.push({
          contestId: item.contestId,
          index: item.index.trim().toUpperCase(),
        });
      }
    }

    if (validItems.length === 0) {
      res.status(400).json({
        success: false,
        message: 'No valid contestId and index pairs were provided for import.',
        error: 'BAD_REQUEST',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const data = await problemImportService.importCodeforcesProblems(validItems);

    res.status(200).json({
      success: true,
      message: `Batch import operation complete. Successfully imported: ${data.importedCount}, skipped: ${data.skippedCount}, failed: ${data.failedCount}.`,
      data,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    console.error('[Codeforces Import Controller Error]:', err);
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Failed to import selected problems',
      error: 'INTERNAL_SERVER_ERROR',
      timestamp: new Date().toISOString(),
    });
  }
}
