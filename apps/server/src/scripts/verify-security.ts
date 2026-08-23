import http from 'http';
import { io as ioClient } from 'socket.io-client';
import { createApp } from '../app';
import { config } from '../config/env';
import { prisma } from '../config/db';
import { registerUser } from '../services/auth.service';
import { RoomRole } from '@prisma/client';
import { SOCKET_EVENTS } from '@codecollab/shared';
import { initSocketServer } from '../socket';

async function runSecurityVerification() {
  console.log('====================================================');
  console.log('   CodeCollab Phase 9 Security & Reliability Suite   ');
  console.log('====================================================\n');

  let passedTests = 0;
  const totalTests = 15;

  const app = createApp();
  const PORT = 5015;
  const httpServer = http.createServer(app);
  const ioServer = initSocketServer(httpServer);

  await new Promise<void>((resolve) => httpServer.listen(PORT, resolve));
  const baseUrl = `http://localhost:${PORT}`;

  const timestamp = Date.now();
  const userAEmail = `sec_user_a_${timestamp}@codecollab.io`;
  const userBEmail = `sec_user_b_${timestamp}@codecollab.io`;

  // Register 2 test users
  const userA = await registerUser({ email: userAEmail, password: 'Password123!', username: `sec_user_a_${timestamp}` });
  const userB = await registerUser({ email: userBEmail, password: 'Password123!', username: `sec_user_b_${timestamp}` });

  // Create a private room owned by User A
  const privateRoom = await prisma.room.create({
    data: {
      name: `Security Private Room ${timestamp}`,
      isPrivate: true,
      ownerId: userA.user.id,
      language: 'cpp',
      members: {
        create: [{ userId: userA.user.id, role: RoomRole.OWNER }],
      },
    },
  });

  try {
    // ----------------------------------------------------
    // Test 1: Operational Liveness & Database Readiness Check
    // ----------------------------------------------------
    console.log('[Test 1] Verifying /api/health and /api/ready endpoints...');
    const healthRes = await fetch(`${baseUrl}/api/health`);
    const readyRes = await fetch(`${baseUrl}/api/ready`);
    const healthData = await healthRes.json();
    const readyData = await readyRes.json();

    if (healthRes.status === 200 && readyRes.status === 200 && readyData.data?.status === 'ready') {
      console.log('✅ Test 1 Passed: Health and Readiness endpoints return 200 OK.');
      passedTests++;
    } else {
      console.error('❌ Test 1 Failed:', { healthData, readyData });
    }

    // ----------------------------------------------------
    // Test 2: Security Response Headers (Helmet)
    // ----------------------------------------------------
    console.log('[Test 2] Verifying Helmet security headers...');
    const headersRes = await fetch(`${baseUrl}/api/health`);
    const headers = headersRes.headers;
    const hasContentTypeOptions = headers.get('x-content-type-options') === 'nosniff';
    const hasFrameOptions = headers.get('x-frame-options') !== null;
    const hasRequestId = headers.get('x-request-id') !== null;

    if (hasContentTypeOptions && hasFrameOptions && hasRequestId) {
      console.log('✅ Test 2 Passed: Helmet security headers (nosniff, frameguard, X-Request-ID) present.');
      passedTests++;
    } else {
      console.error('❌ Test 2 Failed: Missing headers:', {
        noSniff: headers.get('x-content-type-options'),
        frame: headers.get('x-frame-options'),
        reqId: headers.get('x-request-id'),
      });
    }

    // ----------------------------------------------------
    // Test 3: Unauthenticated Request Rejection
    // ----------------------------------------------------
    console.log('[Test 3] Verifying 401 Unauthorized rejection for missing JWT...');
    const unauthRes = await fetch(`${baseUrl}/api/auth/me`);
    if (unauthRes.status === 401) {
      console.log('✅ Test 3 Passed: Protected endpoint rejects unauthenticated request (401).');
      passedTests++;
    } else {
      console.error(`❌ Test 3 Failed: Expected 401, got ${unauthRes.status}`);
    }

    // ----------------------------------------------------
    // Test 4: Malformed / Invalid JWT Rejection
    // ----------------------------------------------------
    console.log('[Test 4] Verifying 401 Unauthorized rejection for invalid JWT...');
    const invalidJwtRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: 'Bearer invalid_garbage_token_123' },
    });
    if (invalidJwtRes.status === 401) {
      console.log('✅ Test 4 Passed: Malformed/invalid token correctly rejected (401).');
      passedTests++;
    } else {
      console.error(`❌ Test 4 Failed: Expected 401, got ${invalidJwtRes.status}`);
    }

    // ----------------------------------------------------
    // Test 5: IDOR Protection (User B trying to access User A private room)
    // ----------------------------------------------------
    console.log('[Test 5] Verifying IDOR room authorization protection...');
    const idorRoomRes = await fetch(`${baseUrl}/api/rooms/${privateRoom.id}`, {
      headers: { Authorization: `Bearer ${userB.token}` },
    });
    if (idorRoomRes.status === 403) {
      console.log('✅ Test 5 Passed: Non-member access to private room correctly rejected (403 Forbidden).');
      passedTests++;
    } else {
      console.error(`❌ Test 5 Failed: Expected 403, got ${idorRoomRes.status}`);
    }

    // ----------------------------------------------------
    // Test 6: Sensitive Credential Leak Prevention
    // ----------------------------------------------------
    console.log('[Test 6] Verifying user DTOs never leak password hashes...');
    const profileRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${userA.token}` },
    });
    const profileData = await profileRes.json();
    const profileKeys = Object.keys(profileData.data?.user || {});
    if (!profileKeys.includes('password') && !profileKeys.includes('passwordHash')) {
      console.log('✅ Test 6 Passed: User profile response contains no password or passwordHash field.');
      passedTests++;
    } else {
      console.error('❌ Test 6 Failed: Sensitive credential fields present:', profileKeys);
    }

    // ----------------------------------------------------
    // Test 7: Body Payload Size Limit (Max 100KB)
    // ----------------------------------------------------
    console.log('[Test 7] Verifying 413 Payload Too Large rejection for oversized HTTP body...');
    const oversizedBody = JSON.stringify({ data: 'A'.repeat(150 * 1024) });
    const payloadRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: oversizedBody,
    });
    if (payloadRes.status === 413) {
      console.log('✅ Test 7 Passed: Oversized payload rejected with 413 Payload Too Large.');
      passedTests++;
    } else {
      console.error(`❌ Test 7 Failed: Expected 413, got ${payloadRes.status}`);
    }

    // ----------------------------------------------------
    // Test 8: Code Execution Unsupported Language Guard
    // ----------------------------------------------------
    console.log('[Test 8] Verifying unsupported code execution language guard...');
    const langRes = await fetch(`${baseUrl}/api/submissions/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userA.token}`,
      },
      body: JSON.stringify({
        problemId: 'non-existent-prob',
        language: 'brainfuck',
        code: '+++++.',
      }),
    });
    const langData = await langRes.json();
    if (langRes.status === 400 || langData.error === 'INVALID_INPUT' || langData.error === 'VALIDATION_FAILED') {
      console.log('✅ Test 8 Passed: Unsupported code execution language rejected cleanly.');
      passedTests++;
    } else {
      console.error('❌ Test 8 Failed:', { status: langRes.status, langData });
    }

    // ----------------------------------------------------
    // Test 9: Standardized Error Format & No Production Stack Leak
    // ----------------------------------------------------
    console.log('[Test 9] Verifying standardized error JSON shape and stack trace sanitization...');
    const errRes = await fetch(`${baseUrl}/api/non-existent-route-xyz`);
    const errData = await errRes.json();
    if (
      errRes.status === 404 &&
      errData.success === false &&
      errData.error === 'NOT_FOUND' &&
      errData.requestId &&
      !errData.stack
    ) {
      console.log('✅ Test 9 Passed: Standardized JSON error response with requestId and sanitized stack.');
      passedTests++;
    } else {
      console.error('❌ Test 9 Failed:', errData);
    }

    // ----------------------------------------------------
    // Test 10: Socket.IO Authentication Security
    // ----------------------------------------------------
    console.log('[Test 10] Verifying Socket.IO unauthenticated connection rejection...');
    const invalidSocketClient = ioClient(baseUrl, {
      auth: { token: 'invalid_socket_token' },
      transports: ['websocket'],
      reconnection: false,
    });

    const socketAuthPromise = new Promise<boolean>((resolve) => {
      invalidSocketClient.on('connect_error', (err) => {
        resolve(err.message.includes('Authentication') || err.message.includes('UNAUTHORIZED'));
      });
      invalidSocketClient.on('connect', () => resolve(false));
    });

    const isSocketRejected = await socketAuthPromise;
    invalidSocketClient.disconnect();

    if (isSocketRejected) {
      console.log('✅ Test 10 Passed: Socket.IO connection cleanly rejected invalid JWT token.');
      passedTests++;
    } else {
      console.error('❌ Test 10 Failed: Socket.IO accepted invalid JWT token.');
    }

    // ----------------------------------------------------
    // Test 11: Authorized Socket Connection & Private Channel Join
    // ----------------------------------------------------
    console.log('[Test 11] Verifying valid Socket.IO connection & user channel isolation...');
    const validSocketClient = ioClient(baseUrl, {
      auth: { token: userA.token },
      transports: ['websocket'],
      reconnection: false,
    });

    const validSocketPromise = new Promise<boolean>((resolve) => {
      validSocketClient.on('connect', () => resolve(true));
      validSocketClient.on('connect_error', () => resolve(false));
    });

    const isSocketConnected = await validSocketPromise;
    if (isSocketConnected) {
      console.log('✅ Test 11 Passed: Authenticated Socket.IO client connected successfully.');
      passedTests++;
    } else {
      console.error('❌ Test 11 Failed: Valid socket failed to connect.');
    }

    // ----------------------------------------------------
    // Test 12: Socket Chat Message Length Rejection (>2000 chars)
    // ----------------------------------------------------
    console.log('[Test 12] Verifying Socket.IO chat message length limit validation...');
    const oversizedMessage = 'M'.repeat(2500);
    const msgLenPromise = new Promise<boolean>((resolve) => {
      validSocketClient.on(SOCKET_EVENTS.ERROR, (err: { code: string }) => {
        if (err.code === 'PAYLOAD_TOO_LARGE') resolve(true);
      });
      validSocketClient.emit(SOCKET_EVENTS.MESSAGE_SEND, {
        roomId: privateRoom.id,
        content: oversizedMessage,
      });
    });

    const isMsgSizeRejected = await msgLenPromise;
    if (isMsgSizeRejected) {
      console.log('✅ Test 12 Passed: Oversized socket chat message (>2000 chars) rejected with PAYLOAD_TOO_LARGE.');
      passedTests++;
    } else {
      console.error('❌ Test 12 Failed: Oversized message was not rejected.');
    }

    // ----------------------------------------------------
    // Test 13: Socket Chat Spam Guard (<300ms)
    // ----------------------------------------------------
    console.log('[Test 13] Verifying Socket.IO chat spam guard...');
    let rateLimitedReceived = false;
    validSocketClient.on(SOCKET_EVENTS.ERROR, (err: { code: string }) => {
      if (err.code === 'RATE_LIMITED') {
        rateLimitedReceived = true;
      }
    });

    // Rapidly emit 2 messages in 10ms
    validSocketClient.emit(SOCKET_EVENTS.MESSAGE_SEND, { roomId: privateRoom.id, content: 'Spam 1' });
    validSocketClient.emit(SOCKET_EVENTS.MESSAGE_SEND, { roomId: privateRoom.id, content: 'Spam 2' });

    await new Promise((r) => setTimeout(r, 200));

    if (rateLimitedReceived) {
      console.log('✅ Test 13 Passed: Rapid socket chat emits triggered RATE_LIMITED guard.');
      passedTests++;
    } else {
      console.error('❌ Test 13 Failed: Rapid socket emits were not rate-limited.');
    }

    validSocketClient.disconnect();

    // ----------------------------------------------------
    // Test 14: Rate Limiter Enforcement on Auth Endpoints
    // ----------------------------------------------------
    console.log('[Test 14] Verifying HTTP rate limiter enforcement (429 Too Many Requests)...');
    let got429 = false;

    // Send requests to auth login
    for (let i = 0; i < 20; i++) {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userAEmail, password: 'WrongPassword' }),
      });
      if (res.status === 429) {
        got429 = true;
        break;
      }
    }

    if (got429) {
      console.log('✅ Test 14 Passed: Auth rate limiter triggered 429 Too Many Requests.');
      passedTests++;
    } else {
      console.error('❌ Test 14 Failed: 20 rapid login attempts were not rate-limited to 429.');
    }

    // ----------------------------------------------------
    // Test 15: Graceful Environment Safety Check
    // ----------------------------------------------------
    console.log('[Test 15] Verifying environment safety configuration object...');
    if (config.port && config.databaseUrl && config.jwtSecret && config.codeRunnerUrl) {
      console.log('✅ Test 15 Passed: Config object successfully validated required environment parameters.');
      passedTests++;
    } else {
      console.error('❌ Test 15 Failed: Config missing required variables:', config);
    }
  } catch (err) {
    console.error('❌ Security verification execution error:', err);
  } finally {
    // Cleanup
    await prisma.room.deleteMany({ where: { id: privateRoom.id } });
    await prisma.user.deleteMany({
      where: { email: { in: [userAEmail, userBEmail] } },
    });
    ioServer.close();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  }

  console.log('\n====================================================');
  console.log(`   Verification Summary: ${passedTests}/${totalTests} Passed   `);
  console.log('====================================================');

  if (passedTests === totalTests) {
    console.log('🎉 PHASE 9 SECURITY & RELIABILITY VERIFICATION SUCCESSFUL!');
    process.exit(0);
  } else {
    console.error('❌ PHASE 9 SECURITY VERIFICATION FAILED.');
    process.exit(1);
  }
}

runSecurityVerification();
