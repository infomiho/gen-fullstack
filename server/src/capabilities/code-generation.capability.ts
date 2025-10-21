import { stepCountIs, streamText } from 'ai';
import type {
  CapabilityContext,
  CapabilityResult,
  ClientToServerEvents,
  ServerToClientEvents,
} from '../types/index.js';
import type { Server as SocketIOServer } from 'socket.io';
import { BaseCapability } from './base.capability.js';
import type { ModelName } from '../services/llm.service.js';
import {
  ARCHITECTURE_DESCRIPTION,
  DOMAIN_SPECIFIC_WARNING,
  FILE_STRUCTURE,
  getNaiveImplementationSteps,
  getPlanFirstImplementationGuidelines,
  getTemplateImplementationGuidelines,
  SYSTEM_PROMPT_INTRO,
  TOOL_CAPABILITIES,
} from '../config/prompt-snippets.js';
import { tools } from '../tools/index.js';
import { calculateCost } from '../services/llm.service.js';

/**
 * Code Generation Mode
 * Determines the system prompt and user prompt strategy
 */
export type CodeGenerationMode = 'naive' | 'template' | 'plan-based' | 'template-plan-based';

/**
 * Code Generation Capability
 *
 * Generates application code using LLM with tool calling.
 * This is the core capability that creates files, reads files, and executes commands.
 *
 * Features:
 * - Streaming text generation with tool calling
 * - Multiple generation modes (naive, template-based, plan-based)
 * - Configurable tool call budget
 * - Token usage and cost tracking
 * - Real-time progress updates via WebSocket
 */
export class CodeGenerationCapability extends BaseCapability {
  private mode: CodeGenerationMode;
  private maxToolCalls: number;

  constructor(
    modelName: ModelName,
    io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>,
    mode: CodeGenerationMode = 'naive',
    maxToolCalls: number = 20,
  ) {
    super(modelName, io);
    this.mode = mode;
    this.maxToolCalls = maxToolCalls;
  }

  getName(): string {
    return 'CodeGeneration';
  }

  /**
   * Build system prompt based on generation mode
   */
  private getSystemPrompt(_context: CapabilityContext): string {
    const basePrompt = SYSTEM_PROMPT_INTRO;

    switch (this.mode) {
      case 'naive':
        return `${basePrompt}

${DOMAIN_SPECIFIC_WARNING}

${TOOL_CAPABILITIES}

${ARCHITECTURE_DESCRIPTION}

${FILE_STRUCTURE}

${getNaiveImplementationSteps()}`;

      case 'template':
        return `${basePrompt}

A complete full-stack template has been pre-loaded into your workspace.

YOUR TASK: Carefully analyze the user's requirements, then customize this template to implement EXACTLY what they requested.

${DOMAIN_SPECIFIC_WARNING}

TEMPLATE STRUCTURE - ALREADY SET UP (DO NOT READ OR MODIFY):
✓ Root package.json with npm workspaces and scripts
✓ client/package.json, vite.config.ts, tsconfig.json (Vite + React 19 configured)
✓ server/package.json, tsconfig.json (Express 5 + Prisma configured)
✓ client/index.html, client/src/main.tsx (HTML template and React entry point)
✓ client/src/App.tsx - Has User CRUD as placeholder (REPLACE with user's actual requirements)
✓ server/src/index.ts - Has /api/users endpoints as placeholder (REPLACE with user's actual entities)
✓ prisma/schema.prisma - Has User model as placeholder (ADD user's actual models)

FILES TO MODIFY:
1. prisma/schema.prisma - ADD models for user's domain (keep or remove User model as needed)
2. server/src/index.ts - ADD/REPLACE API endpoints for user's entities
3. client/src/App.tsx - REPLACE with UI for user's requirements
4. client/src/App.css - Style the UI appropriately
5. client/src/components/* - Create components as needed

WORKFLOW:
1. **READ THE USER'S PROMPT CAREFULLY** - Identify their domain, entities, and operations
2. Start implementing (DO NOT use listFiles or readFile on config files):
   a. Add appropriate data models to prisma/schema.prisma
   b. Add/replace API routes in server/src/index.ts
   c. Create React components in client/src/components/
   d. Update client/src/App.tsx to match the user's requirements

EXAMPLE - If user asks for "plant watering app":
- DON'T create Post/User models - CREATE Plant model (name, species, lastWatered, etc.)
- DON'T add /api/posts - CREATE /api/plants endpoints
- DON'T show generic UI - CREATE plant tracking interface
This applies to ANY domain - build what the user asks for, not generic examples.

${ARCHITECTURE_DESCRIPTION}

${FILE_STRUCTURE}

${getTemplateImplementationGuidelines()}

IMPORTANT: All configuration is done. DO NOT read package.json, tsconfig.json, vite.config.ts, or other config files. Start implementing features immediately.`;

      case 'plan-based':
        return `${basePrompt}

You will be implementing an architectural plan that has already been created.

${DOMAIN_SPECIFIC_WARNING}

${TOOL_CAPABILITIES}

${ARCHITECTURE_DESCRIPTION}

${FILE_STRUCTURE}

${getPlanFirstImplementationGuidelines()}`;

      case 'template-plan-based':
        return `${basePrompt}

A complete full-stack template has been pre-loaded into your workspace.
You will be implementing an architectural plan that has already been created.

YOUR TASK: Follow the architectural plan to customize this template and implement EXACTLY what was planned.

${DOMAIN_SPECIFIC_WARNING}

TEMPLATE STRUCTURE - ALREADY SET UP (DO NOT READ OR MODIFY):
✓ Root package.json with npm workspaces and scripts
✓ client/package.json, vite.config.ts, tsconfig.json (Vite + React 19 configured)
✓ server/package.json, tsconfig.json (Express 5 + Prisma configured)
✓ client/index.html, client/src/main.tsx (HTML template and React entry point)
✓ client/src/App.tsx - Has User CRUD as placeholder (REPLACE with user's actual requirements)
✓ server/src/index.ts - Has /api/users endpoints as placeholder (REPLACE with user's actual entities)
✓ prisma/schema.prisma - Has User model as placeholder (ADD user's actual models)

FILES TO MODIFY:
1. prisma/schema.prisma - ADD models according to the plan
2. server/src/index.ts - ADD/REPLACE API endpoints as specified in the plan
3. client/src/App.tsx - REPLACE with UI according to the plan
4. client/src/App.css - Style the UI appropriately
5. client/src/components/* - Create components as needed per the plan

WORKFLOW:
1. **REVIEW THE ARCHITECTURAL PLAN** - Understand the planned entities, operations, and UI
2. Start implementing (DO NOT use listFiles or readFile on config files):
   a. Add data models to prisma/schema.prisma as planned
   b. Add/replace API routes in server/src/index.ts as planned
   c. Create React components in client/src/components/ as planned
   d. Update client/src/App.tsx according to the UI plan

${ARCHITECTURE_DESCRIPTION}

${FILE_STRUCTURE}

${getTemplateImplementationGuidelines()}

IMPORTANT: All configuration is done. DO NOT read package.json, tsconfig.json, vite.config.ts, or other config files. Start implementing features immediately according to the plan.`;
    }
  }

  /**
   * Build user prompt based on mode and context
   */
  private getUserPrompt(context: CapabilityContext): string {
    const { prompt, plan } = context;

    // For plan-based modes, include the plan in the prompt
    if ((this.mode === 'plan-based' || this.mode === 'template-plan-based') && plan) {
      return `User Requirements:
${prompt}

Architectural Plan:
${plan}

Implement the application following this plan exactly. Create all files as specified and ensure everything works together.`;
    }

    // For other modes, use the original prompt
    return prompt;
  }

  async execute(context: CapabilityContext): Promise<CapabilityResult> {
    const { sessionId, abortSignal } = context;
    const startTime = Date.now();

    try {
      // Emit status based on mode
      if (this.mode === 'plan-based') {
        this.emitStatus('Phase 2: Implementing application based on plan...', context);
      } else if (this.mode === 'template') {
        // No status - template capability already showed message
      } else {
        this.emitStatus(
          `Starting generation with ${this.mode} mode (max ${this.maxToolCalls} tool calls)...`,
          context,
        );
      }

      // Stream text generation with tools
      const result = streamText({
        model: this.model,
        system: this.getSystemPrompt(context),
        prompt: this.getUserPrompt(context),
        tools,
        experimental_context: { sessionId, io: this.io },
        stopWhen: stepCountIs(this.maxToolCalls),
        onStepFinish: this.createOnStepFinishHandler(sessionId),
        abortSignal,
      });

      // Process the full stream for text deltas
      for await (const part of result.fullStream) {
        switch (part.type) {
          case 'text-delta':
            // Stream text deltas to client
            if (part.text) {
              this.emitMessage('assistant', part.text, sessionId);
            }
            break;

          case 'finish':
            break;
        }
      }

      // Wait for usage stats (must await after stream is consumed)
      const [usage, steps] = await Promise.all([result.usage, result.steps]);

      // Calculate metrics
      const duration = Date.now() - startTime;
      const inputTokens = usage.inputTokens || 0;
      const outputTokens = usage.outputTokens || 0;
      const totalTokens = inputTokens + outputTokens;
      const cost = calculateCost(this.modelName, inputTokens, outputTokens);
      const toolCallCount = steps?.length || 0;

      this.logger.info(
        {
          sessionId,
          mode: this.mode,
          inputTokens,
          outputTokens,
          totalTokens,
          cost,
          toolCallCount,
          duration,
        },
        'Code generation completed',
      );

      return {
        success: true,
        tokensUsed: {
          input: inputTokens,
          output: outputTokens,
        },
        cost,
        toolCalls: toolCallCount,
      };
    } catch (error) {
      const errorMessage = `Code generation capability failed: ${error instanceof Error ? error.message : String(error)}`;
      this.logger.error({ error, sessionId, mode: this.mode }, errorMessage);

      return {
        success: false,
        error: errorMessage,
        toolCalls: 0,
      };
    }
  }

  /**
   * Create an onStepFinish handler for streamText calls
   */
  private createOnStepFinishHandler(sessionId: string) {
    // biome-ignore lint/suspicious/noExplicitAny: AI SDK onStepFinish callback types are not strictly typed
    return ({ toolCalls, toolResults }: { toolCalls: any[]; toolResults: any[] }) => {
      // Emit tool calls with all data
      for (const toolCall of toolCalls) {
        const toolInput =
          typeof toolCall.input === 'object' && toolCall.input !== null
            ? (toolCall.input as Record<string, unknown>)
            : {};

        this.emitToolCall(toolCall.toolCallId, toolCall.toolName, toolInput, sessionId);
      }

      for (const toolResult of toolResults) {
        const result =
          typeof toolResult.output === 'string'
            ? toolResult.output
            : JSON.stringify(toolResult.output);

        this.emitToolResult(toolResult.toolCallId, toolResult.toolName, result, sessionId);
      }
    };
  }
}
