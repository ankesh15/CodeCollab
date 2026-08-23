import { PrismaClient, RoomRole, ProblemDifficulty, SubmissionStatus, NotificationType } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting CodeCollab Database Seeding...');

  // Clean existing tables in reverse dependency order
  await prisma.notification.deleteMany();
  await prisma.message.deleteMany();
  await prisma.submission.deleteMany();
  await prisma.testCase.deleteMany();
  await prisma.problem.deleteMany();
  await prisma.roomMember.deleteMany();
  await prisma.codeDocument.deleteMany();
  await prisma.room.deleteMany();
  await prisma.user.deleteMany();

  console.log('🧹 Cleaned existing development database data.');

  // 1. Seed Users
  const passwordHash = await bcrypt.hash('DevPassword123!', 10);

  // Development Admin Setup (Skipped in production for security)
  let adminUser;
  if (process.env.NODE_ENV === 'production') {
    console.warn('⚠️ WARNING: Skipping default development admin user creation in production environment.');
  } else {
    const adminPasswordHash = await bcrypt.hash('AdminPassword123!', 10);
    adminUser = await prisma.user.upsert({
      where: { email: 'admin@codecollab.dev' },
      update: {
        role: 'ADMIN',
      },
      create: {
        username: 'admin',
        email: 'admin@codecollab.dev',
        passwordHash: adminPasswordHash,
        role: 'ADMIN',
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
        bio: 'CodeCollab System Administrator.',
      },
    });
    console.log(`🛡️ Seeded development admin user: ${adminUser.username} (${adminUser.email})`);
  }

  const alex = await prisma.user.create({
    data: {
      username: 'alex_dev',
      email: 'alex.rivers@example.com',
      passwordHash,
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      bio: 'Full Stack Engineer & Competitive Programmer.',
    },
  });

  const sarah = await prisma.user.create({
    data: {
      username: 'sarah_code',
      email: 'sarah.chen@example.com',
      passwordHash,
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
      bio: 'Distributed Systems enthusiast & Open Source contributor.',
    },
  });

  const michael = await prisma.user.create({
    data: {
      username: 'michael_tech',
      email: 'michael.vance@example.com',
      passwordHash,
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
      bio: 'Backend Specialist passionate about Node.js & Docker.',
    },
  });

  console.log(`👤 Created 3 development users: ${alex.username}, ${sarah.username}, ${michael.username}`);

  // 2. Seed Rooms & Code Documents
  const room1 = await prisma.room.create({
    data: {
      name: 'Algo-Masterclass',
      ownerId: alex.id,
      language: 'cpp',
      currentCode: `#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    // Write C++ code here\n    cout << "Hello CodeCollab!" << endl;\n    return 0;\n}`,
      isPrivate: false,
    },
  });

  await prisma.codeDocument.create({
    data: {
      roomId: room1.id,
      language: 'cpp',
      content: `#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    // Write C++ code here\n    cout << "Hello CodeCollab!" << endl;\n    return 0;\n}`,
      version: 1,
    },
  });

  const room2 = await prisma.room.create({
    data: {
      name: 'WebDev-Pairing',
      ownerId: sarah.id,
      language: 'javascript',
      currentCode: `// WebDev Pairing Workspace\nconsole.log("Welcome to WebDev Pairing!");`,
      isPrivate: true,
    },
  });

  await prisma.codeDocument.create({
    data: {
      roomId: room2.id,
      language: 'javascript',
      content: `// WebDev Pairing Workspace\nconsole.log("Welcome to WebDev Pairing!");`,
      version: 1,
    },
  });

  console.log(`🏠 Created 2 rooms and documents: ${room1.name}, ${room2.name}`);

  // 3. Seed Room Members
  await prisma.roomMember.createMany({
    data: [
      { roomId: room1.id, userId: alex.id, role: RoomRole.OWNER },
      { roomId: room1.id, userId: sarah.id, role: RoomRole.ADMIN },
      { roomId: room1.id, userId: michael.id, role: RoomRole.MEMBER },
      { roomId: room2.id, userId: sarah.id, role: RoomRole.OWNER },
      { roomId: room2.id, userId: alex.id, role: RoomRole.MEMBER },
    ],
  });

  console.log('👥 Seeded room memberships and roles.');

  // 4. Seed Problems
  const problem1 = await prisma.problem.create({
    data: {
      title: 'Two Sum',
      description:
        'Given an array of integers `nums` and an integer `target`, return indices of the two numbers such that they add up to `target`.',
      difficulty: ProblemDifficulty.EASY,
      constraints: '2 <= nums.length <= 10^4\n-10^9 <= nums[i] <= 10^9\nOnly one valid answer exists.',
      inputFormat: 'Line 1: Comma-separated array of integers\nLine 2: Target integer',
      outputFormat: 'Array of two indices [i, j]',
    },
  });

  const problem2 = await prisma.problem.create({
    data: {
      title: 'Reverse Linked List',
      description: 'Given the head of a singly linked list, reverse the list, and return the reversed list.',
      difficulty: ProblemDifficulty.EASY,
      constraints: 'The number of nodes in the list is in the range [0, 5000].\n-5000 <= Node.val <= 5000',
      inputFormat: 'Head node array representation',
      outputFormat: 'Reversed head node array representation',
    },
  });

  const problem3 = await prisma.problem.create({
    data: {
      title: 'Valid Parentheses',
      description:
        "Given a string `s` containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid.",
      difficulty: ProblemDifficulty.MEDIUM,
      constraints: '1 <= s.length <= 10^4\ns consists of parentheses only.',
      inputFormat: 'String s',
      outputFormat: 'Boolean true or false',
    },
  });

  console.log(`🧩 Created 3 programming problems: ${problem1.title}, ${problem2.title}, ${problem3.title}`);

  // 5. Seed Test Cases
  await prisma.testCase.createMany({
    data: [
      // Two Sum Test Cases
      {
        problemId: problem1.id,
        input: '[2, 7, 11, 15]\n9',
        expectedOutput: '[0, 1]',
        isHidden: false,
      },
      {
        problemId: problem1.id,
        input: '[3, 2, 4]\n6',
        expectedOutput: '[1, 2]',
        isHidden: false,
      },
      {
        problemId: problem1.id,
        input: '[3, 3]\n6',
        expectedOutput: '[0, 1]',
        isHidden: true,
      },
      // Valid Parentheses Test Cases
      {
        problemId: problem3.id,
        input: '"()"',
        expectedOutput: 'true',
        isHidden: false,
      },
      {
        problemId: problem3.id,
        input: '"()[]{}"',
        expectedOutput: 'true',
        isHidden: false,
      },
      {
        problemId: problem3.id,
        input: '"(]"',
        expectedOutput: 'false',
        isHidden: true,
      },
    ],
  });

  console.log('🧪 Seeded public and hidden test cases.');

  // 6. Seed Submissions
  await prisma.submission.createMany({
    data: [
      {
        userId: alex.id,
        problemId: problem1.id,
        roomId: room1.id,
        language: 'typescript',
        sourceCode: `function twoSum(nums: number[], target: number) { ... }`,
        status: SubmissionStatus.ACCEPTED,
        executionTime: 42.5,
        memoryUsed: 14.2,
      },
      {
        userId: michael.id,
        problemId: problem1.id,
        roomId: room1.id,
        language: 'javascript',
        sourceCode: `function twoSum(nums, target) { return [0, 0]; }`,
        status: SubmissionStatus.WRONG_ANSWER,
        executionTime: 18.0,
        memoryUsed: 12.8,
      },
      {
        userId: sarah.id,
        problemId: problem3.id,
        language: 'typescript',
        sourceCode: `function isValid(s: string): boolean { ... }`,
        status: SubmissionStatus.ACCEPTED,
        executionTime: 36.1,
        memoryUsed: 13.9,
      },
    ],
  });

  console.log('📊 Seeded initial user submissions.');

  // 7. Seed Messages
  await prisma.message.createMany({
    data: [
      {
        roomId: room1.id,
        userId: alex.id,
        content: 'Welcome everyone to the Algo Masterclass session!',
      },
      {
        roomId: room1.id,
        userId: sarah.id,
        content: 'Excited to practice Two Sum using a hash map approach.',
      },
      {
        roomId: room1.id,
        userId: michael.id,
        content: 'Just joined the room. Looking forward to pair coding!',
      },
    ],
  });

  console.log('💬 Seeded room chat messages.');

  // 8. Seed Notifications
  await prisma.notification.createMany({
    data: [
      {
        userId: michael.id,
        type: NotificationType.ROOM_INVITE,
        message: 'Alex invited you to join room: Algo-Masterclass',
        read: true,
      },
      {
        userId: alex.id,
        type: NotificationType.SUBMISSION_RESULT,
        message: 'Your submission for Two Sum was ACCEPTED (42.5ms)',
        read: false,
      },
      {
        userId: sarah.id,
        type: NotificationType.SYSTEM_ANNOUNCEMENT,
        message: 'Welcome to CodeCollab! Explore room collaboration features.',
        read: false,
      },
    ],
  });

  console.log('🔔 Seeded user notifications.');
  console.log('✅ CodeCollab Database Seeding Completed Successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
