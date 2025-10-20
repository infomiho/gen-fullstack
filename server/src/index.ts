import { createServer } from 'node:http';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import httpProxy from 'http-proxy';
import { validateEnv } from './config/env.js';
import { serverLogger } from './lib/logger.js';
import sessionRoutes from './routes/sessions.js';
import { databaseService } from './services/database.service.js';
import { processService } from './services/process.service.js';
import { setupWebSocket } from './websocket.js';

dotenv.config();

// Validate environment variables
const env = validateEnv();

const app = express();
const httpServer = createServer(app);
const PORT = env.PORT;
const CLIENT_URL = env.CLIENT_URL;

// Middleware
app.use(cors({ origin: CLIENT_URL }));
app.use(express.json());

// API Routes
app.use('/api/sessions', sessionRoutes);

// Create proxy for app previews
const proxy = httpProxy.createProxyServer({
  ws: true, // Enable WebSocket proxying for Vite HMR
  changeOrigin: true,
});

// Handle proxy errors
proxy.on('error', (err, _req, res) => {
  serverLogger.error({ error: err }, 'Proxy error');
  if ('status' in res && typeof res.status === 'function') {
    res.status(502).json({ error: 'Bad Gateway', message: 'Failed to proxy request' });
  }
});

// Preview proxy endpoint - routes traffic to running Docker containers
// Routes to client (Vite) which internally proxies /api/* to server (Express)
app.use('/preview/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const appStatus = processService.getAppStatus(sessionId);

  if (!appStatus || appStatus.status !== 'running') {
    res.status(503).json({
      error: 'App not running',
      message: `App ${sessionId} is not running. Status: ${appStatus?.status || 'not found'}`,
    });
    return;
  }

  if (!appStatus.clientPort) {
    res.status(500).json({
      error: 'Configuration error',
      message: 'App is running but client port is not configured',
    });
    return;
  }

  // Remove /preview/:sessionId from the path
  const targetPath = req.url.replace(/^\/[^/]+/, '');

  // Proxy to the container's Vite client port
  // Vite's internal proxy will forward /api/* requests to Express server
  proxy.web(
    req,
    res,
    {
      target: `http://localhost:${appStatus.clientPort}${targetPath}`,
      ignorePath: true,
    },
    (err) => {
      if (err) {
        serverLogger.error({ error: err, sessionId }, 'Failed to proxy request');
        res.status(502).json({ error: 'Proxy failed', message: String(err) });
      }
    },
  );
});

// WebSocket upgrade for Vite HMR
httpServer.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const match = url.pathname.match(/^\/preview\/([^/]+)/);

  if (match) {
    const sessionId = match[1];
    const appStatus = processService.getAppStatus(sessionId);

    if (appStatus && appStatus.status === 'running' && appStatus.clientPort) {
      proxy.ws(req, socket, head, {
        target: `ws://localhost:${appStatus.clientPort}`,
      });
    } else {
      socket.destroy();
    }
  }
});

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Setup WebSocket
const io = setupWebSocket(httpServer);

// Initialize process service with Docker availability check
async function initializeServices() {
  // Initialize database
  serverLogger.info('Initializing database...');
  try {
    await databaseService.initialize();
    serverLogger.info('✓ Database initialized');
  } catch (err) {
    serverLogger.error({ error: err }, 'Failed to initialize database');
    process.exit(1);
  }

  serverLogger.info('Checking Docker availability...');

  const dockerAvailable = await processService.checkDockerAvailability();

  if (!dockerAvailable) {
    serverLogger.warn('Docker is not available!');
    serverLogger.warn('App execution features will be disabled.');
    serverLogger.warn('To enable app execution:');
    serverLogger.warn(
      '  1. Install Docker Desktop: https://www.docker.com/products/docker-desktop',
    );
    serverLogger.warn('  2. Start Docker');
    serverLogger.warn('  3. Restart this server');
    return;
  }

  serverLogger.info('✓ Docker is available');

  // Clean up orphaned containers from previous sessions
  try {
    await processService.cleanupOrphanedContainers();
  } catch (err) {
    serverLogger.error({ error: err }, 'Failed to cleanup orphaned containers');
    // Continue anyway - not critical
  }

  serverLogger.info('Building Docker runner image...');

  try {
    await processService.initialize();
    serverLogger.info('✓ Docker runner image ready');
    serverLogger.info('App execution features enabled');
  } catch (err) {
    serverLogger.error({ error: err }, 'Failed to initialize process service');
    serverLogger.error('App execution will not work');
  }
}

// Start initialization (non-blocking)
initializeServices();

// Start server
httpServer.listen(PORT, () => {
  serverLogger.info({ port: PORT }, `Server running on http://localhost:${PORT}`);
  serverLogger.info({ clientUrl: CLIENT_URL }, `Accepting connections from ${CLIENT_URL}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  serverLogger.info('SIGTERM signal received: closing servers');

  // Cleanup running apps
  await processService.cleanup();
  serverLogger.info('Process service cleaned up');

  // Close database connection
  databaseService.close();

  io.close(() => {
    serverLogger.info('Socket.io server closed');
    httpServer.close(() => {
      serverLogger.info('HTTP server closed');
      process.exit(0);
    });
  });
});
