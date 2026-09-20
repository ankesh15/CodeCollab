import http from 'http';
import { createApp } from '../app';
import { prisma } from '../config/db';

const app = createApp();
let server: http.Server;
let baseUrl: string;

interface TestResponse {
  status: number;
  body: {
    success?: boolean;
    message?: string;
    error?: string;
    data?: {
      problemId?: string;
      testCaseId?: string;
      status?: string;
      problem?: {
        testCases?: Array<{ id: string; isHidden?: boolean }>;
      };
      problems?: Array<{ id: string }>;
      [key: string]: unknown;
    };
  };
}

function makeRequest(
  method: string,
  path: string,
  body?: Record<string, unknown>,
  token?: string
): Promise<TestResponse> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
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
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve({ status: res.statusCode || 500, body: parsed });
          } catch {
            resolve({ status: res.statusCode || 500, body: { message: data } });
          }
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

async function verifyAdminProblemsSystem() {
  console.log('🛠️ Starting Admin Problem Management & Test Case Builder Verification...\n');

  server = app.listen(0);
  const address = server.address();
  if (typeof address === 'object' && address !== null) {
    baseUrl = `http://localhost:${address.port}`;
  } else {
    throw new Error('Failed to resolve server port');
  }

  let createdProblemId: string | null = null;
  let publicTestCaseId: string | null = null;
  let hiddenTestCaseId: string | null = null;

  try {
    const bcrypt = await import('bcrypt');
    const passwordHash = await bcrypt.hash('DevPassword123!', 10);

    // Upsert Admin User
    await prisma.user.upsert({
      where: { email: 'admin.rivera@example.com' },
      update: { role: 'ADMIN', passwordHash },
      create: {
        username: 'alex_admin',
        email: 'admin.rivera@example.com',
        passwordHash,
        role: 'ADMIN',
      },
    });

    // Upsert Normal User
    await prisma.user.upsert({
      where: { email: 'sarah.chen@example.com' },
      update: { role: 'USER', passwordHash },
      create: {
        username: 'sarah_code',
        email: 'sarah.chen@example.com',
        passwordHash,
        role: 'USER',
      },
    });

    // Authenticate Admin and User
    console.log('1️⃣ Logging in as Admin (admin.rivera@example.com)...');
    const adminLoginRes = await makeRequest('POST', '/api/auth/login', {
      email: 'admin.rivera@example.com',
      password: 'DevPassword123!',
    });
    if (adminLoginRes.status !== 200 || !adminLoginRes.body.data?.token) {
      throw new Error(`Admin login failed: ${JSON.stringify(adminLoginRes.body)}`);
    }
    const adminToken = adminLoginRes.body.data.token;
    console.log('  ✅ Admin logged in successfully.');

    console.log('2️⃣ Logging in as Normal User (sarah.chen@example.com)...');
    const userLoginRes = await makeRequest('POST', '/api/auth/login', {
      email: 'sarah.chen@example.com',
      password: 'DevPassword123!',
    });
    if (userLoginRes.status !== 200 || !userLoginRes.body.data?.token) {
      throw new Error(`User login failed: ${JSON.stringify(userLoginRes.body)}`);
    }
    const userToken = userLoginRes.body.data.token;
    console.log('  ✅ User logged in successfully.');

    // TEST 1: Unauthenticated request to /api/admin/problems
    console.log('3️⃣ Testing Unauthenticated Request to Admin Endpoint...');
    const unauthRes = await makeRequest('GET', '/api/admin/problems');
    if (unauthRes.status !== 401) {
      throw new Error(`Expected 401 Unauthorized, got: ${unauthRes.status}`);
    }
    console.log('  ✅ PASS: Unauthenticated request correctly rejected with 401.');

    // TEST 2: Normal User request to /api/admin/problems
    console.log('4️⃣ Testing Non-Admin Request to Admin Endpoint...');
    const forbiddenRes = await makeRequest('GET', '/api/admin/problems', undefined, userToken);
    if (forbiddenRes.status !== 403) {
      throw new Error(`Expected 403 Forbidden, got: ${forbiddenRes.status}`);
    }
    console.log('  ✅ PASS: Non-admin user request correctly rejected with 403 Forbidden.');

    // TEST 3: Admin request to /api/admin/problems
    console.log('5️⃣ Testing Admin Access to List Problems...');
    const adminListRes = await makeRequest('GET', '/api/admin/problems', undefined, adminToken);
    if (adminListRes.status !== 200 || !adminListRes.body.success) {
      throw new Error(`Admin list problems failed: ${JSON.stringify(adminListRes.body)}`);
    }
    console.log('  ✅ PASS: Admin successfully retrieved admin problems list (200 OK).');

    // TEST 4: Create new Draft Problem
    console.log('6️⃣ Testing Create Problem (POST /api/admin/problems)...');
    const createRes = await makeRequest(
      'POST',
      '/api/admin/problems',
      {
        title: 'Verify Matrix Spiral Traversal Test',
        difficulty: 'MEDIUM',
        externalRating: 1400,
        tags: ['matrix', 'algorithms'],
        description: 'Given an m x n matrix, return all elements in spiral order.',
        constraints: '1 <= m, n <= 100',
        inputFormat: 'Line 1: m n, followed by m lines.',
        outputFormat: 'Single line with space-separated elements.',
        status: 'DRAFT',
      },
      adminToken
    );

    if (createRes.status !== 201 || !createRes.body.data?.problemId) {
      throw new Error(`Create problem failed: ${JSON.stringify(createRes.body)}`);
    }
    createdProblemId = createRes.body.data.problemId;
    console.log(`  ✅ PASS: Created Draft Problem with ID: ${createdProblemId}`);

    // TEST 5: Add Public Test Case
    console.log('7️⃣ Testing Add Public Test Case...');
    const publicTcRes = await makeRequest(
      'POST',
      `/api/admin/problems/${createdProblemId}/test-cases`,
      {
        input: '3 3\n1 2 3\n4 5 6\n7 8 9',
        expectedOutput: '1 2 3 6 9 8 7 4 5',
        isHidden: false,
      },
      adminToken
    );
    if (publicTcRes.status !== 201 || !publicTcRes.body.data?.testCaseId) {
      throw new Error(`Add public test case failed: ${JSON.stringify(publicTcRes.body)}`);
    }
    publicTestCaseId = publicTcRes.body.data.testCaseId;
    console.log(`  ✅ PASS: Added Public test case (ID: ${publicTestCaseId}).`);

    // TEST 6: Add Hidden Test Case
    console.log('8️⃣ Testing Add Hidden Test Case...');
    const hiddenTcRes = await makeRequest(
      'POST',
      `/api/admin/problems/${createdProblemId}/test-cases`,
      {
        input: '1 1\n42',
        expectedOutput: '42',
        isHidden: true,
      },
      adminToken
    );
    if (hiddenTcRes.status !== 201 || !hiddenTcRes.body.data?.testCaseId) {
      throw new Error(`Add hidden test case failed: ${JSON.stringify(hiddenTcRes.body)}`);
    }
    hiddenTestCaseId = hiddenTcRes.body.data.testCaseId;
    console.log(`  ✅ PASS: Added Hidden test case (ID: ${hiddenTestCaseId}).`);

    // TEST 7: Ensure Draft Problem is NOT visible to public users
    console.log('9️⃣ Testing Public Problem List Excludes Drafts...');
    const publicListRes = await makeRequest('GET', '/api/problems');
    const draftFound = publicListRes.body.data?.problems?.some(
      (p) => p.id === createdProblemId
    );
    if (draftFound) {
      throw new Error('SECURITY VIOLATION: Draft problem is visible in public /api/problems!');
    }
    console.log('  ✅ PASS: Draft problem is hidden from public /api/problems list.');

    // TEST 8: Admin Details Endpoint exposes all test cases
    console.log('🔟 Testing Admin Details Endpoint exposes all test cases...');
    const adminDetailsRes = await makeRequest(
      'GET',
      `/api/admin/problems/${createdProblemId}`,
      undefined,
      adminToken
    );
    if (
      adminDetailsRes.status !== 200 ||
      adminDetailsRes.body.data?.problem?.testCases?.length !== 2
    ) {
      throw new Error(`Admin problem details test case count mismatch.`);
    }
    console.log('  ✅ PASS: Admin details endpoint returned both public and hidden test cases.');

    // TEST 9: Publish Problem
    console.log('1️⃣1️⃣ Testing Publish Problem (PATCH /api/admin/problems/:id/publish)...');
    const publishRes = await makeRequest(
      'PATCH',
      `/api/admin/problems/${createdProblemId}/publish`,
      undefined,
      adminToken
    );
    if (publishRes.status !== 200 || publishRes.body.data?.status !== 'PUBLISHED') {
      throw new Error(`Publish problem failed: ${JSON.stringify(publishRes.body)}`);
    }
    console.log('  ✅ PASS: Problem status updated to PUBLISHED.');

    // TEST 10: Published Problem IS now visible to public users
    console.log('1️⃣2️⃣ Testing Public List Includes Published Problem...');
    const publicListPublishedRes = await makeRequest('GET', '/api/problems');
    const publishedFound = publicListPublishedRes.body.data?.problems?.some(
      (p) => p.id === createdProblemId
    );
    if (!publishedFound) {
      throw new Error('Published problem should be visible in public /api/problems!');
    }
    console.log('  ✅ PASS: Published problem is now visible in public problems list.');

    // TEST 11: Public Detail Endpoint DOES NOT expose hidden test cases
    console.log('1️⃣3️⃣ Testing Public Detail Endpoint Excludes Hidden Test Cases...');
    const publicDetailRes = await makeRequest('GET', `/api/problems/${createdProblemId}`);
    if (publicDetailRes.status !== 200) {
      throw new Error(`Public detail fetch failed.`);
    }
    const publicTcs = publicDetailRes.body.data?.problem?.testCases || [];
    const hasHiddenExposed = publicTcs.some((tc) => tc.isHidden === true);
    if (hasHiddenExposed) {
      throw new Error('SECURITY VIOLATION: Hidden test cases exposed in public /api/problems/:id!');
    }
    console.log('  ✅ PASS: Public detail endpoint returned ONLY public test cases.');

    // TEST 12: Publish Validation Failure
    console.log('1️⃣4️⃣ Testing Publish Validation Failure for Empty Problem...');
    const emptyProbRes = await makeRequest(
      'POST',
      '/api/admin/problems',
      {
        title: 'Empty Incomplete Draft Problem',
        difficulty: 'EASY',
        description: 'Test description',
        status: 'DRAFT',
      },
      adminToken
    );
    const emptyProbId = emptyProbRes.body.data?.problemId;
    const failPublishRes = await makeRequest(
      'PATCH',
      `/api/admin/problems/${emptyProbId}/publish`,
      undefined,
      adminToken
    );
    if (failPublishRes.status !== 400 || failPublishRes.body.error !== 'PUBLISH_VALIDATION_FAILED') {
      throw new Error(`Publish validation check failed: ${JSON.stringify(failPublishRes.body)}`);
    }
    console.log('  ✅ PASS: Publishing problem without test cases correctly rejected with validation errors.');
    await prisma.problem.delete({ where: { id: emptyProbId } });

    // TEST 13: Deletion Protection for Problems with Submissions
    console.log('1️⃣5️⃣ Testing Historical Submission Deletion Guard...');
    const sarah = await prisma.user.findFirst({ where: { username: 'sarah_code' } });
    if (sarah && createdProblemId) {
      const dummySubmission = await prisma.submission.create({
        data: {
          problemId: createdProblemId,
          userId: sarah.id,
          language: 'CPP',
          sourceCode: '// test',
          status: 'ACCEPTED',
          executionTime: 12,
          memoryUsed: 1024,
        },
      });

      const attemptDeleteRes = await makeRequest(
        'DELETE',
        `/api/admin/problems/${createdProblemId}`,
        undefined,
        adminToken
      );
      if (
        attemptDeleteRes.status !== 400 ||
        attemptDeleteRes.body.error !== 'DEPENDENT_SUBMISSIONS_EXIST'
      ) {
        throw new Error(`Deletion guard check failed: ${JSON.stringify(attemptDeleteRes.body)}`);
      }
      console.log('  ✅ PASS: Deletion of problem with submissions correctly prevented.');

      // Clean up dummy submission
      await prisma.submission.delete({ where: { id: dummySubmission.id } });
    }

    console.log('\n🎉 ALL ADMIN PROBLEM MANAGEMENT & TEST CASE BUILDER TESTS PASSED SUCCESSFULLY!');
  } finally {
    if (createdProblemId) {
      try {
        await prisma.problem.delete({ where: { id: createdProblemId } });
      } catch (e) {
        // ignore
      }
    }
    if (server) {
      server.close();
    }
    await prisma.$disconnect();
  }
}

verifyAdminProblemsSystem().catch((err) => {
  console.error('❌ Verification script failed:', err);
  process.exit(1);
});
