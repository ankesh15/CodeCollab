import http from 'http';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { createApp } from '../app';
import { config } from '../config/env';
import { executeCodeInSandbox } from '../services/code-runner.service';
import { EXECUTION_CONFIG } from '../config/execution';
import { getUserStatisticsService } from '../services/analytics.service';

const prisma = new PrismaClient();
const PORT = 5008;
const BASE_URL = `http://localhost:${PORT}`;

let server: http.Server;
let mockRunnerServer: http.Server;
const MOCK_RUNNER_PORT = 5098;

async function setupTestServer() {
  const app = createApp();
  server = http.createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(PORT, () => {
      resolve();
    });
  });

  // Setup Mock Runner server for simulated Judge0 error responses
  mockRunnerServer = http.createServer((req, res) => {
    const url = req.url || '';
    if (url.includes('mock-400')) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid submission request' }));
    } else if (url.includes('mock-500')) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal Judge0 error' }));
    } else if (url.includes('mock-timeout')) {
      // Do not respond, let client timeout
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: { id: 3, description: 'Accepted' }, stdout: Buffer.from('ok\n').toString('base64') }));
    }
  });

  await new Promise<void>((resolve) => {
    mockRunnerServer.listen(MOCK_RUNNER_PORT, () => {
      resolve();
    });
  });
}

async function cleanupTestServer() {
  if (mockRunnerServer) {
    await new Promise<void>((resolve) => mockRunnerServer.close(() => resolve()));
  }
  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  await prisma.$disconnect();
}

function createTestToken(user: { id: string; username: string; email: string }) {
  return jwt.sign(
    { userId: user.id, username: user.username, email: user.email },
    config.jwtSecret,
    { expiresIn: '1h' }
  );
}

async function runAllP0Tests() {
  console.log('🚀 Starting P0 Critical Code Execution & Submission Security Verification...\n');

  try {
    await setupTestServer();

    const alex = await prisma.user.findUnique({ where: { username: 'alex_dev' } });
    const twoSumProblem = await prisma.problem.findUnique({
      where: { title: 'Two Sum' },
      include: { testCases: true },
    });

    if (!alex || !twoSumProblem) {
      throw new Error('Seed data missing (alex_dev or Two Sum).');
    }

    const token = createTestToken(alex);

    // =========================================================================
    // 1️⃣ Valid Judge0 Execution
    // =========================================================================
    console.log('1️⃣ Testing Valid Judge0 Execution...');
    const validExec = await executeCodeInSandbox('print("Hello Judge0")', 'python', '');
    if (validExec.status !== 'ACCEPTED' || !validExec.stdout?.includes('Hello Judge0')) {
      throw new Error(`Valid execution failed: ${JSON.stringify(validExec)}`);
    }
    console.log('  ✅ PASS: Real code executed and returned ACCEPTED with stdout.');

    // =========================================================================
    // 2️⃣ Judge0 HTTP 400 Handling
    // =========================================================================
    console.log('2️⃣ Testing Judge0 HTTP 400 Handling...');
    const originalRunnerUrl = EXECUTION_CONFIG.RUNNER_URL;
    (EXECUTION_CONFIG as { RUNNER_URL: string }).RUNNER_URL = `http://localhost:${MOCK_RUNNER_PORT}/mock-400`;

    const http400Exec = await executeCodeInSandbox('print(1)', 'python', '');
    if (http400Exec.status !== 'SYSTEM_ERROR' || !http400Exec.stderr?.includes('HTTP 400')) {
      throw new Error(`Expected SYSTEM_ERROR for HTTP 400, got: ${JSON.stringify(http400Exec)}`);
    }
    console.log('  ✅ PASS: HTTP 400 cleanly returns SYSTEM_ERROR with no fallback.');

    // =========================================================================
    // 3️⃣ Judge0 HTTP 500 Handling
    // =========================================================================
    console.log('3️⃣ Testing Judge0 HTTP 500 Handling...');
    (EXECUTION_CONFIG as { RUNNER_URL: string }).RUNNER_URL = `http://localhost:${MOCK_RUNNER_PORT}/mock-500`;

    const http500Exec = await executeCodeInSandbox('print(1)', 'python', '');
    if (http500Exec.status !== 'SYSTEM_ERROR' || !http500Exec.stderr?.includes('HTTP 500')) {
      throw new Error(`Expected SYSTEM_ERROR for HTTP 500, got: ${JSON.stringify(http500Exec)}`);
    }
    console.log('  ✅ PASS: HTTP 500 cleanly returns SYSTEM_ERROR.');

    // =========================================================================
    // 4️⃣ Judge0 Timeout Handling
    // =========================================================================
    console.log('4️⃣ Testing Judge0 HTTP Timeout Handling...');
    (EXECUTION_CONFIG as { RUNNER_URL: string }).RUNNER_URL = `http://localhost:${MOCK_RUNNER_PORT}/mock-timeout`;
    const originalTimeout = EXECUTION_CONFIG.RUNNER_TIMEOUT_MS;
    (EXECUTION_CONFIG as { RUNNER_TIMEOUT_MS: number }).RUNNER_TIMEOUT_MS = 500; // Fast timeout for test

    const timeoutExec = await executeCodeInSandbox('print(1)', 'python', '');
    (EXECUTION_CONFIG as { RUNNER_TIMEOUT_MS: number }).RUNNER_TIMEOUT_MS = originalTimeout;
    if (timeoutExec.status !== 'SYSTEM_ERROR' || !timeoutExec.stderr?.includes('timed out')) {
      throw new Error(`Expected SYSTEM_ERROR on timeout, got: ${JSON.stringify(timeoutExec)}`);
    }
    console.log('  ✅ PASS: Request timeout cleanly returns SYSTEM_ERROR.');

    // =========================================================================
    // 5️⃣ Judge0 Unavailable / Network Failure Handling
    // =========================================================================
    console.log('5️⃣ Testing Judge0 Unavailable / Network Failure...');
    (EXECUTION_CONFIG as { RUNNER_URL: string }).RUNNER_URL = 'http://127.0.0.1:59999'; // Non-existent port

    const unavailExec = await executeCodeInSandbox('print(1)', 'python', '');
    (EXECUTION_CONFIG as { RUNNER_URL: string }).RUNNER_URL = originalRunnerUrl; // Restore original
    if (unavailExec.status !== 'SYSTEM_ERROR' || !unavailExec.stderr?.includes('unavailable')) {
      throw new Error(`Expected SYSTEM_ERROR for unreachable runner, got: ${JSON.stringify(unavailExec)}`);
    }
    console.log('  ✅ PASS: Unreachable runner service cleanly returns SYSTEM_ERROR.');

    // =========================================================================
    // 6️⃣ Invalid Language ID Rejection
    // =========================================================================
    console.log('6️⃣ Testing Invalid Language ID Rejection...');
    const invalidLangRes = await fetch(`${BASE_URL}/api/submissions/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        problemId: twoSumProblem.id,
        language: 'ruby',
        code: 'puts "hello"',
      }),
    });

    if (invalidLangRes.status !== 400) {
      throw new Error(`Expected 400 for unsupported language, got ${invalidLangRes.status}`);
    }
    const invalidLangJson = await invalidLangRes.json();
    if (!JSON.stringify(invalidLangJson).includes('Unsupported language')) {
      throw new Error(`Expected validation error message for unsupported language, got: ${JSON.stringify(invalidLangJson)}`);
    }
    console.log('  ✅ PASS: Unsupported language rejected with HTTP 400.');

    // =========================================================================
    // 7️⃣ Oversized Source Code Rejection
    // =========================================================================
    console.log('7️⃣ Testing Oversized Source Code Rejection...');
    const oversizedCode = 'a'.repeat(70 * 1024); // 70 KB > 64 KB limit
    const oversizedCodeRes = await fetch(`${BASE_URL}/api/submissions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        problemId: twoSumProblem.id,
        language: 'python',
        code: oversizedCode,
      }),
    });

    if (oversizedCodeRes.status !== 400) {
      throw new Error(`Expected 400 for oversized source code, got ${oversizedCodeRes.status}`);
    }
    console.log('  ✅ PASS: Oversized source code (>64 KB) rejected with HTTP 400.');

    // =========================================================================
    // 8️⃣ Oversized Stdin Rejection
    // =========================================================================
    console.log('8️⃣ Testing Oversized Stdin Rejection...');
    const oversizedStdin = 'x'.repeat(70 * 1024); // 70 KB > 64 KB limit
    const oversizedStdinExec = await executeCodeInSandbox('print(1)', 'python', oversizedStdin);
    if (oversizedStdinExec.status !== 'SYSTEM_ERROR' || !oversizedStdinExec.stderr?.includes('maximum allowed size')) {
      throw new Error(`Expected SYSTEM_ERROR for oversized stdin, got: ${JSON.stringify(oversizedStdinExec)}`);
    }
    console.log('  ✅ PASS: Oversized stdin (>64 KB) cleanly rejected with SYSTEM_ERROR.');

    // =========================================================================
    // 9️⃣ Execution Timeout (Infinite Loop)
    // =========================================================================
    console.log('9️⃣ Testing Execution Timeout (Infinite Loop)...');
    const tleExec = await executeCodeInSandbox('while True: pass', 'python', '');
    if (tleExec.status !== 'TIME_LIMIT_EXCEEDED') {
      throw new Error(`Expected TIME_LIMIT_EXCEEDED for infinite loop, got: ${JSON.stringify(tleExec)}`);
    }
    console.log('  ✅ PASS: Infinite loop execution produced TIME_LIMIT_EXCEEDED.');

    // =========================================================================
    // 🔟 Compilation Error Detection
    // =========================================================================
    console.log('🔟 Testing Compilation Error Detection...');
    const compileErrExec = await executeCodeInSandbox('int main() { syntax error; }', 'cpp', '');
    if (compileErrExec.status !== 'COMPILATION_ERROR' || !compileErrExec.compileOutput) {
      throw new Error(`Expected COMPILATION_ERROR with compileOutput, got: ${JSON.stringify(compileErrExec)}`);
    }
    console.log('  ✅ PASS: C++ syntax error correctly returned COMPILATION_ERROR.');

    // =========================================================================
    // 1️⃣1️⃣ Runtime Error Detection
    // =========================================================================
    console.log('1️⃣1️⃣ Testing Runtime Error Detection...');
    const runtimeErrExec = await executeCodeInSandbox('print(1/0)', 'python', '');
    if (runtimeErrExec.status !== 'RUNTIME_ERROR' || !runtimeErrExec.stderr?.includes('ZeroDivisionError')) {
      throw new Error(`Expected RUNTIME_ERROR with ZeroDivisionError, got: ${JSON.stringify(runtimeErrExec)}`);
    }
    console.log('  ✅ PASS: Python division by zero correctly returned RUNTIME_ERROR.');

    // =========================================================================
    // 1️⃣2️⃣ Wrong Answer Detection
    // =========================================================================
    console.log('1️⃣2️⃣ Testing Wrong Answer Detection...');
    const wrongAnswerRes = await fetch(`${BASE_URL}/api/submissions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        problemId: twoSumProblem.id,
        language: 'python',
        code: 'print("[999, 999]")',
      }),
    });

    const wrongAnswerJson = await wrongAnswerRes.json();
    if (!wrongAnswerRes.ok || wrongAnswerJson.data.submission.status !== 'WRONG_ANSWER') {
      throw new Error(`Expected WRONG_ANSWER, got: ${JSON.stringify(wrongAnswerJson)}`);
    }
    console.log('  ✅ PASS: Incorrect output correctly evaluated as WRONG_ANSWER.');

    // =========================================================================
    // 1️⃣3️⃣ Accepted Submission
    // =========================================================================
    console.log('1️⃣3️⃣ Testing Accepted Submission...');
    const validTwoSumPy = `
import sys, json
lines = sys.stdin.read().strip().split('\\n')
if len(lines) >= 2:
    nums = json.loads(lines[0].strip())
    target = int(lines[1].strip())
    lookup = {}
    for i, num in enumerate(nums):
        diff = target - num
        if diff in lookup:
            print(json.dumps([lookup[diff], i]))
            sys.exit(0)
        lookup[num] = i
`;

    const acceptedRes = await fetch(`${BASE_URL}/api/submissions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        problemId: twoSumProblem.id,
        language: 'python',
        code: validTwoSumPy,
      }),
    });

    const acceptedJson = await acceptedRes.json();
    if (!acceptedRes.ok || acceptedJson.data.submission.status !== 'ACCEPTED') {
      throw new Error(`Expected ACCEPTED, got: ${JSON.stringify(acceptedJson)}`);
    }
    console.log('  ✅ PASS: Correct solution evaluated as ACCEPTED with execution metrics.');

    // =========================================================================
    // 1️⃣4️⃣ Hidden Test Metadata Protection
    // =========================================================================
    console.log('1️⃣4️⃣ Testing Hidden Test Metadata Protection...');
    const subTestResults = acceptedJson.data.submission.testResults || [];
    // Only public test cases (2) should be present in testResults
    if (subTestResults.length !== 2) {
      throw new Error(`Expected exactly 2 public test results, got ${subTestResults.length}`);
    }
    const hasAnyHidden = subTestResults.some((t: { isHidden: boolean }) => t.isHidden);
    if (hasAnyHidden) {
      throw new Error('SECURITY VIOLATION: Hidden test case present in testResults array!');
    }

    // Now test a solution that passes public tests but fails the hidden test
    // Public tests: [2,7,11,15]->9, [3,2,4]->6. Hidden: [3,3]->6
    const cheatSolver = `
import sys, json
lines = sys.stdin.read().strip().split('\\n')
if len(lines) >= 2:
    nums = json.loads(lines[0].strip())
    if nums == [3, 3]:
        print("[0, 0]")  # Intentionally fail hidden test
    else:
        target = int(lines[1].strip())
        lookup = {}
        for i, num in enumerate(nums):
            diff = target - num
            if diff in lookup:
                print(json.dumps([lookup[diff], i]))
                sys.exit(0)
            lookup[num] = i
`;
    const hiddenFailRes = await fetch(`${BASE_URL}/api/submissions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        problemId: twoSumProblem.id,
        language: 'python',
        code: cheatSolver,
      }),
    });
    const hiddenFailJson = await hiddenFailRes.json();
    if (hiddenFailJson.data.submission.status !== 'WRONG_ANSWER') {
      throw new Error(`Expected WRONG_ANSWER when hidden test fails, got: ${hiddenFailJson.data.submission.status}`);
    }
    if (hiddenFailJson.data.submission.failedTestIndex !== null) {
      throw new Error(`SECURITY VIOLATION: failedTestIndex leaked for hidden test: ${hiddenFailJson.data.submission.failedTestIndex}`);
    }
    console.log('  ✅ PASS: Hidden test metadata, statuses, and indices strictly protected.');

    // =========================================================================
    // 1️⃣5️⃣ Codeforces Imported Problem with Zero Tests Safety
    // =========================================================================
    console.log('1️⃣5️⃣ Testing Codeforces Imported Problem with Zero Tests Safety...');
    // Create a mock imported Codeforces problem with status DRAFT and 0 test cases
    const cfProblem = await prisma.problem.create({
      data: {
        title: `CF Test Problem ${Date.now()}`,
        description: 'Imported problem without tests',
        difficulty: 'EASY',
        constraints: 'None',
        inputFormat: 'None',
        outputFormat: 'None',
        source: 'CODEFORCES',
        sourceId: `CF-${Date.now()}`,
        status: 'DRAFT',
      },
    });

    const cfRunRes = await fetch(`${BASE_URL}/api/submissions/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        problemId: cfProblem.id,
        language: 'python',
        code: 'print(1)',
      }),
    });

    if (cfRunRes.status !== 400) {
      throw new Error(`Expected 400 for run on draft problem with zero tests, got ${cfRunRes.status}`);
    }

    const cfSubmitRes = await fetch(`${BASE_URL}/api/submissions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        problemId: cfProblem.id,
        language: 'python',
        code: 'print(1)',
      }),
    });

    if (cfSubmitRes.status !== 400) {
      throw new Error(`Expected 400 for submit on draft problem with zero tests, got ${cfSubmitRes.status}`);
    }

    // Clean up test problem
    await prisma.problem.delete({ where: { id: cfProblem.id } });
    console.log('  ✅ PASS: Problem with 0 tests / DRAFT status cannot be executed or submitted.');

    // =========================================================================
    // 1️⃣6️⃣ Submission Cannot Become ACCEPTED Because Runner Failed
    // =========================================================================
    console.log('1️⃣6️⃣ Testing Runner Failure Never Marks Submission ACCEPTED...');
    (EXECUTION_CONFIG as { RUNNER_URL: string }).RUNNER_URL = `http://localhost:${MOCK_RUNNER_PORT}/mock-500`;

    const statsBefore = await getUserStatisticsService(alex.id);

    const runnerFailRes = await fetch(`${BASE_URL}/api/submissions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        problemId: twoSumProblem.id,
        language: 'python',
        code: 'print(1)',
      }),
    });

    (EXECUTION_CONFIG as { RUNNER_URL: string }).RUNNER_URL = originalRunnerUrl; // Restore

    const runnerFailJson = await runnerFailRes.json();
    if (!runnerFailRes.ok || runnerFailJson.data.submission.status !== 'SYSTEM_ERROR') {
      throw new Error(`Expected SYSTEM_ERROR for runner failure, got: ${JSON.stringify(runnerFailJson)}`);
    }

    const statsAfter = await getUserStatisticsService(alex.id);
    if (statsAfter.problemsSolved !== statsBefore.problemsSolved) {
      throw new Error('SCORING INTEGRITY VIOLATION: Failed runner execution incremented problemsSolved!');
    }
    console.log('  ✅ PASS: Runner failure records SYSTEM_ERROR and does not inflate solved statistics.');

    // =========================================================================
    // 1️⃣7️⃣ Submission Cannot Modify Its Own Status
    // =========================================================================
    console.log('1️⃣7️⃣ Testing Submission Cannot Modify Its Own Status...');
    const statusTamperRes = await fetch(`${BASE_URL}/api/submissions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        problemId: twoSumProblem.id,
        language: 'python',
        code: 'print("fake")',
        status: 'ACCEPTED', // Unauthorized field
      }),
    });

    if (statusTamperRes.status !== 400) {
      throw new Error(`Expected 400 for payload tampering with status, got ${statusTamperRes.status}`);
    }
    console.log('  ✅ PASS: Client cannot inject status field in submission payload.');

    // =========================================================================
    // 1️⃣8️⃣ Submission Cannot Modify Its Own Score
    // =========================================================================
    console.log('1️⃣8️⃣ Testing Submission Cannot Modify Its Own Score...');
    const scoreTamperRes = await fetch(`${BASE_URL}/api/submissions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        problemId: twoSumProblem.id,
        language: 'python',
        code: 'print("fake")',
        score: 100, // Unauthorized field
      }),
    });

    if (scoreTamperRes.status !== 400) {
      throw new Error(`Expected 400 for payload tampering with score, got ${scoreTamperRes.status}`);
    }
    console.log('  ✅ PASS: Client cannot inject score field in submission payload.');

    console.log('\n🎉 ALL 18 MANDATORY P0 TEST SCENARIOS PASSED WITH FULL SECURITY SEMANTICS!\n');
  } catch (err) {
    console.error('❌ P0 Verification Failed:', err);
    process.exit(1);
  } finally {
    await cleanupTestServer();
  }
}

runAllP0Tests();
