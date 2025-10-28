import type { ArchitecturePlan } from '@gen-fullstack/shared';
import { stepCountIs, streamText, tool } from 'ai';
import type { Server as SocketIOServer } from 'socket.io';
import { z } from 'zod';
import { getErrorMessage } from '../lib/error-utils.js';
import { toToolResult } from '../lib/tool-utils.js';
import type { ModelName } from '../services/llm.service.js';
import { calculateCost } from '../services/llm.service.js';
import type {
  CapabilityContext,
  CapabilityResult,
  ClientToServerEvents,
  ServerToClientEvents,
} from '../types/index.js';
import { BaseCapability } from './base.capability.js';

/**
 * Planning Capability
 *
 * Generates an architectural plan for the application before implementation.
 * This capability was extracted from the planArchitecture tool to enable
 * explicit pipeline orchestration in Phase B of the XState migration.
 *
 * The LLM generates a structured plan with:
 * - Database models (Prisma schema definitions)
 * - API routes (RESTful endpoints)
 * - Client components (React components)
 *
 * The plan is stored in machine context and passed to code generation stage.
 *
 * Design Notes:
 * - This is a pure planning phase - no file writes
 * - Returns structured JSON (not a string) for type safety
 * - Plan is validated by the tool schema before returning
 * - Uses single tool call with structured output
 */
export class PlanningCapability extends BaseCapability {
  constructor(
    modelName: ModelName,
    io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>,
  ) {
    super(modelName, io);
  }

  getName(): string {
    return 'Planning';
  }

  validateContext(context: CapabilityContext): void {
    if (!context.sessionId) {
      throw new Error('PlanningCapability requires context.sessionId');
    }
    if (!context.prompt) {
      throw new Error('PlanningCapability requires context.prompt (user requirements)');
    }
  }

  async execute(context: CapabilityContext): Promise<CapabilityResult> {
    this.validateContext(context);

    const { sessionId, prompt, abortSignal } = context;
    const startTime = Date.now();

    try {
      this.emitMessage('assistant', 'Creating architectural plan...', sessionId);

      // Define the planning tool that the LLM will use to structure the plan
      const planArchitectureTool = tool({
        description:
          'Create an architectural plan for the application (database models, API routes, components). Use this to design the application structure before implementation.',
        inputSchema: z.object({
          databaseModels: z
            .array(
              z.object({
                name: z.string().describe('Model name (e.g., "User", "Post")'),
                fields: z
                  .array(z.string())
                  .describe('Field definitions (e.g., "id String @id", "email String @unique")'),
                relations: z
                  .array(z.string())
                  .optional()
                  .describe('Relationships to other models (e.g., "posts Post[]")'),
              }),
            )
            .describe('Prisma database models'),
          apiRoutes: z
            .array(
              z.object({
                method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).describe('HTTP method'),
                path: z.string().describe('API endpoint path (e.g., "/api/users")'),
                description: z.string().describe('What this endpoint does'),
              }),
            )
            .describe('RESTful API endpoints'),
          clientComponents: z
            .array(
              z.object({
                name: z.string().describe('Component name (e.g., "LoginForm", "UserList")'),
                purpose: z.string().describe('What this component does'),
                key_features: z
                  .array(z.string())
                  .optional()
                  .describe('Key features or functionality'),
              }),
            )
            .describe('React components to create'),
        }),
        execute: async ({ databaseModels, apiRoutes, clientComponents }) => {
          // Tool validates that the LLM provided structured plan data
          return {
            databaseModels,
            apiRoutes,
            clientComponents,
          };
        },
      });

      // Build system prompt for planning
      const systemPrompt = `You are an expert full-stack application architect.

Your task is to create a detailed architectural plan for a full-stack application based on user requirements.

The application stack is:
- **Database**: Prisma ORM + SQLite
- **Server**: Express 5 + TypeScript + RESTful API
- **Client**: Vite + React 19 + TypeScript + Tailwind CSS 4 + React Router 7

IMPORTANT INSTRUCTIONS:
1. **Call the planArchitecture tool EXACTLY ONCE** with a complete plan
2. Design database models with proper Prisma field syntax
3. Design RESTful API endpoints that follow REST conventions
4. Design React components with clear responsibilities
5. Ensure the plan is coherent and all pieces work together
6. After calling the tool, respond with a brief summary of the plan

Do NOT write any code - just create the architectural plan.`;

      const userPrompt = `Create an architectural plan for this application:

${prompt}

Call the planArchitecture tool with a complete plan covering:
1. Database models (Prisma schema)
2. API routes (RESTful endpoints)
3. Client components (React)`;

      let plan: ArchitecturePlan | null = null;
      let toolCallCount = 0;

      // Stream the LLM response
      const result = streamText({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        tools: {
          planArchitecture: planArchitectureTool,
        },
        toolChoice: {
          type: 'tool',
          toolName: 'planArchitecture',
        },
        stopWhen: stepCountIs(1),
        abortSignal,
        onStepFinish: async (event) => {
          // Capture tool calls
          if (event.toolCalls && event.toolCalls.length > 0) {
            for (const toolCall of event.toolCalls) {
              toolCallCount++;

              this.emitToolCall(
                toolCall.toolCallId,
                toolCall.toolName,
                toolCall.input as Record<string, unknown>,
                sessionId,
              );

              const toolResult = event.toolResults?.find(
                (r) => r.toolCallId === toolCall.toolCallId,
              );

              if (toolResult) {
                const output = toolResult.output;
                const outputString = toToolResult(output);

                this.emitToolResult(
                  toolResult.toolCallId,
                  toolCall.toolName,
                  outputString,
                  sessionId,
                );

                if (toolCall.toolName === 'planArchitecture' && output) {
                  plan = output as ArchitecturePlan;
                }
              }
            }
          }

          if (event.text && event.text.trim()) {
            this.emitMessage('assistant', event.text, sessionId);
          }
        },
      });

      // Consume the stream to allow completion
      for await (const _chunk of result.textStream) {
        // Stream consumed in onStepFinish callback
      }

      const usage = await result.usage;

      if (!plan) {
        throw new Error('LLM did not create a plan (planArchitecture tool was not called)');
      }

      // TypeScript type narrowing - plan is guaranteed to be ArchitecturePlan here
      const validatedPlan: ArchitecturePlan = plan;

      const hasModels = validatedPlan.databaseModels && validatedPlan.databaseModels.length > 0;
      const hasRoutes = validatedPlan.apiRoutes && validatedPlan.apiRoutes.length > 0;
      const hasComponents =
        validatedPlan.clientComponents && validatedPlan.clientComponents.length > 0;

      if (!hasModels && !hasRoutes && !hasComponents) {
        throw new Error('Plan is empty (no models, routes, or components defined)');
      }
      const tokensUsed = {
        input: usage.inputTokens ?? 0,
        output: usage.outputTokens ?? 0,
      };
      const cost = calculateCost(this.modelName, usage.inputTokens ?? 0, usage.outputTokens ?? 0);

      this.emitMessage(
        'assistant',
        `✓ Plan created with ${validatedPlan.databaseModels?.length ?? 0} models, ${validatedPlan.apiRoutes?.length ?? 0} routes, ${validatedPlan.clientComponents?.length ?? 0} components`,
        sessionId,
      );

      return {
        success: true,
        tokensUsed,
        cost,
        toolCalls: toolCallCount,
        contextUpdates: {
          plan: validatedPlan, // Store plan in context for code generation stage
        },
      };
    } catch (error) {
      const errorMessage = getErrorMessage(error);

      this.logger.error(
        {
          sessionId,
          error: errorMessage,
          duration: Date.now() - startTime,
        },
        'Planning capability failed',
      );

      this.emitMessage('system', `✗ Planning failed: ${errorMessage}`, sessionId);

      return {
        success: false,
        error: errorMessage,
        tokensUsed: { input: 0, output: 0 },
        cost: 0,
        toolCalls: 0,
      };
    }
  }
}
