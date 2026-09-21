import http from 'http';
import { io as ClientIO, Socket as ClientSocket } from 'socket.io-client';
import {
  SOCKET_EVENTS,
  DocumentStatePayload,
  EditorChangePayload,
  SocketErrorPayload,
} from '@codecollab/shared';
import { createApp } from '../app';
import { initSocketServer } from '../socket';
import { prisma } from '../config/db';
import { loginUser } from '../services/auth.service';
import { clearVersionCache } from '../socket/editor.handlers';

let httpServer: http.Server;
let port: number;
let serverUrl: string;

function createClientSocket(token?: string): ClientSocket {
  return ClientIO(serverUrl, {
    auth: { token: token || '' },
    transports: ['websocket'],
    forceNew: true,
  });
}

async function runP1VerificationSuite() {
  console.log('🚀 ========================================================');
  console.log('   P1 VERIFICATION SUITE — ROOM LIFECYCLE & COLLABORATION');
  console.log('========================================================\n');

  clearVersionCache();

  // Spin up temporary test HTTP & Socket.IO server
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

  const createdRoomIds: string[] = [];

  try {
    // Authenticate test users
    console.log('🔑 Authenticating test users...');
    const alexAuth = await loginUser({ email: 'alex.rivers@example.com', password: 'DevPassword123!' });
    const sarahAuth = await loginUser({ email: 'sarah.chen@example.com', password: 'DevPassword123!' });
    const michaelAuth = await loginUser({ email: 'michael.vance@example.com', password: 'DevPassword123!' });
    console.log('  ✅ Alex, Sarah, and Michael authenticated successfully.\n');

    // ----------------------------------------------------
    // TEST 1: Room Creation Success (Transactional Flow)
    // ----------------------------------------------------
    console.log('1️⃣ Scenario 1: Room Creation Success (Transactional Flow)...');
    const createRes = await fetch(`${serverUrl}/api/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${alexAuth.token}`,
      },
      body: JSON.stringify({
        name: 'P1-Test-Algorithms',
        language: 'cpp',
        isPrivate: false,
      }),
    });
    const createJson = await createRes.json();
    if (createRes.status !== 201 || !createJson.success || !createJson.data?.room?.id) {
      throw new Error(`Scenario 1 Failed: Expected 201 Created, got ${createRes.status} - ${JSON.stringify(createJson)}`);
    }
    const createdRoomId = createJson.data.room.id;
    createdRoomIds.push(createdRoomId);

    // Verify DB integrity: Room, Owner membership, CodeDocument
    const dbRoom = await prisma.room.findUnique({
      where: { id: createdRoomId },
      include: { members: true, codeDocument: true },
    });
    if (!dbRoom || dbRoom.ownerId !== alexAuth.user.id) {
      throw new Error(`Scenario 1 Failed: Room owner mismatch in DB`);
    }
    const ownerMember = dbRoom.members.find((m) => m.userId === alexAuth.user.id);
    if (!ownerMember || ownerMember.role !== 'OWNER') {
      throw new Error(`Scenario 1 Failed: Owner membership missing or incorrect role`);
    }
    if (!dbRoom.codeDocument || dbRoom.codeDocument.language !== 'cpp') {
      throw new Error(`Scenario 1 Failed: CodeDocument was not created transactionally`);
    }
    console.log('  ✅ PASS: Room, OWNER membership, and CodeDocument created atomically.\n');

    // ----------------------------------------------------
    // TEST 2: Room Creation Validation Rejection
    // ----------------------------------------------------
    console.log('2️⃣ Scenario 2: Room Creation Validation Rejection...');
    const invalidRes = await fetch(`${serverUrl}/api/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${alexAuth.token}`,
      },
      body: JSON.stringify({
        name: 'a', // Too short (min 2)
        language: 'unsupported_lang',
      }),
    });
    const invalidJson = await invalidRes.json();
    if (invalidRes.status !== 400 || invalidJson.error !== 'VALIDATION_FAILED') {
      throw new Error(`Scenario 2 Failed: Expected 400 VALIDATION_FAILED, got ${invalidRes.status} - ${JSON.stringify(invalidJson)}`);
    }
    console.log('  ✅ PASS: Invalid room creation correctly rejected with 400 VALIDATION_FAILED.\n');

    // ----------------------------------------------------
    // TEST 3: Public Room Join
    // ----------------------------------------------------
    console.log('3️⃣ Scenario 3: Public Room Join...');
    const joinRes = await fetch(`${serverUrl}/api/rooms/${createdRoomId}/join`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sarahAuth.token}`,
      },
    });
    const joinJson = await joinRes.json();
    if (joinRes.status !== 200 || !joinJson.success || joinJson.data?.role !== 'MEMBER') {
      throw new Error(`Scenario 3 Failed: Expected 200 OK, got ${joinRes.status} - ${JSON.stringify(joinJson)}`);
    }
    const sarahMembership = await prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId: createdRoomId, userId: sarahAuth.user.id } },
    });
    if (!sarahMembership || sarahMembership.role !== 'MEMBER') {
      throw new Error(`Scenario 3 Failed: Sarah membership record not persisted in DB`);
    }
    console.log('  ✅ PASS: Sarah joined public room and MEMBER record was persisted.\n');

    // ----------------------------------------------------
    // TEST 4: Public Room Join Idempotency
    // ----------------------------------------------------
    console.log('4️⃣ Scenario 4: Public Room Join Idempotency...');
    const duplicateJoinRes = await fetch(`${serverUrl}/api/rooms/${createdRoomId}/join`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sarahAuth.token}`,
      },
    });
    const duplicateJoinJson = await duplicateJoinRes.json();
    if (duplicateJoinRes.status !== 200 || !duplicateJoinJson.success) {
      throw new Error(`Scenario 4 Failed: Expected 200 OK on duplicate join, got ${duplicateJoinRes.status}`);
    }
    const memberCount = await prisma.roomMember.count({
      where: { roomId: createdRoomId, userId: sarahAuth.user.id },
    });
    if (memberCount !== 1) {
      throw new Error(`Scenario 4 Failed: Expected exactly 1 membership row, found ${memberCount}`);
    }
    console.log('  ✅ PASS: Duplicate room join handled idempotently without error.\n');

    // ----------------------------------------------------
    // TEST 5: Private Room Creation & Unauthorized Join Rejection
    // ----------------------------------------------------
    console.log('5️⃣ Scenario 5: Private Room Join Authorization Rejection...');
    const privateRoomRes = await fetch(`${serverUrl}/api/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${alexAuth.token}`,
      },
      body: JSON.stringify({
        name: 'P1-Secret-Workspace',
        language: 'python',
        isPrivate: true,
      }),
    });
    const privateRoomJson = await privateRoomRes.json();
    const privateRoomId = privateRoomJson.data.room.id;
    createdRoomIds.push(privateRoomId);

    const unauthorizedJoinRes = await fetch(`${serverUrl}/api/rooms/${privateRoomId}/join`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${michaelAuth.token}`,
      },
    });
    if (unauthorizedJoinRes.status !== 403) {
      throw new Error(`Scenario 5 Failed: Expected 403 Forbidden for private room join, got ${unauthorizedJoinRes.status}`);
    }
    console.log('  ✅ PASS: Non-invited user joining private room rejected with 403 Forbidden.\n');

    // ----------------------------------------------------
    // TEST 6: Public Room Access (Fixed Authenticated Read)
    // ----------------------------------------------------
    console.log('6️⃣ Scenario 6: Public Room Access for Authenticated Non-Members...');
    // Michael is NOT yet a member of P1-Test-Algorithms
    const publicRoomGetRes = await fetch(`${serverUrl}/api/rooms/${createdRoomId}`, {
      headers: { Authorization: `Bearer ${michaelAuth.token}` },
    });
    const publicRoomGetJson = await publicRoomGetRes.json();
    if (publicRoomGetRes.status !== 200 || !publicRoomGetJson.success) {
      throw new Error(`Scenario 6 Failed: Expected 200 OK viewing public room, got ${publicRoomGetRes.status} - ${JSON.stringify(publicRoomGetJson)}`);
    }

    const publicDocGetRes = await fetch(`${serverUrl}/api/rooms/${createdRoomId}/document`, {
      headers: { Authorization: `Bearer ${michaelAuth.token}` },
    });
    const publicDocGetJson = await publicDocGetRes.json();
    if (publicDocGetRes.status !== 200 || !publicDocGetJson.success) {
      throw new Error(`Scenario 6 Failed: Expected 200 OK viewing public doc, got ${publicDocGetRes.status} - ${JSON.stringify(publicDocGetJson)}`);
    }
    console.log('  ✅ PASS: Public room and code document accessible to authenticated users without 403.\n');

    // ----------------------------------------------------
    // TEST 7: Private Room Access Rejection
    // ----------------------------------------------------
    console.log('7️⃣ Scenario 7: Private Room Access Rejection for Non-Members...');
    const privateRoomGetRes = await fetch(`${serverUrl}/api/rooms/${privateRoomId}`, {
      headers: { Authorization: `Bearer ${michaelAuth.token}` },
    });
    if (privateRoomGetRes.status !== 403) {
      throw new Error(`Scenario 7 Failed: Expected 403 Forbidden for private room GET, got ${privateRoomGetRes.status}`);
    }

    const privateDocGetRes = await fetch(`${serverUrl}/api/rooms/${privateRoomId}/document`, {
      headers: { Authorization: `Bearer ${michaelAuth.token}` },
    });
    if (privateDocGetRes.status !== 403) {
      throw new Error(`Scenario 7 Failed: Expected 403 Forbidden for private document GET, got ${privateDocGetRes.status}`);
    }
    console.log('  ✅ PASS: Private room and document access strictly rejected with 403 Forbidden.\n');

    // ----------------------------------------------------
    // TEST 8: Room Leave Non-Owner
    // ----------------------------------------------------
    console.log('8️⃣ Scenario 8: Room Leave Non-Owner...');
    const sarahLeaveRes = await fetch(`${serverUrl}/api/rooms/${createdRoomId}/leave`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${sarahAuth.token}` },
    });
    const sarahLeaveJson = await sarahLeaveRes.json();
    if (sarahLeaveRes.status !== 200 || sarahLeaveJson.data?.action !== 'left') {
      throw new Error(`Scenario 8 Failed: Expected 200 OK action 'left', got ${sarahLeaveRes.status} - ${JSON.stringify(sarahLeaveJson)}`);
    }
    const sarahLeftCheck = await prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId: createdRoomId, userId: sarahAuth.user.id } },
    });
    if (sarahLeftCheck !== null) {
      throw new Error(`Scenario 8 Failed: Sarah still exists in room members`);
    }
    console.log('  ✅ PASS: Non-owner left room cleanly and membership removed.\n');

    // ----------------------------------------------------
    // TEST 9: Room Leave Owner Transfer
    // ----------------------------------------------------
    console.log('9️⃣ Scenario 9: Room Leave Owner Transfer...');
    // Create multi-member room: Alex (owner), Michael (member)
    const transferRoomRes = await fetch(`${serverUrl}/api/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${alexAuth.token}`,
      },
      body: JSON.stringify({
        name: 'P1-Ownership-Transfer-Room',
        language: 'javascript',
        isPrivate: false,
      }),
    });
    const transferRoomJson = await transferRoomRes.json();
    const transferRoomId = transferRoomJson.data.room.id;
    createdRoomIds.push(transferRoomId);

    // Michael joins
    await fetch(`${serverUrl}/api/rooms/${transferRoomId}/join`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${michaelAuth.token}` },
    });

    // Alex (Owner) leaves -> ownership must transfer to Michael
    const ownerLeaveRes = await fetch(`${serverUrl}/api/rooms/${transferRoomId}/leave`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${alexAuth.token}` },
    });
    const ownerLeaveJson = await ownerLeaveRes.json();
    if (ownerLeaveRes.status !== 200 || ownerLeaveJson.data?.action !== 'transferred') {
      throw new Error(`Scenario 9 Failed: Expected action 'transferred', got ${JSON.stringify(ownerLeaveJson)}`);
    }
    if (ownerLeaveJson.data?.newOwnerId !== michaelAuth.user.id) {
      throw new Error(`Scenario 9 Failed: Expected newOwnerId to be Michael (${michaelAuth.user.id})`);
    }

    // Verify DB
    const updatedTransferRoom = await prisma.room.findUnique({
      where: { id: transferRoomId },
      include: { members: true },
    });
    if (!updatedTransferRoom || updatedTransferRoom.ownerId !== michaelAuth.user.id) {
      throw new Error(`Scenario 9 Failed: Room ownerId was not updated to Michael in DB`);
    }
    const michaelMembership = updatedTransferRoom.members.find((m) => m.userId === michaelAuth.user.id);
    if (!michaelMembership || michaelMembership.role !== 'OWNER') {
      throw new Error(`Scenario 9 Failed: Michael's membership role was not promoted to OWNER`);
    }
    const alexMembershipCheck = updatedTransferRoom.members.find((m) => m.userId === alexAuth.user.id);
    if (alexMembershipCheck) {
      throw new Error(`Scenario 9 Failed: Alex was not removed from room members`);
    }
    console.log('  ✅ PASS: Room owner left, ownership successfully transferred to Michael.\n');

    // ----------------------------------------------------
    // TEST 10: Room Leave Sole Owner (Room Deleted)
    // ----------------------------------------------------
    console.log('🔟 Scenario 10: Room Leave Sole Owner (Room Auto-Deletion)...');
    const soleOwnerRoomRes = await fetch(`${serverUrl}/api/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sarahAuth.token}`,
      },
      body: JSON.stringify({
        name: 'P1-Sole-Owner-Room',
        language: 'python',
        isPrivate: false,
      }),
    });
    const soleOwnerRoomJson = await soleOwnerRoomRes.json();
    const soleOwnerRoomId = soleOwnerRoomJson.data.room.id;

    // Sarah is the sole owner and leaves
    const soleLeaveRes = await fetch(`${serverUrl}/api/rooms/${soleOwnerRoomId}/leave`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${sarahAuth.token}` },
    });
    const soleLeaveJson = await soleLeaveRes.json();
    if (soleLeaveRes.status !== 200 || soleLeaveJson.data?.action !== 'deleted') {
      throw new Error(`Scenario 10 Failed: Expected action 'deleted', got ${JSON.stringify(soleLeaveJson)}`);
    }

    const soleRoomDbCheck = await prisma.room.findUnique({ where: { id: soleOwnerRoomId } });
    if (soleRoomDbCheck !== null) {
      throw new Error(`Scenario 10 Failed: Room should have been deleted from DB`);
    }
    console.log('  ✅ PASS: Sole owner left, room and dependent records deleted cleanly.\n');

    // ----------------------------------------------------
    // TEST 11: Room Deletion Authorization Rejection
    // ----------------------------------------------------
    console.log('1️⃣1️⃣ Scenario 11: Room Deletion Authorization Rejection...');
    // Sarah attempts to delete P1-Test-Algorithms (owned by Alex)
    const unauthorizedDeleteRes = await fetch(`${serverUrl}/api/rooms/${createdRoomId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${sarahAuth.token}` },
    });
    if (unauthorizedDeleteRes.status !== 403) {
      throw new Error(`Scenario 11 Failed: Expected 403 Forbidden, got ${unauthorizedDeleteRes.status}`);
    }
    console.log('  ✅ PASS: Non-owner deletion attempt rejected with 403 Forbidden.\n');

    // ----------------------------------------------------
    // TEST 12: Room Deletion Success (Owner Deletion)
    // ----------------------------------------------------
    console.log('1️⃣2️⃣ Scenario 12: Room Deletion Success...');
    // Alex deletes P1-Test-Algorithms
    const ownerDeleteRes = await fetch(`${serverUrl}/api/rooms/${createdRoomId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${alexAuth.token}` },
    });
    const ownerDeleteJson = await ownerDeleteRes.json();
    if (ownerDeleteRes.status !== 200 || !ownerDeleteJson.success) {
      throw new Error(`Scenario 12 Failed: Expected 200 OK, got ${ownerDeleteRes.status} - ${JSON.stringify(ownerDeleteJson)}`);
    }
    const deletedRoomDb = await prisma.room.findUnique({ where: { id: createdRoomId } });
    if (deletedRoomDb !== null) {
      throw new Error(`Scenario 12 Failed: Room still exists in DB after deletion`);
    }
    console.log('  ✅ PASS: Owner deleted room, cascading deletes completed.\n');

    // ----------------------------------------------------
    // TEST 13: Room Settings Update (PATCH /api/rooms/:roomId)
    // ----------------------------------------------------
    console.log('1️⃣3️⃣ Scenario 13: Room Settings Update...');
    // Michael is owner of transferRoomId
    // Unauthorized user (Sarah) tries to update -> 403
    const unauthorizedUpdateRes = await fetch(`${serverUrl}/api/rooms/${transferRoomId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sarahAuth.token}`,
      },
      body: JSON.stringify({ name: 'Hacked Room Name' }),
    });
    if (unauthorizedUpdateRes.status !== 403) {
      throw new Error(`Scenario 13 Failed: Expected 403 Forbidden for non-owner patch, got ${unauthorizedUpdateRes.status}`);
    }

    // Owner (Michael) updates room name and language
    const authorizedUpdateRes = await fetch(`${serverUrl}/api/rooms/${transferRoomId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${michaelAuth.token}`,
      },
      body: JSON.stringify({
        name: 'Renamed-Transfer-Room',
        language: 'python',
        isPrivate: true,
      }),
    });
    const authorizedUpdateJson = await authorizedUpdateRes.json();
    if (authorizedUpdateRes.status !== 200 || authorizedUpdateJson.data?.room?.name !== 'Renamed-Transfer-Room') {
      throw new Error(`Scenario 13 Failed: Expected updated room name, got ${JSON.stringify(authorizedUpdateJson)}`);
    }
    if (authorizedUpdateJson.data.room.language !== 'python' || !authorizedUpdateJson.data.room.isPrivate) {
      throw new Error(`Scenario 13 Failed: Settings fields not updated properly`);
    }
    console.log('  ✅ PASS: Room settings updated by owner; unauthorized requests rejected.\n');

    // ----------------------------------------------------
    // TEST 14: Socket Real-Time Room Join, Presence & Document State
    // ----------------------------------------------------
    console.log('1️⃣4️⃣ Scenario 14: Real-Time Socket Lifecycle & Document State...');
    const socketRoomRes = await fetch(`${serverUrl}/api/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${alexAuth.token}`,
      },
      body: JSON.stringify({
        name: 'P1-Socket-Collaboration-Room',
        language: 'javascript',
        isPrivate: false,
      }),
    });
    const socketRoomJson = await socketRoomRes.json();
    const socketRoomId = socketRoomJson.data.room.id;
    createdRoomIds.push(socketRoomId);

    const alexSocket = createClientSocket(alexAuth.token);
    const sarahSocket = createClientSocket(sarahAuth.token);

    // Alex joins room
    const alexDocState = await new Promise<DocumentStatePayload>((resolve) => {
      alexSocket.once(SOCKET_EVENTS.DOCUMENT_STATE, (payload: DocumentStatePayload) => resolve(payload));
      alexSocket.emit(SOCKET_EVENTS.ROOM_JOIN, { roomId: socketRoomId });
    });

    if (alexDocState.roomId !== socketRoomId || alexDocState.document.language !== 'javascript') {
      throw new Error(`Scenario 14 Failed: Invalid document:state received by joining socket`);
    }

    // Sarah joins room and receives document:state
    const sarahDocState = await new Promise<DocumentStatePayload>((resolve) => {
      sarahSocket.once(SOCKET_EVENTS.DOCUMENT_STATE, (payload: DocumentStatePayload) => resolve(payload));
      sarahSocket.emit(SOCKET_EVENTS.ROOM_JOIN, { roomId: socketRoomId });
    });

    if (sarahDocState.roomId !== socketRoomId) {
      throw new Error(`Scenario 14 Failed: Sarah failed to receive document:state`);
    }

    // Sarah verifies real-time editor:change broadcast from Alex
    const changeBroadcast = await new Promise<EditorChangePayload>((resolve, reject) => {
      sarahSocket.once(SOCKET_EVENTS.EDITOR_CHANGE, (payload: EditorChangePayload) => resolve(payload));
      alexSocket.emit(SOCKET_EVENTS.EDITOR_CHANGE, {
        roomId: socketRoomId,
        content: `console.log("P1 Collaboration Works!");`,
        version: alexDocState.document.version + 1,
      });
      setTimeout(() => reject(new Error('Timeout waiting for editor:change broadcast')), 3000);
    });

    if (!changeBroadcast.content.includes('P1 Collaboration Works!')) {
      throw new Error(`Scenario 14 Failed: Broadcast content mismatch: ${changeBroadcast.content}`);
    }
    console.log('  ✅ PASS: Real-time socket join, document state, and editor changes synchronized.\n');

    // ----------------------------------------------------
    // TEST 15: Socket Version Conflict Handling & Rate Limiting
    // ----------------------------------------------------
    console.log('1️⃣5️⃣ Scenario 15: Version Conflict Rejection & Rate Limiting...');
    // Alex attempts to send stale/duplicate version (less than or equal to current version)
    const currentVer = changeBroadcast.version;
    const conflictError = await new Promise<SocketErrorPayload>((resolve, reject) => {
      alexSocket.once(SOCKET_EVENTS.ERROR, (payload: SocketErrorPayload) => resolve(payload));
      alexSocket.emit(SOCKET_EVENTS.EDITOR_CHANGE, {
        roomId: socketRoomId,
        content: `console.log("Stale Edit");`,
        version: currentVer, // version <= currentVersion MUST be rejected!
      });
      setTimeout(() => reject(new Error('Timeout waiting for DOCUMENT_VERSION_CONFLICT')), 3000);
    });

    if (conflictError.code !== 'DOCUMENT_VERSION_CONFLICT') {
      throw new Error(`Scenario 15 Failed: Expected DOCUMENT_VERSION_CONFLICT, received ${conflictError.code}`);
    }

    // Verify unjoined socket cannot emit editor changes
    const unjoinedSocket = createClientSocket(michaelAuth.token);
    const unjoinedError = await new Promise<SocketErrorPayload>((resolve, reject) => {
      unjoinedSocket.once(SOCKET_EVENTS.ERROR, (payload: SocketErrorPayload) => resolve(payload));
      unjoinedSocket.emit(SOCKET_EVENTS.EDITOR_CHANGE, {
        roomId: socketRoomId,
        content: `// unauthorized change`,
        version: 10,
      });
      setTimeout(() => reject(new Error('Timeout waiting for unjoined socket error')), 3000);
    });

    if (unjoinedError.code !== 'ROOM_ACCESS_REQUIRED') {
      throw new Error(`Scenario 15 Failed: Expected ROOM_ACCESS_REQUIRED, received ${unjoinedError.code}`);
    }

    alexSocket.disconnect();
    sarahSocket.disconnect();
    unjoinedSocket.disconnect();
    console.log('  ✅ PASS: Stale version <= currentVersion rejected with DOCUMENT_VERSION_CONFLICT; unjoined socket rejected.\n');

    console.log('========================================================');
    console.log('🎉 ALL 15 P1 VERIFICATION SCENARIOS PASSED WITH ZERO ERRORS!');
    console.log('========================================================\n');
  } finally {
    // Wait for in-flight debounce persistence timers to settle
    await new Promise((res) => setTimeout(res, 400));

    // Cleanup any remaining created test rooms
    await prisma.room.deleteMany({
      where: { id: { in: createdRoomIds } },
    }).catch(() => {});

    httpServer.close();
    await prisma.$disconnect();
  }
}

runP1VerificationSuite().catch((err) => {
  console.error('\n❌ P1 Verification Failed:', err);
  process.exit(1);
});
