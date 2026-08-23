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

export async function runCodeService(params: {
  userId: string;
  problemId: string;
  language: string;
  code: string;
}): Promise<RunCodeResponseData> {
  const { problemId, language, code } = params;

  // 1. Verify problem existence
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

  const publicTestCases = problem.testCases;
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

    // Stop execution early if compilation error occurred
    if (testStatus === 'COMPILATION_ERROR') {
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

  // 1. Verify problem existence
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

  // 3. Create initial Submission record in DB (status: QUEUED)
  const submissionRecord = await prisma.submission.create({
    data: {
      userId,
      problemId,
      roomId: roomId || null,
      language,
      sourceCode: code,
      status: 'RUNNING',
    },
    include: {
      user: {
        select: { id: true, username: true },
      },
    },
  });

  // 4. Evaluate against ALL test cases (public + hidden)
  const allTestCases = problem.testCases;
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
      failedTestIndex = index + 1;
    }

    // Build secure test result: Hide input/output data for hidden tests
    const testResult: TestCaseResult = {
      testCaseId: testCase.id,
      testIndex: index + 1,
      isHidden: testCase.isHidden,
      status: testStatus,
      executionTime: execResult.executionTime,
      memory: execResult.memory,
    };

    // Include input/output details ONLY for public test cases
    if (!testCase.isHidden) {
      testResult.input = testCase.input;
      testResult.expectedOutput = testCase.expectedOutput;
      testResult.actualOutput = execResult.stdout || execResult.stderr || execResult.compileOutput || '';
    }

    testResults.push(testResult);

    if (testStatus === 'COMPILATION_ERROR') {
      break;
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
    await createNotificationService({
      userId,
      type: 'SUBMISSION_RESULT',
      message: `Your submission for "${updatedSubmission.problem.title}" was evaluated as ${overallStatus} (${passedTestCases}/${allTestCases.length} passed).`,
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
