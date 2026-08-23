import http from 'http';
import { createApp } from '../app';
import { prisma } from '../config/db';

const app = createApp();
let server: http.Server;
let port: number;
let baseUrl: string;

interface AuthTestResponse {
  status: number;
  body: {
    success?: boolean;
    message?: string;
    error?: string;
    errors?: Array<{ field: string; message: string }>;
    data?: {
      token?: string;
      user?: {
        id: string;
        username: string;
        email: string;
        role?: string;
        passwordHash?: string;
      };
    };
  };
}

function makeRequest(
  method: string,
  path: string,
  body?: Record<string, unknown>,
  token?: string
): Promise<AuthTestResponse> {
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

async function verifyAuthSystem() {
  console.log('🔒 Starting Authentication & Authorization System Verification...\n');

  // Start temporary test HTTP server
  server = app.listen(0);
  const address = server.address();
  if (typeof address === 'object' && address !== null) {
    port = address.port;
    baseUrl = `http://localhost:${port}`;
  } else {
    throw new Error('Failed to resolve server port');
  }

  try {
    // Cleanup any prior test user
    await prisma.user.deleteMany({
      where: {
        OR: [{ username: 'auth_test_user' }, { email: 'auth_test@example.com' }],
      },
    });

    // TEST 1: User Registration
    console.log('1️⃣ Testing User Registration (POST /api/auth/register)...');
    const regRes = await makeRequest('POST', '/api/auth/register', {
      username: 'auth_test_user',
      email: 'auth_test@example.com',
      password: 'SecurePassword123!',
    });

    if (regRes.status !== 201 || !regRes.body.success || !regRes.body.data?.token) {
      throw new Error(`Registration failed: ${JSON.stringify(regRes.body)}`);
    }
    const newlyRegisteredToken = regRes.body.data.token;
    if (regRes.body.data?.user?.passwordHash) {
      throw new Error('SECURITY VIOLATION: passwordHash exposed in registration response!');
    }
    console.log('  ✅ PASS: Registration returned 201 Created with valid JWT and safe user object.');

    // TEST 2: Duplicate Email Registration Rejection
    console.log('2️⃣ Testing Duplicate Email Rejection...');
    const dupEmailRes = await makeRequest('POST', '/api/auth/register', {
      username: 'another_user',
      email: 'auth_test@example.com', // duplicate
      password: 'SecurePassword123!',
    });
    if (dupEmailRes.status !== 409 || dupEmailRes.body.error !== 'DUPLICATE_EMAIL') {
      throw new Error(`Duplicate email check failed: ${JSON.stringify(dupEmailRes.body)}`);
    }
    console.log('  ✅ PASS: Duplicate email correctly rejected with 409 Conflict.');

    // TEST 3: Duplicate Username Registration Rejection
    console.log('3️⃣ Testing Duplicate Username Rejection...');
    const dupUserRes = await makeRequest('POST', '/api/auth/register', {
      username: 'auth_test_user', // duplicate
      email: 'different@example.com',
      password: 'SecurePassword123!',
    });
    if (dupUserRes.status !== 409 || dupUserRes.body.error !== 'DUPLICATE_USERNAME') {
      throw new Error(`Duplicate username check failed: ${JSON.stringify(dupUserRes.body)}`);
    }
    console.log('  ✅ PASS: Duplicate username correctly rejected with 409 Conflict.');

    // TEST 4: Zod Validation Rejection (Invalid email & weak password)
    console.log('4️⃣ Testing Input Validation Failure (Zod)...');
    const invalidInputRes = await makeRequest('POST', '/api/auth/register', {
      username: 'invalid user spaces',
      email: 'invalid-email',
      password: 'short',
    });
    if (invalidInputRes.status !== 400 || !invalidInputRes.body.errors) {
      throw new Error(`Input validation check failed: ${JSON.stringify(invalidInputRes.body)}`);
    }
    console.log('  ✅ PASS: Invalid inputs correctly rejected with 400 Bad Request & field errors.');

    // TEST 5: User Login with Email vs Username
    console.log('5️⃣ Testing Login via Email (sarah.chen@example.com)...');
    const loginEmailRes = await makeRequest('POST', '/api/auth/login', {
      email: 'sarah.chen@example.com',
      password: 'DevPassword123!',
    });
    if (loginEmailRes.status !== 200 || !loginEmailRes.body.data?.token) {
      throw new Error(`Email login failed: ${JSON.stringify(loginEmailRes.body)}`);
    }
    console.log('  ✅ PASS: Login via Email successful.');

    console.log('5️⃣b Testing Login via Username (sarah_code)...');
    const loginUserRes = await makeRequest('POST', '/api/auth/login', {
      email: 'sarah_code',
      password: 'DevPassword123!',
    });
    if (loginUserRes.status !== 200 || !loginUserRes.body.data?.token) {
      throw new Error(`Username login failed: ${JSON.stringify(loginUserRes.body)}`);
    }
    console.log('  ✅ PASS: Login via Username successful.');

    console.log('5️⃣c Testing Admin Login via Username (admin)...');
    const adminUserRes = await makeRequest('POST', '/api/auth/login', {
      email: 'admin',
      password: 'AdminPassword123!',
    });
    if (adminUserRes.status !== 200 || adminUserRes.body.data?.user?.role !== 'ADMIN') {
      throw new Error(`Admin username login failed: ${JSON.stringify(adminUserRes.body)}`);
    }
    console.log('  ✅ PASS: Admin login via Username (admin) successful.');

    console.log('5️⃣d Testing Admin Login via Email (admin@codecollab.dev)...');
    const adminEmailRes = await makeRequest('POST', '/api/auth/login', {
      email: 'admin@codecollab.dev',
      password: 'AdminPassword123!',
    });
    if (adminEmailRes.status !== 200 || adminEmailRes.body.data?.user?.role !== 'ADMIN') {
      throw new Error(`Admin email login failed: ${JSON.stringify(adminEmailRes.body)}`);
    }
    console.log('  ✅ PASS: Admin login via Email (admin@codecollab.dev) successful.');

    // TEST 6: User Login with Invalid Credentials
    console.log('6️⃣ Testing Login with Invalid Password / Non-existent User...');
    const invalidPassRes = await makeRequest('POST', '/api/auth/login', {
      email: 'sarah.chen@example.com',
      password: 'WrongPassword123!',
    });
    if (invalidPassRes.status !== 401 || invalidPassRes.body.message !== 'Invalid username/email or password.') {
      throw new Error(`Invalid password check failed: ${JSON.stringify(invalidPassRes.body)}`);
    }

    const invalidUserRes = await makeRequest('POST', '/api/auth/login', {
      email: 'unknown_user',
      password: 'WrongPassword123!',
    });
    if (invalidUserRes.status !== 401 || invalidUserRes.body.message !== 'Invalid username/email or password.') {
      throw new Error(`Invalid username check failed: ${JSON.stringify(invalidUserRes.body)}`);
    }
    console.log('  ✅ PASS: Invalid email, username, or password all return generic 401 message.');

    // TEST 7: Protected Route Authentication (GET /api/auth/me)
    console.log('7️⃣ Testing Protected User Profile Endpoint (GET /api/auth/me)...');
    const meRes = await makeRequest('GET', '/api/auth/me', undefined, newlyRegisteredToken);
    if (meRes.status !== 200 || meRes.body.data?.user?.username !== 'auth_test_user') {
      throw new Error(`Protected route failed: ${JSON.stringify(meRes.body)}`);
    }
    console.log('  ✅ PASS: Authenticated request returned user profile successfully.');

    // TEST 8: Unauthenticated Request to Protected Route
    console.log('8️⃣ Testing Unauthenticated Request to /api/auth/me...');
    const noTokenRes = await makeRequest('GET', '/api/auth/me');
    if (noTokenRes.status !== 401) {
      throw new Error(`Unauthenticated check failed: ${JSON.stringify(noTokenRes.body)}`);
    }
    console.log('  ✅ PASS: Unauthenticated request rejected with 401 Unauthorized.');

    // TEST 9: Room Authorization & Privacy Controls
    console.log('9️⃣ Testing Room Authorization & Privacy Controls...');
    const publicRoom = await prisma.room.findFirst({ where: { name: 'Algo-Masterclass' } });
    const privateRoom = await prisma.room.findFirst({ where: { name: 'WebDev-Pairing' } });
    const michaelUser = await prisma.user.findFirst({ where: { username: 'michael_tech' } });

    if (!publicRoom || !privateRoom || !michaelUser) {
      throw new Error('Seeded room test data missing.');
    }

    // Login as Michael (not a member of WebDev-Pairing)
    const michaelLoginRes = await makeRequest('POST', '/api/auth/login', {
      email: 'michael.vance@example.com',
      password: 'DevPassword123!',
    });
    const michaelToken = michaelLoginRes.body.data?.token;
    if (!michaelToken) {
      throw new Error('Failed to retrieve token for Michael');
    }

    // Michael accesses public room where he is a member -> 200 OK
    const memberAccessRes = await makeRequest('GET', `/api/rooms/${publicRoom.id}`, undefined, michaelToken);
    if (memberAccessRes.status !== 200) {
      throw new Error(`Room member access failed: ${JSON.stringify(memberAccessRes.body)}`);
    }
    console.log('  ✅ PASS: Room member successfully accessed room (200 OK).');

    // Michael accesses private room WebDev-Pairing (NOT a member) -> 403 Forbidden
    const forbiddenAccessRes = await makeRequest('GET', `/api/rooms/${privateRoom.id}`, undefined, michaelToken);
    if (forbiddenAccessRes.status !== 403) {
      throw new Error(`Private room forbidden check failed: ${JSON.stringify(forbiddenAccessRes.body)}`);
    }
    console.log('  ✅ PASS: Non-member access to private room rejected with 403 Forbidden.');

    console.log('\n🎉 ALL AUTHENTICATION & AUTHORIZATION VERIFICATION TESTS PASSED SUCCESSFULLY!');
  } finally {
    try {
      await prisma.user.deleteMany({
        where: {
          OR: [{ username: 'auth_test_user' }, { email: 'auth_test@example.com' }],
        },
      });
    } catch (cleanupErr) {
      console.error('Warning: auth cleanup error:', cleanupErr);
    }
    server.close();
    await prisma.$disconnect();
  }
}

verifyAuthSystem().catch((err) => {
  console.error('❌ Verification script failed:', err);
  process.exit(1);
});
