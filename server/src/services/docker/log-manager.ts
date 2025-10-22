/**
 * Log Manager
 *
 * Manages log storage, emission, and parsing for Docker containers.
 * Handles log retention and build event detection.
 */

import type { AppLog, BuildEvent } from '@gen-fullstack/shared';
import { EventEmitter } from 'node:events';
import { LOG_RETENTION } from './config.js';
import type { ContainerInfo } from './types.js';

/**
 * Log Manager for Docker service
 *
 * Centralizes log handling logic including:
 * - Log storage with retention management
 * - Event emission to WebSocket clients
 * - Build event parsing (Vite ready, errors)
 */
export class LogManager extends EventEmitter {
  constructor(private containers: Map<string, ContainerInfo>) {
    super();
  }

  /**
   * Store a log entry with retention management
   *
   * @param sessionId - Session identifier
   * @param log - Log entry to store
   */
  storeLogEntry(sessionId: string, log: AppLog): void {
    const containerInfo = this.containers.get(sessionId);
    if (containerInfo) {
      containerInfo.logs.push(log);
      // Batch removal for better performance
      if (containerInfo.logs.length > LOG_RETENTION.pruneThreshold) {
        containerInfo.logs = containerInfo.logs.slice(-LOG_RETENTION.maxLogs);
      }
    }

    this.emit('log', log);

    if (log.level !== 'command') {
      this.parseBuildEvents(sessionId, log.message);
    }
  }

  /**
   * Emit a log entry with specified level
   *
   * @param sessionId - Session identifier
   * @param level - Log level (command, system, info, warn, error)
   * @param message - Log message
   * @param type - Stream type (stdout or stderr), defaults to stdout
   */
  emitLog(
    sessionId: string,
    level: AppLog['level'],
    message: string,
    type: AppLog['type'] = 'stdout',
  ): void {
    const log: AppLog = {
      sessionId,
      timestamp: Date.now(),
      type,
      level,
      message,
    };
    this.storeLogEntry(sessionId, log);
  }

  /**
   * Parse build events from logs
   *
   * Detects key events like Vite ready, build errors, etc.
   *
   * @param sessionId - Session identifier
   * @param message - Log message to parse
   */
  private parseBuildEvents(sessionId: string, message: string): void {
    if (message.includes('VITE') && message.includes('ready')) {
      const event: BuildEvent = {
        sessionId,
        timestamp: Date.now(),
        event: 'success',
        details: 'Dev server ready',
      };
      this.emit('build_event', event);
      this.emit('vite_ready', sessionId);
    }

    if (message.includes('ERROR') || message.includes('Failed')) {
      const event: BuildEvent = {
        sessionId,
        timestamp: Date.now(),
        event: 'error',
        details: message,
      };
      this.emit('build_event', event);
    }
  }

  /**
   * Get container logs
   *
   * @param sessionId - Session identifier
   * @returns Array of log entries
   */
  getLogs(sessionId: string): AppLog[] {
    const containerInfo = this.containers.get(sessionId);
    return containerInfo?.logs || [];
  }
}
