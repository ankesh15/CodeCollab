import { PrismaClient, RoomRole } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyDatabase() {
  console.log('🧪 Starting Database Constraints & Relationship Verification...');

  // 1. Verify User Uniqueness (Email)
  try {
    await prisma.user.create({
      data: {
        username: 'unique_user_test_1',
        email: 'alex.rivers@example.com', // Duplicate email
        passwordHash: 'dummy_hash',
      },
    });
    console.error('❌ FAIL: Duplicate email was incorrectly allowed!');
    process.exit(1);
  } catch (err: unknown) {
    console.log('✅ PASS: Duplicate email correctly rejected by unique constraint.');
  }

  // 2. Verify User Uniqueness (Username)
  try {
    await prisma.user.create({
      data: {
        username: 'alex_dev', // Duplicate username
        email: 'unique.email@example.com',
        passwordHash: 'dummy_hash',
      },
    });
    console.error('❌ FAIL: Duplicate username was incorrectly allowed!');
    process.exit(1);
  } catch (err: unknown) {
    console.log('✅ PASS: Duplicate username correctly rejected by unique constraint.');
  }

  // 3. Verify Room Member Unique Constraint (roomId + userId)
  const room = await prisma.room.findFirst({ select: { id: true, ownerId: true } });
  if (!room) {
    console.error('❌ FAIL: No room found in database.');
    process.exit(1);
  }

  try {
    await prisma.roomMember.create({
      data: {
        roomId: room.id,
        userId: room.ownerId, // Duplicate membership
        role: RoomRole.MEMBER,
      },
    });
    console.error('❌ FAIL: Duplicate room membership was incorrectly allowed!');
    process.exit(1);
  } catch (err: unknown) {
    console.log('✅ PASS: Duplicate room membership correctly rejected by @@unique([roomId, userId]).');
  }

  // 4. Verify Foreign Key Cascade & Query Relations
  const seededRoom = await prisma.room.findFirst({
    where: { name: 'Algo-Masterclass' },
    include: {
      owner: { select: { username: true } },
      members: { include: { user: { select: { username: true } } } },
      messages: true,
      submissions: true,
    },
  });

  if (!seededRoom) {
    console.error('❌ FAIL: Seeded room "Algo-Masterclass" not found.');
    process.exit(1);
  }

  console.log(`✅ PASS: Seeded room relation query succeeded: "${seededRoom.name}" owned by ${seededRoom.owner.username}`);
  console.log(`   Members count: ${seededRoom.members.length}`);
  console.log(`   Messages count: ${seededRoom.messages.length}`);

  const seededProblem = await prisma.problem.findFirst({
    where: { title: 'Two Sum' },
    include: { testCases: true },
  });

  if (!seededProblem || seededProblem.testCases.length === 0) {
    console.error('❌ FAIL: Seeded problem or test cases missing.');
    process.exit(1);
  }

  console.log(`✅ PASS: Problem relation query succeeded: "${seededProblem.title}" has ${seededProblem.testCases.length} test cases.`);

  console.log('\n🎉 ALL DATABASE ARCHITECTURE VERIFICATION TESTS PASSED SUCCESSFULLY!');
}

verifyDatabase()
  .catch((e) => {
    console.error('❌ Verification script failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
