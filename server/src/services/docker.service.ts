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
import { getEnv } from '../config/env.js';
import { dockerLogger } from '../lib/logger.js';

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
      dockerLogger.warn({ realPath }, 'Socket path rejected (not in allowed locations)');
      return false;
    }

    // Verify it's actually a socket, not a regular file
    const stats = fs.statSync(realPath);
    if (!stats.isSocket()) {
      dockerLogger.warn({ realPath }, 'Path exists but is not a socket');
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
  const env = getEnv();

  // 1. Check DOCKER_HOST environment variable (standard Docker way)
  if (env.DOCKER_HOST?.startsWith('unix://')) {
    const socketPath = env.DOCKER_HOST.replace('unix://', '');
    if (isValidSocketPath(socketPath)) {
      dockerLogger.info({ socketPath }, 'Using validated socket from DOCKER_HOST');
      return socketPath;
    }
    dockerLogger.warn({ socketPath }, 'DOCKER_HOST socket invalid');
  }

  if (os.platform() === 'darwin') {
    // 2. Check for Colima (common on macOS)
    const colimaHome = env.COLIMA_HOME || path.join(os.homedir(), '.colima');
    const colimaSocket = path.join(colimaHome, 'default/docker.sock');
    if (isValidSocketPath(colimaSocket)) {
      dockerLogger.info({ socketPath: colimaSocket }, 'Using Colima socket');
      return colimaSocket;
    }

    // 3. Check for Docker Desktop for Mac
    const dockerDesktopSocket = path.join(os.homedir(), '.docker/run/docker.sock');
    if (isValidSocketPath(dockerDesktopSocket)) {
      dockerLogger.info({ socketPath: dockerDesktopSocket }, 'Using Docker Desktop socket');
      return dockerDesktopSocket;
    }

    // 4. Check standard socket (might be symlinked)
    if (isValidSocketPath('/var/run/docker.sock')) {
      dockerLogger.info('Using standard socket: /var/run/docker.sock');
      return '/var/run/docker.sock';
    }

    dockerLogger.warn(
      {
        dockerHost: env.DOCKER_HOST || 'not set',
        colimaSocket,
        dockerDesktopSocket,
      },
      'No valid Docker socket found on macOS',
    );
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

// Note: MAX_CONCURRENT_CONTAINERS moved to DockerService.maxConcurrentContainers (initialized from env)

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
      dockerLogger.info(
        { operationName, delay, attempt, maxAttempts: RETRY_CONFIG.maxAttempts },
        `${operationName} failed with 409 conflict, retrying`,
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
  clientPort: number; // Host port mapped to container's Vite port (5173)
  serverPort: number; // Host port mapped to container's Express port (3000)
  createdAt: number;
  logs: AppLog[];
  cleanupTimer?: NodeJS.Timeout;
  streamCleanup?: () => void;
  devServerStreamCleanup?: () => void;
  readyCheckInterval?: NodeJS.Timeout;
  readyCheckPromise?: Promise<void>;
  readyCheckAbort?: AbortController; // For canceling HTTP ready checks
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
  private consecutiveFailures = 0;
  private circuitBreakerOpen = false;
  private circuitBreakerResetTimeout?: NodeJS.Timeout;
  private maxConcurrentContainers: number;

  private static readonly CIRCUIT_BREAKER_THRESHOLD = 5; // Open after 5 consecutive failures
  private static readonly CIRCUIT_BREAKER_RESET_MS = 60 * 1000; // Try again after 1 minute

  constructor() {
    super();
    const env = getEnv();
    this.maxConcurrentContainers = env.MAX_CONTAINERS;
  }

  /**
   * Check if circuit breaker is open and throw error if so
   */
  private checkCircuitBreaker(): void {
    if (this.circuitBreakerOpen) {
      throw new Error(
        'Docker service temporarily unavailable due to repeated failures. ' +
          'Please wait a moment and try again.',
      );
    }
  }

  /**
   * Record a successful Docker operation (reset failure counter)
   */
  private recordSuccess(): void {
    this.consecutiveFailures = 0;
    this.circuitBreakerOpen = false;
    if (this.circuitBreakerResetTimeout) {
      clearTimeout(this.circuitBreakerResetTimeout);
      this.circuitBreakerResetTimeout = undefined;
    }
  }

  /**
   * Record a failed Docker operation and open circuit breaker if threshold reached
   */
  private recordFailure(): void {
    this.consecutiveFailures++;

    if (this.consecutiveFailures >= DockerService.CIRCUIT_BREAKER_THRESHOLD) {
      this.circuitBreakerOpen = true;
      dockerLogger.error(
        {
          consecutiveFailures: this.consecutiveFailures,
          resetMs: DockerService.CIRCUIT_BREAKER_RESET_MS,
        },
        'Circuit breaker opened',
      );

      // Auto-reset circuit breaker after timeout
      this.circuitBreakerResetTimeout = setTimeout(() => {
        dockerLogger.info('Circuit breaker reset - attempting to recover');
        this.consecutiveFailures = 0;
        this.circuitBreakerOpen = false;
      }, DockerService.CIRCUIT_BREAKER_RESET_MS);
    }
  }

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
   * Emit a log entry with specified level
   *
   * @param sessionId - Session identifier
   * @param level - Log level (command, system, info, warn, error)
   * @param message - Log message
   * @param type - Stream type (stdout or stderr), defaults to stdout
   */
  private emitLog(
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
        dockerLogger.info({ image: RUNNER_IMAGE }, 'Runner image already exists');
        this.imageBuilt = true;
        return;
      }

      dockerLogger.info({ image: RUNNER_IMAGE }, 'Building runner image');

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
              dockerLogger.debug(event.stream.trim());
            }
          },
        );
      });

      dockerLogger.info({ image: RUNNER_IMAGE }, 'Runner image built successfully');
      this.imageBuilt = true;
    } catch (error) {
      dockerLogger.error({ error }, 'Failed to build runner image');
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
      dockerLogger.info('Cleaning up orphaned containers...');

      const containers = await docker.listContainers({ all: true });
      const orphanedContainers = containers.filter((c) =>
        c.Names.some((name) => name.startsWith('/gen-')),
      );

      if (orphanedContainers.length === 0) {
        dockerLogger.info('No orphaned containers found');
        return;
      }

      dockerLogger.info(
        { count: orphanedContainers.length },
        'Found orphaned containers, removing...',
      );

      const promises = orphanedContainers.map(async (c) => {
        const container = docker.getContainer(c.Id);
        try {
          if (c.State === 'running') {
            await container.stop({ t: 5 });
          }
          await container.remove({ force: true });
          dockerLogger.info({ containerName: c.Names[0] }, 'Removed orphaned container');
        } catch (error) {
          dockerLogger.error(
            { error, containerName: c.Names[0] },
            'Failed to remove orphaned container',
          );
        }
      });

      await Promise.all(promises);
      dockerLogger.info('Orphaned container cleanup complete');
    } catch (error) {
      dockerLogger.error({ error }, 'Failed to cleanup orphaned containers');
    }
  }

  /**
   * Find an available port in the range, optionally excluding a specific port
   */
  private async findAvailablePort(start: number, end: number, exclude?: number): Promise<number> {
    for (let port = start; port <= end; port++) {
      if (port === exclude) {
        continue; // Skip excluded port
      }
      const isAvailable = ![...this.containers.values()].some(
        (c) => c.clientPort === port || c.serverPort === port,
      );
      if (isAvailable) {
        return port;
      }
    }
    throw new Error(`No available ports in range ${start}-${end}`);
  }

  /**
   * Find two distinct available ports for client and server
   * Ensures clientPort !== serverPort to avoid bind conflicts
   */
  private async findTwoAvailablePorts(start: number, end: number): Promise<[number, number]> {
    const clientPort = await this.findAvailablePort(start, end);
    const serverPort = await this.findAvailablePort(start, end, clientPort);
    return [clientPort, serverPort];
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
        dockerLogger.info({ containerName }, 'Found existing container, removing...');
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
        dockerLogger.info({ containerName }, 'Removed existing container');
      }
    } catch (error) {
      dockerLogger.error({ error }, 'Failed to cleanup existing container');
    }
  }

  /**
   * Create and start a container for the generated full-stack app
   */
  async createContainer(sessionId: string, workingDir: string): Promise<AppInfo> {
    try {
      // Check circuit breaker first
      this.checkCircuitBreaker();

      // Check container limit before creating new ones
      if (this.containers.size >= this.maxConcurrentContainers) {
        throw new Error(
          `Container limit reached (${this.maxConcurrentContainers}). ` +
            `Please stop some running containers before starting new ones. ` +
            `Increase MAX_CONTAINERS environment variable if needed.`,
        );
      }

      this.emitLog(sessionId, 'system', 'Creating container...');
      await this.buildRunnerImage();
      await this.cleanupExistingContainer(sessionId);

      // Allocate ports for both client (Vite) and server (Express)
      const [clientHostPort, serverHostPort] = await this.findTwoAvailablePorts(5001, 5200);

      const containerOpts: ContainerCreateOptions = {
        Image: RUNNER_IMAGE,
        name: `gen-${sessionId}`,
        Tty: true,
        AttachStdout: true,
        AttachStderr: true,
        WorkingDir: '/app',
        ExposedPorts: {
          '5173/tcp': {}, // Vite client port
          '3000/tcp': {}, // Express server port
        },
        HostConfig: {
          Memory: RESOURCE_LIMITS.memory,
          NanoCpus: RESOURCE_LIMITS.nanoCPUs,
          PortBindings: {
            '5173/tcp': [{ HostPort: clientHostPort.toString() }],
            '3000/tcp': [{ HostPort: serverHostPort.toString() }],
          },
          Binds: [`${path.resolve(workingDir)}:/app:rw`],
          ReadonlyRootfs: false, // Allow writes to /tmp and database file
          Tmpfs: {
            '/tmp': 'rw,noexec,nosuid,size=100m',
          },
          CapDrop: ['ALL'], // Drop all capabilities for security
          SecurityOpt: ['no-new-privileges'], // Prevent privilege escalation
        },
        Env: [
          'NODE_ENV=development',
          'DATABASE_URL=file:./dev.db', // Prisma database connection
        ],
      };

      const container = await docker.createContainer(containerOpts);
      const containerId = container.id;

      await container.start();

      const containerInfo: ContainerInfo = {
        sessionId,
        containerId,
        container,
        status: 'creating',
        clientPort: clientHostPort,
        serverPort: serverHostPort,
        createdAt: Date.now(),
        logs: [],
      };

      this.containers.set(sessionId, containerInfo);

      this.setupLogStream(sessionId, container);
      this.setupAutoCleanup(sessionId);

      this.emitLog(sessionId, 'system', 'Container created successfully');

      // Record successful operation
      this.recordSuccess();

      return {
        sessionId,
        containerId,
        status: 'creating',
        clientPort: clientHostPort,
        serverPort: serverHostPort,
        clientUrl: `http://localhost:${clientHostPort}`,
        serverUrl: `http://localhost:${serverHostPort}`,
      };
    } catch (error) {
      dockerLogger.error({ error, sessionId }, 'Failed to create container');
      // Record failure for circuit breaker
      this.recordFailure();
      throw new Error(`Failed to create Docker container: ${error}`);
    }
  }

  /**
   * Create a handler for Docker multiplexed stream format
   *
   * Docker logs/exec streams use multiplexed format:
   * - Header (8 bytes): [stream_type, 0, 0, 0, size1, size2, size3, size4]
   * - stream_type: 1=stdout, 2=stderr
   * - size: big-endian uint32 of message length
   * - Followed by message bytes
   *
   * @param sessionId - Session identifier for log context
   * @param onMessage - Callback invoked for each parsed log message
   * @returns Handler function to attach to stream's 'data' event
   */
  private createDockerStreamHandler(
    sessionId: string,
    onMessage: (log: AppLog) => void,
  ): (chunk: Buffer) => void {
    let buffer = Buffer.alloc(0);

    return (chunk: Buffer) => {
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

        onMessage(log);
      }
    };
  }

  /**
   * Set up log streaming from container
   */
  private async setupLogStream(sessionId: string, container: Container): Promise<void> {
    try {
      const stream = await container.logs({
        follow: true,
        stdout: true,
        stderr: true,
        timestamps: true,
      });

      const dataHandler = this.createDockerStreamHandler(sessionId, (log) =>
        this.storeLogEntry(sessionId, log),
      );

      const errorHandler = (error: Error) => {
        dockerLogger.error({ error, sessionId }, 'Log stream error');
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
      dockerLogger.error({ error, sessionId }, 'Failed to setup log stream');
    }
  }

  /**
   * Attempt a single HTTP readiness check
   */
  private async attemptHttpCheck(
    port: number,
    attempt: number,
    signal?: AbortSignal,
  ): Promise<boolean> {
    try {
      await fetch(`http://localhost:${port}`, {
        method: 'HEAD',
        signal: signal || AbortSignal.timeout(HTTP_READY_CHECK.requestTimeoutMs),
      });
      return true; // Any response means server is listening
    } catch (error) {
      // Log first and last failures for debugging
      const shouldLog = attempt === 0 || attempt === HTTP_READY_CHECK.maxAttempts - 1;
      if (shouldLog) {
        dockerLogger.info(
          {
            port,
            attempt: attempt + 1,
            maxAttempts: HTTP_READY_CHECK.maxAttempts,
            error: error instanceof Error ? error.message : error,
          },
          'HTTP ready check attempt failed',
        );
      }
      return false;
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
   * @param signal - Optional AbortSignal to cancel the check
   * @returns Promise<boolean> - true if server responds within timeout, false otherwise
   *
   * @remarks
   * - Uses HEAD requests to minimize overhead
   * - Accepts any HTTP response (including 404) as "ready"
   * - Retries up to 10 times with 500ms delays (~5 seconds total)
   * - Each request has a 1 second timeout
   * - Logs first and last failures for debugging
   * - Can be canceled via AbortSignal
   */
  private async checkHttpReady(port: number, signal?: AbortSignal): Promise<boolean> {
    for (let i = 0; i < HTTP_READY_CHECK.maxAttempts; i++) {
      if (signal?.aborted) {
        return false;
      }

      const isReady = await this.attemptHttpCheck(port, i, signal);
      if (isReady) {
        return true;
      }

      if (signal?.aborted) {
        return false;
      }

      // Wait before next attempt (unless last attempt)
      const isLastAttempt = i === HTTP_READY_CHECK.maxAttempts - 1;
      if (!isLastAttempt) {
        await new Promise((resolve) => setTimeout(resolve, HTTP_READY_CHECK.delayMs));
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
      if (containerInfo && containerInfo.status !== 'running') {
        // Prevent concurrent HTTP checks with promise-based lock
        if (containerInfo.readyCheckPromise) {
          return; // Already checking, skip duplicate
        }

        // Create AbortController for cancellation
        const abortController = new AbortController();
        containerInfo.readyCheckAbort = abortController;

        // Run readiness check in background to avoid blocking log processing
        containerInfo.readyCheckPromise = this.checkHttpReady(
          containerInfo.clientPort,
          abortController.signal,
        )
          .then((ready) => {
            // Check if aborted
            if (abortController.signal.aborted) {
              return;
            }

            // Guard against race: only update if still not running
            if (containerInfo.status !== 'running') {
              if (ready) {
                containerInfo.status = 'running';
                this.emit('status_change', {
                  sessionId,
                  status: 'running',
                });
                dockerLogger.info(
                  { sessionId, clientPort: containerInfo.clientPort },
                  'HTTP server ready',
                );
              } else {
                dockerLogger.warn(
                  { sessionId },
                  'HTTP readiness check failed, but VITE reported ready',
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
            }
          })
          .finally(() => {
            containerInfo.readyCheckPromise = undefined;
            containerInfo.readyCheckAbort = undefined;
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
   */
  private processExecStream(sessionId: string, stream: NodeJS.ReadableStream): () => void {
    const dataHandler = this.createDockerStreamHandler(sessionId, (log) => {
      this.storeLogEntry(sessionId, log);
      dockerLogger.debug({ sessionId, message: log.message }, 'Container log');
    });

    stream.on('data', dataHandler);

    return () => {
      stream.off('data', dataHandler);
      if (hasDestroyMethod(stream)) {
        stream.destroy();
      }
    };
  }

  /**
   * Execute a stream operation with timeout
   *
   * Races stream completion against a timeout, throwing an error if the timeout expires first.
   * Properly handles stream cleanup to prevent memory leaks.
   *
   * @param stream - The readable stream to wait for completion
   * @param timeoutMs - Timeout in milliseconds
   * @param operationName - Human-readable operation name for error messages
   * @throws Error if operation times out or stream errors
   */
  private async executeWithTimeout(
    stream: NodeJS.ReadableStream,
    timeoutMs: number,
    operationName: string,
  ): Promise<void> {
    await Promise.race([
      new Promise<void>((resolve, reject) => {
        stream.on('end', () => resolve());
        stream.on('error', reject);
      }),
      new Promise<void>((_, reject) =>
        setTimeout(
          () => reject(new Error(`${operationName} timeout after ${timeoutMs}ms`)),
          timeoutMs,
        ),
      ),
    ]);
  }

  /**
   * Install dependencies in container (monorepo with workspaces)
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

      // Step 1: Install all dependencies (root + client + server workspaces)
      this.emitLog(sessionId, 'system', 'Installing dependencies...');
      this.emitLog(sessionId, 'command', '$ npm install --loglevel=info');

      const installExec = await containerInfo.container.exec({
        Cmd: ['npm', 'install', '--loglevel=info'],
        AttachStdout: true,
        AttachStderr: true,
        WorkingDir: '/app',
      });

      const installStream = await installExec.start({ Detach: false, Tty: false });
      cleanupStream = this.processExecStream(sessionId, installStream);

      await this.executeWithTimeout(installStream, TIMEOUTS.install, 'npm install');

      if (cleanupStream) {
        cleanupStream();
        cleanupStream = undefined;
      }

      dockerLogger.info({ sessionId }, 'Dependencies installed');
      this.emitLog(sessionId, 'system', 'Dependencies installed successfully');

      // Step 2: Generate Prisma client
      this.emitLog(sessionId, 'system', 'Generating Prisma client...');
      this.emitLog(sessionId, 'command', '$ npx prisma generate');

      const generateExec = await containerInfo.container.exec({
        Cmd: ['npx', 'prisma', 'generate'],
        AttachStdout: true,
        AttachStderr: true,
        WorkingDir: '/app',
      });

      const generateStream = await generateExec.start({ Detach: false, Tty: false });
      cleanupStream = this.processExecStream(sessionId, generateStream);

      await this.executeWithTimeout(generateStream, 60000, 'prisma generate');

      if (cleanupStream) {
        cleanupStream();
        cleanupStream = undefined;
      }

      this.emitLog(sessionId, 'system', 'Prisma client generated successfully');

      // Step 3: Check if migrations exist, then run database migrations
      this.emitLog(sessionId, 'system', 'Checking for existing migrations...');

      const checkMigrationsExec = await containerInfo.container.exec({
        Cmd: ['sh', '-c', 'test -d prisma/migrations && echo "exists" || echo "none"'],
        AttachStdout: true,
        AttachStderr: true,
        WorkingDir: '/app',
      });

      const checkStream = await checkMigrationsExec.start({ Detach: false, Tty: false });
      let migrationsExist = false;
      let checkBuffer = '';

      const checkHandler = (chunk: Buffer) => {
        checkBuffer += chunk.toString('utf8');
      };

      checkStream.on('data', checkHandler);

      try {
        await new Promise((resolve, reject) => {
          checkStream.on('end', resolve);
          checkStream.on('error', reject);
        });

        migrationsExist = checkBuffer.includes('exists');
      } finally {
        // Clean up stream handler
        checkStream.off('data', checkHandler);
        if (hasDestroyMethod(checkStream)) {
          checkStream.destroy();
        }
      }

      if (migrationsExist) {
        this.emitLog(
          sessionId,
          'system',
          'Migrations directory already exists, applying existing migrations...',
        );
        this.emitLog(sessionId, 'command', '$ npx prisma migrate deploy');

        const deployExec = await containerInfo.container.exec({
          Cmd: ['npx', 'prisma', 'migrate', 'deploy'],
          AttachStdout: true,
          AttachStderr: true,
          WorkingDir: '/app',
          Env: ['DATABASE_URL=file:./dev.db'],
        });

        const deployStream = await deployExec.start({ Detach: false, Tty: false });
        cleanupStream = this.processExecStream(sessionId, deployStream);

        await this.executeWithTimeout(deployStream, 60000, 'prisma migrate deploy');

        if (cleanupStream) {
          cleanupStream();
          cleanupStream = undefined;
        }

        this.emitLog(sessionId, 'system', 'Existing migrations applied successfully');
      } else {
        this.emitLog(sessionId, 'system', 'Running initial database migration...');
        this.emitLog(sessionId, 'command', '$ npx prisma migrate dev --name init');

        const migrateExec = await containerInfo.container.exec({
          Cmd: ['npx', 'prisma', 'migrate', 'dev', '--name', 'init'],
          AttachStdout: true,
          AttachStderr: true,
          WorkingDir: '/app',
          Env: ['DATABASE_URL=file:./dev.db'],
        });

        const migrateStream = await migrateExec.start({ Detach: false, Tty: false });
        cleanupStream = this.processExecStream(sessionId, migrateStream);

        await this.executeWithTimeout(migrateStream, 60000, 'prisma migrate dev');

        if (cleanupStream) {
          cleanupStream();
          cleanupStream = undefined;
        }

        this.emitLog(sessionId, 'system', 'Initial database migration completed successfully');
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
   * Start dev servers in container (both client and server via concurrently)
   */
  async startDevServer(sessionId: string): Promise<void> {
    const containerInfo = this.containers.get(sessionId);
    if (!containerInfo) {
      throw new Error(`Container not found: ${sessionId}`);
    }

    try {
      containerInfo.status = 'starting';
      this.emit('status_change', { sessionId, status: 'starting' });

      this.emitLog(sessionId, 'system', 'Starting development servers (client + server)...');
      this.emitLog(sessionId, 'command', '$ npm run dev');

      const exec = await containerInfo.container.exec({
        Cmd: ['npm', 'run', 'dev'],
        AttachStdout: true,
        AttachStderr: true,
        WorkingDir: '/app',
      });

      // Start both dev servers via concurrently - DON'T detach so we can capture output
      const stream = await exec.start({ Detach: false, Tty: false });

      containerInfo.devServerStreamCleanup = this.processExecStream(sessionId, stream);

      dockerLogger.info({ sessionId }, 'Dev servers starting (client + server)');

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
        error: `Failed to start dev servers: ${error}`,
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
        dockerLogger.info({ sessionId }, 'Auto-cleanup timeout');
        this.destroyContainer(sessionId).catch((err) =>
          dockerLogger.error({ error: err, sessionId }, 'Auto-cleanup failed'),
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
      clientPort: containerInfo.clientPort,
      serverPort: containerInfo.serverPort,
      clientUrl: `http://localhost:${containerInfo.clientPort}`,
      serverUrl: `http://localhost:${containerInfo.serverPort}`,
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

    this.emitLog(sessionId, 'system', 'Stopping container...');

    try {
      // Abort any pending HTTP ready checks
      if (containerInfo.readyCheckAbort) {
        containerInfo.readyCheckAbort.abort();
        containerInfo.readyCheckAbort = undefined;
      }

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

      dockerLogger.info({ sessionId }, 'Container destroyed');
      this.emitLog(sessionId, 'system', 'Container stopped and cleaned up');
    } catch (error) {
      dockerLogger.error({ error, sessionId }, 'Failed to destroy container');
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
   * Cleanup all containers and circuit breaker timeout
   */
  async cleanup(): Promise<void> {
    // Clear circuit breaker timeout to prevent memory leak
    if (this.circuitBreakerResetTimeout) {
      clearTimeout(this.circuitBreakerResetTimeout);
      this.circuitBreakerResetTimeout = undefined;
    }

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
