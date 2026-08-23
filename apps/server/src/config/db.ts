import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

export const prisma =
  globalThis.prismaGlobal ??
  new PrismaClient({
    log: process.env['NODE_ENV'] === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env['NODE_ENV'] !== 'production') {
  globalThis.prismaGlobal = prisma;
}

export interface DbStatus {
  connected: boolean;
  provider: string;
  message?: string;
}

export async function checkDatabaseConnection(): Promise<DbStatus> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      connected: true,
      provider: 'PostgreSQL',
      message: 'Successfully connected to PostgreSQL via Prisma ORM.',
    };
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : 'Unknown database connection error';
    return {
      connected: false,
      provider: 'PostgreSQL',
      message: errMessage,
    };
  }
}
