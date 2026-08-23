import http from 'http';
import { io as clientIo, Socket as ClientSocket } from 'socket.io-client';
import { createApp } from '../app';
import { initSocketServer } from '../socket';
import { prisma } from '../config/db';
import { registerUser } from '../services/auth.service';
import { SOCKET_EVENTS, MessageNewPayload, MessageDeletePayload } from '@codecollab/shared';

const PORT = 5009;
const SERVER_URL = `http://localhost:${PORT}`;

async function runChatVerification() {
  console.log('\n======================================================');
  console.log('🧪 Starting Phase 7 Real-Time Chat Verification Suite');
  console.log('======================================================\n');

  let server: http.Server | null = null;
  let clientSocket1: ClientSocket | null = null;
  let clientSocket2: ClientSocket | null = null;
  const createdRoomIds: string[] = [];
  const createdUserIds: string[] = [];

  try {
    // 0. Pre-test cleanup of any previous test artifacts
    await prisma.message.deleteMany({
      where: {
        OR: [
          { room: { name: { startsWith: 'Public Chat Room' } } },
          { room: { name: { startsWith: 'Private Chat Room' } } },
          { user: { username: { startsWith: 'chatuser' } } },
        ],
      },
    });
    await prisma.roomMember.deleteMany({
      where: {
        OR: [
          { room: { name: { startsWith: 'Public Chat Room' } } },
          { room: { name: { startsWith: 'Private Chat Room' } } },
          { user: { username: { startsWith: 'chatuser' } } },
        ],
      },
    });
    await prisma.codeDocument.deleteMany({
      where: {
        room: {
          OR: [
            { name: { startsWith: 'Public Chat Room' } },
            { name: { startsWith: 'Private Chat Room' } },
          ],
        },
      },
    });
    await prisma.room.deleteMany({
      where: {
        OR: [
          { name: { startsWith: 'Public Chat Room' } },
          { name: { startsWith: 'Private Chat Room' } },
        ],
      },
    });
    await prisma.user.deleteMany({
      where: { username: { startsWith: 'chatuser' } },
    });

    // 1. Start Server & Socket.IO Instance
    const app = createApp();
    server = http.createServer(app);
    initSocketServer(server);

    await new Promise<void>((resolve) => {
      server!.listen(PORT, () => {
        console.log(`✅ [Test 1/9] Server listening on port ${PORT}`);
        resolve();
      });
    });

    // 2. Create Test Users & Auth Tokens
    const uniqueSuffix = Date.now().toString().slice(-6);
    const user1Data = await registerUser({
      username: `chatuser1_${uniqueSuffix}`,
      email: `chatuser1_${uniqueSuffix}@example.com`,
      password: 'Password123!',
    });
    const user2Data = await registerUser({
      username: `chatuser2_${uniqueSuffix}`,
      email: `chatuser2_${uniqueSuffix}@example.com`,
      password: 'Password123!',
    });

    createdUserIds.push(user1Data.user.id, user2Data.user.id);

    const token1 = user1Data.token;
    const token2 = user2Data.token;
    console.log(`✅ [Test 2/9] Auth Tokens generated for ${user1Data.user.username} and ${user2Data.user.username}`);

    // 3. Create Public & Private Test Rooms directly in Prisma
    const publicRoom = await prisma.room.create({
      data: {
        name: `Public Chat Room ${uniqueSuffix}`,
        isPrivate: false,
        language: 'cpp',
        ownerId: user1Data.user.id,
        members: {
          create: {
            userId: user1Data.user.id,
            role: 'OWNER',
          },
        },
      },
    });

    const privateRoom = await prisma.room.create({
      data: {
        name: `Private Chat Room ${uniqueSuffix}`,
        isPrivate: true,
        language: 'python',
        ownerId: user1Data.user.id,
        members: {
          create: {
            userId: user1Data.user.id,
            role: 'OWNER',
          },
        },
      },
    });

    createdRoomIds.push(publicRoom.id, privateRoom.id);

    console.log(`✅ [Test 3/9] Created public room (${publicRoom.id}) and private room (${privateRoom.id})`);

    // 4. Connect Authenticated Sockets for User 1 & User 2
    clientSocket1 = clientIo(SERVER_URL, { auth: { token: token1 } });
    clientSocket2 = clientIo(SERVER_URL, { auth: { token: token2 } });

    await new Promise<void>((resolve, reject) => {
      let connectedCount = 0;
      const checkDone = () => {
        connectedCount++;
        if (connectedCount === 2) resolve();
      };

      clientSocket1!.on('connect', checkDone);
      clientSocket2!.on('connect', checkDone);
      clientSocket1!.on('connect_error', (err) => reject(new Error(`Socket 1 failed: ${err.message}`)));
      clientSocket2!.on('connect_error', (err) => reject(new Error(`Socket 2 failed: ${err.message}`)));
    });

    console.log('✅ [Test 4/9] Socket.IO authenticated connections established for User 1 & User 2');

    // 5. User 1 & User 2 Join Public Room and Send Real-Time Chat Message
    clientSocket1.emit(SOCKET_EVENTS.ROOM_JOIN, { roomId: publicRoom.id });
    clientSocket2.emit(SOCKET_EVENTS.ROOM_JOIN, { roomId: publicRoom.id });

    // Wait for room join state
    await new Promise((r) => setTimeout(r, 250));

    let receivedMessagePayload: MessageNewPayload | null = null;

    const messagePromise = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timeout waiting for message:new socket event')), 4000);

      clientSocket2!.on(SOCKET_EVENTS.MESSAGE_NEW, (payload: MessageNewPayload) => {
        clearTimeout(timer);
        receivedMessagePayload = payload;
        resolve();
      });
    });

    // User 1 sends message via socket
    const testContent = 'Hello world! Real-time Socket.IO chat verification.';
    clientSocket1.emit(SOCKET_EVENTS.MESSAGE_SEND, {
      roomId: publicRoom.id,
      content: testContent,
    });

    await messagePromise;

    if (!receivedMessagePayload || (receivedMessagePayload as MessageNewPayload).message.content !== testContent) {
      throw new Error('Message content mismatch or missing in socket broadcast');
    }

    console.log(`✅ [Test 5/9] Real-time message sent by User 1 and received by User 2: "${testContent}"`);

    // 6. Verify Message Persistence in PostgreSQL Database
    const messageId = (receivedMessagePayload as MessageNewPayload).message.id;
    const dbMessage = await prisma.message.findUnique({
      where: { id: messageId },
      include: { user: true },
    });

    if (!dbMessage || dbMessage.content !== testContent || dbMessage.userId !== user1Data.user.id) {
      throw new Error('Database message persistence verification failed');
    }

    console.log(`✅ [Test 6/9] Message persisted in PostgreSQL DB with id ${dbMessage.id}`);

    // 7. REST API Message Retrieval & Cursor Pagination
    const resMsg = await fetch(`${SERVER_URL}/api/rooms/${publicRoom.id}/messages?limit=10`, {
      headers: { Authorization: `Bearer ${token2}` },
    });
    const jsonMsg = await resMsg.json();

    if (!resMsg.ok || !jsonMsg.success || jsonMsg.data.messages.length === 0) {
      throw new Error(`REST message retrieval failed: ${jsonMsg.message}`);
    }

    console.log(`✅ [Test 7/9] REST API retrieved ${jsonMsg.data.messages.length} message(s) from room`);

    // 8. Private Room Authorization Enforcement
    const resForbidden = await fetch(`${SERVER_URL}/api/rooms/${privateRoom.id}/messages`, {
      headers: { Authorization: `Bearer ${token2}` },
    });
    const jsonForbidden = await resForbidden.json();

    if (resForbidden.status !== 403 || jsonForbidden.success !== false) {
      throw new Error('Private room message authorization test failed (expected 403 FORBIDDEN)');
    }

    console.log('✅ [Test 8/9] Private room access control correctly returned 403 FORBIDDEN for non-member');

    // 9. Real-Time Message Deletion
    const deletePromise = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timeout waiting for message:delete socket event')), 4000);

      clientSocket2!.on(SOCKET_EVENTS.MESSAGE_DELETE, (payload: MessageDeletePayload) => {
        if (payload.messageId === messageId) {
          clearTimeout(timer);
          resolve();
        }
      });
    });

    // User 1 deletes message via REST API
    const resDel = await fetch(`${SERVER_URL}/api/messages/${messageId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token1}` },
    });

    if (!resDel.ok) {
      const jsonDel = await resDel.json();
      throw new Error(`REST message delete failed: ${jsonDel.message}`);
    }

    await deletePromise;

    // Verify deletion in DB
    const deletedDbMsg = await prisma.message.findUnique({ where: { id: messageId } });
    if (deletedDbMsg) {
      throw new Error('Deleted message still exists in database');
    }

    console.log('✅ [Test 9/9] Message deleted successfully and real-time deletion broadcast confirmed');

    console.log('\n======================================================');
    console.log('🎉 ALL 9 CHAT VERIFICATION TESTS PASSED SUCCESSFULLY!');
    console.log('======================================================\n');
  } catch (err) {
    console.error('\n❌ Chat Verification Suite Failed:', err);
    process.exit(1);
  } finally {
    if (clientSocket1) clientSocket1.disconnect();
    if (clientSocket2) clientSocket2.disconnect();
    if (server) {
      await new Promise<void>((r) => server!.close(() => r()));
    }

    // Teardown created test rooms & users
    try {
      if (createdRoomIds.length > 0) {
        await prisma.message.deleteMany({ where: { roomId: { in: createdRoomIds } } });
        await prisma.roomMember.deleteMany({ where: { roomId: { in: createdRoomIds } } });
        await prisma.codeDocument.deleteMany({ where: { roomId: { in: createdRoomIds } } });
        await prisma.room.deleteMany({ where: { id: { in: createdRoomIds } } });
      }
      if (createdUserIds.length > 0) {
        await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
      }
    } catch (cleanupErr) {
      console.error('Warning: Failed to cleanup chat test artifacts:', cleanupErr);
    }

    await prisma.$disconnect();
  }
}

runChatVerification();
