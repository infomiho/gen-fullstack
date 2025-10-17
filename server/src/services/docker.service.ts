/**
 * Docker Service
 *
 * Manages Docker containers for running generated apps in isolation.
 * Provides secure execution with resource limits and automatic cleanup.
 */

import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AppInfo, AppLog, AppStatus, BuildEvent } from '@gen-fullstack/shared';
import type { Container, ContainerCreateOptions } from 'dockerode';
import Docker from 'dockerode';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Validates that a socket path is safe and legitimate
 */
function isValidSocketPath(socketPath: string): boolean {
  try {
    // Resolve symlinks to prevent TOCTOU attacks
    const realPath = fs.realpathSync(socketPath);

    // Validate path is in allowed locations only
    const allowedPrefixes = [
      '/var/run',
      path.join(os.homedir(), '.colima'),
      path.join(os.homedir(), '.docker'),
    ];

    const isAllowed = allowedPrefixes.some((prefix) => realPath.startsWith(prefix));

    if (!isAllowed) {
      console.warn(`[Docker] Socket path rejected (not in allowed locations): ${realPath}`);
      return false;
    }

    // Verify it's actually a socket, not a regular file
    const stats = fs.statSync(realPath);
    if (!stats.isSocket()) {
      console.warn(`[Docker] Path exists but is not a socket: ${realPath}`);
      return false;
    }

    return true;
  } catch (_error) {
    // Path doesn't exist or can't be accessed
    return false;
  }
}

/**
 * Get the Docker socket path based on the platform and Docker runtime
 */
function getDockerSocketPath(): string {
  // 1. Check DOCKER_HOST environment variable (standard Docker way)
  const dockerHost = process.env.DOCKER_HOST;
  if (dockerHost?.startsWith('unix://')) {
    const socketPath = dockerHost.replace('unix://', '');
    if (isValidSocketPath(socketPath)) {
      console.log(`[Docker] Using validated socket from DOCKER_HOST: ${socketPath}`);
      return socketPath;
    }
    console.warn(`[Docker] DOCKER_HOST socket invalid: ${socketPath}`);
  }

  if (os.platform() === 'darwin') {
    // 2. Check for Colima (common on macOS)
    const colimaHome = process.env.COLIMA_HOME || path.join(os.homedir(), '.colima');
    const colimaSocket = path.join(colimaHome, 'default/docker.sock');
    if (isValidSocketPath(colimaSocket)) {
      console.log(`[Docker] Using Colima socket: ${colimaSocket}`);
      return colimaSocket;
    }

    // 3. Check for Docker Desktop for Mac
    const dockerDesktopSocket = path.join(os.homedir(), '.docker/run/docker.sock');
    if (isValidSocketPath(dockerDesktopSocket)) {
      console.log(`[Docker] Using Docker Desktop socket: ${dockerDesktopSocket}`);
      return dockerDesktopSocket;
    }

    // 4. Check standard socket (might be symlinked)
    if (isValidSocketPath('/var/run/docker.sock')) {
      console.log('[Docker] Using standard socket: /var/run/docker.sock');
      return '/var/run/docker.sock';
    }

    console.warn('[Docker] No valid Docker socket found on macOS. Tried:');
    console.warn(`  - DOCKER_HOST: ${dockerHost || 'not set'}`);
    console.warn(`  - Colima: ${colimaSocket}`);
    console.warn(`  - Docker Desktop: ${dockerDesktopSocket}`);
    console.warn('  - Standard: /var/run/docker.sock');
  }

  // Linux default - validate it too
  const linuxSocket = '/var/run/docker.sock';
  if (isValidSocketPath(linuxSocket)) {
    return linuxSocket;
  }

  // Fall back to default path even if validation fails
  // Docker will handle the error when trying to connect
  return linuxSocket;
}

const docker = new Docker({ socketPath: getDockerSocketPath() });

const RUNNER_IMAGE = 'gen-fullstack-runner';
const DOCKERFILE_PATH = path.join(__dirname, '../../docker/runner.Dockerfile');

// Resource limits
const RESOURCE_LIMITS = {
  memory: 512 * 1024 * 1024, // 512MB RAM
  nanoCPUs: 1000000000, // 1 CPU core
  diskQuota: 100 * 1024 * 1024, // 100MB disk (not enforced on all systems)
};

// Timeouts
const TIMEOUTS = {
  install: 2 * 60 * 1000, // 2 minutes for npm install
  start: 30 * 1000, // 30 seconds to start dev server
  stop: 10 * 1000, // 10 seconds for graceful shutdown
  maxRuntime: 10 * 60 * 1000, // 10 minutes max runtime
};

// Retry configuration for Docker 409 conflicts
const RETRY_CONFIG = {
  maxAttempts: 3,
  delayMs: 1000, // Start with 1 second
  backoffMultiplier: 2, // Exponential backoff
};

/**
 * Retry helper for Docker operations that may fail with 409 conflicts
 */
async function retryOnConflict<T>(operation: () => Promise<T>, operationName: string): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= RETRY_CONFIG.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      // Check if it's a 409 conflict error
      const is409 =
        error &&
        typeof error === 'object' &&
        'statusCode' in error &&
        (error as { statusCode: number }).statusCode === 409;

      if (!is409 || attempt === RETRY_CONFIG.maxAttempts) {
        // Not a conflict or last attempt - throw immediately
        throw error;
      }

      // Wait before retrying with exponential backoff
      const delay = RETRY_CONFIG.delayMs * RETRY_CONFIG.backoffMultiplier ** (attempt - 1);
      console.log(
        `[Docker] ${operationName} failed with 409 conflict, retrying in ${delay}ms (attempt ${attempt}/${RETRY_CONFIG.maxAttempts})`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // Should never reach here, but TypeScript needs it
  throw (
    lastError || new Error(`${operationName} failed after ${RETRY_CONFIG.maxAttempts} attempts`)
  );
}

export interface ContainerInfo {
  sessionId: string;
  containerId: string;
  container: Container;
  status: AppStatus;
  port: number;
  createdAt: number;
  logs: AppLog[];
  cleanupTimer?: NodeJS.Timeout;
  streamCleanup?: () => void;
  devServerStreamCleanup?: () => void;
  readyCheckInterval?: NodeJS.Timeout;
}

/**
 * Type guard for stream with destroy method
 */
function hasDestroyMethod(stream: unknown): stream is { destroy: () => void } {
  return (
    typeof stream === 'object' &&
    stream !== null &&
    'destroy' in stream &&
    typeof (stream as { destroy: unknown }).destroy === 'function'
  );
}

/**
 * Determine log level from message content
 */
function determineLogLevel(message: string): 'error' | 'warn' | 'info' {
  if (message.includes('ERROR') || message.includes('error')) {
    return 'error';
  }
  if (message.includes('WARN') || message.includes('warn')) {
    return 'warn';
  }
  return 'info';
}

export class DockerService extends EventEmitter {
  private containers = new Map<string, ContainerInfo>();
  private imageBuilt = false;

  /**
   * Store a log entry with retention management
   */
  private storeLogEntry(sessionId: string, log: AppLog): void {
    const containerInfo = this.containers.get(sessionId);
    if (containerInfo) {
      containerInfo.logs.push(log);
      // Batch removal for better performance
      if (containerInfo.logs.length > 1200) {
        containerInfo.logs = containerInfo.logs.slice(-1000);
      }
    }

    // Emit log event
    this.emit('log', log);

    // Check for build events
    this.parseBuildEvents(sessionId, log.message);
  }

  /**
   * Build the runner image if it doesn't exist
   */
  async buildRunnerImage(): Promise<void> {
    if (this.imageBuilt) {
      return;
    }

    try {
      // Check if image already exists
      const images = await docker.listImages();
      const imageExists = images.some((img) => img.RepoTags?.includes(`${RUNNER_IMAGE}:latest`));

      if (imageExists) {
        console.log(`[Docker] Runner image ${RUNNER_IMAGE} already exists`);
        this.imageBuilt = true;
        return;
      }

      console.log(`[Docker] Building runner image ${RUNNER_IMAGE}...`);

      // Build image from Dockerfile
      const stream = await docker.buildImage(
        {
          context: path.dirname(DOCKERFILE_PATH),
          src: [path.basename(DOCKERFILE_PATH)],
        },
        {
          t: RUNNER_IMAGE,
          dockerfile: path.basename(DOCKERFILE_PATH),
        },
      );

      // Wait for build to complete
      await new Promise((resolve, reject) => {
        docker.modem.followProgress(
          stream,
          (err, res) => (err ? reject(err) : resolve(res)),
          (event) => {
            if (event.stream) {
              console.log(`[Docker] ${event.stream.trim()}`);
            }
          },
        );
      });

      console.log(`[Docker] Runner image ${RUNNER_IMAGE} built successfully`);
      this.imageBuilt = true;
    } catch (error) {
      console.error('[Docker] Failed to build runner image:', error);
      throw new Error(`Failed to build Docker runner image: ${error}`);
    }
  }

  /**
   * Check if Docker is available
   */
  async checkDockerAvailability(): Promise<boolean> {
    try {
      await docker.ping();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clean up orphaned containers from previous sessions
   * Call this on server startup to remove stale containers
   */
  async cleanupOrphanedContainers(): Promise<void> {
    try {
      console.log('[Docker] Cleaning up orphaned containers...');

      // List all containers with gen- prefix
      const containers = await docker.listContainers({ all: true });
      const orphanedContainers = containers.filter((c) =>
        c.Names.some((name) => name.startsWith('/gen-')),
      );

      if (orphanedContainers.length === 0) {
        console.log('[Docker] No orphaned containers found');
        return;
      }

      console.log(`[Docker] Found ${orphanedContainers.length} orphaned containers, removing...`);

      // Remove all orphaned containers
      const promises = orphanedContainers.map(async (c) => {
        const container = docker.getContainer(c.Id);
        try {
          // Stop if running
          if (c.State === 'running') {
            await container.stop({ t: 5 });
          }
          // Remove
          await container.remove({ force: true });
          console.log(`[Docker] Removed orphaned container: ${c.Names[0]}`);
        } catch (error) {
          console.error(`[Docker] Failed to remove orphaned container ${c.Names[0]}:`, error);
        }
      });

      await Promise.all(promises);
      console.log('[Docker] Orphaned container cleanup complete');
    } catch (error) {
      console.error('[Docker] Failed to cleanup orphaned containers:', error);
      // Don't throw - this is not critical for startup
    }
  }

  /**
   * Find an available port in the range
   */
  private async findAvailablePort(start: number, end: number): Promise<number> {
    for (let port = start; port <= end; port++) {
      const isAvailable = ![...this.containers.values()].some((c) => c.port === port);
      if (isAvailable) {
        return port;
      }
    }
    throw new Error(`No available ports in range ${start}-${end}`);
  }

  /**
   * Remove existing container with the same name if it exists
   */
  private async cleanupExistingContainer(sessionId: string): Promise<void> {
    try {
      const containerName = `gen-${sessionId}`;

      // Check if container exists in Docker
      const containers = await docker.listContainers({ all: true });
      const existingContainer = containers.find((c) => c.Names.includes(`/${containerName}`));

      if (existingContainer) {
        console.log(`[Docker] Found existing container ${containerName}, removing...`);
        const container = docker.getContainer(existingContainer.Id);

        // Stop if running (with retry for 409 conflicts)
        if (existingContainer.State === 'running') {
          try {
            await retryOnConflict(
              () => container.stop({ t: 5 }),
              `Stop container ${containerName}`,
            );
          } catch (_error) {
            // Ignore stop errors, we'll force remove anyway
          }
        }

        // Remove container (with retry for 409 conflicts)
        await retryOnConflict(
          () => container.remove({ force: true }),
          `Remove container ${containerName}`,
        );
        console.log(`[Docker] Removed existing container ${containerName}`);
      }
    } catch (error) {
      console.error('[Docker] Failed to cleanup existing container:', error);
      // Don't throw - let createContainer fail if there's still a conflict
    }
  }

  /**
   * Create and start a container for the generated app
   */
  async createContainer(sessionId: string, workingDir: string): Promise<AppInfo> {
    try {
      // Ensure runner image is built
      await this.buildRunnerImage();

      // Clean up any existing container with this name
      await this.cleanupExistingContainer(sessionId);

      // Find available port (start at 5001 to avoid macOS AirPlay on 5000)
      const hostPort = await this.findAvailablePort(5001, 5100);

      // Container configuration
      const containerOpts: ContainerCreateOptions = {
        Image: RUNNER_IMAGE,
        name: `gen-${sessionId}`,
        Tty: true,
        AttachStdout: true,
        AttachStderr: true,
        WorkingDir: '/app',
        ExposedPorts: {
          '5173/tcp': {}, // Vite default port
        },
        HostConfig: {
          Memory: RESOURCE_LIMITS.memory,
          NanoCpus: RESOURCE_LIMITS.nanoCPUs,
          PortBindings: {
            '5173/tcp': [{ HostPort: hostPort.toString() }],
          },
          Binds: [`${path.resolve(workingDir)}:/app:rw`],
          ReadonlyRootfs: false, // Allow writes to /tmp
          Tmpfs: {
            '/tmp': 'rw,noexec,nosuid,size=100m',
          },
          CapDrop: ['ALL'], // Drop all capabilities for security
          SecurityOpt: ['no-new-privileges'], // Prevent privilege escalation
        },
        Env: ['NODE_ENV=development', 'PORT=5173'],
      };

      // Create container
      const container = await docker.createContainer(containerOpts);
      const containerId = container.id;

      // Start container
      await container.start();

      // Store container info
      const containerInfo: ContainerInfo = {
        sessionId,
        containerId,
        container,
        status: 'creating',
        port: hostPort,
        createdAt: Date.now(),
        logs: [],
      };

      this.containers.set(sessionId, containerInfo);

      // Set up log streaming
      this.setupLogStream(sessionId, container);

      // Set up auto-cleanup timeout
      this.setupAutoCleanup(sessionId);

      return {
        sessionId,
        containerId,
        status: 'creating',
        port: hostPort,
        url: `http://localhost:${hostPort}`,
      };
    } catch (error) {
      console.error('[Docker] Failed to create container:', error);
      throw new Error(`Failed to create Docker container: ${error}`);
    }
  }

  /**
   * Set up log streaming from container
   *
   * Docker logs use multiplexed stream format:
   * - Header (8 bytes): [stream_type, 0, 0, 0, size1, size2, size3, size4]
   * - stream_type: 1=stdout, 2=stderr
   * - size: big-endian uint32 of message length
   * - Followed by message bytes
   */
  private async setupLogStream(sessionId: string, container: Container): Promise<void> {
    try {
      const stream = await container.logs({
        follow: true,
        stdout: true,
        stderr: true,
        timestamps: true,
      });

      let buffer = Buffer.alloc(0);

      const dataHandler = (chunk: Buffer) => {
        buffer = Buffer.concat([buffer, chunk]);

        // Process complete frames
        while (buffer.length >= 8) {
          const messageSize = buffer.readUInt32BE(4);

          // Check if we have the complete message
          if (buffer.length < 8 + messageSize) {
            break; // Wait for more data
          }

          // Extract and process message
          const streamType = buffer[0]; // 1=stdout, 2=stderr
          const messageBuffer = buffer.slice(8, 8 + messageSize);
          const message = messageBuffer.toString('utf8').trim();

          // Advance buffer
          buffer = buffer.slice(8 + messageSize);

          if (!message) continue;

          // Create and store log entry
          const log: AppLog = {
            sessionId,
            timestamp: Date.now(),
            type: streamType === 2 ? 'stderr' : 'stdout',
            level: determineLogLevel(message),
            message,
          };

          this.storeLogEntry(sessionId, log);
        }
      };

      const errorHandler = (error: Error) => {
        console.error(`[Docker] Log stream error for ${sessionId}:`, error);
      };

      stream.on('data', dataHandler);
      stream.on('error', errorHandler);

      // Store cleanup function
      const containerInfo = this.containers.get(sessionId);
      if (containerInfo) {
        containerInfo.streamCleanup = () => {
          stream.off('data', dataHandler);
          stream.off('error', errorHandler);
          if (hasDestroyMethod(stream)) {
            stream.destroy();
          }
        };
      }
    } catch (error) {
      console.error('[Docker] Failed to setup log stream:', error);
    }
  }

  /**
   * Parse build events from logs
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

      // Update container status
      const containerInfo = this.containers.get(sessionId);
      if (containerInfo) {
        containerInfo.status = 'running';
        this.emit('status_change', {
          sessionId,
          status: 'running',
        });
      }
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
   * Process exec stream output and emit logs
   *
   * Docker exec streams use the same multiplexed format as container logs
   */
  private processExecStream(sessionId: string, stream: NodeJS.ReadableStream): () => void {
    let buffer = Buffer.alloc(0);

    const dataHandler = (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);

      // Process complete frames
      while (buffer.length >= 8) {
        const messageSize = buffer.readUInt32BE(4);

        // Check if we have the complete message
        if (buffer.length < 8 + messageSize) {
          break; // Wait for more data
        }

        // Extract and process message
        const streamType = buffer[0]; // 1=stdout, 2=stderr
        const messageBuffer = buffer.slice(8, 8 + messageSize);
        const message = messageBuffer.toString('utf8').trim();

        // Advance buffer
        buffer = buffer.slice(8 + messageSize);

        if (!message) continue;

        // Create and store log entry
        const log: AppLog = {
          sessionId,
          timestamp: Date.now(),
          type: streamType === 2 ? 'stderr' : 'stdout',
          level: determineLogLevel(message),
          message,
        };

        this.storeLogEntry(sessionId, log);

        // Also log to console for debugging
        console.log(`[Docker:${sessionId}] ${message}`);
      }
    };

    stream.on('data', dataHandler);

    // Return cleanup function
    return () => {
      stream.off('data', dataHandler);
      if (hasDestroyMethod(stream)) {
        stream.destroy();
      }
    };
  }

  /**
   * Install dependencies in container
   */
  async installDependencies(sessionId: string): Promise<void> {
    const containerInfo = this.containers.get(sessionId);
    if (!containerInfo) {
      throw new Error(`Container not found: ${sessionId}`);
    }

    let cleanupStream: (() => void) | undefined;

    try {
      containerInfo.status = 'installing';
      this.emit('status_change', { sessionId, status: 'installing' });

      const exec = await containerInfo.container.exec({
        Cmd: ['npm', 'install'],
        AttachStdout: true,
        AttachStderr: true,
        WorkingDir: '/app',
      });

      const stream = await exec.start({ Detach: false, Tty: false });

      // Process stream output and get cleanup function
      cleanupStream = this.processExecStream(sessionId, stream);

      // Wait for installation to complete (with timeout)
      await Promise.race([
        new Promise((resolve, reject) => {
          stream.on('end', resolve);
          stream.on('error', reject);
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Installation timeout')), TIMEOUTS.install),
        ),
      ]);

      console.log(`[Docker] Dependencies installed for ${sessionId}`);

      // Clean up stream after completion
      if (cleanupStream) {
        cleanupStream();
      }
    } catch (error) {
      // Clean up stream on error
      if (cleanupStream) {
        cleanupStream();
      }

      containerInfo.status = 'failed';
      this.emit('status_change', {
        sessionId,
        status: 'failed',
        error: `Failed to install dependencies: ${error}`,
      });
      throw error;
    }
  }

  /**
   * Start dev server in container
   */
  async startDevServer(sessionId: string): Promise<void> {
    const containerInfo = this.containers.get(sessionId);
    if (!containerInfo) {
      throw new Error(`Container not found: ${sessionId}`);
    }

    try {
      containerInfo.status = 'starting';
      this.emit('status_change', { sessionId, status: 'starting' });

      const exec = await containerInfo.container.exec({
        Cmd: ['npm', 'run', 'dev', '--', '--host', '0.0.0.0', '--port', '5173'],
        AttachStdout: true,
        AttachStderr: true,
        WorkingDir: '/app',
      });

      // Start the dev server - DON'T detach so we can capture output
      const stream = await exec.start({ Detach: false, Tty: false });

      // Process stream output continuously and store cleanup function
      // This prevents memory leaks on restart by properly cleaning up event listeners
      containerInfo.devServerStreamCleanup = this.processExecStream(sessionId, stream);

      console.log(`[Docker] Dev server starting for ${sessionId}`);

      // Wait for server to be ready (check logs for "ready" message)
      await this.waitForReady(sessionId, TIMEOUTS.start);
    } catch (error) {
      // Cancel ready check interval if it exists
      if (containerInfo.readyCheckInterval) {
        clearInterval(containerInfo.readyCheckInterval);
        containerInfo.readyCheckInterval = undefined;
      }

      containerInfo.status = 'failed';
      this.emit('status_change', {
        sessionId,
        status: 'failed',
        error: `Failed to start dev server: ${error}`,
      });
      throw error;
    }
  }

  /**
   * Wait for dev server to be ready
   */
  private async waitForReady(sessionId: string, timeout: number): Promise<void> {
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        const containerInfo = this.containers.get(sessionId);
        if (!containerInfo) {
          clearInterval(checkInterval);
          reject(new Error('Container not found'));
          return;
        }

        // Check if "ready" message in logs
        const hasReadyMessage = containerInfo.logs.some(
          (log) => log.message.includes('ready') || log.message.includes('VITE'),
        );

        if (hasReadyMessage || containerInfo.status === 'running') {
          clearInterval(checkInterval);
          containerInfo.readyCheckInterval = undefined;
          resolve();
          return;
        }

        // Check timeout
        if (Date.now() - startTime > timeout) {
          clearInterval(checkInterval);
          containerInfo.readyCheckInterval = undefined;
          reject(new Error('Timeout waiting for dev server to start'));
        }
      }, 500);

      // Store interval for cleanup
      const containerInfo = this.containers.get(sessionId);
      if (containerInfo) {
        containerInfo.readyCheckInterval = checkInterval;
      }
    });
  }

  /**
   * Setup automatic cleanup after timeout
   */
  private setupAutoCleanup(sessionId: string): void {
    const timer = setTimeout(() => {
      const containerInfo = this.containers.get(sessionId);
      if (containerInfo && containerInfo.status !== 'stopped') {
        console.log(`[Docker] Auto-cleanup timeout for ${sessionId}`);
        this.destroyContainer(sessionId).catch((err) =>
          console.error(`[Docker] Auto-cleanup failed for ${sessionId}:`, err),
        );
      }
    }, TIMEOUTS.maxRuntime);

    // Store timer for cancellation
    const containerInfo = this.containers.get(sessionId);
    if (containerInfo) {
      containerInfo.cleanupTimer = timer;
    }
  }

  /**
   * Get container logs
   */
  getLogs(sessionId: string): AppLog[] {
    const containerInfo = this.containers.get(sessionId);
    return containerInfo?.logs || [];
  }

  /**
   * Get container status
   */
  getStatus(sessionId: string): AppInfo | null {
    const containerInfo = this.containers.get(sessionId);
    if (!containerInfo) {
      return null;
    }

    return {
      sessionId,
      containerId: containerInfo.containerId,
      status: containerInfo.status,
      port: containerInfo.port,
      url: `http://localhost:${containerInfo.port}`,
    };
  }

  /**
   * Stop and destroy a container
   */
  async destroyContainer(sessionId: string): Promise<void> {
    const containerInfo = this.containers.get(sessionId);
    if (!containerInfo) {
      return;
    }

    try {
      // Cancel auto-cleanup timer
      if (containerInfo.cleanupTimer) {
        clearTimeout(containerInfo.cleanupTimer);
        containerInfo.cleanupTimer = undefined;
      }

      // Cancel ready check interval
      if (containerInfo.readyCheckInterval) {
        clearInterval(containerInfo.readyCheckInterval);
        containerInfo.readyCheckInterval = undefined;
      }

      // Clean up stream listeners
      if (containerInfo.streamCleanup) {
        containerInfo.streamCleanup();
        containerInfo.streamCleanup = undefined;
      }

      // Clean up dev server stream listeners
      if (containerInfo.devServerStreamCleanup) {
        containerInfo.devServerStreamCleanup();
        containerInfo.devServerStreamCleanup = undefined;
      }

      containerInfo.status = 'stopped';
      this.emit('status_change', { sessionId, status: 'stopped' });

      // Stop container (with timeout and retry)
      await retryOnConflict(
        () =>
          Promise.race([
            containerInfo.container.stop(),
            new Promise((resolve) => setTimeout(resolve, TIMEOUTS.stop)),
          ]),
        `Stop container ${sessionId}`,
      );

      // Remove container (with retry)
      await retryOnConflict(
        () => containerInfo.container.remove({ force: true }),
        `Remove container ${sessionId}`,
      );

      // Remove from map
      this.containers.delete(sessionId);

      console.log(`[Docker] Container destroyed: ${sessionId}`);
    } catch (error) {
      console.error('[Docker] Failed to destroy container:', error);
      // Force remove if stop failed
      try {
        await retryOnConflict(
          () => containerInfo.container.remove({ force: true }),
          `Force remove container ${sessionId}`,
        );
        this.containers.delete(sessionId);
      } catch {
        // Ignore errors on force remove
      }
    }
  }

  /**
   * Cleanup all containers
   */
  async cleanup(): Promise<void> {
    const promises = Array.from(this.containers.keys()).map((sessionId) =>
      this.destroyContainer(sessionId),
    );
    await Promise.all(promises);
  }

  /**
   * List all containers
   */
  listContainers(): ContainerInfo[] {
    return Array.from(this.containers.values());
  }
}

// Export singleton instance
export const dockerService = new DockerService();
