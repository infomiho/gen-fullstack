/**
 * Docker Container State Machine
 *
 * Manages the lifecycle of Docker containers for running generated apps.
 * Uses XState for explicit state management and automatic cleanup.
 *
 * State Transitions:
 * idle → creating → ready → installing → starting → running → stopped
 *                                                  ↓
 *                                               failed
 */

import type { Container } from 'dockerode';
import { type Actor, assign, createMachine, fromPromise } from 'xstate';
import type { AppLog, AppStatus } from '@gen-fullstack/shared';

// ============================================================================
// Context Types
// ============================================================================

export interface DockerMachineContext {
  sessionId: string;
  workingDir: string;
  containerId: string | null;
  container: Container | null;
  clientPort: number | null;
  serverPort: number | null;
  logs: AppLog[];
  error: string | null;

  // Cleanup resources stored in machine context
  // NOTE: Function cleanups (streamCleanup, devServerStreamCleanup) cannot be stored here
  // as context snapshots are immutable and functions aren't serializable.
  // These are stored in DockerService's containerInfo instead.
  cleanupTimer?: NodeJS.Timeout;
  readyCheckInterval?: NodeJS.Timeout;
  readyCheckAbort?: AbortController;
  readyCheckPromise?: Promise<void>;
}

// ============================================================================
// Event Types
// ============================================================================

export type DockerMachineEvent =
  | { type: 'CREATE'; sessionId: string; workingDir: string }
  | { type: 'INSTALL_DEPS' }
  | { type: 'START_SERVER' }
  | { type: 'STOP_SERVER' }
  | { type: 'RESTART' }
  | { type: 'DESTROY' }
  | { type: 'VITE_READY' }
  | { type: 'HTTP_READY' }
  | { type: 'ERROR'; error: string };

// ============================================================================
// Input Types for Invoked Services
// ============================================================================

export interface CreateContainerInput {
  sessionId: string;
  workingDir: string;
}

export interface CreateContainerOutput {
  containerId: string;
  container: Container;
  clientPort: number;
  serverPort: number;
}

export interface InstallDependenciesInput {
  sessionId: string;
  container: Container;
}

export interface StartDevServerInput {
  sessionId: string;
  container: Container;
}

export interface HttpReadyCheckInput {
  sessionId: string;
  port: number;
  signal: AbortSignal;
}

// ============================================================================
// State Machine Definition
// ============================================================================

export const dockerContainerMachine = createMachine(
  {
    /** @xstate-layout N4IgpgJg5mDOIC5QAoC2BDAxgCwJYDswBKAOgHkAlAS2wG0AGAXUVAAdsZZD0BXd6gPawAnmlYAzACYAbFgAsmM9pKEC1GnQZMoAYQCuAF0EQATqpjbdBo-y6L9AgG4I0AN0wAHbAAc8JJFAA2rgC+4Q5oWHgExKTklNS0DExsnDwCwmISUjIAvqqauhB6BsZYZpbWtg5Obh7ePn4BIaERmFHROFCFxKQU1PQ8QiJicgpKKlX16QBMAIzV5RbWtvZOzi7u3r4wwSgRE6BxCUkkqaUsdAyi4tL0YhV19Zp6IAYmZpYIrdrgXXY5VTOVyzQbeMKrQp0HChGAAfQAggB9ACCAGEANIAUQAIgARACyAElgcAADIAGUxOUx+VYhWKmkqBxqx3qWDaHU63V6-SGY0m02mc3mS2SQQ8W1CHl2EQO4UKMDOsUu1IeVxcDycT0Qjhc9m5ry+nyyjX+gMl6Uh0BZbI5XJ5-MFwpFYoAgpz+YA5AGiwAAyX8vmCv6SpXoqBqjUgOAYWUK9gGI13Qwmf5vRDGjm3c3bPYWsLWgr7I6nWJW4quiVxGjYejwJ7ENBYEgoR7MfiwRMphOpuXKtDStWRrU67V62OGzBGt4m83mm1ROkFxRV6u12sc+trpt8sUdlYy9a7SZuhCuh5lzUVb01kz1zTvGq-P6DjN+Pn-JhQUIoUmBuLGn5rlgW47tWnIoIGCCljYmDWAu1gvjuJR3K6j4BuCRThCUjREe8jpGG00aYEYGSArUkLXHu-j3i8sRbDy-K1kK95Qu0AjQdST6XKo1LAvaAB0RhhF+lIgdBcGIaw+GaC4D54ahJSNM0ZiEdapSiea5h+hRvwkYurzuk8Xw4t+lqlHBkJsJslZ2IgJH4QR6a2Oh1J-pK8oCXp1gnvUJRXGYYTWeY9p1JUhF2QFjwUiJjyqXu6m6Z5pZ4jpdh0BsciuRJxZYdWmCaEYGYIJRiVIdaQ7TuUsJ1Nol4hMRE41NlXmWGC26rJV1XcHVTCSrV5Z1nWa74cZCntphuSxs6F4PJaMKtaasSNe8SrXupBqvkNE2gZBpYORN9nOS15VaUKUW7lN7orjENqlA8sS2sVprXP4l3Dc5l0AvNYEQStc1LQtyVrZVxmeaD4Mmca8QRHYDTXGUs4VGYn4tPdgKGG074dP1v3uZybnQzd3YIzyoRPYSlJSBYLlXPt9qnp+xR3aa5TEWFBTw10COvCj-Ro0j30IYQKA45jK3Y3V+3LeJp5iUwOaFKpVKlCUl0qRRfrXNcrWEwUv5lFt6rYqJ75FXjjOE+LktrCKbnSgzzqaLr9rXC0k6Gzd1wVM8Juc6zNtW3N2WqXd6mUxR1F0X2pT8r4RPXN+pRezeRjuSU3uc9tTuaS7Ym7lHGJOSbF3ixN1N9Y7F3Y9T8v048rTS1r6HnX7TOByzHMUlz66q-HKN3LdzxaXHGEOIRJM-E1nfqq4tUlQVmDnb6CAPdtce7Y9kK20-T6O5JN+yQnqcJ2nieDTP3cV7nM153n+fK4l3UImUz5KJacL4TF9TZldEqA8yqAzrouAC9lALH1gSAmBsaGxSPkSIOFPTRCfmYdQgNeraRKtKS+6gDQ+hhmTKm0JbrVVYbzImGd9L9GAQ-F+5MgGvx0SSOmmFnRKPbOoW4o4SLhDAR-C2LQGK2V1gQnBwD3o4wEVoIRTAy4cMrvIr0dRYEn1ckYMwsJ2jOhrnRBu5CLT3xvmo+x+1QL2hqF3Ko+jghPVfiUd8cIXpRBVoowmCAgA */
    id: 'dockerContainer',
    initial: 'idle',
    types: {} as {
      context: DockerMachineContext;
      events: DockerMachineEvent;
      input: { sessionId: string; workingDir: string };
    },
    context: ({ input }) => ({
      sessionId: input.sessionId,
      workingDir: input.workingDir,
      containerId: null,
      container: null,
      clientPort: null,
      serverPort: null,
      logs: [],
      error: null,
      cleanupTimer: undefined,
      readyCheckInterval: undefined,
      readyCheckAbort: undefined,
      readyCheckPromise: undefined,
    }),
    states: {
      idle: {
        on: {
          CREATE: {
            target: 'creating',
            actions: assign({
              sessionId: ({ event }) => event.sessionId,
              workingDir: ({ event }) => event.workingDir,
            }),
          },
        },
      },
      creating: {
        invoke: {
          id: 'createContainer',
          src: 'createContainer',
          input: ({ context }) => ({
            sessionId: context.sessionId,
            workingDir: context.workingDir,
          }),
          onDone: {
            target: 'ready',
            actions: assign({
              containerId: ({ event }) => event.output.containerId,
              container: ({ event }) => event.output.container,
              clientPort: ({ event }) => event.output.clientPort,
              serverPort: ({ event }) => event.output.serverPort,
            }),
          },
          onError: {
            target: 'failed',
            actions: assign({
              error: ({ event }) =>
                event.error instanceof Error ? event.error.message : String(event.error),
            }),
          },
        },
        exit: 'cleanupCreatingStreams',
      },
      ready: {
        on: {
          INSTALL_DEPS: 'installing',
          DESTROY: 'stopped',
        },
      },
      installing: {
        invoke: {
          id: 'installDependencies',
          src: 'installDependencies',
          input: ({ context }) => {
            if (!context.container) {
              throw new Error('Container is null in installing state');
            }
            return {
              sessionId: context.sessionId,
              container: context.container,
            };
          },
          onDone: {
            target: 'starting',
          },
          onError: {
            target: 'failed',
            actions: assign({
              error: ({ event }) =>
                event.error instanceof Error ? event.error.message : String(event.error),
            }),
          },
        },
        exit: 'cleanupInstallStreams',
      },
      starting: {
        invoke: {
          id: 'startDevServer',
          src: 'startDevServer',
          input: ({ context }) => {
            if (!context.container) {
              throw new Error('Container is null in starting state');
            }
            return {
              sessionId: context.sessionId,
              container: context.container,
            };
          },
          onDone: {
            target: 'waitingForVite',
          },
          onError: {
            target: 'failed',
            actions: assign({
              error: ({ event }) =>
                event.error instanceof Error ? event.error.message : String(event.error),
            }),
          },
        },
        exit: 'cleanupStartStreams',
      },
      waitingForVite: {
        on: {
          VITE_READY: 'checkingHttpReady',
          DESTROY: 'stopped',
        },
        after: {
          30000: {
            target: 'failed',
            actions: assign({
              error: 'Timeout waiting for Vite to be ready',
            }),
          },
        },
      },
      checkingHttpReady: {
        invoke: {
          id: 'httpReadyCheck',
          src: 'httpReadyCheck',
          input: ({ context }) => {
            const abortController = new AbortController();
            // Store abort controller for cleanup (will be cleaned up on exit)
            if (!context.clientPort) {
              throw new Error('Client port is null in checkingHttpReady state');
            }
            return {
              sessionId: context.sessionId,
              port: context.clientPort,
              signal: abortController.signal,
            };
          },
          onDone: {
            target: 'running',
          },
          onError: {
            target: 'failed',
            actions: assign({
              error: 'HTTP readiness check failed',
            }),
          },
        },
      },
      running: {
        on: {
          STOP_SERVER: 'ready',
          DESTROY: 'stopped',
        },
        exit: 'cleanupRunningStreams',
      },
      stopped: {
        type: 'final',
        entry: 'cleanupAllResources',
      },
      failed: {
        type: 'final',
        entry: 'cleanupAllResources',
      },
    },
    on: {
      DESTROY: '.stopped',
      ERROR: {
        target: '.failed',
        actions: assign({
          error: ({ event }) => event.error,
        }),
      },
    },
  },
  {
    actors: {
      // These will be implemented by DockerService
      createContainer: fromPromise<CreateContainerOutput, CreateContainerInput>(async () => {
        throw new Error('createContainer actor must be provided');
      }),
      installDependencies: fromPromise<void, InstallDependenciesInput>(async () => {
        throw new Error('installDependencies actor must be provided');
      }),
      startDevServer: fromPromise<void, StartDevServerInput>(async () => {
        throw new Error('startDevServer actor must be provided');
      }),
      httpReadyCheck: fromPromise<boolean, HttpReadyCheckInput>(async () => {
        throw new Error('httpReadyCheck actor must be provided');
      }),
    },
    actions: {
      // Cleanup actions will be implemented by DockerService
      cleanupCreatingStreams: () => {},
      cleanupInstallStreams: () => {},
      cleanupStartStreams: () => {},
      cleanupRunningStreams: () => {},
      cleanupAllResources: () => {},
    },
  },
);

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Map XState machine state to AppStatus
 *
 * The state machine has more granular states than the AppStatus type.
 * We now expose intermediate states to provide better UI feedback.
 *
 * Machine states → AppStatus mapping:
 * - idle → stopped (no container yet)
 * - creating → creating (container being created)
 * - ready → ready (container created, ready for commands)
 * - installing → installing (npm install + Prisma)
 * - starting, waitingForVite, checkingHttpReady → starting (dev servers starting)
 * - running → running (dev servers active)
 * - stopped → stopped (container destroyed)
 * - failed → failed (error occurred)
 */
export function stateToAppStatus(state: string): AppStatus {
  switch (state) {
    case 'running':
      return 'running';
    case 'stopped':
      return 'stopped';
    case 'failed':
      return 'failed';
    case 'creating':
      return 'creating';
    case 'installing':
      return 'installing';
    case 'starting':
    case 'waitingForVite':
    case 'checkingHttpReady':
      return 'starting';
    case 'idle':
    case 'ready':
      return 'ready';
    default:
      return 'stopped';
  }
}

/**
 * Create a configured state machine for a Docker container
 *
 * This factory function creates a machine instance with proper actor implementations
 * and action handlers. It should be called by DockerService for each container.
 *
 * @param implementations - Actor and action implementations from DockerService
 * @returns Configured machine ready to be instantiated as an actor
 */
export function createDockerMachine(implementations: {
  actors: {
    createContainer: (input: CreateContainerInput) => Promise<CreateContainerOutput>;
    installDependencies: (input: InstallDependenciesInput) => Promise<void>;
    startDevServer: (input: StartDevServerInput) => Promise<void>;
    httpReadyCheck: (input: HttpReadyCheckInput) => Promise<boolean>;
  };
  actions: {
    cleanupCreatingStreams: () => void;
    cleanupInstallStreams: () => void;
    cleanupStartStreams: () => void;
    cleanupRunningStreams: () => void;
    cleanupAllResources: () => void;
  };
}) {
  return dockerContainerMachine.provide({
    actors: {
      createContainer: fromPromise(({ input }: { input: CreateContainerInput }) =>
        implementations.actors.createContainer(input),
      ),
      installDependencies: fromPromise(({ input }: { input: InstallDependenciesInput }) =>
        implementations.actors.installDependencies(input),
      ),
      startDevServer: fromPromise(({ input }: { input: StartDevServerInput }) =>
        implementations.actors.startDevServer(input),
      ),
      httpReadyCheck: fromPromise(({ input }: { input: HttpReadyCheckInput }) =>
        implementations.actors.httpReadyCheck(input),
      ),
    },
    actions: implementations.actions,
  });
}

// ============================================================================
// Machine Actor Type
// ============================================================================

/**
 * Type for the Docker machine actor
 * This provides proper typing for actor.send() calls
 */
export type DockerMachineActor = Actor<ReturnType<typeof createDockerMachine>>;
