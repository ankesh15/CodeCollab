import { prisma } from '../config/db';
import {
  CodeforcesProblemCandidate,
  FetchCodeforcesProblemsResponseData,
  ImportCodeforcesProblemsResponseData,
  ImportProblemResultItem,
} from '@codecollab/shared';

interface CFProblemRaw {
  contestId: number;
  index: string;
  name: string;
  type: string;
  points?: number;
  rating?: number;
  tags: string[];
}

interface CFApiResponse {
  status: string;
  comment?: string;
  result?: {
    problems: CFProblemRaw[];
  };
}

class ProblemImportService {
  private cachedRawProblems: CFProblemRaw[] | null = null;
  private lastFetchTime = 0;
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
  private readonly MIN_INTERVAL_MS = 2000; // 2 seconds rate limit as required by Codeforces API
  private fetchLock: Promise<CFProblemRaw[]> | null = null;

  /**
   * Helper to map Codeforces numerical rating to CodeCollab Difficulty
   * rating < 1200 -> EASY
   * 1200-1599 -> MEDIUM
   * 1600+ -> HARD
   */
  public mapRatingToDifficulty(rating?: number | null): 'EASY' | 'MEDIUM' | 'HARD' {
    if (!rating || rating < 1200) {
      return 'EASY';
    }
    if (rating >= 1200 && rating <= 1599) {
      return 'MEDIUM';
    }
    return 'HARD';
  }

  /**
   * Safe fetcher for Codeforces API with rate limiting and caching.
   */
  private async getCodeforcesProblemset(): Promise<CFProblemRaw[]> {
    const now = Date.now();

    // 1. Return cached result if still valid
    if (this.cachedRawProblems && now - this.lastFetchTime < this.CACHE_TTL_MS) {
      return this.cachedRawProblems;
    }

    // 2. Reuse active fetch if one is currently in progress
    if (this.fetchLock) {
      return this.fetchLock;
    }

    // 3. Enforce rate limit (minimum 2000ms between outbound requests)
    const timeSinceLast = now - this.lastFetchTime;
    if (timeSinceLast < this.MIN_INTERVAL_MS) {
      await new Promise((resolve) => setTimeout(resolve, this.MIN_INTERVAL_MS - timeSinceLast));
    }

    this.fetchLock = (async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout

        const response = await fetch('https://codeforces.com/api/problemset.problems', {
          signal: controller.signal,
          headers: {
            'User-Agent': 'CodeCollab-Platform/1.0 (ProblemImporter; Developer Tools)',
            Accept: 'application/json',
          },
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`Codeforces API responded with HTTP status ${response.status}`);
        }

        const data = (await response.json()) as CFApiResponse;
        if (data.status !== 'OK' || !data.result?.problems) {
          throw new Error(data.comment || 'Codeforces API returned an invalid response payload');
        }

        this.cachedRawProblems = data.result.problems;
        this.lastFetchTime = Date.now();
        return this.cachedRawProblems;
      } finally {
        this.fetchLock = null;
      }
    })();

    return this.fetchLock;
  }

  /**
   * Fetch Codeforces candidate problems with filtering and database import status check.
   */
  public async fetchCandidateProblems(params: {
    tag?: string;
    difficulty?: 'EASY' | 'MEDIUM' | 'HARD';
    limit?: number;
  }): Promise<FetchCodeforcesProblemsResponseData> {
    const { tag, difficulty, limit = 50 } = params;
    const maxLimit = Math.min(Math.max(1, limit), 100);

    const rawProblems = await this.getCodeforcesProblemset();

    // 1. Fetch already imported Codeforces problems from database to mark isImported
    const importedProblems = await prisma.problem.findMany({
      where: { source: 'CODEFORCES' },
      select: { sourceId: true },
    });
    const importedSourceIds = new Set(
      importedProblems.map((p: { sourceId: string | null }) => p.sourceId).filter(Boolean) as string[]
    );

    // 2. Filter raw problems
    let filtered = rawProblems.filter((p) => p.contestId && p.index && p.name);

    if (tag && tag.trim().length > 0) {
      const cleanTag = tag.trim().toLowerCase();
      filtered = filtered.filter((p) =>
        p.tags.some((t) => t.toLowerCase().includes(cleanTag))
      );
    }

    if (difficulty) {
      filtered = filtered.filter((p) => this.mapRatingToDifficulty(p.rating) === difficulty);
    }

    const totalCount = filtered.length;
    const sliced = filtered.slice(0, maxLimit);

    const candidates: CodeforcesProblemCandidate[] = sliced.map((p) => {
      const sourceId = `${p.contestId}-${p.index}`;
      const sourceUrl = `https://codeforces.com/problemset/problem/${p.contestId}/${p.index}`;
      const mappedDifficulty = this.mapRatingToDifficulty(p.rating);

      return {
        contestId: p.contestId,
        index: p.index,
        name: p.name,
        type: p.type || 'PROGRAMMING',
        rating: p.rating ?? null,
        tags: p.tags || [],
        difficulty: mappedDifficulty,
        isImported: importedSourceIds.has(sourceId),
        sourceId,
        sourceUrl,
      };
    });

    return {
      problems: candidates,
      totalCount,
    };
  }

  /**
   * Import selected Codeforces problems into database with duplicate prevention.
   */
  public async importCodeforcesProblems(
    items: Array<{ contestId: number; index: string }>
  ): Promise<ImportCodeforcesProblemsResponseData> {
    if (!items || items.length === 0) {
      return {
        importedCount: 0,
        skippedCount: 0,
        failedCount: 0,
        results: [],
      };
    }

    // Limit single import request to max 100 items for safety
    const safeItems = items.slice(0, 100);

    const rawProblems = await this.getCodeforcesProblemset();

    // Map raw problems by sourceId ("contestId-index")
    const rawMap = new Map<string, CFProblemRaw>();
    rawProblems.forEach((p) => {
      if (p.contestId && p.index) {
        rawMap.set(`${p.contestId}-${p.index}`, p);
      }
    });

    let importedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    const results: ImportProblemResultItem[] = [];

    for (const item of safeItems) {
      const sourceId = `${item.contestId}-${item.index}`;
      const raw = rawMap.get(sourceId);

      if (!raw) {
        failedCount++;
        results.push({
          sourceId,
          title: `Contest ${item.contestId} Problem ${item.index}`,
          status: 'FAILED',
          reason: 'Problem not found in official Codeforces problem set dataset',
        });
        continue;
      }

      const sourceUrl = `https://codeforces.com/problemset/problem/${item.contestId}/${item.index}`;
      const difficulty = this.mapRatingToDifficulty(raw.rating);

      try {
        // 1. Check if problem already exists in PostgreSQL DB by (source, sourceId)
        const existing = await prisma.problem.findFirst({
          where: {
            source: 'CODEFORCES',
            sourceId,
          },
        });

        if (existing) {
          skippedCount++;
          results.push({
            sourceId,
            title: raw.name,
            status: 'SKIPPED',
            reason: 'Already imported',
          });
          continue;
        }

        // 2. Ensure title is unique in DB (if another problem has identical title, append contest-index)
        let uniqueTitle = raw.name;
        const titleConflict = await prisma.problem.findUnique({
          where: { title: uniqueTitle },
        });
        if (titleConflict) {
          uniqueTitle = `${raw.name} (${item.contestId}${item.index})`;
        }

        const description = `### ${raw.name} (Codeforces ${item.contestId}${item.index})\n\n` +
          `**Difficulty Rating:** ${raw.rating ?? 'Unrated'}\n` +
          `**Tags:** ${raw.tags.join(', ') || 'None'}\n\n` +
          `This problem was imported from the official Codeforces problem set dataset.\n` +
          `Complete problem statement and test submission suite are hosted on Codeforces.\n\n` +
          `[View original problem on Codeforces](${sourceUrl})`;

        const constraints = `Refer to original problem page on Codeforces (${sourceUrl}) for time and memory limits.`;
        const inputFormat = `Standard Input (refer to Codeforces problem page)`;
        const outputFormat = `Standard Output (refer to Codeforces problem page)`;

        // 3. Insert problem into PostgreSQL
        await prisma.problem.create({
          data: {
            title: uniqueTitle,
            description,
            difficulty,
            constraints,
            inputFormat,
            outputFormat,
            source: 'CODEFORCES',
            sourceId,
            sourceUrl,
            externalRating: raw.rating ?? null,
            tags: raw.tags || [],
          },
        });

        importedCount++;
        results.push({
          sourceId,
          title: uniqueTitle,
          status: 'IMPORTED',
        });
      } catch (err: any) {
        // Handle race conditions or duplicate title unique violations
        if (err.code === 'P2002') {
          skippedCount++;
          results.push({
            sourceId,
            title: raw.name,
            status: 'SKIPPED',
            reason: 'Already imported (unique constraint)',
          });
        } else {
          failedCount++;
          results.push({
            sourceId,
            title: raw.name,
            status: 'FAILED',
            reason: err.message || 'Database insert failed',
          });
        }
      }
    }

    return {
      importedCount,
      skippedCount,
      failedCount,
      results,
    };
  }
}

export const problemImportService = new ProblemImportService();
