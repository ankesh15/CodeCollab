import { Router, Request, Response } from 'express';
import { HealthResponse, ApiResponse } from '@codecollab/shared';
import { checkDatabaseConnection, prisma } from '../config/db';
import { config } from '../config/env';

const router = Router();
const startTime = Date.now();

router.get('/health', async (_req: Request, res: Response<HealthResponse>) => {
  const dbStatus = await checkDatabaseConnection();

  const isHealthy = dbStatus.connected;
  const statusCode = isHealthy ? 200 : 503;

  res.status(statusCode).json({
    success: isHealthy,
    message: isHealthy
      ? 'CodeCollab Backend Service is operational.'
      : 'CodeCollab Backend Service is running in degraded state (Database disconnected).',
    data: {
      service: 'CodeCollab Backend REST API',
      status: isHealthy ? 'healthy' : 'degraded',
      uptime: Math.floor((Date.now() - startTime) / 1000),
      environment: config.nodeEnv,
      database: dbStatus,
      timestamp: new Date().toISOString(),
    },
    timestamp: new Date().toISOString(),
  });
});

router.get('/ready', async (_req: Request, res: Response<ApiResponse>) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      success: true,
      message: 'CodeCollab Backend Service is ready to serve traffic.',
      data: {
        status: 'ready',
        database: 'connected',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Database query failed';
    res.status(503).json({
      success: false,
      message: 'CodeCollab Backend Service is not ready to serve traffic.',
      error: 'SERVICE_UNAVAILABLE',
      data: {
        status: 'not_ready',
        database: 'disconnected',
        details: errorMsg,
      },
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
