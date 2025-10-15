/**
 * Shared constants for Gen Fullstack
 */

// File size limits
export const MAX_FILE_SIZE = 10_000_000; // 10MB for file uploads/saves
export const MAX_EDITOR_FILE_SIZE = 1_000_000; // 1MB for in-browser editing

// Timeout values (milliseconds)
export const TIMEOUTS = {
  AUTO_START_DELAY: 1000, // Delay before auto-starting app
  NPM_INSTALL: 120_000, // 2 minutes for npm install
  FILE_SAVE: 30_000, // 30 seconds for file save operations
  WEBSOCKET_RECONNECT: 5000, // 5 seconds between reconnection attempts
  DOCKER_OPERATION: 60_000, // 1 minute for Docker operations
} as const;

// Message and log limits
export const MAX_MESSAGES = 1000; // Maximum messages to keep in memory
export const MAX_LOGS = 500; // Maximum log entries to keep in memory

// Rate limiting
export const RATE_LIMITS = {
  REQUESTS_PER_SECOND: 10, // Max requests per second per client
  BURST_SIZE: 20, // Allow burst of requests
} as const;
