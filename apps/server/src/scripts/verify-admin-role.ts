import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import http from 'http';

const prisma = new PrismaClient();
const API_PORT = process.env['PORT'] || 5000;
const BASE_URL = `http://localhost:${API_PORT}`;

interface HttpResponse {
  status: number;
  body: any;
}

function makeRequest(
  method: string,
  path: string,
  body?: any,
  token?: string
): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const payload = body ? JSON.stringify(body) : null;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (payload) {
      headers['Content-Length'] = Buffer.byteLength(payload).toString();
    }

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
        let responseData = '';
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        res.on('end', () => {
          try {
            const parsed = responseData ? JSON.parse(responseData) : {};
            resolve({ status: res.statusCode || 500, body: parsed });
          } catch {
            resolve({ status: res.statusCode || 500, body: { raw: responseData } });
          }
        });
      }
    );

    req.on('error', (err) => {
      reject(err);
    });

    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

async function verifyAdminRoleSystem() {
  console.log('🛡️ Starting Final Admin Role & Security Verification Suite...\n');

  let testProblemId: string | null = null;

  try {
    const passwordHash = await bcrypt.hash('DevPassword123!', 10);
    const adminPasswordHash = await bcrypt.hash('AdminPassword123!', 10);

    // 0. Ensure Test Accounts Exist
    await prisma.user.upsert({
      where: { email: 'admin@codecollab.dev' },
      update: { role: 'ADMIN', passwordHash: adminPasswordHash },
      create: {
        username: 'admin',
        email: 'admin@codecollab.dev',
        passwordHash: adminPasswordHash,
        role: 'ADMIN',
      },
    });

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

    // 1. Authenticate Normal User
    console.log('1️⃣ Authenticating Normal User (sarah.chen@example.com)...');
    const userLoginRes = await makeRequest('POST', '/api/auth/login', {
      email: 'sarah.chen@example.com',
      password: 'DevPassword123!',
    });
    if (userLoginRes.status !== 200 || !userLoginRes.body.data?.token) {
      throw new Error(`Normal user login failed: ${JSON.stringify(userLoginRes.body)}`);
    }
    const userToken = userLoginRes.body.data.token;
    const userPayloadRole = userLoginRes.body.data.user.role;
    if (userPayloadRole !== 'USER') {
      throw new Error(`Expected role 'USER' for normal user, got '${userPayloadRole}'`);
    }
    console.log('  ✅ PASS: Normal user authenticated with role USER.\n');

    // 2. Authenticate Admin User
    console.log('2️⃣ Authenticating Admin User (admin)...');
    const adminLoginRes = await makeRequest('POST', '/api/auth/login', {
      email: 'admin',
      password: 'AdminPassword123!',
    });
    if (adminLoginRes.status !== 200 || !adminLoginRes.body.data?.token) {
      throw new Error(`Admin user login failed: ${JSON.stringify(adminLoginRes.body)}`);
    }
    const adminToken = adminLoginRes.body.data.token;
    const adminPayloadRole = adminLoginRes.body.data.user.role;
    if (adminPayloadRole !== 'ADMIN') {
      throw new Error(`Expected role 'ADMIN' for admin user, got '${adminPayloadRole}'`);
    }
    console.log('  ✅ PASS: Admin user authenticated with role ADMIN.\n');

    // 3. Normal User Accessing Admin API → 403 Forbidden
    console.log('3️⃣ Testing Normal User Accessing Admin API (GET /api/admin/problems)...');
    const userAdminRes = await makeRequest('GET', '/api/admin/problems', undefined, userToken);
    if (userAdminRes.status !== 403) {
      throw new Error(`Expected 403 Forbidden for normal user, got ${userAdminRes.status}`);
    }
    console.log('  ✅ PASS: Normal user access to /api/admin/problems rejected with 403 Forbidden.\n');

    // 4. Admin Accessing Admin API → 200 OK
    console.log('4️⃣ Testing Admin User Accessing Admin API (GET /api/admin/problems)...');
    const adminAdminRes = await makeRequest('GET', '/api/admin/problems', undefined, adminToken);
    if (adminAdminRes.status !== 200) {
      throw new Error(`Expected 200 OK for admin user, got ${adminAdminRes.status}`);
    }
    console.log('  ✅ PASS: Admin user access to /api/admin/problems granted with 200 OK.\n');

    // 5. Normal User Accessing Public Problems → 200 OK
    console.log('5️⃣ Testing Normal User Accessing Public Problems (GET /api/problems)...');
    const userPublicRes = await makeRequest('GET', '/api/problems', undefined, userToken);
    if (userPublicRes.status !== 200) {
      throw new Error(`Expected 200 OK for normal user accessing /api/problems, got ${userPublicRes.status}`);
    }
    console.log('  ✅ PASS: Normal user can browse public problems.\n');

    // 6. Admin Accessing Public Problems → 200 OK
    console.log('6️⃣ Testing Admin User Accessing Public Problems (GET /api/problems)...');
    const adminPublicRes = await makeRequest('GET', '/api/problems', undefined, adminToken);
    if (adminPublicRes.status !== 200) {
      throw new Error(`Expected 200 OK for admin user accessing /api/problems, got ${adminPublicRes.status}`);
    }
    console.log('  ✅ PASS: Admin user can browse public problems.\n');

    // 7. Normal User Attempting to Create Problem → 403 Forbidden
    console.log('7️⃣ Testing Normal User Creating Problem (POST /api/admin/problems)...');
    const userCreateRes = await makeRequest(
      'POST',
      '/api/admin/problems',
      {
        title: 'Unauthorized Problem',
        difficulty: 'EASY',
        description: 'Testing permissions',
      },
      userToken
    );
    if (userCreateRes.status !== 403) {
      throw new Error(`Expected 403 Forbidden for normal user creating problem, got ${userCreateRes.status}`);
    }
    console.log('  ✅ PASS: Normal user problem creation rejected with 403 Forbidden.\n');

    // 8. Admin Creating Problem → 201 Created
    console.log('8️⃣ Testing Admin Creating Problem (POST /api/admin/problems)...');
    const adminCreateRes = await makeRequest(
      'POST',
      '/api/admin/problems',
      {
        title: `Role Verification Draft ${Date.now()}`,
        difficulty: 'MEDIUM',
        description: 'Problem created to verify status visibility and permissions.',
      },
      adminToken
    );
    if (adminCreateRes.status !== 201 || !adminCreateRes.body.data?.problemId) {
      throw new Error(`Admin problem creation failed: ${JSON.stringify(adminCreateRes.body)}`);
    }
    testProblemId = adminCreateRes.body.data.problemId as string;
    console.log(`  ✅ PASS: Admin successfully created Draft Problem (ID: ${testProblemId}).\n`);

    // 9. Verify Draft Problem is Hidden from Normal User Public List
    console.log('9️⃣ Testing Draft Problem Visibility in Public Library...');
    const publicListAfterDraft = await makeRequest('GET', '/api/problems', undefined, userToken);
    const foundDraft = (publicListAfterDraft.body.data?.problems || []).find(
      (p: any) => p.id === testProblemId
    );
    if (foundDraft) {
      throw new Error('Draft problem is incorrectly visible to normal user in public list!');
    }
    console.log('  ✅ PASS: Draft problem is hidden from normal user in public library.\n');

    // 10. Normal User Attempting to Add Test Case → 403 Forbidden
    console.log('🔟 Testing Normal User Adding Test Case...');
    const userAddTcRes = await makeRequest(
      'POST',
      `/api/admin/problems/${testProblemId}/test-cases`,
      { input: '1 2', expectedOutput: '3', isHidden: false },
      userToken
    );
    if (userAddTcRes.status !== 403) {
      throw new Error(`Expected 403 Forbidden for normal user adding test case, got ${userAddTcRes.status}`);
    }
    console.log('  ✅ PASS: Normal user adding test case rejected with 403 Forbidden.\n');

    // Add Required Test Cases via Admin
    await makeRequest(
      'POST',
      `/api/admin/problems/${testProblemId}/test-cases`,
      { input: '1 2', expectedOutput: '3', isHidden: false },
      adminToken
    );

    await makeRequest(
      'POST',
      `/api/admin/problems/${testProblemId}/test-cases`,
      { input: '10 20', expectedOutput: '30', isHidden: true },
      adminToken
    );

    // 11. Normal User Attempting to Publish Problem → 403 Forbidden
    console.log('1️⃣1️⃣ Testing Normal User Publishing Problem...');
    const userPubRes = await makeRequest(
      'PATCH',
      `/api/admin/problems/${testProblemId}/publish`,
      undefined,
      userToken
    );
    if (userPubRes.status !== 403) {
      throw new Error(`Expected 403 Forbidden for normal user publishing problem, got ${userPubRes.status}`);
    }
    console.log('  ✅ PASS: Normal user publishing problem rejected with 403 Forbidden.\n');

    // 12. Admin Publishing Problem → 200 OK
    console.log('1️⃣2️⃣ Testing Admin Publishing Problem...');
    const adminPubRes = await makeRequest(
      'PATCH',
      `/api/admin/problems/${testProblemId}/publish`,
      undefined,
      adminToken
    );
    if (adminPubRes.status !== 200 || adminPubRes.body.data?.status !== 'PUBLISHED') {
      throw new Error(`Admin publishing problem failed: ${JSON.stringify(adminPubRes.body)}`);
    }
    console.log('  ✅ PASS: Admin successfully published problem.\n');

    // 13. Verify Published Problem is Visible to Normal User Public List
    console.log('1️⃣3️⃣ Testing Published Problem Visibility to Normal User...');
    const publicListAfterPub = await makeRequest('GET', '/api/problems', undefined, userToken);
    const foundPublished = (publicListAfterPub.body.data?.problems || []).find(
      (p: any) => p.id === testProblemId
    );
    if (!foundPublished) {
      throw new Error('Published problem is NOT visible to normal user in public list!');
    }
    console.log('  ✅ PASS: Published problem is visible to normal user in public library.\n');

    console.log('🎉 ALL 13 ADMIN ROLE & SECURITY VERIFICATION TESTS PASSED SUCCESSFULLY!\n');
  } catch (err) {
    console.error('❌ Role Security Verification failed:', err);
    process.exit(1);
  } finally {
    if (testProblemId) {
      await prisma.testCase.deleteMany({ where: { problemId: testProblemId } });
      await prisma.problem.deleteMany({ where: { id: testProblemId } });
      console.log('🧹 Cleaned up temporary test problem.');
    }
    await prisma.$disconnect();
  }
}

verifyAdminRoleSystem();
