import {
  SubmissionStatusType,
  TestCaseResult,
  SubmissionSummary,
  RunCodeResponseData,
} from '@codecollab/shared';
import { prisma } from '../config/db';
import { executeCodeInSandbox } from './code-runner.service';
import { compareOutputs } from '../utils/output-comparator';
import { broadcastSubmissionCompleted } from '../socket/submission.handlers';
import { createNotificationService } from './notification.service';
import { EXECUTION_CONFIG } from '../config/execution';

export async function runCodeService(params: {
  userId: string;
  problemId: string;
  language: string;
  code: string;
}): Promise<RunCodeResponseData> {
  const { problemId, language, code } = params;

  // 1. Verify problem existence and publication status
  const problem = await prisma.problem.findUnique({
    where: { id: problemId },
    include: {
      testCases: {
        where: { isHidden: false },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!problem) {
    const error = new Error('Problem not found.') as Error & { statusCode?: number };
    error.statusCode = 404;
    throw error;
  }

  if (problem.status !== 'PUBLISHED') {
    const error = new Error('Problem is not published for execution.') as Error & { statusCode?: number };
    error.statusCode = 400;
    throw error;
  }

  if (problem.testCases.length === 0) {
    const error = new Error('Problem has no public test cases configured for execution.') as Error & { statusCode?: number };
    error.statusCode = 400;
    throw error;
  }

  const publicTestCases = problem.testCases.slice(0, EXECUTION_CONFIG.MAX_TEST_CASES_PER_SUBMISSION);
  const testResults: TestCaseResult[] = [];
  let passedTestCases = 0;
  let overallStatus: SubmissionStatusType = 'ACCEPTED';

  // 2. Evaluate each public test case
  for (const [index, testCase] of publicTestCases.entries()) {
    const execResult = await executeCodeInSandbox(code, language, testCase.input);

    let testStatus: SubmissionStatusType = execResult.status;

    if (execResult.status === 'ACCEPTED') {
      const isMatch = compareOutputs(execResult.stdout || '', testCase.expectedOutput);
      if (isMatch) {
        testStatus = 'ACCEPTED';
        passedTestCases++;
      } else {
        testStatus = 'WRONG_ANSWER';
      }
    }

    if (testStatus !== 'ACCEPTED' && overallStatus === 'ACCEPTED') {
      overallStatus = testStatus;
    }

    testResults.push({
      testCaseId: testCase.id,
      testIndex: index + 1,
      isHidden: false,
      status: testStatus,
      executionTime: execResult.executionTime,
      memory: execResult.memory,
      input: testCase.input,
      expectedOutput: testCase.expectedOutput,
      actualOutput: execResult.stdout || execResult.stderr || execResult.compileOutput || '',
    });

    // Terminate immediately on infrastructure failure or compilation error
    if (testStatus === 'SYSTEM_ERROR' || testStatus === 'COMPILATION_ERROR') {
      overallStatus = testStatus;
      break;
    }
  }

  return {
    problemId: problem.id,
    language,
    overallStatus,
    testResults,
    passedTestCases,
    totalTestCases: publicTestCases.length,
  };
}

export async function submitCodeService(params: {
  userId: string;
  problemId: string;
  roomId?: string | null;
  language: string;
  code: string;
}): Promise<SubmissionSummary> {
  const { userId, problemId, roomId, language, code } = params;

  // 1. Verify problem existence and publication status
  const problem = await prisma.problem.findUnique({
    where: { id: problemId },
    include: {
      testCases: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!problem) {
    const error = new Error('Problem not found.') as Error & { statusCode?: number };
    error.statusCode = 404;
    throw error;
  }

  if (problem.status !== 'PUBLISHED') {
    const error = new Error('Problem is not published for submissions.') as Error & { statusCode?: number };
    error.statusCode = 400;
    throw error;
  }

  if (problem.testCases.length === 0) {
    const error = new Error('Problem has no test cases configured for execution.') as Error & { statusCode?: number };
    error.statusCode = 400;
    throw error;
  }

  // 2. If roomId provided, verify user room membership
  if (roomId) {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      select: { id: true, isPrivate: true },
    });

    if (!room) {
      const error = new Error('Room not found.') as Error & { statusCode?: number };
      error.statusCode = 404;
      throw error;
    }

    const membership = await prisma.roomMember.findUnique({
      where: {
        roomId_userId: {
          roomId,
          userId,
        },
      },
    });

    if (room.isPrivate && !membership) {
      const error = new Error('Forbidden. You are not a member of this private room.') as Error & { statusCode?: number };
      error.statusCode = 403;
      throw error;
    }
  }

  // 3. Deterministic State Machine: Create in QUEUED state, then transition to RUNNING
  const submissionRecord = await prisma.submission.create({
    data: {
      userId,
      problemId,
      roomId: roomId || null,
      language,
      sourceCode: code,
      status: 'QUEUED',
    },
    include: {
      user: {
        select: { id: true, username: true },
      },
    },
  });

  await prisma.submission.update({
    where: { id: submissionRecord.id },
    data: { status: 'RUNNING' },
  });

  // 4. Evaluate against test cases (bounded by MAX_TEST_CASES_PER_SUBMISSION)
  const allTestCases = problem.testCases.slice(0, EXECUTION_CONFIG.MAX_TEST_CASES_PER_SUBMISSION);
  const testResults: TestCaseResult[] = [];
  let passedTestCases = 0;
  let overallStatus: SubmissionStatusType = 'ACCEPTED';
  let maxExecutionTime = 0;
  let maxMemoryUsed = 0;
  let failedTestIndex: number | null = null;

  for (const [index, testCase] of allTestCases.entries()) {
    const execResult = await executeCodeInSandbox(code, language, testCase.input);

    if ((execResult.executionTime || 0) > maxExecutionTime) {
      maxExecutionTime = execResult.executionTime || 0;
    }
    if ((execResult.memory || 0) > maxMemoryUsed) {
      maxMemoryUsed = execResult.memory || 0;
    }

    // Runner failure must never be masked as ACCEPTED or WRONG_ANSWER
    if (execResult.status === 'SYSTEM_ERROR') {
      overallStatus = 'SYSTEM_ERROR';
      failedTestIndex = !testCase.isHidden ? index + 1 : null;
      break;
    }

    // Compilation error halts further test cases immediately
    if (execResult.status === 'COMPILATION_ERROR') {
      overallStatus = 'COMPILATION_ERROR';
      failedTestIndex = !testCase.isHidden ? index + 1 : null;
      break;
    }

    let testStatus: SubmissionStatusType = execResult.status;

    if (execResult.status === 'ACCEPTED') {
      const isMatch = compareOutputs(execResult.stdout || '', testCase.expectedOutput);
      if (isMatch) {
        testStatus = 'ACCEPTED';
        passedTestCases++;
      } else {
        testStatus = 'WRONG_ANSWER';
      }
    }

    if (testStatus !== 'ACCEPTED' && overallStatus === 'ACCEPTED') {
      overallStatus = testStatus;
      // Only disclose failed test index if it was a public test case
      if (!testCase.isHidden) {
        failedTestIndex = index + 1;
      } else {
        failedTestIndex = null;
      }
    }

    // HIDDEN TEST CASE PROTECTION:
    // Only public test case results are added to the returned testResults array.
    // Hidden test case IDs, statuses, execution times, and memory are never exposed.
    if (!testCase.isHidden) {
      testResults.push({
        testCaseId: testCase.id,
        testIndex: index + 1,
        isHidden: false,
        status: testStatus,
        executionTime: execResult.executionTime,
        memory: execResult.memory,
        input: testCase.input,
        expectedOutput: testCase.expectedOutput,
        actualOutput: execResult.stdout || execResult.stderr || execResult.compileOutput || '',
      });
    }
  }

  // 5. Update submission record in database with final status & metrics
  const updatedSubmission = await prisma.submission.update({
    where: { id: submissionRecord.id },
    data: {
      status: overallStatus,
      executionTime: maxExecutionTime > 0 ? maxExecutionTime : null,
      memoryUsed: maxMemoryUsed > 0 ? maxMemoryUsed : null,
    },
    include: {
      user: {
        select: { id: true, username: true },
      },
      problem: {
        select: { title: true },
      },
    },
  });

  const formattedSummary: SubmissionSummary = {
    id: updatedSubmission.id,
    userId: updatedSubmission.userId,
    username: updatedSubmission.user.username,
    problemId: updatedSubmission.problemId,
    problemTitle: updatedSubmission.problem.title,
    roomId: updatedSubmission.roomId,
    language: updatedSubmission.language,
    sourceCode: updatedSubmission.sourceCode,
    status: updatedSubmission.status as SubmissionStatusType,
    executionTime: updatedSubmission.executionTime,
    memoryUsed: updatedSubmission.memoryUsed,
    createdAt: updatedSubmission.createdAt.toISOString(),
    testResults,
    failedTestIndex,
    totalTestCases: allTestCases.length,
    passedTestCases,
  };

  // 6. Create persistent notification for the user who submitted
  try {
    const notifMessage =
      overallStatus === 'SYSTEM_ERROR'
        ? `Your submission for "${updatedSubmission.problem.title}" encountered a runner execution service error.`
        : `Your submission for "${updatedSubmission.problem.title}" was evaluated as ${overallStatus} (${passedTestCases}/${allTestCases.length} passed).`;

    await createNotificationService({
      userId,
      type: 'SUBMISSION_RESULT',
      message: notifMessage,
    });
  } catch (notifErr) {
    console.warn('[SubmissionService] Failed to create submission completion notification:', notifErr);
  }

  // 7. Emit real-time Socket notification to room if applicable
  if (roomId) {
    broadcastSubmissionCompleted(roomId, {
      submissionId: formattedSummary.id,
      roomId,
      problemId: formattedSummary.problemId,
      user: {
        userId: formattedSummary.userId,
        username: formattedSummary.username || 'Collaborator',
      },
      status: formattedSummary.status,
      executionTime: formattedSummary.executionTime,
      memoryUsed: formattedSummary.memoryUsed,
      passedTestCases,
      totalTestCases: allTestCases.length,
    });
  }

  return formattedSummary;
}

export async function getUserSubmissionsService(
  userId: string,
  problemId: string
): Promise<SubmissionSummary[]> {
  const submissions = await prisma.submission.findMany({
    where: {
      userId,
      problemId,
    },
    orderBy: { createdAt: 'desc' },
    include: {
      user: {
        select: { username: true },
      },
      problem: {
        select: { title: true },
      },
    },
  });

  return submissions.map((s) => ({
    id: s.id,
    userId: s.userId,
    username: s.user.username,
    problemId: s.problemId,
    problemTitle: s.problem.title,
    roomId: s.roomId,
    language: s.language,
    sourceCode: s.sourceCode,
    status: s.status as SubmissionStatusType,
    executionTime: s.executionTime,
    memoryUsed: s.memoryUsed,
    createdAt: s.createdAt.toISOString(),
  }));
}

export async function getSubmissionService(
  submissionId: string,
  userId: string
): Promise<SubmissionSummary> {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      user: {
        select: { username: true },
      },
      problem: {
        select: { title: true },
      },
    },
  });

  if (!submission) {
    const error = new Error('Submission not found.') as Error & { statusCode?: number };
    error.statusCode = 404;
    throw error;
  }

  // Authorization check: User must own the submission or be in the room
  if (submission.userId !== userId) {
    if (submission.roomId) {
      const membership = await prisma.roomMember.findUnique({
        where: {
          roomId_userId: {
            roomId: submission.roomId,
            userId,
          },
        },
      });

      if (!membership) {
        const error = new Error('Forbidden. You do not have access to view this submission.') as Error & { statusCode?: number };
        error.statusCode = 403;
        throw error;
      }
    } else {
      const error = new Error('Forbidden. You do not have access to view this submission.') as Error & { statusCode?: number };
      error.statusCode = 403;
      throw error;
    }
  }

  return {
    id: submission.id,
    userId: submission.userId,
    username: submission.user.username,
    problemId: submission.problemId,
    problemTitle: submission.problem.title,
    roomId: submission.roomId,
    language: submission.language,
    sourceCode: submission.sourceCode,
    status: submission.status as SubmissionStatusType,
    executionTime: submission.executionTime,
    memoryUsed: submission.memoryUsed,
    createdAt: submission.createdAt.toISOString(),
  };
}
