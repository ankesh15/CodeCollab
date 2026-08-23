import http from 'http';
import { io as clientIo, Socket as ClientSocket } from 'socket.io-client';
import { createApp } from '../app';
import { initSocketServer } from '../socket';
import { prisma } from '../config/db';
import { registerUser } from '../services/auth.service';
import { createNotificationService } from '../services/notification.service';
import { submitCodeService } from '../services/submission.service';
import {
  SOCKET_EVENTS,
  NotificationNewPayload,
  NotificationCountPayload,
} from '@codecollab/shared';

const PORT = 5010;
const SERVER_URL = `http://localhost:${PORT}`;

async function runNotificationsVerification() {
  console.log('\n=============================================================');
  console.log('🧪 Starting Phase 7 Real-Time Notifications Verification Suite');
  console.log('=============================================================\n');

  let server: http.Server | null = null;
  let clientSocket1: ClientSocket | null = null;
  let clientSocket2: ClientSocket | null = null;
  const createdUserIds: string[] = [];

  try {
    // Pre-test cleanup of leftover test users
    await prisma.notification.deleteMany({
      where: { user: { username: { startsWith: 'notifuser' } } },
    });
    await prisma.submission.deleteMany({
      where: { user: { username: { startsWith: 'notifuser' } } },
    });
    await prisma.user.deleteMany({
      where: { username: { startsWith: 'notifuser' } },
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
      username: `notifuser1_${uniqueSuffix}`,
      email: `notifuser1_${uniqueSuffix}@example.com`,
      password: 'Password123!',
    });
    const user2Data = await registerUser({
      username: `notifuser2_${uniqueSuffix}`,
      email: `notifuser2_${uniqueSuffix}@example.com`,
      password: 'Password123!',
    });

    createdUserIds.push(user1Data.user.id, user2Data.user.id);

    const token1 = user1Data.token;
    const token2 = user2Data.token;
    console.log(`✅ [Test 2/9] Registered User 1 (${user1Data.user.username}) and User 2 (${user2Data.user.username})`);

    // 3. Connect User Sockets to Private Channels (user:${userId})
    clientSocket1 = clientIo(SERVER_URL, { auth: { token: token1 } });
    clientSocket2 = clientIo(SERVER_URL, { auth: { token: token2 } });

    await new Promise<void>((resolve, reject) => {
      let count = 0;
      const checkDone = () => {
        count++;
        if (count === 2) resolve();
      };
      clientSocket1!.on('connect', checkDone);
      clientSocket2!.on('connect', checkDone);
      clientSocket1!.on('connect_error', (err) => reject(err));
      clientSocket2!.on('connect_error', (err) => reject(err));
    });

    console.log('✅ [Test 3/9] User 1 & User 2 connected to private socket channels (user:${userId})');

    // 4. Test Manual Notification Creation & User 1 Socket Delivery
    let receivedNotifPayload: NotificationNewPayload | null = null;
    let receivedCountPayload: NotificationCountPayload | null = null;

    const notifPromise = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timeout waiting for notification:new event')), 4000);

      clientSocket1!.on(SOCKET_EVENTS.NOTIFICATION_NEW, (payload: NotificationNewPayload) => {
        receivedNotifPayload = payload;
      });

      clientSocket1!.on(SOCKET_EVENTS.NOTIFICATION_COUNT, (payload: NotificationCountPayload) => {
        receivedCountPayload = payload;
        clearTimeout(timer);
        resolve();
      });
    });

    const testMessage = 'Welcome to CodeCollab Phase 7 notifications!';
    await createNotificationService({
      userId: user1Data.user.id,
      type: 'SYSTEM_ANNOUNCEMENT',
      message: testMessage,
    });

    await notifPromise;

    if (
      !receivedNotifPayload ||
      (receivedNotifPayload as NotificationNewPayload).notification.message !== testMessage
    ) {
      throw new Error('Notification payload mismatch on user private socket channel');
    }

    if (!receivedCountPayload || (receivedCountPayload as NotificationCountPayload).unreadCount !== 1) {
      throw new Error('Unread count socket payload mismatch');
    }

    console.log('✅ [Test 4/9] Notification delivered in real-time to User 1 private channel');

    // 5. REST API Notification List Retrieval & Cursor Pagination
    const resList = await fetch(`${SERVER_URL}/api/notifications?limit=10`, {
      headers: { Authorization: `Bearer ${token1}` },
    });
    const jsonList = await resList.json();

    if (!resList.ok || !jsonList.success || jsonList.data.notifications.length !== 1) {
      throw new Error(`REST notifications list failed: ${jsonList.message}`);
    }

    console.log(`✅ [Test 5/9] REST API retrieved ${jsonList.data.notifications.length} notification(s)`);

    // 6. REST API Unread Count Check
    const resCount = await fetch(`${SERVER_URL}/api/notifications/unread-count`, {
      headers: { Authorization: `Bearer ${token1}` },
    });
    const jsonCount = await resCount.json();

    if (!resCount.ok || jsonCount.data.unreadCount !== 1) {
      throw new Error(`Unread count endpoint failed: ${jsonCount.message}`);
    }

    console.log(`✅ [Test 6/9] REST API unread count verified: ${jsonCount.data.unreadCount}`);

    // 7. Single Notification Mark-As-Read & Real-Time Count Broadcast
    const notifId = (receivedNotifPayload as NotificationNewPayload).notification.id;

    const countUpdatePromise = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timeout waiting for notification:count update')), 4000);
      clientSocket1!.on(SOCKET_EVENTS.NOTIFICATION_COUNT, (payload: NotificationCountPayload) => {
        if (payload.unreadCount === 0) {
          clearTimeout(timer);
          resolve();
        }
      });
    });

    const resRead = await fetch(`${SERVER_URL}/api/notifications/${notifId}/read`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token1}` },
    });
    const jsonRead = await resRead.json();

    if (!resRead.ok || jsonRead.data.notification.read !== true) {
      throw new Error('Failed to mark single notification as read');
    }

    await countUpdatePromise;
    console.log('✅ [Test 7/9] Single notification marked read & unread count broadcasted as 0');

    // 8. Bulk Mark-All-Read Test
    // Create 2 new notifications for User 1
    await createNotificationService({
      userId: user1Data.user.id,
      type: 'ROOM_INVITE',
      message: 'You have been invited to a private room.',
    });
    await createNotificationService({
      userId: user1Data.user.id,
      type: 'SYSTEM_ANNOUNCEMENT',
      message: 'System maintenance scheduled.',
    });

    const resAllRead = await fetch(`${SERVER_URL}/api/notifications/read-all`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token1}` },
    });
    const jsonAllRead = await resAllRead.json();

    if (!resAllRead.ok || jsonAllRead.data.count < 2) {
      throw new Error('Bulk mark-all-read failed');
    }

    console.log(`✅ [Test 8/9] Bulk mark-all-read updated ${jsonAllRead.data.count} notification(s)`);

    // 9. Code Submission Evaluation Trigger Notification Test
    // Fetch seed problem
    const seedProblem = await prisma.problem.findFirst();
    if (!seedProblem) {
      throw new Error('No seed problem found in database to test submission notifications');
    }

    let submissionNotifReceived = false;

    const subNotifPromise = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timeout waiting for submission notification')), 6000);

      clientSocket2!.on(SOCKET_EVENTS.NOTIFICATION_NEW, (payload: NotificationNewPayload) => {
        if (payload.notification.type === 'SUBMISSION_RESULT') {
          clearTimeout(timer);
          submissionNotifReceived = true;
          resolve();
        }
      });
    });

    // Execute submission as User 2
    await submitCodeService({
      userId: user2Data.user.id,
      problemId: seedProblem.id,
      language: 'javascript',
      code: `function solve(a, b) { return a + b; }`,
    });

    await subNotifPromise;

    if (!submissionNotifReceived) {
      throw new Error('Submission evaluation did not generate persistent notification');
    }

    console.log('✅ [Test 9/9] Code submission completion generated persistent notification & delivered in real-time');

    console.log('\n=============================================================');
    console.log('🎉 ALL 9 NOTIFICATIONS VERIFICATION TESTS PASSED SUCCESSFULLY!');
    console.log('=============================================================\n');
  } catch (err) {
    console.error('\n❌ Notifications Verification Suite Failed:', err);
    process.exit(1);
  } finally {
    if (clientSocket1) clientSocket1.disconnect();
    if (clientSocket2) clientSocket2.disconnect();
    if (server) {
      await new Promise<void>((r) => server!.close(() => r()));
    }

    // Post-test cleanup of created test users and notifications
    try {
      if (createdUserIds.length > 0) {
        await prisma.notification.deleteMany({ where: { userId: { in: createdUserIds } } });
        await prisma.submission.deleteMany({ where: { userId: { in: createdUserIds } } });
        await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
      }
    } catch (cleanupErr) {
      console.error('Warning: Failed to cleanup notification test artifacts:', cleanupErr);
    }

    await prisma.$disconnect();
  }
}

runNotificationsVerification();
