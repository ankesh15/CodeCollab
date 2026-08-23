import http from 'http';
import { createApp } from './app';
import { config } from './config/env';
import { prisma } from './config/db';
import { initSocketServer } from './socket';

const app = createApp();
const httpServer = http.createServer(app);

// Initialize Socket.IO attached to HTTP server
const io = initSocketServer(httpServer);

httpServer.listen(config.port, () => {
  console.log(`
🚀 CodeCollab Backend Service initialized successfully!
📡 REST API Server listening at: http://localhost:${config.port}
⚡ Socket.IO Realtime Engine attached to HTTP server on port ${config.port}
🏥 Health Endpoint: http://localhost:${config.port}/api/health
🌐 Environment: ${config.nodeEnv}
  `);
});

const gracefulShutdown = async (signal: string) => {
  console.log(`\n⚠️ Received ${signal}. Shutting down server gracefully...`);
  io.close(() => {
    console.log('⚡ Socket.IO Engine closed.');
  });
  httpServer.close(async () => {
    console.log('🔒 HTTP Server closed.');
    await prisma.$disconnect();
    console.log('🐘 PostgreSQL Prisma connection closed.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => void gracefulShutdown('SIGINT'));
