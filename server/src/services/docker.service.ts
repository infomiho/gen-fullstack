/**
 * Docker Service
 *
 * Manages Docker containers for running generated apps in isolation.
 * Provides secure execution with resource limits and automatic cleanup.
 */

import { EventEmitter } from 'node:events';
import path from 'node:path';
import type { AppInfo, AppLog, AppStatus } from '@gen-fullstack/shared';
import type { Container, ContainerCreateOptions } from 'dockerode';
import Docker from 'dockerode';
import type { Actor } from 'xstate';
import { createActor } from 'xstate';
import { getEnv } from '../config/env.js';
import { dockerLogger } from '../lib/logger.js';
import {
  CircuitBreaker,
  type ContainerInfo,
  checkHttpReady,
  createDockerMachine,
  createDockerStreamHandler,
  DOCKERFILE_PATH,
  type DockerMachineActor,
  type dockerContainerMachine,
  getDockerSocketPath,
  hasDestroyMethod,
  LogManager,
  PORT_RANGE,
  PortManager,
  RESOURCE_LIMITS,
  RUNNER_IMAGE,
  retryOnConflict,
  stateToAppStatus,
  TIMEOUTS,
} from './docker/index.js';

const docker = new Docker({ socketPath: getDockerSocketPath() });

export class DockerService extends EventEmitter {
  private containers = new Map<string, ContainerInfo>();
  private imageBuilt = false;
  private circuitBreaker = new CircuitBreaker();
  private logManager: LogManager;
  private portManager: PortManager;
  private maxConcurrentContainers: number;

  constructor() {
    super();
    const env = getEnv();
    this.maxConcurrentContainers = env.MAX_CONTAINERS;
    this.logManager = new LogManager(this.containers);
    this.portManager = new PortManager(this.containers, PORT_RANGE.min, PORT_RANGE.max);

    // Forward events from log manager to this service
    this.logManager.on('log', (log) => this.emit('log', log));
    this.logManager.on('build_event', (event) => this.emit('build_event', event));
    this.logManager.on('vite_ready', (sessionId) => {
      // Send VITE_READY event to state machine
      const containerInfo = this.containers.get(sessionId);
      if (containerInfo?.actor) {
        containerInfo.actor.send({ type: 'VITE_READY' });
        dockerLogger.debug({ sessionId }, 'Sent VITE_READY event to state machine');
      }
    });
  }

  /**
   * Cleanup machine context timers and abort controllers
   */
  private cleanupMachineContext(context: {
    readyCheckAbort?: AbortController;
    cleanupTimer?: NodeJS.Timeout;
    readyCheckInterval?: NodeJS.Timeout;
  }): void {
    // Abort HTTP ready checks
    if (context.readyCheckAbort) {
      context.readyCheckAbort.abort();
    }

    // Clear all timers
    if (context.cleanupTimer) {
      clearTimeout(context.cleanupTimer);
    }

    if (context.readyCheckInterval) {
      clearInterval(context.readyCheckInterval);
    }
  }

  /**
   * Cleanup container streams
   */
  private cleanupContainerStreams(containerInfo: ContainerInfo): void {
    if (containerInfo.streamCleanup) {
      containerInfo.streamCleanup();
    }

    if (containerInfo.devServerStreamCleanup) {
      containerInfo.devServerStreamCleanup();
    }
  }

  /**
   * Kill npm run dev process inside container
   *
   * This sends SIGTERM to all node processes inside the container,
   * which kills npm, node (client), and node (server), freeing up ports.
   *
   * Expected exit codes from pkill:
   * - 0: Success (processes killed)
   * - 1: No processes matched (already stopped)
   * - 2: Syntax error (shouldn't happen)
   */
  private async killDevServerProcess(container: Container, sessionId: string): Promise<void> {
    try {
      dockerLogger.debug({ sessionId }, 'Killing dev server process');

      // Kill all node processes (npm + child processes) inside the container
      // Using pkill ensures we kill the entire process tree (npm, vite, express)
      const killExec = await container.exec({
        Cmd: ['pkill', '-TERM', 'node'],
        WorkingDir: '/app',
      });

      // DON'T detach - we want to wait for completion and check exit code
      const stream = await killExec.start({ Detach: false, Tty: false });

      // Wait for command to complete
      await new Promise<void>((resolve, reject) => {
        stream.on('end', () => resolve());
        stream.on('error', reject);
      });

      // Check exit code to verify result
      const inspectResult = await killExec.inspect();
      const exitCode = inspectResult.ExitCode ?? 0;

      if (exitCode === 0) {
        dockerLogger.info({ sessionId }, 'Dev server processes killed successfully');
      } else if (exitCode === 1) {
        dockerLogger.debug({ sessionId }, 'No node processes found to kill (already stopped)');
      } else {
        dockerLogger.warn({ sessionId, exitCode }, 'pkill returned unexpected exit code');
      }
    } catch (error) {
      // Swallow errors - expected scenarios:
      // 1. Process already terminated (ESRCH)
      // 2. Container is stopping/stopped (API error)
      // 3. Stream errors during container shutdown
      dockerLogger.debug(
        {
          error,
          sessionId,
          errorType: error instanceof Error ? error.constructor.name : typeof error,
        },
        'Failed to kill dev server process (might be expected during shutdown)',
      );
    }
  }

  /**
   * Create a configured state machine actor for a container
   *
   * The machine orchestrates the container lifecycle, but delegates actual
   * Docker operations back to the service methods. This hybrid approach
   * allows gradual migration while maintaining existing functionality.
   */
  private createMachineActor(sessionId: string, workingDir: string): DockerMachineActor {
    const machine = createDockerMachine({
      actors: {
        // Delegate to existing service methods
        createContainer: async (input) => {
          // Reuse existing container creation logic
          await this.buildRunnerImage();
          await this.cleanupExistingContainer(input.sessionId);

          const [clientHostPort, serverHostPort] = this.portManager.findTwoAvailablePorts();

          const containerOpts: ContainerCreateOptions = {
            Image: RUNNER_IMAGE,
            name: `gen-${input.sessionId}`,
            Tty: true,
            AttachStdout: true,
            AttachStderr: true,
            WorkingDir: '/app',
            ExposedPorts: {
              '5173/tcp': {},
              '3000/tcp': {},
            },
            HostConfig: {
              Memory: RESOURCE_LIMITS.memory,
              NanoCpus: RESOURCE_LIMITS.nanoCPUs,
              PortBindings: {
                '5173/tcp': [{ HostPort: clientHostPort.toString() }],
                '3000/tcp': [{ HostPort: serverHostPort.toString() }],
              },
              Binds: [`${path.resolve(input.workingDir)}:/app:rw`],
              ReadonlyRootfs: false,
              Tmpfs: {
                '/tmp': 'rw,noexec,nosuid,size=100m',
              },
              CapDrop: ['ALL'],
              SecurityOpt: ['no-new-privileges'],
            },
            Env: ['NODE_ENV=development', 'DATABASE_URL=file:./dev.db'],
          };

          const container = await docker.createContainer(containerOpts);
          await container.start();

          return {
            containerId: container.id,
            container,
            clientPort: clientHostPort,
            serverPort: serverHostPort,
          };
        },
        installDependencies: async (input) => {
          // Reuse existing dependency installation logic
          const containerInfo = this.containers.get(input.sessionId);
          if (!containerInfo || !input.container) {
            throw new Error(`Container not found: ${input.sessionId}`);
          }

          let cleanupStream: (() => void) | undefined;

          try {
            // Step 1: npm install
            this.logManager.emitLog(input.sessionId, 'system', 'Installing dependencies...');
            this.logManager.emitLog(input.sessionId, 'command', '$ npm install --loglevel=info');

            const installExec = await input.container.exec({
              Cmd: ['npm', 'install', '--loglevel=info'],
              AttachStdout: true,
              AttachStderr: true,
              WorkingDir: '/app',
            });

            const installStream = await installExec.start({ Detach: false, Tty: false });
            cleanupStream = this.processExecStream(input.sessionId, installStream);

            await this.executeWithTimeout(installStream, TIMEOUTS.install, 'npm install');

            if (cleanupStream) {
              cleanupStream();
              cleanupStream = undefined;
            }

            this.logManager.emitLog(
              input.sessionId,
              'system',
              'Dependencies installed successfully',
            );

            // Step 2: Prisma generate
            this.logManager.emitLog(input.sessionId, 'system', 'Generating Prisma client...');
            this.logManager.emitLog(input.sessionId, 'command', '$ npx prisma generate');

            const generateExec = await input.container.exec({
              Cmd: ['npx', 'prisma', 'generate'],
              AttachStdout: true,
              AttachStderr: true,
              WorkingDir: '/app',
            });

            const generateStream = await generateExec.start({ Detach: false, Tty: false });
            cleanupStream = this.processExecStream(input.sessionId, generateStream);

            await this.executeWithTimeout(
              generateStream,
              TIMEOUTS.prismaGenerate,
              'prisma generate',
            );

            if (cleanupStream) {
              cleanupStream();
              cleanupStream = undefined;
            }

            this.logManager.emitLog(
              input.sessionId,
              'system',
              'Prisma client generated successfully',
            );

            // Step 3: Database migrations
            this.logManager.emitLog(input.sessionId, 'system', 'Running database migration...');
            this.logManager.emitLog(
              input.sessionId,
              'command',
              '$ npx prisma migrate dev --name init',
            );

            const migrateExec = await input.container.exec({
              Cmd: ['npx', 'prisma', 'migrate', 'dev', '--name', 'init'],
              AttachStdout: true,
              AttachStderr: true,
              WorkingDir: '/app',
              Env: ['DATABASE_URL=file:./dev.db'],
            });

            const migrateStream = await migrateExec.start({ Detach: false, Tty: false });
            cleanupStream = this.processExecStream(input.sessionId, migrateStream);

            await this.executeWithTimeout(
              migrateStream,
              TIMEOUTS.prismaMigrate,
              'prisma migrate dev',
            );

            if (cleanupStream) {
              cleanupStream();
              cleanupStream = undefined;
            }

            this.logManager.emitLog(
              input.sessionId,
              'system',
              'Database migration completed successfully',
            );
          } catch (error) {
            if (cleanupStream) {
              cleanupStream();
            }
            throw error;
          }
        },
        startDevServer: async (input) => {
          // Reuse existing dev server start logic
          const containerInfo = this.containers.get(input.sessionId);
          if (!containerInfo || !input.container) {
            throw new Error(`Container not found: ${input.sessionId}`);
          }

          this.logManager.emitLog(
            input.sessionId,
            'system',
            'Starting development servers (client + server)...',
          );
          this.logManager.emitLog(input.sessionId, 'command', '$ npm run dev');

          const exec = await input.container.exec({
            Cmd: ['npm', 'run', 'dev'],
            AttachStdout: true,
            AttachStderr: true,
            WorkingDir: '/app',
          });

          // Start dev servers - DON'T detach so we can capture output
          const stream = await exec.start({ Detach: false, Tty: false });

          // Store exec instance and cleanup function in containerInfo for later cleanup
          // NOTE: Cannot store in machine context as snapshots are immutable.
          // Cleanup actions will access this via containerInfo object.
          containerInfo.devServerExec = exec;
          const cleanup = this.processExecStream(input.sessionId, stream);
          containerInfo.devServerStreamCleanup = cleanup;

          dockerLogger.info(
            { sessionId: input.sessionId },
            'Dev servers starting (client + server)',
          );
        },
        httpReadyCheck: async (input) => {
          // Use extracted checkHttpReady function
          const ready = await checkHttpReady(input.port, input.signal);
          return ready;
        },
      },
      actions: {
        // Cleanup actions (automatic cleanup on state exits)
        cleanupCreatingStreams: () => {
          const containerInfo = this.containers.get(sessionId);
          if (containerInfo?.actor) {
            const context = containerInfo.actor.getSnapshot().context;
            dockerLogger.debug({ sessionId: context.sessionId }, 'Cleanup: creating streams');
          }
        },
        cleanupInstallStreams: () => {
          const containerInfo = this.containers.get(sessionId);
          if (containerInfo?.actor) {
            const context = containerInfo.actor.getSnapshot().context;
            dockerLogger.debug({ sessionId: context.sessionId }, 'Cleanup: install streams');
          }
        },
        cleanupStartStreams: () => {
          const containerInfo = this.containers.get(sessionId);
          if (containerInfo?.actor) {
            const context = containerInfo.actor.getSnapshot().context;
            dockerLogger.debug({ sessionId: context.sessionId }, 'Cleanup: start streams');
          }
        },
        cleanupRunningStreams: () => {
          const containerInfo = this.containers.get(sessionId);
          if (containerInfo?.actor) {
            const context = containerInfo.actor.getSnapshot().context;
            dockerLogger.debug({ sessionId: context.sessionId }, 'Cleanup: running streams');

            // Abort HTTP ready checks
            if (context.readyCheckAbort) {
              context.readyCheckAbort.abort();
            }

            // Clear intervals
            if (context.readyCheckInterval) {
              clearInterval(context.readyCheckInterval);
            }

            // Kill npm run dev process inside container to free up ports
            // Note: This is async but we don't await in action context.
            // The process kill happens via a separate exec (not the devServer stream),
            // so it's safe to clean up stream listeners immediately after starting the kill.
            if (containerInfo.container && containerInfo.devServerExec) {
              this.killDevServerProcess(containerInfo.container, sessionId).catch((err) =>
                dockerLogger.error({ error: err, sessionId }, 'Failed to kill dev server process'),
              );
            }

            // Cleanup dev server stream listeners (stored in containerInfo, not context)
            // This just removes event listeners - the actual processes are being killed above
            if (containerInfo.devServerStreamCleanup) {
              containerInfo.devServerStreamCleanup();
            }
          }
        },
        cleanupAllResources: () => {
          const containerInfo = this.containers.get(sessionId);
          if (!containerInfo?.actor) return;

          const context = containerInfo.actor.getSnapshot().context;
          dockerLogger.info({ sessionId: context.sessionId }, 'Cleanup: all resources');

          // Cleanup machine context (timers, abort controllers)
          this.cleanupMachineContext(context);

          // Cleanup container streams
          this.cleanupContainerStreams(containerInfo);
        },
      },
    });

    // Create and configure actor
    const actor = createActor(machine, {
      input: { sessionId, workingDir },
    });

    // Subscribe to state changes to update ContainerInfo status and emit WebSocket events
    actor.subscribe((snapshot) => {
      const containerInfo = this.containers.get(sessionId);
      if (containerInfo) {
        const machineState = this.getMachineStateString(snapshot);
        const newStatus = stateToAppStatus(machineState);

        // Only emit if status actually changed to avoid duplicate events
        if (containerInfo.status !== newStatus) {
          containerInfo.status = newStatus;

          // Emit status_change event to WebSocket clients
          const error = snapshot.context.error;
          this.emit('status_change', { sessionId, status: newStatus, error });

          dockerLogger.debug(
            { sessionId, state: machineState, status: newStatus, error },
            'State machine transitioned - status changed',
          );
        }
      }
    });

    return actor;
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
   * Helper method to convert machine state to string
   * Handles both simple string states and complex nested state objects
   *
   * @param snapshot - The machine snapshot to extract state from
   * @returns The state as a string
   */
  private getMachineStateString(
    snapshot: ReturnType<Actor<typeof dockerContainerMachine>['getSnapshot']>,
  ): string {
    return typeof snapshot.value === 'string' ? snapshot.value : JSON.stringify(snapshot.value);
  }

  /**
   * Helper method to wait for machine state transition with timeout protection
   * Prevents memory leaks by ensuring subscriptions are always cleaned up
   *
   * @param actor - The state machine actor to monitor
   * @param targetStates - Array of acceptable target states
   * @param timeoutMs - Maximum time to wait (default: 60 seconds)
   * @returns Promise that resolves when target state is reached
   * @throws Error if timeout is reached or machine enters failed state
   */
  private async waitForMachineState(
    actor: Actor<typeof dockerContainerMachine>,
    targetStates: string[],
    timeoutMs: number = TIMEOUTS.default,
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let subscription: ReturnType<typeof actor.subscribe> | undefined;
      let timeout: NodeJS.Timeout | undefined;

      const cleanup = () => {
        if (subscription) {
          subscription.unsubscribe();
          subscription = undefined;
        }
        if (timeout) {
          clearTimeout(timeout);
          timeout = undefined;
        }
      };

      // Check current state immediately (handles race condition)
      const currentSnapshot = actor.getSnapshot();
      const currentState = this.getMachineStateString(currentSnapshot);

      if (targetStates.includes(currentState)) {
        resolve();
        return;
      }

      if (currentState === 'failed') {
        reject(new Error(currentSnapshot.context.error || 'Machine in failed state'));
        return;
      }

      // Set up timeout protection
      timeout = setTimeout(() => {
        cleanup();
        reject(
          new Error(
            `Timeout waiting for machine state. Expected: [${targetStates.join(', ')}], Current: ${currentState}`,
          ),
        );
      }, timeoutMs);

      // Subscribe to state changes
      subscription = actor.subscribe((snapshot) => {
        const state = this.getMachineStateString(snapshot);

        if (targetStates.includes(state)) {
          cleanup();
          resolve();
        } else if (state === 'failed') {
          cleanup();
          reject(new Error(snapshot.context.error || 'Machine transitioned to failed state'));
        }
      });
    });
  }

  /**
   * Create and start a container for the generated full-stack app
   */
  async createContainer(sessionId: string, workingDir: string): Promise<AppInfo> {
    try {
      // Check circuit breaker first
      this.circuitBreaker.check();

      // Check container limit before creating new ones
      if (this.containers.size >= this.maxConcurrentContainers) {
        throw new Error(
          `Container limit reached (${this.maxConcurrentContainers}). ` +
            `Please stop some running containers before starting new ones. ` +
            `Increase MAX_CONTAINERS environment variable if needed.`,
        );
      }

      this.logManager.emitLog(sessionId, 'system', 'Creating container...');

      // Create minimal container info - machine will populate it
      const containerInfo: ContainerInfo = {
        sessionId,
        containerId: '',
        container: null,
        status: 'ready',
        clientPort: 0,
        serverPort: 0,
        createdAt: Date.now(),
        logs: [],
      };

      this.containers.set(sessionId, containerInfo);

      // Initialize state machine actor
      const actor = this.createMachineActor(sessionId, workingDir);
      containerInfo.actor = actor;
      actor.start();

      dockerLogger.info({ sessionId }, 'State machine driving container creation');

      // Send CREATE event - machine will handle buildImage, cleanup, create, start
      actor.send({ type: 'CREATE', sessionId, workingDir });

      // Wait for machine to reach 'ready' state with timeout protection
      await this.waitForMachineState(actor, ['ready'], TIMEOUTS.containerCreation);

      // Update containerInfo from machine context
      const snapshot = actor.getSnapshot();
      containerInfo.containerId = snapshot.context.containerId || '';
      containerInfo.container = snapshot.context.container || null;
      containerInfo.clientPort = snapshot.context.clientPort || 0;
      containerInfo.serverPort = snapshot.context.serverPort || 0;

      // Setup log streaming and auto-cleanup
      if (containerInfo.container) {
        this.setupLogStream(sessionId, containerInfo.container);
      }
      this.setupAutoCleanup(sessionId);

      this.logManager.emitLog(sessionId, 'system', 'Container ready for commands');

      // Record successful operation
      this.circuitBreaker.recordSuccess();

      return {
        sessionId,
        containerId: containerInfo.containerId,
        status: stateToAppStatus(actor.getSnapshot().value as string),
        clientPort: containerInfo.clientPort,
        serverPort: containerInfo.serverPort,
        clientUrl: `http://localhost:${containerInfo.clientPort}`,
        serverUrl: `http://localhost:${containerInfo.serverPort}`,
      };
    } catch (error) {
      dockerLogger.error({ error, sessionId }, 'Failed to create container');
      // Record failure for circuit breaker
      this.circuitBreaker.recordFailure();
      throw new Error(`Failed to create Docker container: ${error}`);
    }
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

      const dataHandler = createDockerStreamHandler(sessionId, (log) =>
        this.logManager.storeLogEntry(sessionId, log),
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
   * Process exec stream output and emit logs
   */
  private processExecStream(sessionId: string, stream: NodeJS.ReadableStream): () => void {
    const dataHandler = createDockerStreamHandler(sessionId, (log) => {
      this.logManager.storeLogEntry(sessionId, log);
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

    if (!containerInfo.actor) {
      throw new Error(`State machine actor not found for session: ${sessionId}`);
    }

    try {
      dockerLogger.info({ sessionId }, 'State machine driving dependency installation');

      // Send INSTALL_DEPS event - machine handles npm install, Prisma generate, migrations
      containerInfo.actor.send({ type: 'INSTALL_DEPS' });

      // Wait for machine to reach installation complete states with timeout protection
      await this.waitForMachineState(
        containerInfo.actor,
        ['starting', 'waitingForVite', 'running'], // Accept any state past installation
        180000, // 3 minutes for npm install + Prisma
      );

      dockerLogger.info({ sessionId }, 'Dependencies installed successfully via state machine');
    } catch (error) {
      dockerLogger.error({ error, sessionId }, 'Failed to install dependencies via state machine');
      throw error;
    }
  }

  /**
   * Execute an arbitrary command in a container
   *
   * This method enables running validation commands (TypeScript, Prisma, etc.)
   * inside Docker containers for security and environment consistency.
   *
   * @param sessionId - Session identifier
   * @param command - Command to execute (e.g., 'npm install', 'npx tsc --noEmit')
   * @param timeoutMs - Command timeout in milliseconds (default: 60s)
   * @returns Command result with stdout, stderr, exitCode, executionTime, and success flag
   *
   * @example
   * ```typescript
   * // Run TypeScript type checking
   * const result = await dockerService.executeCommand(
   *   sessionId,
   *   'npx tsc --noEmit --project server/tsconfig.json',
   *   120000
   * );
   *
   * if (!result.success) {
   *   console.error('Type check failed:', result.stderr);
   * }
   * ```
   */
  async executeCommand(
    sessionId: string,
    command: string,
    timeoutMs: number = TIMEOUTS.default,
  ): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
    executionTime: number;
    success: boolean;
  }> {
    const containerInfo = this.containers.get(sessionId);
    if (!containerInfo) {
      throw new Error(`Container not found: ${sessionId}`);
    }

    const startTime = Date.now();
    let cleanupStream: (() => void) | undefined;
    let stdout = '';
    let stderr = '';
    let exitCode = 0;

    try {
      dockerLogger.debug({ sessionId, command }, 'Executing command in container');

      if (!containerInfo.container) {
        throw new Error('Container is null - cannot execute command');
      }

      // Create exec instance
      const exec = await containerInfo.container.exec({
        Cmd: ['sh', '-c', command],
        AttachStdout: true,
        AttachStderr: true,
        WorkingDir: '/app',
      });

      // Start execution
      const stream = await exec.start({ Detach: false, Tty: false });

      // Capture output
      const dataHandler = createDockerStreamHandler(sessionId, (log) => {
        if (log.type === 'stdout') {
          stdout += `${log.message}\n`;
        } else {
          stderr += `${log.message}\n`;
        }
      });

      stream.on('data', dataHandler);

      cleanupStream = () => {
        stream.off('data', dataHandler);
        if (hasDestroyMethod(stream)) {
          stream.destroy();
        }
      };

      // Wait for completion with timeout
      await this.executeWithTimeout(stream, timeoutMs, `command: ${command}`);

      // Get exit code
      const inspectResult = await exec.inspect();
      exitCode = inspectResult.ExitCode ?? 0;

      const executionTime = Date.now() - startTime;
      const success = exitCode === 0;

      dockerLogger.debug(
        {
          sessionId,
          command,
          exitCode,
          executionTime,
          success,
        },
        'Command execution completed',
      );

      return {
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode,
        executionTime,
        success,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      dockerLogger.error({ error, sessionId, command }, 'Command execution failed');

      return {
        stdout: stdout.trim(),
        stderr: stderr.trim() || (error instanceof Error ? error.message : String(error)),
        exitCode: exitCode || 1,
        executionTime,
        success: false,
      };
    } finally {
      if (cleanupStream) {
        cleanupStream();
      }
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

    if (!containerInfo.actor) {
      throw new Error(`State machine actor not found for session: ${sessionId}`);
    }

    try {
      dockerLogger.info({ sessionId }, 'State machine driving dev server startup');

      // Send START_SERVER event - machine handles npm run dev and waits for VITE_READY + HTTP_READY
      containerInfo.actor.send({ type: 'START_SERVER' });

      // Wait for machine to reach 'running' state with timeout protection
      await this.waitForMachineState(containerInfo.actor, ['running'], TIMEOUTS.viteHttpReady);

      dockerLogger.info({ sessionId }, 'Dev servers running successfully via state machine');
    } catch (error) {
      dockerLogger.error({ error, sessionId }, 'Failed to start dev servers via state machine');
      throw error;
    }
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
    return this.logManager.getLogs(sessionId);
  }

  /**
   * Check if a container exists for a session
   *
   * @param sessionId - Session identifier
   * @returns True if container exists, false otherwise
   */
  hasContainer(sessionId: string): boolean {
    return this.containers.has(sessionId);
  }

  /**
   * Stop the dev server but keep the container running
   *
   * This transitions the container from 'running' back to 'ready' state,
   * keeping dependencies installed so it can be restarted quickly.
   */
  async stopDevServer(sessionId: string): Promise<void> {
    const containerInfo = this.containers.get(sessionId);
    if (!containerInfo) {
      throw new Error(`Container not found: ${sessionId}`);
    }

    if (!containerInfo.actor) {
      throw new Error(`State machine actor not found for session: ${sessionId}`);
    }

    try {
      this.logManager.emitLog(sessionId, 'system', 'Stopping dev servers...');

      // Send STOP_SERVER event - machine handles cleanup and transitions to 'ready'
      containerInfo.actor.send({ type: 'STOP_SERVER' });

      // Wait for machine to reach 'ready' state with timeout protection
      await this.waitForMachineState(containerInfo.actor, ['ready'], TIMEOUTS.stop);

      dockerLogger.info(
        { sessionId },
        'Dev servers stopped via state machine, container ready for restart',
      );
      this.logManager.emitLog(
        sessionId,
        'system',
        'Dev servers stopped. Container is ready to restart.',
      );
    } catch (error) {
      dockerLogger.error({ error, sessionId }, 'Failed to stop dev server via state machine');
      throw error;
    }
  }

  /**
   * Get container status information
   * Status is derived from state machine state
   */
  getStatus(sessionId: string): AppInfo | null {
    const containerInfo = this.containers.get(sessionId);
    if (!containerInfo) {
      return null;
    }

    // Derive status from machine state
    let status: AppStatus = 'stopped';
    if (containerInfo.actor) {
      const machineState = containerInfo.actor.getSnapshot().value;
      status = stateToAppStatus(
        typeof machineState === 'string' ? machineState : JSON.stringify(machineState),
      );
    }

    return {
      sessionId,
      containerId: containerInfo.containerId,
      status,
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

    this.logManager.emitLog(sessionId, 'system', 'Stopping container...');

    try {
      // Send DESTROY event to state machine - cleanup will happen via exit actions
      if (containerInfo.actor) {
        containerInfo.actor.send({ type: 'DESTROY' });

        // Wait for machine to reach 'stopped' or 'failed' state with timeout protection
        await this.waitForMachineState(containerInfo.actor, ['stopped', 'failed'], TIMEOUTS.stop);
      }

      // Physical Docker container cleanup
      if (containerInfo.container) {
        const container = containerInfo.container;
        await retryOnConflict(
          () =>
            Promise.race([
              container.stop(),
              new Promise((resolve) => setTimeout(resolve, TIMEOUTS.stop)),
            ]),
          `Stop container ${sessionId}`,
        );

        await retryOnConflict(
          () => container.remove({ force: true }),
          `Remove container ${sessionId}`,
        );
      }

      this.containers.delete(sessionId);

      dockerLogger.info({ sessionId }, 'Container destroyed');
      this.logManager.emitLog(sessionId, 'system', 'Container stopped and cleaned up');
    } catch (error) {
      dockerLogger.error({ error, sessionId }, 'Failed to destroy container');
      try {
        if (containerInfo.container) {
          const container = containerInfo.container;
          await retryOnConflict(
            () => container.remove({ force: true }),
            `Force remove container ${sessionId}`,
          );
          this.containers.delete(sessionId);
        }
      } catch {}
    }
  }

  /**
   * Cleanup all containers and circuit breaker
   */
  async cleanup(): Promise<void> {
    // Clear circuit breaker timeout to prevent memory leak
    this.circuitBreaker.cleanup();

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

// Re-export types for backward compatibility
export type { ContainerInfo };
