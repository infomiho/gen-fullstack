import { createServer } from 'node:http';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import httpProxy from 'http-proxy';
import { validateEnv } from './config/env.js';
import { setupWebSocket } from './websocket.js';
import { processService } from './services/process.service.js';
import { databaseService } from './services/database.service.js';
import sessionRoutes from './routes/sessions.js';

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
  console.error('Proxy error:', err);
  if ('status' in res && typeof res.status === 'function') {
    res.status(502).json({ error: 'Bad Gateway', message: 'Failed to proxy request' });
  }
});

// Preview proxy endpoint - routes traffic to running Docker containers
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

  // Remove /preview/:sessionId from the path
  const targetPath = req.url.replace(/^\/[^/]+/, '');

  // Proxy to the container's port
  proxy.web(
    req,
    res,
    {
      target: `http://localhost:${appStatus.port}${targetPath}`,
      ignorePath: true,
    },
    (err) => {
      if (err) {
        console.error(`Failed to proxy request to ${sessionId}:`, err);
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

    if (appStatus && appStatus.status === 'running') {
      proxy.ws(req, socket, head, {
        target: `ws://localhost:${appStatus.port}`,
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
  console.log('[Server] Initializing database...');
  try {
    await databaseService.initialize();
    console.log('[Server] ✓ Database initialized');
  } catch (err) {
    console.error('[Server] Failed to initialize database:', err);
    process.exit(1);
  }

  console.log('[Server] Checking Docker availability...');

  const dockerAvailable = await processService.checkDockerAvailability();

  if (!dockerAvailable) {
    console.error('[Server] ⚠️  Docker is not available!');
    console.error('[Server] App execution features will be disabled.');
    console.error('[Server] To enable app execution:');
    console.error(
      '[Server]   1. Install Docker Desktop: https://www.docker.com/products/docker-desktop',
    );
    console.error('[Server]   2. Start Docker');
    console.error('[Server]   3. Restart this server');
    return;
  }

  console.log('[Server] ✓ Docker is available');
  console.log('[Server] Building Docker runner image...');

  try {
    await processService.initialize();
    console.log('[Server] ✓ Docker runner image ready');
    console.log('[Server] App execution features enabled');
  } catch (err) {
    console.error('[Server] Failed to initialize process service:', err);
    console.error('[Server] App execution will not work');
  }
}

// Start initialization (non-blocking)
initializeServices();

// Start server
httpServer.listen(PORT, () => {
  console.log(`[Server] Server running on http://localhost:${PORT}`);
  console.log(`[Server] Accepting connections from ${CLIENT_URL}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing servers');

  // Cleanup running apps
  await processService.cleanup();
  console.log('Process service cleaned up');

  // Close database connection
  databaseService.close();

  io.close(() => {
    console.log('Socket.io server closed');
    httpServer.close(() => {
      console.log('HTTP server closed');
      process.exit(0);
    });
  });
});
