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

// HTTP readiness check configuration
const HTTP_READY_CHECK = {
  maxAttempts: 10, // ~5 seconds total with 500ms delays
  delayMs: 500, // Wait between retry attempts
  requestTimeoutMs: 1000, // Timeout for each HTTP request
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

      const is409 =
        error &&
        typeof error === 'object' &&
        'statusCode' in error &&
        (error as { statusCode: number }).statusCode === 409;

      if (!is409 || attempt === RETRY_CONFIG.maxAttempts) {
        throw error;
      }

      const delay = RETRY_CONFIG.delayMs * RETRY_CONFIG.backoffMultiplier ** (attempt - 1);
      console.log(
        `[Docker] ${operationName} failed with 409 conflict, retrying in ${delay}ms (attempt ${attempt}/${RETRY_CONFIG.maxAttempts})`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

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
  readyCheckInProgress?: boolean;
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

    this.emit('log', log);

    if (log.level !== 'command') {
      this.parseBuildEvents(sessionId, log.message);
    }
  }

  /**
   * Emit a command log entry (shown before command execution)
   */
  private emitCommandLog(sessionId: string, command: string): void {
    const log: AppLog = {
      sessionId,
      timestamp: Date.now(),
      type: 'stdout',
      level: 'command',
      message: command,
    };
    this.storeLogEntry(sessionId, log);
  }

  /**
   * Emit a system log entry (lifecycle events)
   */
  private emitSystemLog(sessionId: string, message: string): void {
    const log: AppLog = {
      sessionId,
      timestamp: Date.now(),
      type: 'stdout',
      level: 'system',
      message,
    };
    this.storeLogEntry(sessionId, log);
  }

  /**
   * Build the runner image if it doesn't exist
   */
  async buildRunnerImage(): Promise<void> {
    if (this.imageBuilt) {
      return;
    }

    try {
      const images = await docker.listImages();
      const imageExists = images.some((img) => img.RepoTags?.includes(`${RUNNER_IMAGE}:latest`));

      if (imageExists) {
        console.log(`[Docker] Runner image ${RUNNER_IMAGE} already exists`);
        this.imageBuilt = true;
        return;
      }

      console.log(`[Docker] Building runner image ${RUNNER_IMAGE}...`);

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

      const containers = await docker.listContainers({ all: true });
      const orphanedContainers = containers.filter((c) =>
        c.Names.some((name) => name.startsWith('/gen-')),
      );

      if (orphanedContainers.length === 0) {
        console.log('[Docker] No orphaned containers found');
        return;
      }

      console.log(`[Docker] Found ${orphanedContainers.length} orphaned containers, removing...`);

      const promises = orphanedContainers.map(async (c) => {
        const container = docker.getContainer(c.Id);
        try {
          if (c.State === 'running') {
            await container.stop({ t: 5 });
          }
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

      const containers = await docker.listContainers({ all: true });
      const existingContainer = containers.find((c) => c.Names.includes(`/${containerName}`));

      if (existingContainer) {
        console.log(`[Docker] Found existing container ${containerName}, removing...`);
        const container = docker.getContainer(existingContainer.Id);

        if (existingContainer.State === 'running') {
          try {
            await retryOnConflict(
              () => container.stop({ t: 5 }),
              `Stop container ${containerName}`,
            );
          } catch (_error) {}
        }

        await retryOnConflict(
          () => container.remove({ force: true }),
          `Remove container ${containerName}`,
        );
        console.log(`[Docker] Removed existing container ${containerName}`);
      }
    } catch (error) {
      console.error('[Docker] Failed to cleanup existing container:', error);
    }
  }

  /**
   * Create and start a container for the generated app
   */
  async createContainer(sessionId: string, workingDir: string): Promise<AppInfo> {
    try {
      this.emitSystemLog(sessionId, 'Creating container...');
      await this.buildRunnerImage();
      await this.cleanupExistingContainer(sessionId);

      const hostPort = await this.findAvailablePort(5001, 5100);

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

      const container = await docker.createContainer(containerOpts);
      const containerId = container.id;

      await container.start();

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

      this.setupLogStream(sessionId, container);
      this.setupAutoCleanup(sessionId);

      this.emitSystemLog(sessionId, 'Container created successfully');

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

        while (buffer.length >= 8) {
          const messageSize = buffer.readUInt32BE(4);

          if (buffer.length < 8 + messageSize) {
            break;
          }

          const streamType = buffer[0]; // 1=stdout, 2=stderr
          const messageBuffer = buffer.slice(8, 8 + messageSize);
          const message = messageBuffer.toString('utf8').trim();

          buffer = buffer.slice(8 + messageSize);

          if (!message) continue;

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
   * Check if HTTP server is actually ready to accept connections
   *
   * Polls the HTTP endpoint with HEAD requests until the server responds.
   * This prevents the iframe from loading before the server is ready to
   * handle requests, avoiding "Unable to connect" errors.
   *
   * @param port - The host port to check
   * @returns Promise<boolean> - true if server responds within timeout, false otherwise
   *
   * @remarks
   * - Uses HEAD requests to minimize overhead
   * - Accepts any HTTP response (including 404) as "ready"
   * - Retries up to 10 times with 500ms delays (~5 seconds total)
   * - Each request has a 1 second timeout
   * - Logs first and last failures for debugging
   */
  private async checkHttpReady(port: number): Promise<boolean> {
    const shouldLog = (attempt: number) =>
      attempt === 0 || attempt === HTTP_READY_CHECK.maxAttempts - 1;

    for (let i = 0; i < HTTP_READY_CHECK.maxAttempts; i++) {
      try {
        await fetch(`http://localhost:${port}`, {
          method: 'HEAD',
          signal: AbortSignal.timeout(HTTP_READY_CHECK.requestTimeoutMs),
        });
        // Any response (even 404) means the server is listening
        return true;
      } catch (error) {
        // Log first and last failures for debugging
        if (shouldLog(i)) {
          console.log(
            `[Docker] HTTP ready check attempt ${i + 1}/${HTTP_READY_CHECK.maxAttempts} failed:`,
            error instanceof Error ? error.message : error,
          );
        }
        // Server not ready yet, wait and retry
        const isLastAttempt = i === HTTP_READY_CHECK.maxAttempts - 1;
        if (!isLastAttempt) {
          await new Promise((resolve) => setTimeout(resolve, HTTP_READY_CHECK.delayMs));
        }
      }
    }
    return false;
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

      // Update container status to running after HTTP readiness check
      const containerInfo = this.containers.get(sessionId);
      if (
        containerInfo &&
        containerInfo.status !== 'running' &&
        !containerInfo.readyCheckInProgress
      ) {
        // Prevent concurrent HTTP checks with flag
        containerInfo.readyCheckInProgress = true;

        // Run readiness check in background to avoid blocking log processing
        this.checkHttpReady(containerInfo.port)
          .then((ready) => {
            if (ready && containerInfo.status !== 'running') {
              containerInfo.status = 'running';
              this.emit('status_change', {
                sessionId,
                status: 'running',
              });
              console.log(
                `[Docker] HTTP server ready for ${sessionId} on port ${containerInfo.port}`,
              );
            } else if (!ready) {
              console.warn(
                `[Docker] HTTP readiness check failed for ${sessionId}, but VITE reported ready`,
              );

              // Emit warning event that surfaces in the UI
              const warningEvent: BuildEvent = {
                sessionId,
                timestamp: Date.now(),
                event: 'error',
                details:
                  'Dev server reported ready but HTTP health check failed. The preview may not load correctly.',
              };
              this.emit('build_event', warningEvent);

              // Still mark as running since VITE said it's ready
              containerInfo.status = 'running';
              this.emit('status_change', {
                sessionId,
                status: 'running',
              });
            }
          })
          .finally(() => {
            containerInfo.readyCheckInProgress = false;
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

      while (buffer.length >= 8) {
        const messageSize = buffer.readUInt32BE(4);

        if (buffer.length < 8 + messageSize) {
          break;
        }

        const streamType = buffer[0]; // 1=stdout, 2=stderr
        const messageBuffer = buffer.slice(8, 8 + messageSize);
        const message = messageBuffer.toString('utf8').trim();

        buffer = buffer.slice(8 + messageSize);

        if (!message) continue;

        const log: AppLog = {
          sessionId,
          timestamp: Date.now(),
          type: streamType === 2 ? 'stderr' : 'stdout',
          level: determineLogLevel(message),
          message,
        };

        this.storeLogEntry(sessionId, log);
        console.log(`[Docker:${sessionId}] ${message}`);
      }
    };

    stream.on('data', dataHandler);

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

      this.emitSystemLog(sessionId, 'Installing dependencies...');
      this.emitCommandLog(sessionId, '$ npm install');

      const exec = await containerInfo.container.exec({
        Cmd: ['npm', 'install'],
        AttachStdout: true,
        AttachStderr: true,
        WorkingDir: '/app',
      });

      const stream = await exec.start({ Detach: false, Tty: false });

      cleanupStream = this.processExecStream(sessionId, stream);

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
      this.emitSystemLog(sessionId, 'Dependencies installed successfully');

      if (cleanupStream) {
        cleanupStream();
      }
    } catch (error) {
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

      this.emitSystemLog(sessionId, 'Starting development server...');
      this.emitCommandLog(sessionId, '$ npm run dev -- --host 0.0.0.0 --port 5173');

      const exec = await containerInfo.container.exec({
        Cmd: ['npm', 'run', 'dev', '--', '--host', '0.0.0.0', '--port', '5173'],
        AttachStdout: true,
        AttachStderr: true,
        WorkingDir: '/app',
      });

      // Start the dev server - DON'T detach so we can capture output
      const stream = await exec.start({ Detach: false, Tty: false });

      containerInfo.devServerStreamCleanup = this.processExecStream(sessionId, stream);

      console.log(`[Docker] Dev server starting for ${sessionId}`);

      await this.waitForReady(sessionId, TIMEOUTS.start);
    } catch (error) {
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

        const hasReadyMessage = containerInfo.logs.some(
          (log) => log.message.includes('ready') || log.message.includes('VITE'),
        );

        if (hasReadyMessage || containerInfo.status === 'running') {
          clearInterval(checkInterval);
          containerInfo.readyCheckInterval = undefined;
          resolve();
          return;
        }

        if (Date.now() - startTime > timeout) {
          clearInterval(checkInterval);
          containerInfo.readyCheckInterval = undefined;
          reject(new Error('Timeout waiting for dev server to start'));
        }
      }, 500);

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

    this.emitSystemLog(sessionId, 'Stopping container...');

    try {
      if (containerInfo.cleanupTimer) {
        clearTimeout(containerInfo.cleanupTimer);
        containerInfo.cleanupTimer = undefined;
      }

      if (containerInfo.readyCheckInterval) {
        clearInterval(containerInfo.readyCheckInterval);
        containerInfo.readyCheckInterval = undefined;
      }

      if (containerInfo.streamCleanup) {
        containerInfo.streamCleanup();
        containerInfo.streamCleanup = undefined;
      }

      if (containerInfo.devServerStreamCleanup) {
        containerInfo.devServerStreamCleanup();
        containerInfo.devServerStreamCleanup = undefined;
      }

      containerInfo.status = 'stopped';
      this.emit('status_change', { sessionId, status: 'stopped' });

      await retryOnConflict(
        () =>
          Promise.race([
            containerInfo.container.stop(),
            new Promise((resolve) => setTimeout(resolve, TIMEOUTS.stop)),
          ]),
        `Stop container ${sessionId}`,
      );

      await retryOnConflict(
        () => containerInfo.container.remove({ force: true }),
        `Remove container ${sessionId}`,
      );

      this.containers.delete(sessionId);

      console.log(`[Docker] Container destroyed: ${sessionId}`);
      this.emitSystemLog(sessionId, 'Container stopped and cleaned up');
    } catch (error) {
      console.error('[Docker] Failed to destroy container:', error);
      try {
        await retryOnConflict(
          () => containerInfo.container.remove({ force: true }),
          `Force remove container ${sessionId}`,
        );
        this.containers.delete(sessionId);
      } catch {}
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

export const dockerService = new DockerService();
