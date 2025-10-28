/**
 * Generation Pipeline State Machine
 *
 * Manages the lifecycle of code generation with explicit state management.
 * Uses XState for automatic cleanup, metrics tracking, and timeout handling.
 *
 * State Transitions:
 * idle → initializing → [loadingTemplate]? → codeGenerating → completing → completed
 *              ↓                ↓                         ↓
 *         completingFailed  completingFailed      completingFailed
 *              ↓                ↓                         ↓
 *            failed           failed                   failed
 *
 * Cancellation (ABORT event):
 * any state → completingCancelled → cancelled
 *
 * This is Phase A of the XState migration - wrapping existing capabilities
 * with minimal changes. The LLM still self-orchestrates via tools within
 * UnifiedCodeGenerationCapability.
 */

import type { CapabilityConfig, GenerationMetrics, GenerationStatus } from '@gen-fullstack/shared';
import { type Actor, assign, createMachine, fromPromise } from 'xstate';

// ============================================================================
// Context Types
// ============================================================================

export interface GenerationMachineContext {
  sessionId: string;
  prompt: string;
  config: CapabilityConfig;
  modelName: string; // Model name from orchestrator
  sandboxPath: string | null;

  // Accumulated metrics
  tokens: {
    input: number;
    output: number;
    total: number;
  };
  cost: number;
  toolCalls: number;
  startTime: number;

  // Cleanup resources
  timeoutTimer?: NodeJS.Timeout;

  // Error tracking
  error: string | null;
}

// ============================================================================
// Event Types
// ============================================================================

export type GenerationMachineEvent =
  | {
      type: 'START';
      sessionId: string;
      prompt: string;
      config: CapabilityConfig;
      modelName: string;
    }
  | { type: 'ABORT' }
  | { type: 'ERROR'; error: string };

// ============================================================================
// Input Types for Invoked Actors
// ============================================================================

export interface InitializeInput {
  sessionId: string;
}

export interface InitializeOutput {
  sandboxPath: string;
}

export interface CopyTemplateInput {
  sessionId: string;
  sandboxPath: string;
  templateName: string;
}

export interface CodeGenerationInput {
  sessionId: string;
  prompt: string;
  config: CapabilityConfig;
  sandboxPath: string;
}

export interface CodeGenerationOutput {
  tokensUsed: { input: number; output: number };
  cost: number;
  toolCalls: number;
}

export interface FinishInput {
  sessionId: string;
  metrics: GenerationMetrics;
  status: GenerationStatus;
  error?: string;
}

// ============================================================================
// State Machine Definition
// ============================================================================

export const generationMachine = createMachine(
  {
    /** @xstate-layout N4IgpgJg5mDOIC5QAoC2BDAxgCwJYDswBKAOgHkAlASwG0AGAXUVAAdsZZD0BXd6gPawAnmlYAzACYAbFgAsmM9pKEC1GnQZMoAYQCuAF0EQATqpjbdBo-y6L9AgG4I0AN0wAHbAAc8JJFAA2rgC+4Q5oWHgExKTklNS0DExsnDwCwmISUjIAvqqauhB6BsZYZpbWtg5Obh7ePn4BIaERmFHROFCFxKQU1PQ8QiJicgpKKlX16QBMAIzV5RbWtvZOzi7u3r4wwSgRE6BxCUkkqaUsdAyi4tL0YhV19Zp6IAYmZpYIrdrgXXY5VTOVyzQbeMKrQp0HChGAAfQAggB9ACCAGEANIAUQAIgARACyAElgcAADIAGUxOUx+VYhWKmkqBxqx3qWDaHU63V6-SGY0m02mc3mS2SQQ8W1CHl2EQO4UKMDOsUu1IeVxcDycT0Qjhc9m5ry+nyyjX+gMl6Uh0BZbI5XJ5-MFwpFYoAgpz+YA5AGiwAAyX8vmCv6SpXoqBqjUgOAYWUK9gGI13Qwmf5vRDGjm3c3bPYWsLWgr7I6nWJW4quiVxGjYejwJ7ENBYEgoR7MfiwRMphOpuXKtDStWRrU67V62OGzBGt4m83mm1ROkFxRV6u12sc+trpt8sUdlYy9a7SZuhCuh5lzUVb01kz1zTvGq-P6DjN+Pn-JhQUIoUmBuLGn5rlgW47tWnIoIGCCljYmDWAu1gvjuJR3K6j4BuCRThCUjREe8jpGG00aYEYGSArUkLXHu-j3i8sRbDy-K1kK95Qu0AjQdST6XKo1LAvaAB0RhhF+lIgdBcGIaw+GaC4D54ahJSNM0ZiEdapSiea5h+hRvwkYurzuk8Xw4t+lqlHBkJsJslZ2IgJH4QR6a2Oh1J-pK8oCXp1gnvUJRXGYYTWeY9p1JUhF2QFjwUiJjyqXu6m6Z5pZ4jpdh0BsciuRJxZYdWmCaEYGYIJRiVIdaQ7TuUsJ1Nol4hMRE41NlXmWGC26rJV1XcHVTCSrV5Z1nWa74cZCntphuSxs6F4PJaMKtaasSNe8SrXupBqvkNE2gZBpYORN9nOS15VaUKUW7lN7orjENqlA8sS2sVprXP4l3Dc5l0AvNYEQStc1LQtyVrZVxmeaD4Mmca8QRHYDTXGUs4VGYn4tPdgKGG074dP1v3uZybnQzd3YIzyoRPYSlJSBYLlXPt9qnp+xR3aa5TEWFBTw10COvCj-Ro0j30IYQKA45jK3Y3V+3LeJp5iUwOaFKpVKlCUl0qRRfrXNcrWEwUv5lFt6rYqJ75FXjjOE+LktrCKbnSgzzqaLr9rXC0k6Gzd1wVM8Juc6zNtW3N2WqXd6mUxR1F0X2pT8r4RPXN+pRezeRjuSU3uc9tTuaS7Gu7lHGJOSbF3ixN1N9Y7F3Y9T8v048rTS1r6HnX7TOByzHMUlz66q-HKN3LdzxaXHGEOIRJM-E1nfqq4tUlQVmDnb6CAPdtce7Y9kK20-T6O5JN+yQnqcJ2nieDTP3cV7nM953n+fK4l3UImUz5KJacL4TF9TZldEqA8yqAzrouAC9lALH1gSAmBsaGxSPkSIOFPTRCfmYdQgNeraRKtKS+6gDQ+hhmTKm0JbrVVYbzImGd9L9GAQ-F+5MgGvx0SSOmmFnRKPbOoW4o4SLhDAR-C2LQGK2V1gQnBwD3o4wEVoIRTAy4cMrvIr0dRYEn1ckYMwsJ2jOhrnRBu5CLT3xvmo+x+1QL2hqF3Ko+jghPVfiUd8cIXpRBVoowmCAgA */
    id: 'generation',
    initial: 'idle',
    types: {} as {
      context: GenerationMachineContext;
      events: GenerationMachineEvent;
      input: { sessionId: string; prompt: string; config: CapabilityConfig; modelName: string };
    },
    context: ({ input }) => ({
      sessionId: input.sessionId,
      prompt: input.prompt,
      config: input.config,
      modelName: input.modelName,
      sandboxPath: null,
      tokens: {
        input: 0,
        output: 0,
        total: 0,
      },
      cost: 0,
      toolCalls: 0,
      startTime: Date.now(),
      timeoutTimer: undefined,
      error: null,
    }),
    states: {
      idle: {
        on: {
          START: {
            target: 'initializing',
            actions: assign({
              sessionId: ({ event }) => event.sessionId,
              prompt: ({ event }) => event.prompt,
              config: ({ event }) => event.config,
              // Note: modelName is already set from input, no need to reassign
              startTime: () => Date.now(),
            }),
          },
        },
      },
      initializing: {
        entry: 'setupTimeout',
        invoke: {
          id: 'initialize',
          src: 'initializeActor',
          input: ({ context }) => ({
            sessionId: context.sessionId,
          }),
          onDone: [
            {
              target: 'loadingTemplate',
              guard: 'shouldLoadTemplate',
              actions: assign({
                sandboxPath: ({ event }) => event.output.sandboxPath,
              }),
            },
            {
              target: 'codeGenerating',
              actions: assign({
                sandboxPath: ({ event }) => event.output.sandboxPath,
              }),
            },
          ],
          onError: {
            target: 'completingFailed',
            actions: assign({
              error: ({ event }) =>
                event.error instanceof Error ? event.error.message : String(event.error),
            }),
          },
        },
      },
      loadingTemplate: {
        invoke: {
          id: 'copyTemplate',
          src: 'copyTemplateActor',
          input: ({ context }) => {
            if (!context.sandboxPath) {
              throw new Error('Sandbox path is null in loadingTemplate state');
            }
            const templateName =
              context.config.inputMode === 'template'
                ? (context.config.templateOptions?.templateName ?? 'vite-fullstack-base')
                : 'vite-fullstack-base';
            return {
              sessionId: context.sessionId,
              sandboxPath: context.sandboxPath,
              templateName,
            };
          },
          onDone: {
            target: 'codeGenerating',
          },
          onError: {
            target: 'completingFailed',
            actions: assign({
              error: ({ event }) =>
                event.error instanceof Error ? event.error.message : String(event.error),
            }),
          },
        },
      },
      codeGenerating: {
        invoke: {
          id: 'codeGeneration',
          src: 'codeGenerationActor',
          input: ({ context }) => {
            if (!context.sandboxPath) {
              throw new Error('Sandbox path is null in codeGenerating state');
            }
            return {
              sessionId: context.sessionId,
              prompt: context.prompt,
              config: context.config,
              sandboxPath: context.sandboxPath,
            };
          },
          onDone: {
            target: 'completing',
            actions: assign({
              tokens: ({ context, event }) => ({
                input: context.tokens.input + event.output.tokensUsed.input,
                output: context.tokens.output + event.output.tokensUsed.output,
                total:
                  context.tokens.input +
                  event.output.tokensUsed.input +
                  context.tokens.output +
                  event.output.tokensUsed.output,
              }),
              cost: ({ context, event }) => context.cost + event.output.cost,
              toolCalls: ({ context, event }) => context.toolCalls + event.output.toolCalls,
            }),
          },
          onError: {
            target: 'completingFailed',
            actions: assign({
              error: ({ event }) =>
                event.error instanceof Error ? event.error.message : String(event.error),
            }),
          },
        },
      },
      completing: {
        invoke: {
          id: 'finish',
          src: 'finishActor',
          input: ({ context }) => {
            const duration = Date.now() - context.startTime;
            return {
              sessionId: context.sessionId,
              metrics: {
                sessionId: context.sessionId,
                model: context.modelName,
                status: 'completed' as GenerationStatus,
                totalTokens: context.tokens.total,
                inputTokens: context.tokens.input,
                outputTokens: context.tokens.output,
                cost: context.cost,
                duration,
                steps: context.toolCalls,
              },
              status: 'completed' as GenerationStatus,
            };
          },
          onDone: {
            target: 'completed',
          },
          onError: {
            target: 'failed',
            actions: assign({
              error: ({ event }) =>
                event.error instanceof Error ? event.error.message : String(event.error),
            }),
          },
        },
      },
      completed: {
        type: 'final',
        entry: 'clearTimeout',
      },
      completingFailed: {
        invoke: {
          id: 'finishFailed',
          src: 'finishActor',
          input: ({ context }) => {
            const duration = Date.now() - context.startTime;
            return {
              sessionId: context.sessionId,
              metrics: {
                sessionId: context.sessionId,
                model: context.modelName,
                status: 'failed' as GenerationStatus,
                totalTokens: context.tokens.total,
                inputTokens: context.tokens.input,
                outputTokens: context.tokens.output,
                cost: context.cost,
                duration,
                steps: context.toolCalls,
              },
              status: 'failed' as GenerationStatus,
              error: context.error ?? undefined,
            };
          },
          onDone: {
            target: 'failed',
          },
          onError: {
            target: 'failed',
          },
        },
        entry: 'clearTimeout',
      },
      failed: {
        type: 'final',
      },
      completingCancelled: {
        invoke: {
          id: 'finishCancelled',
          src: 'finishActor',
          input: ({ context }) => {
            const duration = Date.now() - context.startTime;
            return {
              sessionId: context.sessionId,
              metrics: {
                sessionId: context.sessionId,
                model: context.modelName,
                status: 'cancelled' as GenerationStatus,
                totalTokens: context.tokens.total,
                inputTokens: context.tokens.input,
                outputTokens: context.tokens.output,
                cost: context.cost,
                duration,
                steps: context.toolCalls,
              },
              status: 'cancelled' as GenerationStatus,
            };
          },
          onDone: {
            target: 'cancelled',
          },
          onError: {
            target: 'cancelled',
          },
        },
        entry: 'clearTimeout',
      },
      cancelled: {
        type: 'final',
      },
    },
    on: {
      ABORT: {
        target: '.completingCancelled',
      },
      ERROR: {
        target: '.completingFailed',
        actions: assign({
          error: ({ event }) => event.error,
        }),
      },
    },
  },
  {
    guards: {
      shouldLoadTemplate: ({ context }) => {
        return context.config.inputMode === 'template';
      },
    },
    actors: {
      // These will be implemented by UnifiedOrchestrator in Phase 2
      initializeActor: fromPromise<InitializeOutput, InitializeInput>(async () => {
        throw new Error('initializeActor must be provided');
      }),
      copyTemplateActor: fromPromise<void, CopyTemplateInput>(async () => {
        throw new Error('copyTemplateActor must be provided');
      }),
      codeGenerationActor: fromPromise<CodeGenerationOutput, CodeGenerationInput>(async () => {
        throw new Error('codeGenerationActor must be provided');
      }),
      finishActor: fromPromise<void, FinishInput>(async () => {
        throw new Error('finishActor must be provided');
      }),
    },
    actions: {
      // These will be implemented by UnifiedOrchestrator in Phase 2
      setupTimeout: () => {},
      clearTimeout: () => {},
    },
  },
);

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Map XState machine state to GenerationStatus
 *
 * Machine states → GenerationStatus mapping:
 * - completed → 'completed'
 * - completingFailed, failed → 'failed'
 * - completingCancelled, cancelled → 'cancelled'
 * - all others → undefined (generation still in progress)
 */
export function stateToGenerationStatus(state: string): GenerationStatus | undefined {
  switch (state) {
    case 'completed':
      return 'completed';
    case 'completingFailed':
    case 'failed':
      return 'failed';
    case 'completingCancelled':
    case 'cancelled':
      return 'cancelled';
    default:
      return undefined; // Still in progress
  }
}

/**
 * Create a configured state machine for generation
 *
 * This factory function creates a machine instance with proper actor implementations
 * and action handlers. It should be called by UnifiedOrchestrator.
 *
 * @param implementations - Actor and action implementations from UnifiedOrchestrator
 * @returns Configured machine ready to be instantiated as an actor
 */
export function createGenerationMachine(implementations: {
  actors: {
    initializeActor: (input: InitializeInput) => Promise<InitializeOutput>;
    copyTemplateActor: (input: CopyTemplateInput) => Promise<void>;
    codeGenerationActor: (input: CodeGenerationInput) => Promise<CodeGenerationOutput>;
    finishActor: (input: FinishInput) => Promise<void>;
  };
  actions: {
    setupTimeout: () => void;
    clearTimeout: () => void;
  };
}) {
  return generationMachine.provide({
    actors: {
      initializeActor: fromPromise(({ input }: { input: InitializeInput }) =>
        implementations.actors.initializeActor(input),
      ),
      copyTemplateActor: fromPromise(({ input }: { input: CopyTemplateInput }) =>
        implementations.actors.copyTemplateActor(input),
      ),
      codeGenerationActor: fromPromise(({ input }: { input: CodeGenerationInput }) =>
        implementations.actors.codeGenerationActor(input),
      ),
      finishActor: fromPromise(({ input }: { input: FinishInput }) =>
        implementations.actors.finishActor(input),
      ),
    },
    actions: implementations.actions,
  });
}

// ============================================================================
// Machine Actor Type
// ============================================================================

/**
 * Type for the generation machine actor
 * This provides proper typing for actor.send() calls
 */
export type GenerationMachineActor = Actor<ReturnType<typeof createGenerationMachine>>;
