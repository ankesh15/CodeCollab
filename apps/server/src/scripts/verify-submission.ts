import { PrismaClient, SubmissionStatus } from '@prisma/client';
import http from 'http';
import { io as ClientIO, Socket as ClientSocket } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import { createApp } from '../app';
import { initSocketServer } from '../socket';
import { config } from '../config/env';
import { SOCKET_EVENTS, SubmissionCompletedPayload } from '@codecollab/shared';

const prisma = new PrismaClient();
const PORT = 5006;
const BASE_URL = `http://localhost:${PORT}`;

let server: http.Server;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ioServer: any;

async function setupTestEnvironment() {
  const app = createApp();
  server = http.createServer(app);
  ioServer = initSocketServer(server);

  await new Promise<void>((resolve) => {
    server.listen(PORT, () => {
      console.log(`📡 [Test Server] Running on http://localhost:${PORT}`);
      resolve();
    });
  });
}

async function cleanupTestEnvironment() {
  if (ioServer) {
    await ioServer.close();
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

function connectTestSocket(token: string): Promise<ClientSocket> {
  return new Promise((resolve, reject) => {
    const client = ClientIO(BASE_URL, {
      auth: { token },
      transports: ['websocket'],
      forceNew: true,
    });

    client.on('connect', () => resolve(client));
    client.on('connect_error', (err) => reject(err));
  });
}

async function verifySubmissionSystem() {
  console.log('💻 Starting Phase 6 — Secure Code Execution & Submissions System Verification...\n');

  try {
    await setupTestEnvironment();

    // Fetch seed data from PostgreSQL
    const alex = await prisma.user.findUnique({ where: { username: 'alex_dev' } });
    const michael = await prisma.user.findUnique({ where: { username: 'michael_tech' } });
    const algoRoom = await prisma.room.findFirst({ where: { name: 'Algo-Masterclass' } });
    const privateRoom = await prisma.room.findFirst({ where: { name: 'WebDev-Pairing' } });
    const problem1 = await prisma.problem.findUnique({ where: { title: 'Two Sum' } });

    if (!alex || !michael || !algoRoom || !privateRoom || !problem1) {
      throw new Error('Seed data missing. Run npx prisma db seed first.');
    }

    const alexToken = createTestToken(alex);
    const michaelToken = createTestToken(michael);

    // Dynamic Two Sum JS Solver that reads stdin input
    const twoSumJsSolver = `
      const fs = require('fs');
      try {
        const input = fs.readFileSync(0, 'utf-8').trim().split('\\n');
        if (input.length >= 2) {
          const nums = JSON.parse(input[0].trim());
          const target = parseInt(input[1].trim(), 10);
          const map = new Map();
          for (let i = 0; i < nums.length; i++) {
            const diff = target - nums[i];
            if (map.has(diff)) {
              console.log(JSON.stringify([map.get(diff), i]));
              process.exit(0);
            }
            map.set(nums[i], i);
          }
        }
      } catch (e) {
        process.exit(1);
      }
    `;

    // Dynamic Two Sum Python Solver
    const twoSumPySolver = `
import sys, json
try:
    lines = sys.stdin.read().strip().split('\\n')
    if len(lines) >= 2:
        nums = json.loads(lines[0].strip())
        target = int(lines[1].strip())
        mp = {}
        for i, num in enumerate(nums):
            diff = target - num
            if diff in mp:
                print(json.dumps([mp[diff], i]))
                sys.exit(0)
            mp[num] = i
except Exception:
    sys.exit(1)
`;

    // =========================================================================
    // 1️⃣ Authentication Rejection Test
    // =========================================================================
    console.log('1️⃣ Testing Unauthenticated Submission Rejection...');
    const unauthRes = await fetch(`${BASE_URL}/api/submissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        problemId: problem1.id,
        language: 'javascript',
        code: 'console.log("hello");',
      }),
    });

    if (unauthRes.status !== 401) {
      throw new Error(`Expected 401 Unauthorized for unauthenticated submission, got ${unauthRes.status}`);
    }
    console.log('  ✅ PASS: Unauthenticated submission correctly rejected with 401 Unauthorized.');

    // =========================================================================
    // 2️⃣ Invalid Problem Rejection Test
    // =========================================================================
    console.log('2️⃣ Testing Non-Existent Problem Rejection...');
    const invalidProblemRes = await fetch(`${BASE_URL}/api/submissions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${alexToken}`,
      },
      body: JSON.stringify({
        problemId: '00000000-0000-0000-0000-000000000000',
        language: 'javascript',
        code: 'console.log("test");',
      }),
    });

    if (invalidProblemRes.status !== 404) {
      throw new Error(`Expected 404 NOT_FOUND for non-existent problem, got ${invalidProblemRes.status}`);
    }
    console.log('  ✅ PASS: Non-existent problem submission correctly rejected with 404.');

    // =========================================================================
    // 3️⃣ Non-Member Private Room Rejection Test
    // =========================================================================
    console.log('3️⃣ Testing Non-Member Private Room Submission Rejection...');
    const privateRoomRejectionRes = await fetch(`${BASE_URL}/api/submissions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${michaelToken}`,
      },
      body: JSON.stringify({
        problemId: problem1.id,
        roomId: privateRoom.id,
        language: 'javascript',
        code: 'console.log("unauthorized");',
      }),
    });

    if (privateRoomRejectionRes.status !== 403) {
      throw new Error(`Expected 403 Forbidden for non-member private room submission, got ${privateRoomRejectionRes.status}`);
    }
    console.log('  ✅ PASS: Non-member private room submission correctly rejected with 403 Forbidden.');

    // =========================================================================
    // 4️⃣ Sample Run Code Execution Test (Public Test Cases)
    // =========================================================================
    console.log('4️⃣ Testing Sample Run Execution (/api/submissions/run)...');
    const runRes = await fetch(`${BASE_URL}/api/submissions/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${alexToken}`,
      },
      body: JSON.stringify({
        problemId: problem1.id,
        language: 'javascript',
        code: twoSumJsSolver,
      }),
    });

    const runJson = await runRes.json();
    if (!runRes.ok || !runJson.success || runJson.data.overallStatus !== 'ACCEPTED') {
      throw new Error(`Run execution failed: ${JSON.stringify(runJson)}`);
    }
    if (runJson.data.testResults.length === 0 || runJson.data.testResults[0].isHidden) {
      throw new Error('Run execution should evaluate public test cases only.');
    }
    console.log('  ✅ PASS: Sample run execution completed successfully against public test cases.');

    // =========================================================================
    // 5️⃣ Compilation Error Detection Test
    // =========================================================================
    console.log('5️⃣ Testing Compilation Error Detection...');
    const compileErrorRes = await fetch(`${BASE_URL}/api/submissions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${alexToken}`,
      },
      body: JSON.stringify({
        problemId: problem1.id,
        language: 'cpp',
        code: `
          int main() {
            invalid syntax here;
          }
        `,
      }),
    });

    const compileJson = await compileErrorRes.json();
    if (!compileErrorRes.ok || compileJson.data.submission.status !== 'COMPILATION_ERROR') {
      throw new Error(`Expected COMPILATION_ERROR, got: ${JSON.stringify(compileJson)}`);
    }
    console.log('  ✅ PASS: Invalid code correctly evaluated as COMPILATION_ERROR.');

    // =========================================================================
    // 6️⃣ Wrong Answer Detection Test
    // =========================================================================
    console.log('6️⃣ Testing Wrong Answer Detection...');
    const wrongAnswerRes = await fetch(`${BASE_URL}/api/submissions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${alexToken}`,
      },
      body: JSON.stringify({
        problemId: problem1.id,
        language: 'javascript',
        code: 'console.log("[0, 0]");',
      }),
    });

    const wrongJson = await wrongAnswerRes.json();
    if (!wrongAnswerRes.ok || wrongJson.data.submission.status !== 'WRONG_ANSWER') {
      throw new Error(`Expected WRONG_ANSWER, got: ${JSON.stringify(wrongJson)}`);
    }
    console.log('  ✅ PASS: Incorrect solution output correctly evaluated as WRONG_ANSWER.');

    // =========================================================================
    // 7️⃣ Accepted Solution Evaluation Test
    // =========================================================================
    console.log('7️⃣ Testing Accepted Solution Evaluation...');
    const acceptedRes = await fetch(`${BASE_URL}/api/submissions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${alexToken}`,
      },
      body: JSON.stringify({
        problemId: problem1.id,
        roomId: algoRoom.id,
        language: 'javascript',
        code: twoSumJsSolver,
      }),
    });

    const acceptedJson = await acceptedRes.json();
    if (!acceptedRes.ok || acceptedJson.data.submission.status !== 'ACCEPTED') {
      throw new Error(`Expected ACCEPTED, got: ${JSON.stringify(acceptedJson)}`);
    }
    const submissionId = acceptedJson.data.submission.id;
    console.log('  ✅ PASS: Correct solution evaluated as ACCEPTED with metrics.');

    // =========================================================================
    // 8️⃣ Timeout Protection Test
    // =========================================================================
    console.log('8️⃣ Testing Timeout / Resource Limits Handling...');
    const timeoutRes = await fetch(`${BASE_URL}/api/submissions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${alexToken}`,
      },
      body: JSON.stringify({
        problemId: problem1.id,
        language: 'javascript',
        code: `
          while (true) {
            // Infinite loop
          }
        `,
      }),
    });

    const timeoutJson = await timeoutRes.json();
    if (!timeoutRes.ok || timeoutJson.data.submission.status !== 'TIME_LIMIT_EXCEEDED') {
      throw new Error(`Expected TIME_LIMIT_EXCEEDED, got: ${JSON.stringify(timeoutJson)}`);
    }
    console.log('  ✅ PASS: Infinite loop execution safely handled with TIME_LIMIT_EXCEEDED status.');

    // =========================================================================
    // 9️⃣ Hidden Test Case Security Verification
    // =========================================================================
    console.log('9️⃣ Testing Hidden Test Case Security...');
    const problemDetailsRes = await fetch(`${BASE_URL}/api/problems/${problem1.id}`);
    const problemDetailsJson = await problemDetailsRes.json();

    const returnedCases = problemDetailsJson.data.problem.testCases || [];
    const hasHiddenInApi = returnedCases.some((t: { isHidden: boolean }) => t.isHidden);
    if (hasHiddenInApi) {
      throw new Error('SECURITY VIOLATION: REST API endpoint returned hidden test cases to client!');
    }

    const testResultsInSub = acceptedJson.data.submission.testResults || [];
    const hasAnyHiddenInResults = testResultsInSub.some((t: { isHidden: boolean }) => t.isHidden);
    if (hasAnyHiddenInResults) {
      throw new Error('SECURITY VIOLATION: Submission response leaked hidden test cases in testResults array!');
    }
    console.log('  ✅ PASS: Hidden test inputs & expected outputs strictly isolated from client payloads.');

    // =========================================================================
    // 🔟 PostgreSQL Submission Persistence & History Test
    // =========================================================================
    console.log('🔟 Testing PostgreSQL Submission Persistence & History API...');
    const dbRecord = await prisma.submission.findUnique({
      where: { id: submissionId },
    });

    if (!dbRecord || dbRecord.status !== SubmissionStatus.ACCEPTED) {
      throw new Error('Submission record not properly persisted in PostgreSQL.');
    }

    const historyRes = await fetch(`${BASE_URL}/api/submissions/problem/${problem1.id}`, {
      headers: { Authorization: `Bearer ${alexToken}` },
    });
    const historyJson = await historyRes.json();
    if (!historyRes.ok || historyJson.data.submissions.length === 0) {
      throw new Error('Failed to fetch user submission history.');
    }
    console.log('  ✅ PASS: Submission record persisted in PostgreSQL and history API returned results.');

    // =========================================================================
    // 1️⃣1️⃣ Real-Time Room Submission Notification & Room Isolation Test
    // =========================================================================
    console.log('1️⃣1️⃣ Testing Real-Time Room Submission Notification & Isolation...');
    const socketAlex = await connectTestSocket(alexToken);
    const socketMichael = await connectTestSocket(michaelToken);

    // Alex joins Algo-Masterclass (algoRoom)
    socketAlex.emit(SOCKET_EVENTS.ROOM_JOIN, { roomId: algoRoom.id });
    // Michael joins WebDev-Pairing (privateRoom)
    socketMichael.emit(SOCKET_EVENTS.ROOM_JOIN, { roomId: privateRoom.id });

    await new Promise((r) => setTimeout(r, 250));

    let roomABroadcastReceived = false;
    let roomBBroadcastReceived = false;

    socketAlex.on(SOCKET_EVENTS.SUBMISSION_COMPLETED, (payload: SubmissionCompletedPayload) => {
      if (payload.roomId === algoRoom.id) {
        roomABroadcastReceived = true;
      }
    });

    socketMichael.on(SOCKET_EVENTS.SUBMISSION_COMPLETED, () => {
      roomBBroadcastReceived = true;
    });

    // Alex submits code inside Algo-Masterclass (algoRoom)
    await fetch(`${BASE_URL}/api/submissions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${alexToken}`,
      },
      body: JSON.stringify({
        problemId: problem1.id,
        roomId: algoRoom.id,
        language: 'python',
        code: twoSumPySolver,
      }),
    });

    await new Promise((r) => setTimeout(r, 500));

    if (!roomABroadcastReceived) {
      throw new Error('Room A socket did not receive submission:completed event.');
    }
    if (roomBBroadcastReceived) {
      throw new Error('SECURITY VIOLATION: Submission event from Room A leaked to Room B!');
    }

    socketAlex.disconnect();
    socketMichael.disconnect();

    console.log('  ✅ PASS: Real-time submission event delivered to Room A and isolated from Room B.');
    console.log('\n🎉 ALL PHASE 6 — SECURE CODE EXECUTION & SUBMISSIONS TESTS PASSED SUCCESSFULLY!');
  } catch (err) {
    console.error('❌ Verification Failed:', err);
    process.exit(1);
  } finally {
    await cleanupTestEnvironment();
  }
}

verifySubmissionSystem();
