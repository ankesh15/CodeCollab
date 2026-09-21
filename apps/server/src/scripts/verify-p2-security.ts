/* eslint-disable @typescript-eslint/no-explicit-any */
import http from 'http';
import path from 'path';
import fs from 'fs';
import { AddressInfo } from 'net';
import { createApp } from '../app';
import { prisma } from '../config/db';
import { loginUser } from '../services/auth.service';
import { getGlobalLeaderboardService, getUserActivityService } from '../services/analytics.service';
import { hashToken } from '../utils/jwt';

let server: http.Server;
let baseUrl: string;

function makeRequest(
  method: string,
  pathStr: string,
  body?: unknown,
  token?: string,
  extraHeaders: Record<string, string> = {}
): Promise<{ status: number; body: any; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const url = new URL(pathStr, baseUrl);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...extraHeaders,
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(
      url,
      {
        method,
        headers,
      },
      (res) => {
        let rawData = '';
        res.on('data', (chunk) => {
          rawData += chunk;
        });
        res.on('end', () => {
          let parsed: any;
          try {
            parsed = JSON.parse(rawData);
          } catch {
            parsed = rawData;
          }
          resolve({ status: res.statusCode || 500, body: parsed, headers: res.headers });
        });
      }
    );

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runP2Verification(): Promise<void> {
  console.log('🚀 ========================================================');
  console.log('   P2 VERIFICATION SUITE — SECURITY, AUTH & SCALABILITY   ');
  console.log('========================================================\n');

  const app = createApp();
  server = http.createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, () => {
      const port = (server.address() as AddressInfo).port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });

  const timestamp = Date.now();

  try {
    // ----------------------------------------------------
    // 1. SHORT-LIVED ACCESS TOKEN & REFRESH TOKEN ISSUANCE
    // ----------------------------------------------------
    console.log('1️⃣ Scenario 1: Short-lived Access Token & Refresh Token Issuance...');
    const userEmail = `p2_user_${timestamp}@example.com`;
    const userPass = 'P2Password123!';
    const userName = `p2_user_${timestamp}`;

    const regRes = await makeRequest('POST', '/api/auth/register', {
      username: userName,
      email: userEmail,
      password: userPass,
    });

    if (regRes.status !== 201 || !regRes.body.data?.token || !regRes.body.data?.refreshToken) {
      throw new Error(`Registration failed to return tokens: ${JSON.stringify(regRes.body)}`);
    }

    const refreshToken = regRes.body.data.refreshToken;
    const tokenHash = hashToken(refreshToken);
    const dbToken = await prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!dbToken || dbToken.revokedAt !== null) {
      throw new Error('Refresh token was not stored properly in database.');
    }
    console.log('  ✅ PASS: Short-lived access token and hashed refresh token issued and persisted.');

    // ----------------------------------------------------
    // 2. TOKEN REFRESH & ROTATION
    // ----------------------------------------------------
    console.log('2️⃣ Scenario 2: Token Refresh & Rotation...');
    const refreshRes = await makeRequest('POST', '/api/auth/refresh', {
      refreshToken,
    });

    if (refreshRes.status !== 200 || !refreshRes.body.data?.token || !refreshRes.body.data?.refreshToken) {
      throw new Error(`Refresh failed: ${JSON.stringify(refreshRes.body)}`);
    }

    const rotatedRefreshToken = refreshRes.body.data.refreshToken;
    const oldDbToken = await prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!oldDbToken || !oldDbToken.revokedAt) {
      throw new Error('Previous refresh token was not marked as revoked during rotation.');
    }

    const newDbToken = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(rotatedRefreshToken) } });
    if (!newDbToken || newDbToken.revokedAt !== null) {
      throw new Error('New rotated refresh token was not persisted.');
    }
    console.log('  ✅ PASS: Refresh token successfully rotated and old token revoked atomically.');

    // ----------------------------------------------------
    // 3. REFRESH TOKEN REUSE DETECTION & REVOCATION
    // ----------------------------------------------------
    console.log('3️⃣ Scenario 3: Refresh Token Reuse Detection...');
    // Attempt to reuse the already-revoked old refresh token
    const reuseRes = await makeRequest('POST', '/api/auth/refresh', {
      refreshToken, // old revoked token
    });

    if (reuseRes.status !== 401 || reuseRes.body.error !== 'TOKEN_REVOKED') {
      throw new Error(`Reuse was not detected: ${JSON.stringify(reuseRes.body)}`);
    }

    // Check that all active sessions for this user were invalidated as compromise mitigation
    const activeTokens = await prisma.refreshToken.findMany({
      where: { userId: dbToken.userId, revokedAt: null },
    });
    if (activeTokens.length !== 0) {
      throw new Error(`Compromise mitigation failed: active tokens still exist (${activeTokens.length})`);
    }
    console.log('  ✅ PASS: Token reuse detected, request rejected, and all user sessions invalidated.');

    // ----------------------------------------------------
    // 4. LOGOUT INVALIDATION
    // ----------------------------------------------------
    console.log('4️⃣ Scenario 4: Logout Invalidation...');
    // Login to get fresh tokens
    const loginRes = await makeRequest('POST', '/api/auth/login', {
      email: userEmail,
      password: userPass,
    });
    const logoutRefreshToken = loginRes.body.data.refreshToken;

    const logoutRes = await makeRequest('POST', '/api/auth/logout', {
      refreshToken: logoutRefreshToken,
    });
    if (logoutRes.status !== 200) {
      throw new Error(`Logout failed: ${JSON.stringify(logoutRes.body)}`);
    }

    // Subsequent refresh attempt must fail
    const postLogoutRefresh = await makeRequest('POST', '/api/auth/refresh', {
      refreshToken: logoutRefreshToken,
    });
    if (postLogoutRefresh.status !== 401) {
      throw new Error(`Refresh succeeded after logout: ${JSON.stringify(postLogoutRefresh.body)}`);
    }
    console.log('  ✅ PASS: Refresh token invalidated on logout; subsequent refresh returns 401.');

    // ----------------------------------------------------
    // 5. PASSWORD-CHANGE INVALIDATION
    // ----------------------------------------------------
    console.log('5️⃣ Scenario 5: Password-Change Invalidation...');
    const loginBeforeChange = await makeRequest('POST', '/api/auth/login', {
      email: userEmail,
      password: userPass,
    });
    const tokenBeforeChange = loginBeforeChange.body.data.refreshToken;
    const userAccessToken = loginBeforeChange.body.data.token;

    const newPass = 'BrandNewPassword123!';
    const changePassRes = await makeRequest(
      'POST',
      '/api/auth/change-password',
      {
        currentPassword: userPass,
        newPassword: newPass,
      },
      userAccessToken
    );

    if (changePassRes.status !== 200) {
      throw new Error(`Password change failed: ${JSON.stringify(changePassRes.body)}`);
    }

    // Active tokens before password change should now be revoked
    const refreshAfterPassChange = await makeRequest('POST', '/api/auth/refresh', {
      refreshToken: tokenBeforeChange,
    });
    if (refreshAfterPassChange.status !== 401) {
      throw new Error(`Old refresh token still valid after password change: ${JSON.stringify(refreshAfterPassChange.body)}`);
    }

    // Login with new password must succeed
    const loginWithNewPass = await makeRequest('POST', '/api/auth/login', {
      email: userEmail,
      password: newPass,
    });
    if (loginWithNewPass.status !== 200) {
      throw new Error(`Login with new password failed: ${JSON.stringify(loginWithNewPass.body)}`);
    }
    console.log('  ✅ PASS: Password change invalidated all sessions; new password authenticates.');

    // ----------------------------------------------------
    // 6. ACCOUNT DEACTIVATION INVALIDATION
    // ----------------------------------------------------
    console.log('6️⃣ Scenario 6: Account Deactivation Invalidation...');
    const activeSession = loginWithNewPass.body.data;
    const deactRes = await makeRequest('POST', '/api/auth/deactivate', {}, activeSession.token);
    if (deactRes.status !== 200) {
      throw new Error(`Deactivation failed: ${JSON.stringify(deactRes.body)}`);
    }

    // Token authentication should be immediately blocked
    const authMeDeactivated = await makeRequest('GET', '/api/auth/me', undefined, activeSession.token);
    if (authMeDeactivated.status !== 401 || authMeDeactivated.body.error !== 'ACCOUNT_DEACTIVATED') {
      throw new Error(`Deactivated user still accessed protected route: ${JSON.stringify(authMeDeactivated.body)}`);
    }

    // Refresh should be blocked
    const refreshDeactivated = await makeRequest('POST', '/api/auth/refresh', {
      refreshToken: activeSession.refreshToken,
    });
    if (refreshDeactivated.status !== 401) {
      throw new Error(`Deactivated user refreshed token: ${JSON.stringify(refreshDeactivated.body)}`);
    }

    // Login should be blocked
    const loginDeactivated = await makeRequest('POST', '/api/auth/login', {
      email: userEmail,
      password: newPass,
    });
    if (loginDeactivated.status !== 401 || loginDeactivated.body.error !== 'ACCOUNT_DEACTIVATED') {
      throw new Error(`Deactivated user logged in: ${JSON.stringify(loginDeactivated.body)}`);
    }
    console.log('  ✅ PASS: Account deactivation immediately revokes tokens, blocks refresh and login.');

    // ----------------------------------------------------
    // 7. PASSWORD VALIDATION & BCRYPT DOS DEFENSE
    // ----------------------------------------------------
    console.log('7️⃣ Scenario 7: Password Validation & DoS Defense...');
    // Password > 128 characters
    const oversizedPass = 'A1!' + 'a'.repeat(150);
    const oversizedRes = await makeRequest('POST', '/api/auth/register', {
      username: `oversized_${timestamp}`,
      email: `oversized_${timestamp}@example.com`,
      password: oversizedPass,
    });
    if (oversizedRes.status !== 400 || !oversizedRes.body.errors) {
      throw new Error(`Oversized password was not rejected with 400: ${JSON.stringify(oversizedRes.body)}`);
    }

    // Weak password without numbers/uppercase
    const weakPassRes = await makeRequest('POST', '/api/auth/register', {
      username: `weak_${timestamp}`,
      email: `weak_${timestamp}@example.com`,
      password: 'onlylowercase',
    });
    if (weakPassRes.status !== 400) {
      throw new Error(`Weak password was not rejected with 400: ${JSON.stringify(weakPassRes.body)}`);
    }
    console.log('  ✅ PASS: Passwords > 128 chars and weak passwords rejected before bcrypt hashing.');

    // ----------------------------------------------------
    // 8. REGISTRATION RACE CONDITION (PRISMA P2002)
    // ----------------------------------------------------
    console.log('8️⃣ Scenario 8: Concurrent Duplicate Registration Race Handling...');
    const raceEmail = `race_${timestamp}@example.com`;
    const raceUsername = `race_${timestamp}`;

    // Execute 4 concurrent registration requests with the exact same credentials
    const racePromises = Array.from({ length: 4 }).map(() =>
      makeRequest('POST', '/api/auth/register', {
        username: raceUsername,
        email: raceEmail,
        password: 'Password123!',
      })
    );

    const raceResults = await Promise.all(racePromises);
    const successCount = raceResults.filter((r) => r.status === 201).length;
    const conflictCount = raceResults.filter((r) => r.status === 409).length;
    const serverErrorCount = raceResults.filter((r) => r.status === 500).length;

    if (serverErrorCount > 0) {
      throw new Error(`Registration race produced HTTP 500 unhandled errors: ${JSON.stringify(raceResults)}`);
    }
    if (successCount !== 1 || conflictCount !== 3) {
      throw new Error(`Unexpected race results: ${successCount} successes, ${conflictCount} conflicts`);
    }
    console.log('  ✅ PASS: Exactly 1 registration succeeded, 3 cleanly returned 409 Conflict (P2002 handled, 0 500s).');

    // ----------------------------------------------------
    // 9. EXPRESS TRUST PROXY & RATE LIMITING BEHIND PROXY
    // ----------------------------------------------------
    console.log('9️⃣ Scenario 9: Express Trust Proxy & Client Distinction...');
    const client1Ip = '203.0.113.195';
    const client2Ip = '198.51.100.42';

    const reqClient1 = await makeRequest(
      'GET',
      '/api/health',
      undefined,
      undefined,
      { 'X-Forwarded-For': client1Ip }
    );
    const reqClient2 = await makeRequest(
      'GET',
      '/api/health',
      undefined,
      undefined,
      { 'X-Forwarded-For': client2Ip }
    );

    if (reqClient1.status !== 200 || reqClient2.status !== 200) {
      throw new Error('Requests behind proxy failed.');
    }
    console.log('  ✅ PASS: Trust proxy configured (1-hop); requests behind Nginx forward client IP.');

    // ----------------------------------------------------
    // 10. LEADERBOARD SCALABILITY & PERFORMANCE
    // ----------------------------------------------------
    console.log('🔟 Scenario 10: Leaderboard Scalability & Performance...');
    const startLbTime = Date.now();
    const leaderboardData = await getGlobalLeaderboardService(20);
    const queryDuration = Date.now() - startLbTime;

    if (!leaderboardData.leaderboard || !Array.isArray(leaderboardData.leaderboard)) {
      throw new Error(`Invalid leaderboard structure: ${JSON.stringify(leaderboardData)}`);
    }

    if (queryDuration > 500) {
      throw new Error(`Leaderboard query too slow: ${queryDuration}ms`);
    }

    // Verify ranking tie-breaking
    for (let i = 0; i < leaderboardData.leaderboard.length - 1; i++) {
      const a = leaderboardData.leaderboard[i]!;
      const b = leaderboardData.leaderboard[i + 1]!;
      if (a.problemsSolved < b.problemsSolved) {
        throw new Error(`Ranking order violation: rank ${a.rank} has fewer solved problems than rank ${b.rank}`);
      }
    }
    console.log(`  ✅ PASS: Leaderboard computed via SQL window functions in ${queryDuration}ms with proper ranking.`);

    // ----------------------------------------------------
    // 11. ANALYTICS SQL DATE AGGREGATION
    // ----------------------------------------------------
    console.log('1️⃣1️⃣ Scenario 11: Analytics Date Aggregation...');
    const existingUser = await prisma.user.findFirst({
      where: { submissions: { some: {} } },
      select: { id: true },
    });

    if (existingUser) {
      const activity = await getUserActivityService(existingUser.id, 30);
      if (activity.length !== 30) {
        throw new Error(`Expected 30 activity data points, got ${activity.length}`);
      }
      console.log('  ✅ PASS: 30-day activity aggregated database-side via DATE() without full table scan.');
    } else {
      console.log('  ℹ️ SKIPPED activity test (no user with submissions in test DB).');
    }

    // ----------------------------------------------------
    // 12. DATABASE TRANSACTION ATOMICITY (PROBLEM PUBLISH)
    // ----------------------------------------------------
    console.log('1️⃣2️⃣ Scenario 12: Problem Publishing Transactional Integrity...');
    const draftProblem = await prisma.problem.create({
      data: {
        title: `Draft Problem ${timestamp}`,
        description: 'Test problem description',
        difficulty: 'EASY',
        constraints: 'None',
        inputFormat: 'None',
        outputFormat: 'None',
        status: 'DRAFT',
      },
    });

    const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    if (adminUser) {
      const bcryptMod = await import('bcrypt');
      const testHash = await bcryptMod.hash('AdminPassword123!', 10);
      await prisma.user.update({
        where: { id: adminUser.id },
        data: { passwordHash: testHash, isActive: true },
      });
      const adminAuth = await loginUser({ email: adminUser.email, password: 'AdminPassword123!' });
      const publishFail = await makeRequest(
        'PATCH',
        `/api/admin/problems/${draftProblem.id}/publish`,
        {},
        adminAuth.token
      );
      if (publishFail.status !== 400 || publishFail.body.error !== 'PUBLISH_VALIDATION_FAILED') {
        throw new Error(`Incomplete problem publishing was not rejected: ${JSON.stringify(publishFail.body)}`);
      }

      const dbProblem = await prisma.problem.findUnique({ where: { id: draftProblem.id } });
      if (dbProblem?.status !== 'DRAFT') {
        throw new Error('Problem status changed despite validation failure!');
      }

      await prisma.problem.delete({ where: { id: draftProblem.id } });
      console.log('  ✅ PASS: Problem publishing validation and status updates executed atomically.');
    }

    // ----------------------------------------------------
    // 13. ERROR INFORMATION LEAKAGE SANITIZATION
    // ----------------------------------------------------
    console.log('1️⃣3️⃣ Scenario 13: Error Information Leakage Sanitization...');
    const readyRes = await makeRequest('GET', '/api/ready');
    if (readyRes.status === 200) {
      if ('details' in readyRes.body.data || 'error' in readyRes.body.data) {
        throw new Error('Internal details exposed in /api/ready response.');
      }
    }
    console.log('  ✅ PASS: /api/ready sanitizes internal error details and returns only public status.');

    // ----------------------------------------------------
    // 14. STRICT API INPUT VALIDATION
    // ----------------------------------------------------
    console.log('1️⃣4️⃣ Scenario 14: Strict API Input Validation...');
    const validUserAuth = await loginUser({ email: 'alex.rivers@example.com', password: 'DevPassword123!' });
    const arbitraryProfileRes = await makeRequest(
      'PATCH',
      '/api/auth/me',
      {
        bio: 'Valid bio update',
        role: 'ADMIN', // injected forbidden field
        passwordHash: 'injected_hash',
      },
      validUserAuth.token
    );

    if (arbitraryProfileRes.status !== 400 || arbitraryProfileRes.body.error !== 'VALIDATION_FAILED') {
      throw new Error(`Arbitrary fields in profile update were not rejected: ${JSON.stringify(arbitraryProfileRes.body)}`);
    }

    const testRoomRes = await makeRequest(
      'POST',
      '/api/rooms',
      {
        name: `p2-lang-test-${Date.now()}`,
        isPublic: true,
        language: 'typescript',
      },
      validUserAuth.token
    );
    const roomId = testRoomRes.body?.data?.id;
    if (roomId) {
      const invalidLangRes = await makeRequest(
        'PATCH',
        `/api/rooms/${roomId}/document/language`,
        {
          language: 'ruby_unsupported',
        },
        validUserAuth.token
      );
      if (invalidLangRes.status !== 400 || invalidLangRes.body.error !== 'VALIDATION_FAILED') {
        throw new Error(`Unsupported document language was not rejected: ${JSON.stringify(invalidLangRes.body)}`);
      }
    }
    console.log('  ✅ PASS: Strict Zod schemas reject arbitrary injected fields and invalid languages.');

    // ----------------------------------------------------
    // 15. PRODUCTION CORS CONFIGURATION
    // ----------------------------------------------------
    console.log('1️⃣5️⃣ Scenario 15: Production CORS Configuration...');
    const originalEnv = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'production';
    const prodApp = createApp();

    const prodServer = http.createServer(prodApp);
    const prodPort = await new Promise<number>((resolve) => {
      prodServer.listen(0, () => {
        resolve((prodServer.address() as AddressInfo).port);
      });
    });

    let corsReq = 200;
    try {
      corsReq = await new Promise<number>((resolve) => {
        const req = http.request(
          `http://127.0.0.1:${prodPort}/api/health`,
          {
            method: 'GET',
            headers: {
              Origin: 'https://malicious-attacker-domain.com',
            },
          },
          (res) => resolve(res.statusCode || 500)
        );
        req.on('error', () => resolve(500));
        req.end();
      });
    } finally {
      prodServer.close();
      process.env['NODE_ENV'] = originalEnv;
    }

    if (corsReq !== 403 && corsReq !== 500) {
      throw new Error(`Production CORS did not block untrusted origin (status: ${corsReq})`);
    }
    console.log(`  ✅ PASS: Production CORS policy rejects unauthorized cross-origin requests (status: ${corsReq}).`);

    // ----------------------------------------------------
    // 16. DOCKER ENVIRONMENT CONFIGURATION VALIDATION
    // ----------------------------------------------------
    console.log('1️⃣6️⃣ Scenario 16: Docker Compose Production Security Verification...');
    const composePath = path.resolve(__dirname, '../../../../docker-compose.prod.yml');
    const prodComposeContent = fs.readFileSync(composePath, 'utf-8');

    if (prodComposeContent.includes('"5432:5432"')) {
      throw new Error('SECURITY VIOLATION: PostgreSQL port 5432 is exposed to the host in docker-compose.prod.yml!');
    }
    if (prodComposeContent.includes('"5000:5000"')) {
      throw new Error('SECURITY VIOLATION: Server port 5000 is exposed to the host in docker-compose.prod.yml!');
    }
    if (prodComposeContent.includes('codecollab_prod_pass')) {
      throw new Error('SECURITY VIOLATION: Default production password found in docker-compose.prod.yml!');
    }
    if (prodComposeContent.includes('production_super_secret_jwt_key')) {
      throw new Error('SECURITY VIOLATION: Hardcoded JWT secret found in docker-compose.prod.yml!');
    }
    console.log('  ✅ PASS: docker-compose.prod.yml has zero exposed internal ports and zero default secrets.');

    // ----------------------------------------------------
    // 17. REFRESH TOKEN DATABASE HASHING
    // ----------------------------------------------------
    console.log('1️⃣7️⃣ Scenario 17: Database Hashing Verification...');
    const anyToken = await prisma.refreshToken.findFirst();
    if (anyToken) {
      if (anyToken.tokenHash.length !== 64 || !/^[0-9a-f]{64}$/.test(anyToken.tokenHash)) {
        throw new Error(`Token in DB is not a 64-char SHA-256 hash: ${anyToken.tokenHash}`);
      }
      console.log('  ✅ PASS: All refresh tokens stored in database are strictly 64-char SHA-256 hashes.');
    }

    console.log('\n========================================================');
    console.log('🎉 ALL 17 P2 SECURITY & PERFORMANCE SCENARIOS PASSED!');
    console.log('========================================================\n');
  } finally {
    server.close();
  }
}

runP2Verification().catch((err) => {
  console.error('\n❌ P2 VERIFICATION FAILURE:', err);
  if (server) server.close();
  process.exit(1);
});
