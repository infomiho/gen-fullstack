/**
 * Docker Stream Parsing Utilities
 *
 * Handles parsing of Docker multiplexed stream format and log level detection.
 * Docker uses a multiplexed stream format with an 8-byte header:
 * - Byte 0: Stream type (1=stdout, 2=stderr)
 * - Bytes 1-3: Reserved
 * - Bytes 4-7: Message size (big-endian uint32)
 */

import type { AppLog } from '@gen-fullstack/shared';

/**
 * Type guard for stream with destroy method
 */
export function hasDestroyMethod(stream: unknown): stream is { destroy: () => void } {
  return (
    typeof stream === 'object' &&
    stream !== null &&
    'destroy' in stream &&
    typeof (stream as { destroy: unknown }).destroy === 'function'
  );
}

/**
 * Determine log level from message content
 *
 * @param message - The log message to analyze
 * @returns The appropriate log level
 */
export function determineLogLevel(message: string): 'error' | 'warn' | 'info' {
  if (message.includes('ERROR') || message.includes('error')) {
    return 'error';
  }
  if (message.includes('WARN') || message.includes('warn')) {
    return 'warn';
  }
  return 'info';
}

/**
 * Creates a handler function for parsing Docker multiplexed stream format
 *
 * Docker streams use a multiplexed format with an 8-byte header followed by the message.
 * This handler accumulates chunks in a buffer and parses complete messages.
 *
 * @param sessionId - Session identifier for logging
 * @param onMessage - Callback invoked for each parsed log message
 * @returns Handler function to attach to stream's 'data' event
 */
export function createDockerStreamHandler(
  sessionId: string,
  onMessage: (log: AppLog) => void,
): (chunk: Buffer) => void {
  let buffer = Buffer.alloc(0);

  return (chunk: Buffer) => {
    buffer = Buffer.concat([buffer, chunk]);

    // Parse all complete messages in the buffer
    while (buffer.length >= 8) {
      const messageSize = buffer.readUInt32BE(4);

      // Wait for complete message
      if (buffer.length < 8 + messageSize) {
        break;
      }

      const streamType = buffer[0]; // 1=stdout, 2=stderr
      const messageBuffer = buffer.slice(8, 8 + messageSize);
      const message = messageBuffer.toString('utf8').trim();

      // Move buffer forward
      buffer = buffer.slice(8 + messageSize);

      // Skip empty messages
      if (!message) continue;

      const log: AppLog = {
        sessionId,
        timestamp: Date.now(),
        type: streamType === 2 ? 'stderr' : 'stdout',
        level: determineLogLevel(message),
        message,
      };

      onMessage(log);
    }
  };
}
