import { prisma } from '../config/db';
import { registerUser } from '../services/auth.service';
import {
  getUserStatisticsService,
  getUserActivityService,
  getUserRankService,
  getGlobalLeaderboardService,
  getRoomLeaderboardService,
  getProblemStatisticsService,
} from '../services/analytics.service';
import { RoomRole } from '@prisma/client';

async function runVerification() {
  console.log('====================================================');
  console.log('   CodeCollab Phase 8 Analytics & Leaderboard Verification   ');
  console.log('====================================================\n');

  let passedTests = 0;
  const totalTests = 22;

  const timestamp = Date.now();
  const testUserAEmail = `analytics_user_a_${timestamp}@codecollab.io`;
  const testUserBEmail = `analytics_user_b_${timestamp}@codecollab.io`;

  // 1. Setup Test Data (2 users, 2 problems, 1 room)
  const userA = await registerUser({ email: testUserAEmail, password: 'Password123!', username: `analytics_user_a_${timestamp}` });
  const userB = await registerUser({ email: testUserBEmail, password: 'Password123!', username: `analytics_user_b_${timestamp}` });

  const easyProblem = await prisma.problem.create({
    data: {
      title: `Analytics Test Easy ${timestamp}`,
      description: 'Test easy problem description',
      difficulty: 'EASY',
      constraints: '1 <= N <= 100',
      inputFormat: 'Array',
      outputFormat: 'Array',
    },
  });

  const hardProblem = await prisma.problem.create({
    data: {
      title: `Analytics Test Hard ${timestamp}`,
      description: 'Test hard problem description',
      difficulty: 'HARD',
      constraints: '1 <= N <= 10^5',
      inputFormat: 'Array',
      outputFormat: 'Array',
    },
  });

  const testRoom = await prisma.room.create({
    data: {
      name: `Analytics Room ${timestamp}`,
      isPrivate: false,
      ownerId: userA.user.id,
      language: 'cpp',
      members: {
        create: [
          { userId: userA.user.id, role: RoomRole.OWNER },
          { userId: userB.user.id, role: RoomRole.MEMBER },
        ],
      },
    },
  });

  try {
    // ----------------------------------------------------
    // Test 1: Zero-data user stats
    // ----------------------------------------------------
    console.log('[Test 1] Verifying zero-data user stats...');
    const zeroStats = await getUserStatisticsService(userA.user.id);
    if (
      zeroStats.totalSubmissions === 0 &&
      zeroStats.acceptedSubmissions === 0 &&
      zeroStats.problemsSolved === 0 &&
      zeroStats.acceptanceRate === 0 &&
      zeroStats.difficulty.easy === 0 &&
      zeroStats.difficulty.medium === 0 &&
      zeroStats.difficulty.hard === 0 &&
      zeroStats.runtime.averageMs === 0 &&
      zeroStats.memory.averageMb === 0
    ) {
      console.log('✅ Test 1 Passed: Zero-data stats handled cleanly.');
      passedTests++;
    } else {
      console.error('❌ Test 1 Failed: Unexpected zero-data stats:', zeroStats);
    }

    // Populate submissions for User A & User B
    // User A submissions:
    // 1. Easy Problem -> ACCEPTED (runtime 20ms, memory 10MB) [In Room]
    // 2. Easy Problem -> ACCEPTED (runtime 10ms, memory 8MB) [Multiple solve check]
    // 3. Hard Problem -> ACCEPTED (runtime 100ms, memory 25MB) [Global]
    // 4. Hard Problem -> WRONG_ANSWER [Global]
    await prisma.submission.createMany({
      data: [
        {
          userId: userA.user.id,
          problemId: easyProblem.id,
          roomId: testRoom.id,
          language: 'cpp',
          sourceCode: 'int main(){}',
          status: 'ACCEPTED',
          executionTime: 20,
          memoryUsed: 10,
        },
        {
          userId: userA.user.id,
          problemId: easyProblem.id,
          roomId: testRoom.id,
          language: 'cpp',
          sourceCode: 'int main(){}',
          status: 'ACCEPTED',
          executionTime: 10,
          memoryUsed: 8,
        },
        {
          userId: userA.user.id,
          problemId: hardProblem.id,
          roomId: null,
          language: 'cpp',
          sourceCode: 'int main(){}',
          status: 'ACCEPTED',
          executionTime: 100,
          memoryUsed: 25,
        },
        {
          userId: userA.user.id,
          problemId: hardProblem.id,
          roomId: null,
          language: 'cpp',
          sourceCode: 'int main(){}',
          status: 'WRONG_ANSWER',
          executionTime: null,
          memoryUsed: null,
        },
      ],
    });

    // User B submissions:
    // 1. Easy Problem -> ACCEPTED (runtime 30ms, memory 12MB) [In Room]
    // 2. Easy Problem -> WRONG_ANSWER [In Room]
    // 3. Easy Problem -> WRONG_ANSWER [In Room]
    // 4. Easy Problem -> WRONG_ANSWER [In Room]
    await prisma.submission.createMany({
      data: [
        {
          userId: userB.user.id,
          problemId: easyProblem.id,
          roomId: testRoom.id,
          language: 'python',
          sourceCode: 'print("hello")',
          status: 'ACCEPTED',
          executionTime: 30,
          memoryUsed: 12,
        },
        {
          userId: userB.user.id,
          problemId: easyProblem.id,
          roomId: testRoom.id,
          language: 'python',
          sourceCode: 'print("error")',
          status: 'WRONG_ANSWER',
        },
        {
          userId: userB.user.id,
          problemId: easyProblem.id,
          roomId: testRoom.id,
          language: 'python',
          sourceCode: 'print("error")',
          status: 'WRONG_ANSWER',
        },
        {
          userId: userB.user.id,
          problemId: easyProblem.id,
          roomId: testRoom.id,
          language: 'python',
          sourceCode: 'print("error")',
          status: 'WRONG_ANSWER',
        },
      ],
    });

    const userAStats = await getUserStatisticsService(userA.user.id);

    // ----------------------------------------------------
    // Test 2: Total submissions count
    // ----------------------------------------------------
    console.log('[Test 2] Verifying total submissions count...');
    if (userAStats.totalSubmissions === 4) {
      console.log('✅ Test 2 Passed: Total submissions count matches (4).');
      passedTests++;
    } else {
      console.error(`❌ Test 2 Failed: Expected 4, got ${userAStats.totalSubmissions}`);
    }

    // ----------------------------------------------------
    // Test 3: Accepted submissions count
    // ----------------------------------------------------
    console.log('[Test 3] Verifying accepted submissions count...');
    if (userAStats.acceptedSubmissions === 3) {
      console.log('✅ Test 3 Passed: Accepted submissions count matches (3).');
      passedTests++;
    } else {
      console.error(`❌ Test 3 Failed: Expected 3, got ${userAStats.acceptedSubmissions}`);
    }

    // ----------------------------------------------------
    // Test 4: Distinct solved problems logic
    // ----------------------------------------------------
    console.log('[Test 4] Verifying distinct solved problems count...');
    if (userAStats.problemsSolved === 2) {
      console.log('✅ Test 4 Passed: Distinct solved problems count matches (2: Easy + Hard).');
      passedTests++;
    } else {
      console.error(`❌ Test 4 Failed: Expected 2 distinct problems, got ${userAStats.problemsSolved}`);
    }

    // ----------------------------------------------------
    // Test 5: Acceptance rate calculation
    // ----------------------------------------------------
    console.log('[Test 5] Verifying acceptance rate formula (3/4 = 75%)...');
    if (userAStats.acceptanceRate === 75) {
      console.log('✅ Test 5 Passed: Acceptance rate is exactly 75%.');
      passedTests++;
    } else {
      console.error(`❌ Test 5 Failed: Expected 75%, got ${userAStats.acceptanceRate}%`);
    }

    // ----------------------------------------------------
    // Test 6: Difficulty breakdown
    // ----------------------------------------------------
    console.log('[Test 6] Verifying difficulty breakdown...');
    if (userAStats.difficulty.easy === 1 && userAStats.difficulty.hard === 1 && userAStats.difficulty.medium === 0) {
      console.log('✅ Test 6 Passed: Difficulty breakdown matches (1 Easy, 0 Medium, 1 Hard).');
      passedTests++;
    } else {
      console.error('❌ Test 6 Failed: Unexpected difficulty breakdown:', userAStats.difficulty);
    }

    // ----------------------------------------------------
    // Test 7: Runtime & Best Runtime metrics
    // ----------------------------------------------------
    console.log('[Test 7] Verifying runtime & best runtime metrics...');
    // ACCEPTED runtimes for User A: 20ms, 10ms, 100ms -> Avg: (20+10+100)/3 = 43.33 -> 43ms. Min: 10ms.
    if (userAStats.runtime.bestMs === 10 && userAStats.runtime.averageMs === 43) {
      console.log('✅ Test 7 Passed: Runtime metrics match (Best: 10ms, Avg: 43ms).');
      passedTests++;
    } else {
      console.error('❌ Test 7 Failed: Unexpected runtime metrics:', userAStats.runtime);
    }

    // ----------------------------------------------------
    // Test 8: 30-day activity date grouping
    // ----------------------------------------------------
    console.log('[Test 8] Verifying 30-day activity date grouping...');
    const activity = await getUserActivityService(userA.user.id, 30);
    const todayStr = new Date().toISOString().split('T')[0];
    const todayPoint = activity.find((p) => p.date === todayStr);

    if (activity.length === 30 && todayPoint && todayPoint.submissions === 4) {
      console.log('✅ Test 8 Passed: 30-day activity array has 30 items with 4 submissions today.');
      passedTests++;
    } else {
      console.error('❌ Test 8 Failed: Activity points mismatch:', { len: activity.length, todayPoint });
    }

    // ----------------------------------------------------
    // Test 9: Global leaderboard ranking order
    // ----------------------------------------------------
    console.log('[Test 9] Verifying global leaderboard ranking order...');
    const leaderboardData = await getGlobalLeaderboardService(10);
    const rankUserA = leaderboardData.leaderboard.find((e) => e.user.id === userA.user.id);
    const rankUserB = leaderboardData.leaderboard.find((e) => e.user.id === userB.user.id);

    if (rankUserA && rankUserB && rankUserA.rank < rankUserB.rank) {
      console.log(`✅ Test 9 Passed: User A (Rank #${rankUserA.rank}) leads User B (Rank #${rankUserB.rank}).`);
      passedTests++;
    } else {
      console.error('❌ Test 9 Failed: Unexpected leaderboard order:', { rankUserA, rankUserB });
    }

    // ----------------------------------------------------
    // Test 10: Leaderboard tie-breaking logic
    // ----------------------------------------------------
    console.log('[Test 10] Verifying tie-breaking logic (Same problems solved, higher acceptance rate ranks higher)...');
    // Create User C with 1 problem solved (100% acceptance rate: 1/1) vs User B with 1 problem solved (25% acceptance rate: 1/4)
    const userCEmail = `analytics_user_c_${timestamp}@codecollab.io`;
    const userC = await registerUser({ email: userCEmail, password: 'Password123!', username: `analytics_user_c_${timestamp}` });

    await prisma.submission.create({
      data: {
        userId: userC.user.id,
        problemId: easyProblem.id,
        status: 'ACCEPTED',
        language: 'javascript',
        sourceCode: 'console.log("ok")',
      },
    });

    const tieBreakLeaderboard = await getGlobalLeaderboardService(100);
    const entryB = tieBreakLeaderboard.leaderboard.find((e) => e.user.id === userB.user.id);
    const entryC = tieBreakLeaderboard.leaderboard.find((e) => e.user.id === userC.user.id);

    if (entryB && entryC && entryC.problemsSolved === entryB.problemsSolved && entryC.rank < entryB.rank) {
      console.log(
        `✅ Test 10 Passed: User C (100% rate, Rank #${entryC.rank}) beats User B (25% rate, Rank #${entryB.rank}).`
      );
      passedTests++;
    } else {
      console.error('❌ Test 10 Failed: Tie-breaking rules failed:', { entryB, entryC });
    }

    // ----------------------------------------------------
    // Test 11: Leaderboard cursor pagination
    // ----------------------------------------------------
    console.log('[Test 11] Verifying leaderboard cursor pagination...');
    const page1 = await getGlobalLeaderboardService(1);
    const page2 = await getGlobalLeaderboardService(1, page1.nextCursor || undefined);

    if (page1.leaderboard.length === 1 && page2.leaderboard.length === 1 && page1.leaderboard[0]?.user.id !== page2.leaderboard[0]?.user.id) {
      console.log('✅ Test 11 Passed: Cursor pagination cleanly navigates pages.');
      passedTests++;
    } else {
      console.error('❌ Test 11 Failed: Pagination error:', { page1, page2 });
    }

    // ----------------------------------------------------
    // Test 12: Authenticated user rank lookup
    // ----------------------------------------------------
    console.log('[Test 12] Verifying user rank lookup service...');
    const rankA = await getUserRankService(userA.user.id);
    if (rankA !== null && rankA > 0) {
      console.log(`✅ Test 12 Passed: User A rank lookup returned #${rankA}.`);
      passedTests++;
    } else {
      console.error(`❌ Test 12 Failed: Invalid user rank: ${rankA}`);
    }

    // ----------------------------------------------------
    // Test 13: Leaderboard data privacy
    // ----------------------------------------------------
    console.log('[Test 13] Verifying leaderboard privacy protection (no email/password leak)...');
    const firstEntry = page1.leaderboard[0];
    const userKeys = firstEntry ? Object.keys(firstEntry.user) : [];
    if (!userKeys.includes('password') && !userKeys.includes('email') && !userKeys.includes('token')) {
      console.log('✅ Test 13 Passed: User privacy protected in leaderboard DTO.');
      passedTests++;
    } else {
      console.error('❌ Test 13 Failed: Sensitive fields present in user DTO:', userKeys);
    }

    // ----------------------------------------------------
    // Test 14: Room leaderboard RBAC enforcement
    // ----------------------------------------------------
    console.log('[Test 14] Verifying room leaderboard member access...');
    const roomLeaderboard = await getRoomLeaderboardService(testRoom.id);
    if (roomLeaderboard && roomLeaderboard.leaderboard.length === 2) {
      console.log('✅ Test 14 Passed: Room leaderboard returns room members.');
      passedTests++;
    } else {
      console.error('❌ Test 14 Failed: Room leaderboard member count mismatch:', roomLeaderboard);
    }

    // ----------------------------------------------------
    // Test 15: Room leaderboard isolation
    // ----------------------------------------------------
    console.log('[Test 15] Verifying room leaderboard isolation...');
    // User A has 2 solved total (1 in room, 1 outside room). In room leaderboard, problemsSolved should be 1.
    const roomUserA = roomLeaderboard.leaderboard.find((e) => e.user.id === userA.user.id);
    if (roomUserA && roomUserA.problemsSolved === 1) {
      console.log('✅ Test 15 Passed: Room leaderboard isolates submissions to testRoom (1 solved).');
      passedTests++;
    } else {
      console.error('❌ Test 15 Failed: Room isolation error:', roomUserA);
    }

    // ----------------------------------------------------
    // Test 16: Room leaderboard distinct solved problems
    // ----------------------------------------------------
    console.log('[Test 16] Verifying room leaderboard distinct solved problems count...');
    // User A solved Easy Problem twice in testRoom. Distinct count should still be 1.
    if (roomUserA && roomUserA.problemsSolved === 1) {
      console.log('✅ Test 16 Passed: Duplicate room submissions correctly counted as 1 distinct problem.');
      passedTests++;
    } else {
      console.error('❌ Test 16 Failed: Distinct room count error:', roomUserA);
    }

    // ----------------------------------------------------
    // Test 17: Room leaderboard ranking
    // ----------------------------------------------------
    console.log('[Test 17] Verifying room leaderboard ranking (User A 100% vs User B 25%)...');
    const roomUserB = roomLeaderboard.leaderboard.find((e) => e.user.id === userB.user.id);
    if (roomUserA && roomUserB && roomUserA.rank === 1 && roomUserB.rank === 2) {
      console.log('✅ Test 17 Passed: User A ranks #1, User B ranks #2 in room leaderboard.');
      passedTests++;
    } else {
      console.error('❌ Test 17 Failed: Room ranking error:', { roomUserA, roomUserB });
    }

    // ----------------------------------------------------
    // Test 18: Problem statistics attempts count
    // ----------------------------------------------------
    console.log('[Test 18] Verifying problem statistics attempts count...');
    const easyStats = await getProblemStatisticsService(easyProblem.id);
    // Submissions for Easy Problem: User A (2), User B (4), User C (1) = 7 total attempts
    if (easyStats.attempts === 7) {
      console.log('✅ Test 18 Passed: Problem attempts count matches (7).');
      passedTests++;
    } else {
      console.error(`❌ Test 18 Failed: Expected 7 attempts, got ${easyStats.attempts}`);
    }

    // ----------------------------------------------------
    // Test 19: Problem statistics accepted count
    // ----------------------------------------------------
    console.log('[Test 19] Verifying problem statistics accepted count...');
    // ACCEPTED for Easy Problem: User A (2), User B (1), User C (1) = 4 accepted
    if (easyStats.accepted === 4) {
      console.log('✅ Test 19 Passed: Problem accepted count matches (4).');
      passedTests++;
    } else {
      console.error(`❌ Test 19 Failed: Expected 4 accepted, got ${easyStats.accepted}`);
    }

    // ----------------------------------------------------
    // Test 20: Problem statistics unique users attempted
    // ----------------------------------------------------
    console.log('[Test 20] Verifying unique users attempted problem count...');
    if (easyStats.uniqueUsers === 3) {
      console.log('✅ Test 20 Passed: Unique users attempted count matches (3).');
      passedTests++;
    } else {
      console.error(`❌ Test 20 Failed: Expected 3 unique users attempted, got ${easyStats.uniqueUsers}`);
    }

    // ----------------------------------------------------
    // Test 21: Problem statistics solved by unique users count
    // ----------------------------------------------------
    console.log('[Test 21] Verifying unique users solved problem count...');
    if (easyStats.solvedBy === 3) {
      console.log('✅ Test 21 Passed: Solved by unique users count matches (3).');
      passedTests++;
    } else {
      console.error(`❌ Test 21 Failed: Expected 3 unique users solved, got ${easyStats.solvedBy}`);
    }

    // ----------------------------------------------------
    // Test 22: Problem statistics acceptance rate & average runtime
    // ----------------------------------------------------
    console.log('[Test 22] Verifying problem acceptance rate & runtime averages...');
    // Evaluated: 7, Accepted: 4 -> Rate: (4/7)*100 = 57.14%. Avg Runtime: (20+10+30)/3 = 20ms (User C runtime null).
    if (easyStats.acceptanceRate === 57.14 && easyStats.averageRuntimeMs === 20) {
      console.log('✅ Test 22 Passed: Problem acceptance rate (57.14%) & avg runtime (20ms) match.');
      passedTests++;
    } else {
      console.error('❌ Test 22 Failed: Problem rate/runtime error:', easyStats);
    }
  } catch (err) {
    console.error('❌ Verification suite execution error:', err);
  } finally {
    // Cleanup created test records
    await prisma.submission.deleteMany({
      where: {
        userId: { in: [userA.user.id, userB.user.id] },
      },
    });
    await prisma.room.deleteMany({ where: { id: testRoom.id } });
    await prisma.problem.deleteMany({
      where: { id: { in: [easyProblem.id, hardProblem.id] } },
    });
    await prisma.user.deleteMany({
      where: { email: { in: [testUserAEmail, testUserBEmail, `analytics_user_c_${timestamp}@codecollab.io`] } },
    });
  }

  console.log('\n====================================================');
  console.log(`   Verification Summary: ${passedTests}/${totalTests} Passed   `);
  console.log('====================================================');

  if (passedTests === totalTests) {
    console.log('🎉 PHASE 8 VERIFICATION SUCCESSFUL!');
    process.exit(0);
  } else {
    console.error('❌ PHASE 8 VERIFICATION FAILED.');
    process.exit(1);
  }
}

runVerification();
