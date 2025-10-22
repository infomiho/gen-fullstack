/**
 * Docker Service Types
 *
 * TypeScript interfaces and types for Docker container management.
 */

import type { AppLog, AppStatus } from '@gen-fullstack/shared';
import type { Container } from 'dockerode';
import type { Actor } from 'xstate';
import type { dockerContainerMachine } from './docker.machine.js';

/**
 * Container information with state machine integration
 */
export interface ContainerInfo {
  sessionId: string;
  containerId: string;
  container: Container;
  status: AppStatus; // Derived from machine state
  clientPort: number; // Host port mapped to container's Vite port (5173)
  serverPort: number; // Host port mapped to container's Express port (3000)
  createdAt: number;
  logs: AppLog[];

  // XState machine actor (source of truth for container state)
  actor?: Actor<typeof dockerContainerMachine>;

  // Cleanup resources
  // NOTE: Function cleanups (streamCleanup, devServerStreamCleanup) are stored here
  // in containerInfo, NOT in machine context, because:
  // 1. Machine context snapshots are immutable
  // 2. Functions cannot be serialized or stored in XState context
  // 3. Cleanup actions access these via containerInfo object
  cleanupTimer?: NodeJS.Timeout;
  streamCleanup?: () => void;
  devServerStreamCleanup?: () => void;
  readyCheckInterval?: NodeJS.Timeout;
  readyCheckPromise?: Promise<void>;
  readyCheckAbort?: AbortController;
}
