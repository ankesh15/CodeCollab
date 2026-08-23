import http from 'http';
import { io as ClientIO, Socket as ClientSocket } from 'socket.io-client';
import {
  SOCKET_EVENTS,
  RoomStatePayload,
  RoomUserJoinedPayload,
  RoomUserLeftPayload,
  SocketErrorPayload,
} from '@codecollab/shared';
import { createApp } from '../app';
import { initSocketServer } from '../socket';
import { prisma } from '../config/db';
import { loginUser } from '../services/auth.service';

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

async function verifySocketSystem() {
  console.log('⚡ Starting Real-Time Socket.IO Signaling Verification...\n');

  // Start temporary server
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
    // Retrieve seeded user credentials
    const alexAuth = await loginUser({ email: 'alex.rivers@example.com', password: 'DevPassword123!' });
    const sarahAuth = await loginUser({ email: 'sarah.chen@example.com', password: 'DevPassword123!' });
    const michaelAuth = await loginUser({ email: 'michael.vance@example.com', password: 'DevPassword123!' });

    const publicRoom = await prisma.room.findFirst({ where: { name: 'Algo-Masterclass' } });
    const privateRoom = await prisma.room.findFirst({ where: { name: 'WebDev-Pairing' } });

    if (!publicRoom || !privateRoom) {
      throw new Error('Seeded test rooms missing');
    }

    // TEST 1: Connection with Missing / Invalid Token
    console.log('1️⃣ Testing Socket Authentication with Invalid Token...');
    const invalidSocket = createClientSocket('invalid_jwt_token');
    await new Promise<void>((resolve, reject) => {
      invalidSocket.on('connect_error', (err) => {
        if (err.message.includes('UNAUTHORIZED')) {
          console.log('  ✅ PASS: Socket connection correctly rejected with UNAUTHORIZED.');
          invalidSocket.disconnect();
          resolve();
        } else {
          reject(new Error(`Unexpected connect_error: ${err.message}`));
        }
      });
      invalidSocket.on('connect', () => {
        reject(new Error('Invalid token incorrectly allowed socket connection!'));
      });
    });

    // TEST 2: Valid Authentication Connection
    console.log('2️⃣ Testing Socket Authentication with Valid JWT...');
    const alexSocket = createClientSocket(alexAuth.token);
    await new Promise<void>((resolve, reject) => {
      alexSocket.on('connect', () => {
        console.log('  ✅ PASS: Socket successfully authenticated and connected.');
        resolve();
      });
      alexSocket.on('connect_error', (err) => reject(err));
    });

    // TEST 3: Authorized Room Join & State Delivery
    console.log('3️⃣ Testing Authorized Room Join (alex_dev joining Algo-Masterclass)...');
    await new Promise<void>((resolve, reject) => {
      alexSocket.on(SOCKET_EVENTS.ROOM_STATE, (state: RoomStatePayload) => {
        if (state.roomId === publicRoom.id && state.users.some((u) => u.username === 'alex_dev')) {
          console.log('  ✅ PASS: Room join succeeded and received initial presence state.');
          resolve();
        } else {
          reject(new Error(`Unexpected room state: ${JSON.stringify(state)}`));
        }
      });
      alexSocket.emit(SOCKET_EVENTS.ROOM_JOIN, { roomId: publicRoom.id });
    });

    // TEST 4: Non-Member Access Rejection to Private Room
    console.log('4️⃣ Testing Private Room Access Rejection (michael_tech joining WebDev-Pairing)...');
    const michaelSocket = createClientSocket(michaelAuth.token);
    await new Promise<void>((resolve, reject) => {
      michaelSocket.on('connect', () => {
        michaelSocket.emit(SOCKET_EVENTS.ROOM_JOIN, { roomId: privateRoom.id });
      });

      michaelSocket.on(SOCKET_EVENTS.ERROR, (err: SocketErrorPayload) => {
        if (err.code === 'FORBIDDEN') {
          console.log('  ✅ PASS: Non-member rejected from private room with FORBIDDEN error.');
          michaelSocket.disconnect();
          resolve();
        } else {
          reject(new Error(`Unexpected error event code: ${err.code}`));
        }
      });
    });

    // TEST 5: Multi-Client Broadcasts (room:user_joined & room:user_left)
    console.log('5️⃣ Testing Multi-Client Room Broadcasts (sarah_code joining Algo-Masterclass)...');
    const sarahSocket = createClientSocket(sarahAuth.token);

    await new Promise<void>((resolve, reject) => {
      alexSocket.on(SOCKET_EVENTS.ROOM_USER_JOINED, (payload: RoomUserJoinedPayload) => {
        if (payload.user.username === 'sarah_code') {
          console.log('  ✅ PASS: Existing member received room:user_joined event for new member.');
          resolve();
        } else {
          reject(new Error(`Unexpected user joined event: ${JSON.stringify(payload)}`));
        }
      });

      sarahSocket.on('connect', () => {
        sarahSocket.emit(SOCKET_EVENTS.ROOM_JOIN, { roomId: publicRoom.id });
      });
    });

    // TEST 6: Room Leaving
    console.log('6️⃣ Testing Room Leaving (sarah_code emitting room:leave)...');
    await new Promise<void>((resolve) => {
      alexSocket.on(SOCKET_EVENTS.ROOM_USER_LEFT, (payload: RoomUserLeftPayload) => {
        if (payload.user.username === 'sarah_code') {
          console.log('  ✅ PASS: Remaining member received room:user_left event.');
          resolve();
        }
      });
      sarahSocket.emit(SOCKET_EVENTS.ROOM_LEAVE, { roomId: publicRoom.id });
    });

    // TEST 7: Automatic Disconnect Presence Cleanup
    console.log('7️⃣ Testing Disconnect Presence Cleanup...');
    await new Promise<void>((resolve) => {
      sarahSocket.emit(SOCKET_EVENTS.ROOM_JOIN, { roomId: publicRoom.id });

      alexSocket.on(SOCKET_EVENTS.ROOM_USER_LEFT, (payload: RoomUserLeftPayload) => {
        if (payload.user.username === 'sarah_code') {
          console.log('  ✅ PASS: Disconnection automatically cleaned up presence & notified room.');
          resolve();
        }
      });

      setTimeout(() => {
        sarahSocket.disconnect();
      }, 200);
    });

    alexSocket.disconnect();
    console.log('\n🎉 ALL REAL-TIME SIGNALING & ROOM INFRASTRUCTURE TESTS PASSED!');
  } finally {
    httpServer.close();
    await prisma.$disconnect();
  }
}

verifySocketSystem().catch((err) => {
  console.error('❌ Socket verification failed:', err);
  process.exit(1);
});
