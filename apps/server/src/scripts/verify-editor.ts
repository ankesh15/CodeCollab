import http from 'http';
import { io as ClientIO, Socket as ClientSocket } from 'socket.io-client';
import {
  SOCKET_EVENTS,
  DocumentStatePayload,
  EditorChangePayload,
  EditorCursorPayload,
  EditorLanguagePayload,
  SocketErrorPayload,
} from '@codecollab/shared';
import { createApp } from '../app';
import { initSocketServer } from '../socket';
import { prisma } from '../config/db';
import { loginUser } from '../services/auth.service';
import { getDocument } from '../services/document.service';
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

async function verifyEditorSystem() {
  console.log('💻 Starting Phase 5 — Collaborative Code Editor System Verification...\n');
  clearVersionCache();

  // Start temporary server instance
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

  try {
    // 1. Retrieve seeded test users & rooms
    const alexAuth = await loginUser({ email: 'alex.rivers@example.com', password: 'DevPassword123!' });
    const sarahAuth = await loginUser({ email: 'sarah.chen@example.com', password: 'DevPassword123!' });
    const michaelAuth = await loginUser({ email: 'michael.vance@example.com', password: 'DevPassword123!' });

    const publicRoom = await prisma.room.findFirst({ where: { name: 'Algo-Masterclass' } });
    const privateRoom = await prisma.room.findFirst({ where: { name: 'WebDev-Pairing' } });

    if (!publicRoom || !privateRoom) {
      throw new Error('Seeded test rooms missing');
    }

    // TEST 1: REST Document Retrieval with Authorization
    console.log('1️⃣ Testing REST GET /api/rooms/:roomId/document (Authorized Member)...');
    const docRes = await fetch(`${serverUrl}/api/rooms/${publicRoom.id}/document`, {
      headers: { Authorization: `Bearer ${alexAuth.token}` },
    });
    const docJson = await docRes.json();
    if (docRes.status === 200 && docJson.success && docJson.data?.document) {
      console.log('  ✅ PASS: Document retrieved successfully via REST API.');
    } else {
      throw new Error(`Failed to fetch document: ${JSON.stringify(docJson)}`);
    }

    const initialVersion = docJson.data.document.version;

    // TEST 2: REST Document Retrieval Rejection for Non-Member on Private Room
    console.log('2️⃣ Testing REST Document Access Rejection (Non-Member on Private Room)...');
    const forbiddenRes = await fetch(`${serverUrl}/api/rooms/${privateRoom.id}/document`, {
      headers: { Authorization: `Bearer ${michaelAuth.token}` },
    });
    if (forbiddenRes.status === 403) {
      console.log('  ✅ PASS: Non-member document request correctly rejected with 403 Forbidden.');
    } else {
      throw new Error(`Expected 403 Forbidden, received status ${forbiddenRes.status}`);
    }

    // TEST 3: Socket Room Join delivers document:state payload
    console.log('3️⃣ Testing Socket document:state delivery on room:join...');
    const alexSocket = createClientSocket(alexAuth.token);
    await new Promise<void>((resolve, reject) => {
      alexSocket.once(SOCKET_EVENTS.DOCUMENT_STATE, (payload: DocumentStatePayload) => {
        if (payload.roomId === publicRoom.id && payload.document?.language) {
          console.log('  ✅ PASS: Joining room received document:state with valid document payload.');
          resolve();
        } else {
          reject(new Error(`Unexpected document:state payload: ${JSON.stringify(payload)}`));
        }
      });
      alexSocket.emit(SOCKET_EVENTS.ROOM_JOIN, { roomId: publicRoom.id });
    });

    // TEST 4: Real-time editor:change broadcast to room members
    console.log('4️⃣ Testing Real-Time editor:change broadcast (Alex -> Sarah in Algo-Masterclass)...');
    const sarahSocket = createClientSocket(sarahAuth.token);

    // Wait for sarahSocket connection & room join state
    await new Promise<void>((resolve) => {
      sarahSocket.once(SOCKET_EVENTS.DOCUMENT_STATE, () => resolve());
      sarahSocket.emit(SOCKET_EVENTS.ROOM_JOIN, { roomId: publicRoom.id });
    });

    const nextVersion = initialVersion + 1;
    await new Promise<void>((resolve, reject) => {
      sarahSocket.once(SOCKET_EVENTS.EDITOR_CHANGE, (payload: EditorChangePayload) => {
        if (payload.roomId === publicRoom.id && payload.content.includes('verify_test_code')) {
          console.log('  ✅ PASS: Collaborator received real-time editor:change event.');
          resolve();
        } else {
          reject(new Error(`Unexpected editor change payload: ${JSON.stringify(payload)}`));
        }
      });

      alexSocket.emit(SOCKET_EVENTS.EDITOR_CHANGE, {
        roomId: publicRoom.id,
        content: `#include <bits/stdc++.h>\n// verify_test_code\nint main() { return 0; }`,
        version: nextVersion,
      });
    });

    // TEST 5: Stale Version Conflict Rejection
    console.log('5️⃣ Testing Stale Version Conflict Rejection...');
    await new Promise<void>((resolve, reject) => {
      alexSocket.once(SOCKET_EVENTS.ERROR, (payload: SocketErrorPayload) => {
        if (payload.code === 'DOCUMENT_VERSION_CONFLICT') {
          console.log('  ✅ PASS: Stale version emit correctly rejected with DOCUMENT_VERSION_CONFLICT.');
          resolve();
        } else {
          reject(new Error(`Unexpected error code: ${payload.code}`));
        }
      });

      // Emit stale version (initialVersion when current version is nextVersion)
      alexSocket.emit(SOCKET_EVENTS.EDITOR_CHANGE, {
        roomId: publicRoom.id,
        content: `// Stale edit`,
        version: initialVersion,
      });
    });

    // TEST 6: Room Isolation Verification
    console.log('6️⃣ Testing Room Isolation (Room A changes MUST NOT reach Room B)...');
    const alexPrivateSocket = createClientSocket(alexAuth.token);
    await new Promise<void>((resolve) => {
      alexPrivateSocket.once(SOCKET_EVENTS.DOCUMENT_STATE, () => resolve());
      alexPrivateSocket.emit(SOCKET_EVENTS.ROOM_JOIN, { roomId: privateRoom.id });
    });

    let isolatedReceived = false;
    await new Promise<void>((resolve, reject) => {
      alexPrivateSocket.once(SOCKET_EVENTS.EDITOR_CHANGE, () => {
        isolatedReceived = true;
      });

      // Emit change in publicRoom from Sarah
      sarahSocket.emit(SOCKET_EVENTS.EDITOR_CHANGE, {
        roomId: publicRoom.id,
        content: `// Room A isolated change`,
        version: nextVersion + 1,
      });

      setTimeout(() => {
        if (!isolatedReceived) {
          console.log('  ✅ PASS: Room A editor changes did NOT leak to Room B.');
          alexPrivateSocket.disconnect();
          resolve();
        } else {
          reject(new Error('Room A editor change leaked to client in Room B!'));
        }
      }, 400);
    });

    // TEST 7: Cursor Position Broadcast
    console.log('7️⃣ Testing editor:cursor position broadcast...');
    await new Promise<void>((resolve, reject) => {
      sarahSocket.once(SOCKET_EVENTS.EDITOR_CURSOR, (payload: EditorCursorPayload) => {
        if (payload.user.username === 'alex_dev' && payload.position.lineNumber === 12) {
          console.log('  ✅ PASS: Collaborator received editor:cursor update (Line 12 : Col 5).');
          resolve();
        } else {
          reject(new Error(`Unexpected cursor payload: ${JSON.stringify(payload)}`));
        }
      });

      alexSocket.emit(SOCKET_EVENTS.EDITOR_CURSOR, {
        roomId: publicRoom.id,
        position: { lineNumber: 12, column: 5 },
      });
    });

    // TEST 8: Language Synchronization
    console.log('8️⃣ Testing editor:language synchronization...');
    await new Promise<void>((resolve, reject) => {
      sarahSocket.once(SOCKET_EVENTS.EDITOR_LANGUAGE, (payload: EditorLanguagePayload) => {
        if (payload.language === 'python') {
          console.log('  ✅ PASS: Language change synchronized to room collaborators.');
          resolve();
        } else {
          reject(new Error(`Unexpected language payload: ${JSON.stringify(payload)}`));
        }
      });

      alexSocket.emit(SOCKET_EVENTS.EDITOR_LANGUAGE, {
        roomId: publicRoom.id,
        language: 'python',
      });
    });

    // TEST 9: PostgreSQL Document Persistence Verification
    console.log('9️⃣ Testing Debounced PostgreSQL Persistence Verification...');
    await new Promise((res) => setTimeout(res, 600)); // Wait for 300ms debounce timer

    const persistedDoc = await getDocument(publicRoom.id);
    if (persistedDoc && persistedDoc.content.includes('Room A isolated change')) {
      console.log('  ✅ PASS: PostgreSQL CodeDocument contains latest debounced content.');
    } else {
      throw new Error(`Persisted document content mismatch: ${persistedDoc?.content}`);
    }

    sarahSocket.disconnect();
    alexSocket.disconnect();

    console.log('\n🎉 ALL PHASE 5 — COLLABORATIVE CODE EDITOR TESTS PASSED SUCCESSFULLY!');
  } finally {
    httpServer.close();
    await prisma.$disconnect();
  }
}

verifyEditorSystem().catch((err) => {
  console.error('❌ Editor verification failed:', err);
  process.exit(1);
});
