import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/env';
import { requestIdMiddleware } from './middlewares/request-id.middleware';
import { httpLoggerMiddleware } from './middlewares/http-logger.middleware';
import {
  authRateLimiter,
  refreshRateLimiter,
  submissionRateLimiter,
  chatRateLimiter,
  analyticsRateLimiter,
  importRateLimiter,
  generalRateLimiter,
} from './config/rate-limit';
import healthRouter from './routes/health.route';
import authRouter from './routes/auth.route';
import roomRouter from './routes/room.route';
import problemRouter from './routes/problem.route';
import documentRouter from './routes/document.route';
import { submissionRouter } from './routes/submission.route';
import { messageRouter } from './routes/message.route';
import { notificationRouter } from './routes/notification.route';
import { analyticsRouter } from './routes/analytics.route';
import { adminRouter } from './routes/admin.route';
import { errorHandler } from './middlewares/error.middleware';

export function createApp(): Express {
  const app = express();

  // 1. Trust Proxy Configuration (1-hop behind Nginx reverse proxy)
  app.set('trust proxy', 1);

  // 2. Security Headers (Helmet)
  app.use(
    helmet({
      contentSecurityPolicy: false, // Disabled to prevent blocking Monaco Web Workers & Socket.IO in Vite
      crossOriginEmbedderPolicy: false,
    })
  );

  // 3. CORS Hardening
  const isProduction = (process.env['NODE_ENV'] || config.nodeEnv) === 'production';
  const configuredOrigins = config.corsOrigin
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  const allowedOrigins = isProduction
    ? configuredOrigins
    : [
        ...configuredOrigins,
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:5174',
        'http://127.0.0.1:5174',
      ];

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like curl, health checks, or server-to-server)
        if (!origin) {
          return callback(null, true);
        }
        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        if (!isProduction) {
          return callback(null, true);
        }
        return callback(new Error(`CORS policy rejection: Origin ${origin} is not allowed.`));
      },
      credentials: true,
    })
  );

  // 4. Request Tracing & Logging Middlewares
  app.use(requestIdMiddleware);
  app.use(httpLoggerMiddleware);

  // 5. Request Body Size Limit (Max 100KB to prevent memory exhaustion)
  app.use(express.json({ limit: '100kb' }));

  // 6. Global API Rate Limiting
  app.use('/api', generalRateLimiter);

  // 7. Specific Tiered Rate Limiters
  app.use('/api/auth/login', authRateLimiter);
  app.use('/api/auth/register', authRateLimiter);
  app.use('/api/auth/refresh', refreshRateLimiter);
  app.use('/api/submissions/run', submissionRateLimiter);
  app.use('/api/submissions', submissionRateLimiter);
  app.use('/api/leaderboard', analyticsRateLimiter);
  app.use('/api/analytics', analyticsRateLimiter);
  app.use('/api/admin/problems/import/codeforces', importRateLimiter);

  // 8. API Routes Registration
  app.use('/api', healthRouter);
  app.use('/api', authRouter);
  app.use('/api', roomRouter);
  app.use('/api', problemRouter);
  app.use('/api', documentRouter);
  app.use('/api/submissions', submissionRouter);
  app.use('/api', chatRateLimiter, messageRouter);
  app.use('/api/notifications', notificationRouter);
  app.use('/api', analyticsRouter);
  app.use('/api/admin', adminRouter);

  // 9. Fallback 404 Handler
  app.use('*', (req, res) => {
    res.status(404).json({
      success: false,
      message: `Route '${req.originalUrl}' not found.`,
      error: 'NOT_FOUND',
      requestId: req.requestId,
      timestamp: new Date().toISOString(),
    });
  });

  // 10. Global Error Handler
  app.use(errorHandler);

  return app;
}
