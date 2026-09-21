import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '..');

console.log('🌐 ========================================================');
console.log('   CODECOLLAB FRONTEND SUITE — STATIC & CONTRACT AUDIT');
console.log('========================================================\n');

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`✅ [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`❌ [FAIL] ${name}:`, err.message || err);
    failed++;
  }
}

// 1. Verify Production Build Artifacts
test('Production Build Output (dist/index.html & assets)', () => {
  const distDir = path.join(webRoot, 'dist');
  assert.ok(fs.existsSync(distDir), 'dist directory must exist');
  const indexHtml = path.join(distDir, 'index.html');
  assert.ok(fs.existsSync(indexHtml), 'dist/index.html must exist');
  const htmlContent = fs.readFileSync(indexHtml, 'utf8');
  assert.ok(htmlContent.includes('<div id="root"></div>'), 'index.html must contain #root div');
  assert.ok(htmlContent.includes('CodeCollab'), 'index.html must contain CodeCollab title');

  const assetsDir = path.join(distDir, 'assets');
  assert.ok(fs.existsSync(assetsDir), 'dist/assets directory must exist');
  const assetFiles = fs.readdirSync(assetsDir);
  assert.ok(assetFiles.some((f) => f.endsWith('.js')), 'Must have JS asset bundle');
  assert.ok(assetFiles.some((f) => f.endsWith('.css')), 'Must have CSS asset bundle');
});

// 2. Verify All Application Pages Exist
test('Page Component Files Exist & Export Expected Components', () => {
  const pagesDir = path.join(webRoot, 'src', 'pages');
  const requiredPages = [
    'LandingPage.tsx',
    'LoginPage.tsx',
    'RegisterPage.tsx',
    'RoomsPage.tsx',
    'RoomPage.tsx',
    'ProblemsPage.tsx',
    'ProblemDetailPage.tsx',
    'SoloEditorPage.tsx',
    'NotificationsPage.tsx',
    'LeaderboardPage.tsx',
    'ProfilePage.tsx',
    'AdminProblemsPage.tsx',
    'AdminProblemEditPage.tsx',
    'AdminProblemImportPage.tsx',
    'DevPage.tsx',
    'NotFoundPage.tsx',
  ];

  for (const page of requiredPages) {
    const pagePath = path.join(pagesDir, page);
    assert.ok(fs.existsSync(pagePath), `Page file ${page} must exist in src/pages/`);
    const content = fs.readFileSync(pagePath, 'utf8');
    const componentName = page.replace('.tsx', '');
    assert.ok(
      content.includes(`export const ${componentName}`) || content.includes(`export function ${componentName}`),
      `Page ${page} must export component ${componentName}`
    );
  }
});

// 3. Verify All Core Components Exist
test('Core Component Files Exist', () => {
  const compDir = path.join(webRoot, 'src', 'components');
  const requiredComponents = [
    'Navbar.tsx',
    'Footer.tsx',
    'CodeEditor.tsx',
    'RoomChat.tsx',
    'LeaderboardTable.tsx',
    'ProtectedRoute.tsx',
    'PublicOnlyRoute.tsx',
    'ErrorBoundary.tsx',
    'StatsCard.tsx',
    'ActivityChart.tsx',
    'DifficultyBreakdown.tsx',
  ];

  for (const comp of requiredComponents) {
    const compPath = path.join(compDir, comp);
    assert.ok(fs.existsSync(compPath), `Component file ${comp} must exist in src/components/`);
  }
});

// 4. Verify Route Coverage in App.tsx
test('App.tsx Route Declarations Coverage', () => {
  const appPath = path.join(webRoot, 'src', 'App.tsx');
  assert.ok(fs.existsSync(appPath), 'src/App.tsx must exist');
  const content = fs.readFileSync(appPath, 'utf8');

  const expectedRoutes = [
    'path="/"',
    'path="/login"',
    'path="/register"',
    'path="/problems"',
    'path="/problems/:problemId"',
    'path="/leaderboard"',
    'path="/profile"',
    'path="/problems/:problemId/solve"',
    'path="/rooms"',
    'path="/rooms/:roomId"',
    'path="/notifications"',
    'path="/admin/problems"',
    'path="/admin/problems/new"',
    'path="/admin/problems/:problemId/edit"',
    'path="/admin/problems/import"',
    'path="*"',
  ];

  for (const route of expectedRoutes) {
    assert.ok(content.includes(route), `App.tsx must contain route ${route}`);
  }
});

// 5. Verify API Client Contract Coverage in api.ts
test('API Client Function Declarations in api.ts', () => {
  const apiPath = path.join(webRoot, 'src', 'lib', 'api.ts');
  assert.ok(fs.existsSync(apiPath), 'src/lib/api.ts must exist');
  const content = fs.readFileSync(apiPath, 'utf8');

  const expectedApiMethods = [
    'export async function fetchRooms',
    'export async function fetchRoomDetails',
    'export async function createRoomApi',
    'export async function joinRoomApi',
    'export async function leaveRoomApi',
    'export async function deleteRoomApi',
    'export async function updateRoomSettingsApi',
    'export async function fetchProblems',
    'export async function fetchProblemDetails',
    'export async function fetchDocument',
    'export async function updateDocumentLanguageApi',
    'export async function runCodeApi',
    'export async function submitCodeApi',
    'export async function fetchSubmissionsApi',
    'export async function fetchRoomMessagesApi',
    'export async function deleteMessageApi',
    'export async function fetchNotificationsApi',
    'export async function fetchUnreadCountApi',
    'export async function markNotificationReadApi',
    'export async function markAllNotificationsReadApi',
    'export async function fetchLeaderboardApi',
    'export async function fetchUserAnalyticsApi',
    'export async function fetchUserActivityApi',
    'export async function fetchAdminProblemsApi',
    'export async function createAdminProblemApi',
    'export async function updateAdminProblemApi',
    'export async function addTestCaseApi',
    'export async function publishProblemApi',
    'export async function importCodeforcesProblemsApi',
  ];

  for (const method of expectedApiMethods) {
    assert.ok(content.includes(method), `api.ts must declare ${method}`);
  }
});

// 6. Verify AuthContext Token Lifecycle & Refresh Interceptor
test('AuthContext Token Lifecycle Implementation', () => {
  const authCtxPath = path.join(webRoot, 'src', 'context', 'AuthContext.tsx');
  assert.ok(fs.existsSync(authCtxPath), 'src/context/AuthContext.tsx must exist');
  const content = fs.readFileSync(authCtxPath, 'utf8');

  assert.ok(content.includes('codecollab_token'), 'AuthContext must track access token');
  assert.ok(content.includes('codecollab_refresh_token'), 'AuthContext must track refresh token');
  assert.ok(content.includes('/auth/refresh'), 'AuthContext must implement silent token refresh');
  assert.ok(content.includes('/auth/logout'), 'AuthContext must implement server-side logout');
});

// 7. Verify Shared Workspace Integration
await test('Shared Package Integration & Exports', async () => {
  const shared = await import('@codecollab/shared');
  assert.ok(shared, 'Must be able to import @codecollab/shared');
  assert.ok(shared.SOCKET_EVENTS, 'Must export SOCKET_EVENTS');
  assert.strictEqual(shared.SOCKET_EVENTS.ROOM_JOIN, 'room:join');
  assert.strictEqual(shared.SOCKET_EVENTS.EDITOR_CHANGE, 'editor:change');
  assert.strictEqual(shared.SOCKET_EVENTS.DOCUMENT_STATE, 'document:state');
});

console.log('\n========================================================');
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('========================================================\n');

if (failed > 0) {
  process.exit(1);
}
