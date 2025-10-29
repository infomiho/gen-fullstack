/**
 * Generation Pipeline State Machine (Phase B)
 *
 * Manages the lifecycle of code generation with explicit pipeline orchestration.
 * This is the Phase B implementation with planning, validation, and error-fixing stages.
 *
 * State Transitions:
 * idle → initializing → [loadingTemplate]? → [planning]? → codeGenerating → [validating]? → [fixingErrors]? → completing → completed
 *
 * Optional stages (controlled by config):
 * - loadingTemplate: if config.inputMode === 'template' (RUNS BEFORE PLANNING)
 * - planning: if config.planning === true (runs after template if both enabled)
 * - validating: if config.compilerChecks === true
 * - fixingErrors: if validation errors exist AND errorFixAttempts < maxIterations
 *
 * Error/Cancellation paths:
 * any state → completingFailed → failed (on ERROR event)
 * any state → completingCancelled → cancelled (on ABORT event)
 *
 * Key Changes from Phase A:
 * - Added planning state with PlanningCapability
 * - Added validating state with ValidationCapability
 * - Added fixingErrors state with ErrorFixingCapability
 * - Machine controls error-fixing iteration loop (not LLM)
 * - Plan and validation errors passed via context (type-safe)
 */

import type {
  ArchitecturePlan,
  CapabilityConfig,
  GenerationMetrics,
  GenerationStatus,
  ValidationError,
} from '@gen-fullstack/shared';
import { type Actor, assign, createMachine, fromPromise } from 'xstate';

// ============================================================================
// Context Types
// ============================================================================

export interface GenerationMachineContext {
  sessionId: string;
  prompt: string;
  config: CapabilityConfig;
  modelName: string;
  sandboxPath: string | null;

  // Pipeline data (passed between stages)
  plan?: ArchitecturePlan;
  validationErrors?: ValidationError[];
  errorFixAttempts: number;

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

export interface PlanningInput {
  sessionId: string;
  prompt: string;
  sandboxPath: string;
}

export interface PlanningOutput {
  plan: ArchitecturePlan;
  tokensUsed: { input: number; output: number };
  cost: number;
  toolCalls: number;
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
  plan?: ArchitecturePlan; // Optional plan from planning stage
}

export interface CodeGenerationOutput {
  tokensUsed: { input: number; output: number };
  cost: number;
  toolCalls: number;
}

export interface ValidationInput {
  sessionId: string;
  sandboxPath: string;
  /** Current error fix attempt count (0-based). Display as iteration = errorFixAttempts + 1 */
  errorFixAttempts: number;
}

export interface ValidationOutput {
  validationErrors: ValidationError[];
}

export interface ErrorFixingInput {
  sessionId: string;
  sandboxPath: string;
  validationErrors: ValidationError[];
  errorFixAttempts: number;
}

export interface ErrorFixingOutput {
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
    /** @xstate-layout N4IgpgJg5mDOIC5QAoC2BDAxgCwJYDswBKAOgHkAlASwG0AGAXUVAAdsZZD0BXd6gPawAnmlYAzACYAbFgAsmM9pKEC1GnQZMoAYQCuAF0EQATqpjbdBo-y6L9AgG4I0AN0wAHbAAc8JJFAA2rgC+4Q5oWHgExKTklNS0DExsnDwCwmISUjIAvqqauhB6BsZYZpbWtg5Obh7ePn4BIaERmFHROFCFxKQU1PQ8QiJicgpKKlX16QBMAIzV5RbWtvZOzi7u3r4wwSgRE6BxCUkkqaUsdAyi4tL0YhV19Zp6IAYmZpYIrdrgXXY5VTOVyzQbeMKrQp0HChGAAfQAggB9ACCAGEANIAUQAIgARACyAElgcAADIAGUxOUx+VYhWKmkqBxqx3qWDaHU63V6-SGY0m02mc3mS2SQQ8W1CHl2EQO4UKMDOsUu1IeVxcDycT0Qjhc9m5ry+nyyjX+gMl6Uh0BZbI5XJ5-MFwpFYoAgpz+YA5AGiwAAyX8vmCv6SpXoqBqjUgOAYWUK9gGI13Qwmf5vRDGjm3c3bPYWsLWgr7I6nWJW4quiVxGjYejwJ7ENBYEgoR7MfiwROphhptDStWRrU67V62OGzBGt4m83mm1ROkFxRV6u12sc+trpt8sUdlYy9a7SZuhCuh5lzUVb01kz1zTvGq-P6DjN+Pn-JhQUIoUmBuLGn5rlgW47tWnIoIGCCljYmDWAu1gvjuJR3K6j4BuCRThCUjREe8jpGG00aYEYGSArUkLXHu-j3i8sRbDy-K1kK95Qu0AjQdST6XKo1LAvaAB0RhhF+lIgdBcGIaw+GaC4D54ahJSNM0ZiEdapSiea5h+hRvwkYurzuk8Xw4t+lqlHBkJsJslZ2IgJH4QR6a2Oh1J-pK8oCXp1gnvUJRXGYYTWeY9p1JUhF2QFjwUiJjyqXu6m6Z5pZ4jpdh0BsciuRJxZYdWmCaEYGYIJRiVIdaQ7TuUsJ1Nol4hMRE41NlXmWGC26rJV1XcHVTCSrV5Z1nWa74cZCntphuSxs6F4PJaMKtaasSNe8SqvkNE2gZBpYORN9nOS15VaUKUW7lN7orjENqlA8sS2sVprXP4l3Dc5l0AvNYEQStc1LQtyVrZVxmeaD4Mmca8QRHYDTXGUs4VGYn4tPdgKGG074dP1v3uZybnQzd3YIzyoRPYSlJSBYLlXPt9qnp+xR3aa5TEWFBTw10COvCj-Ro0j30IYQKA45jK3Y3V+3LeJp5iUwOaFKpVKlCUl0qRRfrXNcrWEwUv5lFt6rYqJ75FXjjOE+LktrCKbnSgzzqaLr9rXC0k6Gzd1wVM8Juc6zNtW3N2WqXdGJOSbF3ixN1N9Y7F3Y9T8v048rTS1r6HnX7TOByzHMUlz66q-HKN3LdzxaXHGEOIRJM-E1nfqq4tUlQVmDnb6CAPdtce7Y9kK20_T6O5JN+yQnqcJ2nieDTP3cV7nM953n+fK4l3UImUz5KJacL4TF9TZldEqA8yqAzrouAC9lALH1gSAmBsaGxSPkSIOFPTRCfmYdQgNeraRKtKS+6gDQ+hhmTKm0JbrVVYbzImGd9L9GAQ-F+5MgGvx0SSOmmFnRKPbOoW4o4SLhDAR-C2LQGK2V1gQnBwD3o4wEVoIRTAy4cMrvIr0dRYEn1ckYMwsJ2jOhrnRBu5CLT3xvmo+x+1QL2hqF3Ko+jghPVfiUd8cIXpRBVoowmCAgA */
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
      plan: undefined,
      validationErrors: undefined,
      errorFixAttempts: 0,
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
              modelName: ({ event }) => event.modelName,
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
              target: 'planning',
              guard: 'shouldPlan',
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
      planning: {
        invoke: {
          id: 'planning',
          src: 'planningActor',
          input: ({ context }) => {
            if (!context.sandboxPath) {
              throw new Error('Sandbox path is null in planning state');
            }
            return {
              sessionId: context.sessionId,
              prompt: context.prompt,
              sandboxPath: context.sandboxPath,
            };
          },
          onDone: {
            target: 'codeGenerating',
            actions: [
              assign({
                plan: ({ event }) => event.output.plan,
              }),
              'accumulateMetrics',
            ],
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
          onDone: [
            {
              target: 'planning',
              guard: 'shouldPlan',
            },
            {
              target: 'codeGenerating',
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
              plan: context.plan, // Pass plan to code generation
            };
          },
          onDone: [
            {
              target: 'validating',
              guard: 'shouldValidate',
              actions: 'accumulateMetrics',
            },
            {
              target: 'completing',
              actions: 'accumulateMetrics',
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
      validating: {
        invoke: {
          id: 'validation',
          src: 'validationActor',
          input: ({ context }) => {
            if (!context.sandboxPath) {
              throw new Error('Sandbox path is null in validating state');
            }
            return {
              sessionId: context.sessionId,
              sandboxPath: context.sandboxPath,
              errorFixAttempts: context.errorFixAttempts,
            };
          },
          onDone: [
            {
              target: 'fixingErrors',
              guard: 'hasValidationErrors',
              actions: assign({
                validationErrors: ({ event }) => event.output.validationErrors,
              }),
            },
            {
              target: 'completing',
              actions: assign({
                validationErrors: ({ event }) => event.output.validationErrors,
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
      fixingErrors: {
        invoke: {
          id: 'errorFixing',
          src: 'errorFixingActor',
          input: ({ context }) => {
            if (!context.sandboxPath) {
              throw new Error('Sandbox path is null in fixingErrors state');
            }
            if (!context.validationErrors || context.validationErrors.length === 0) {
              throw new Error('No validation errors in fixingErrors state');
            }
            return {
              sessionId: context.sessionId,
              sandboxPath: context.sandboxPath,
              validationErrors: context.validationErrors,
              errorFixAttempts: context.errorFixAttempts,
            };
          },
          onDone: [
            {
              target: 'validating',
              guard: 'canRetryValidation',
              actions: [
                'accumulateMetrics',
                assign({
                  errorFixAttempts: ({ context }) => context.errorFixAttempts + 1,
                }),
              ],
            },
            {
              target: 'completing',
              actions: [
                'accumulateMetrics',
                assign({
                  errorFixAttempts: ({ context }) => context.errorFixAttempts + 1,
                }),
              ],
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
      shouldPlan: ({ context }) => {
        return context.config.planning === true;
      },
      shouldLoadTemplate: ({ context }) => {
        return context.config.inputMode === 'template';
      },
      shouldValidate: ({ context }) => {
        return context.config.compilerChecks === true;
      },
      hasValidationErrors: ({ event }) => {
        // Guard: only process events that have output property
        if (!('output' in event) || typeof event.output !== 'object' || event.output === null) {
          return false;
        }
        const output = event.output as ValidationOutput;
        return output.validationErrors && output.validationErrors.length > 0;
      },
      canRetryValidation: ({ context }) => {
        return context.errorFixAttempts < context.config.maxIterations;
      },
    },
    actors: {
      /**
       * These actors are placeholders that MUST be replaced via machine.provide() in createGenerationMachine().
       *
       * Real implementations are provided by UnifiedOrchestrator (see unified-orchestrator.ts:124-197).
       * This pattern allows the machine definition to be pure and testable, while the orchestrator
       * provides the concrete implementations with access to services, loggers, and state.
       *
       * If you see these errors at runtime, it means the machine wasn't properly initialized.
       */
      initializeActor: fromPromise<InitializeOutput, InitializeInput>(async () => {
        throw new Error('initializeActor must be provided');
      }),
      planningActor: fromPromise<PlanningOutput, PlanningInput>(async () => {
        throw new Error('planningActor must be provided');
      }),
      copyTemplateActor: fromPromise<void, CopyTemplateInput>(async () => {
        throw new Error('copyTemplateActor must be provided');
      }),
      codeGenerationActor: fromPromise<CodeGenerationOutput, CodeGenerationInput>(async () => {
        throw new Error('codeGenerationActor must be provided');
      }),
      validationActor: fromPromise<ValidationOutput, ValidationInput>(async () => {
        throw new Error('validationActor must be provided');
      }),
      errorFixingActor: fromPromise<ErrorFixingOutput, ErrorFixingInput>(async () => {
        throw new Error('errorFixingActor must be provided');
      }),
      finishActor: fromPromise<void, FinishInput>(async () => {
        throw new Error('finishActor must be provided');
      }),
    },
    actions: {
      // These will be implemented by UnifiedOrchestrator
      setupTimeout: () => {},
      clearTimeout: () => {},
      accumulateMetrics: assign({
        tokens: ({ context, event }) => {
          // Guard: only process events that have output property
          if (!('output' in event) || typeof event.output !== 'object' || event.output === null) {
            return context.tokens;
          }
          const output = event.output as PlanningOutput | CodeGenerationOutput | ErrorFixingOutput;
          return {
            input: context.tokens.input + output.tokensUsed.input,
            output: context.tokens.output + output.tokensUsed.output,
            total:
              context.tokens.input +
              output.tokensUsed.input +
              context.tokens.output +
              output.tokensUsed.output,
          };
        },
        cost: ({ context, event }) => {
          // Guard: only process events that have output property
          if (!('output' in event) || typeof event.output !== 'object' || event.output === null) {
            return context.cost;
          }
          const output = event.output as PlanningOutput | CodeGenerationOutput | ErrorFixingOutput;
          return context.cost + output.cost;
        },
        toolCalls: ({ context, event }) => {
          // Guard: only process events that have output property
          if (!('output' in event) || typeof event.output !== 'object' || event.output === null) {
            return context.toolCalls;
          }
          const output = event.output as PlanningOutput | CodeGenerationOutput | ErrorFixingOutput;
          return context.toolCalls + output.toolCalls;
        },
      }),
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
    planningActor: (input: PlanningInput) => Promise<PlanningOutput>;
    copyTemplateActor: (input: CopyTemplateInput) => Promise<void>;
    codeGenerationActor: (input: CodeGenerationInput) => Promise<CodeGenerationOutput>;
    validationActor: (input: ValidationInput) => Promise<ValidationOutput>;
    errorFixingActor: (input: ErrorFixingInput) => Promise<ErrorFixingOutput>;
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
      planningActor: fromPromise(({ input }: { input: PlanningInput }) =>
        implementations.actors.planningActor(input),
      ),
      copyTemplateActor: fromPromise(({ input }: { input: CopyTemplateInput }) =>
        implementations.actors.copyTemplateActor(input),
      ),
      codeGenerationActor: fromPromise(({ input }: { input: CodeGenerationInput }) =>
        implementations.actors.codeGenerationActor(input),
      ),
      validationActor: fromPromise(({ input }: { input: ValidationInput }) =>
        implementations.actors.validationActor(input),
      ),
      errorFixingActor: fromPromise(({ input }: { input: ErrorFixingInput }) =>
        implementations.actors.errorFixingActor(input),
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
