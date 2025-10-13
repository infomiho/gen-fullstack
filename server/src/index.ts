import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import { setupWebSocket } from './websocket.js';
import { validateEnv } from './config/env.js';

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

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Setup WebSocket
const io = setupWebSocket(httpServer);

// Start server
httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Accepting connections from ${CLIENT_URL}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing servers');
  io.close(() => {
    console.log('Socket.io server closed');
    httpServer.close(() => {
      console.log('HTTP server closed');
      process.exit(0);
    });
  });
});
