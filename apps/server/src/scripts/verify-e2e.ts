import http from 'http';
import { io as ClientIO, Socket as ClientSocket } from 'socket.io-client';
import {
  SOCKET_EVENTS,
  RoomStatePayload,
  EditorChangePayload,
  MessageNewPayload,
  SubmissionCompletedPayload,
} from '@codecollab/shared';
import { createApp } from '../app';
import { initSocketServer } from '../socket';
import { broadcastSubmissionCompleted } from '../socket/submission.handlers';
import { prisma } from '../config/db';
import { registerUser, loginUser } from '../services/auth.service';

let httpServer: http.Server;
let port: number;
let serverUrl: string;

function createClientSocket(token: string): ClientSocket {
  return ClientIO(serverUrl, {
    auth: { token },
    transports: ['websocket'],
    forceNew: true,
  });
}

async function verifyE2EFlow() {
  console.log('🚀 Starting CodeCollab Multi-User End-to-End Integration Verification Suite...\n');

  // Pre-test cleanup: remove any lingering E2E test data
  await prisma.room.deleteMany({ where: { name: { startsWith: 'E2E-Workspace' } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: 'e2e_' } } });

  // 1. Initialize HTTP + Socket.IO Test Server instance
  const app = createApp();
  httpServer = http.createServer(app);
  initSocketServer(httpServer);

  await new Promise<void>((resolve) => {
    httpServer.listen(0, () => {
      const addr = httpServer.address();
      if (typeof addr === 'object' && addr !== null) {
        port = addr.port;
        serverUrl = `http://localhost:${port}`;
      }
      resolve();
    });
  });

  console.log(`🌐 Test server listening on ${serverUrl}`);

  let createdRoomId: string | null = null;
  let createdUser1Id: string | null = null;
  let createdUser2Id: string | null = null;

  try {
    // TEST 1: User Registration & Authentication Flow
    console.log('\n1️⃣ Testing Multi-User Auth & Registration...');
    const timestamp = Date.now();
    const user1Email = `e2e_user1_${timestamp}@example.com`;
    const user2Email = `e2e_user2_${timestamp}@example.com`;

    const user1Auth = await registerUser({
      username: `e2e_dev1_${timestamp.toString().slice(-4)}`,
      email: user1Email,
      password: 'TestPassword123!',
    });

    const user2Auth = await registerUser({
      username: `e2e_dev2_${timestamp.toString().slice(-4)}`,
      email: user2Email,
      password: 'TestPassword123!',
    });

    createdUser1Id = user1Auth.user.id;
    createdUser2Id = user2Auth.user.id;

    console.log(`  ✅ Registered User 1: ${user1Auth.user.username} (${user1Auth.user.id})`);
    console.log(`  ✅ Registered User 2: ${user2Auth.user.username} (${user2Auth.user.id})`);

    const loginRes = await loginUser({ email: user1Email, password: 'TestPassword123!' });
    if (!loginRes.token) throw new Error('Login failed to return token');
    console.log('  ✅ Verified login token generation.');

    // TEST 2: Problem Library & Room Infrastructure
    console.log('\n2️⃣ Testing Problem Library & Room Setup...');
    const problem = await prisma.problem.findFirst({ where: { title: 'Two Sum' } });
    if (!problem) throw new Error('Seeded problem "Two Sum" not found');

    const testRoom = await prisma.room.create({
      data: {
        name: `E2E-Workspace-${timestamp}`,
        isPrivate: false,
        language: 'javascript',
        ownerId: user1Auth.user.id,
        members: {
          create: [
            { userId: user1Auth.user.id, role: 'OWNER' },
            { userId: user2Auth.user.id, role: 'MEMBER' },
          ],
        },
      },
    });
    createdRoomId = testRoom.id;
    console.log(`  ✅ Created test room: ${testRoom.name} (${testRoom.id})`);

    // Initialize document for room
    await prisma.codeDocument.create({
      data: {
        roomId: testRoom.id,
        content: '// Initial E2E test code\nfunction twoSum(nums, target) {\n  return [0, 1];\n}\n',
        language: 'javascript',
        version: 1,
      },
    });

    // TEST 3: Multi-User Real-time Socket Connection & Room Presence
    console.log('\n3️⃣ Testing Multi-User Real-Time Socket Connection & Presence...');
    const socket1 = createClientSocket(user1Auth.token);
    const socket2 = createClientSocket(user2Auth.token);

    await Promise.all([
      new Promise<void>((res) => socket1.on('connect', res)),
      new Promise<void>((res) => socket2.on('connect', res)),
    ]);
    console.log('  ✅ Both user sockets connected successfully.');

    // Join room for both sockets
    await new Promise<void>((resolve) => {
      socket1.on(SOCKET_EVENTS.ROOM_STATE, (state: RoomStatePayload) => {
        if (state.roomId === testRoom.id) {
          console.log(`  ✅ User 1 received room state (${state.users.length} user present).`);
          resolve();
        }
      });
      socket1.emit(SOCKET_EVENTS.ROOM_JOIN, { roomId: testRoom.id });
    });

    await new Promise<void>((resolve) => {
      socket1.on(SOCKET_EVENTS.ROOM_USER_JOINED, (payload) => {
        if (payload.user.userId === user2Auth.user.id) {
          console.log(`  ✅ User 1 received presence alert: ${payload.user.username} joined.`);
          resolve();
        }
      });
      socket2.emit(SOCKET_EVENTS.ROOM_JOIN, { roomId: testRoom.id });
    });

    // TEST 4: Real-time Code Editing & Version Synchronization
    console.log('\n4️⃣ Testing Collaborative Code Editing & Sync...');
    const updatedCode = `// Modified by User 1\nfunction twoSum(nums, target) {\n  const map = new Map();\n  for (let i = 0; i < nums.length; i++) {\n    const diff = target - nums[i];\n    if (map.has(diff)) return [map.get(diff), i];\n    map.set(nums[i], i);\n  }\n  return [];\n}\n`;

    await new Promise<void>((resolve) => {
      socket2.on(SOCKET_EVENTS.EDITOR_CHANGE, (payload: EditorChangePayload) => {
        if (payload.roomId === testRoom.id && payload.content === updatedCode) {
          console.log(`  ✅ User 2 received code edit v${payload.version} from User 1 in real time.`);
          resolve();
        }
      });

      socket1.emit(SOCKET_EVENTS.EDITOR_CHANGE, {
        roomId: testRoom.id,
        content: updatedCode,
        version: 2,
      });
    });

    // TEST 5: Real-time Room Chat Message Broadcast
    console.log('\n5️⃣ Testing Real-Time Room Chat Broadcast...');
    const chatContent = 'Hello room! Ready to submit solution?';

    await new Promise<void>((resolve) => {
      socket2.on(SOCKET_EVENTS.MESSAGE_NEW, (payload: MessageNewPayload) => {
        if (payload.message.roomId === testRoom.id && payload.message.content === chatContent) {
          console.log(`  ✅ User 2 received real-time chat message from User 1.`);
          resolve();
        }
      });

      socket1.emit(SOCKET_EVENTS.MESSAGE_SEND, {
        roomId: testRoom.id,
        content: chatContent,
      });
    });

    // TEST 6: Real-time Submission Broadcast Notification
    console.log('\n6️⃣ Testing Real-Time Submission Notification Broadcast...');
    await new Promise<void>((resolve) => {
      socket2.on(SOCKET_EVENTS.SUBMISSION_COMPLETED, (payload: SubmissionCompletedPayload) => {
        if (payload.roomId === testRoom.id && payload.user.userId === user1Auth.user.id) {
          console.log(`  ✅ User 2 received real-time submission notification: Status ${payload.status}`);
          resolve();
        }
      });

      // Broadcast submission completed event via server instance
      broadcastSubmissionCompleted(testRoom.id, {
        submissionId: 'e2e-submission-1',
        roomId: testRoom.id,
        user: { userId: user1Auth.user.id, username: user1Auth.user.username },
        problemId: problem.id,
        status: 'ACCEPTED',
        passedTestCases: 2,
        totalTestCases: 2,
      });
    });

    // TEST 7: Cleanup Connections
    console.log('\n7️⃣ Cleaning up sockets & resources...');
    socket1.disconnect();
    socket2.disconnect();
    console.log('  ✅ Sockets disconnected gracefully.');

    // Wait 500ms for debounced persistence timers to conclude before deleting room
    await new Promise((r) => setTimeout(r, 500));

    console.log('\n🎉 E2E MULTI-USER INTEGRATION VERIFICATION SUITE PASSED SUCCESSFULLY!');
  } finally {
    // Post-test cleanup: delete created test artifacts
    if (createdRoomId) {
      await prisma.room.deleteMany({ where: { id: createdRoomId } });
    }
    if (createdUser1Id || createdUser2Id) {
      await prisma.user.deleteMany({
        where: { id: { in: [createdUser1Id, createdUser2Id].filter(Boolean) as string[] } },
      });
    }
    await prisma.room.deleteMany({ where: { name: { startsWith: 'E2E-Workspace' } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: 'e2e_' } } });

    httpServer.close();
    await prisma.$disconnect();
  }
}

verifyE2EFlow().catch((err) => {
  console.error('❌ E2E verification failed:', err);
  process.exit(1);
});
