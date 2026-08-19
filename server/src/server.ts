import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { URL } from 'url';
import app from './app';
import { env, validateApiKeys } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/database';
import { CallSocketHandler } from './websocket/call.socket';
import { logger } from './utils/logger';

async function startServer(): Promise<void> {
  // Validate environment
  try {
    validateApiKeys();
  } catch (error) {
    logger.warn(`API key validation: ${(error as Error).message}`);
    logger.warn('Server will start but AI providers may fail without valid keys.');
  }

  // Connect to MongoDB
  try {
    await connectDatabase();
  } catch (error) {
    logger.error('Failed to connect to MongoDB:', error);
    process.exit(1);
  }

  // Create HTTP server
  const server = http.createServer(app);

  // Create WebSocket server
  const wss = new WebSocketServer({ server });
  const callSocketHandler = new CallSocketHandler();

  wss.on('connection', (ws: WebSocket, req) => {
    // Parse the URL to extract callId
    // Expected path: /ws/call/:callId
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const pathParts = url.pathname.split('/').filter(Boolean);

    // Validate path format: ['ws', 'call', ':callId']
    if (pathParts.length !== 3 || pathParts[0] !== 'ws' || pathParts[1] !== 'call') {
      ws.send(
        JSON.stringify({
          type: 'error',
          message: 'Invalid WebSocket path. Use /ws/call/:callId',
        })
      );
      ws.close();
      return;
    }

    const callId = pathParts[2];
    callSocketHandler.handleConnection(ws, callId);
  });

  // Start listening
  server.listen(env.PORT, () => {
    logger.info('═══════════════════════════════════════════════════');
    logger.info(`  AI Health Screening Server`);
    logger.info(`  HTTP:      http://localhost:${env.PORT}`);
    logger.info(`  WebSocket: ws://localhost:${env.PORT}/ws/call/:callId`);
    logger.info(`  Health:    http://localhost:${env.PORT}/api/health`);
    logger.info(`  Env:       ${env.NODE_ENV}`);
    logger.info(`  Providers: STT=${env.STT_PROVIDER} LLM=${env.LLM_PROVIDER} TTS=${env.TTS_PROVIDER}`);
    logger.info('═══════════════════════════════════════════════════');
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`\n${signal} received. Shutting down gracefully...`);

    // Close WebSocket connections
    wss.clients.forEach((client) => {
      client.send(
        JSON.stringify({ type: 'error', message: 'Server is shutting down.' })
      );
      client.close();
    });

    // Close HTTP server
    server.close(() => {
      logger.info('HTTP server closed');
    });

    // Disconnect MongoDB
    await disconnectDatabase();

    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer().catch((error) => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});
