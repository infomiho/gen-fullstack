import type { ValidationError } from '@gen-fullstack/shared';
import { stepCountIs, streamText } from 'ai';
import type { Server as SocketIOServer } from 'socket.io';
import { getErrorMessage } from '../lib/error-utils.js';
import { toToolResult } from '../lib/tool-utils.js';
import type { ModelName } from '../services/llm.service.js';
import { calculateCost } from '../services/llm.service.js';
import { getToolsForCapability } from '../tools/index.js';
import type {
  CapabilityContext,
  CapabilityResult,
  ClientToServerEvents,
  ServerToClientEvents,
} from '../types/index.js';
import { BaseCapability } from './base.capability.js';

/**
 * Error Fixing Capability
 *
 * Fixes validation errors (Prisma schema + TypeScript) using the LLM.
 * This capability was created for Phase B of the XState migration to enable
 * explicit pipeline orchestration with iteration control.
 *
 * Features:
 * - Takes validation errors from ValidationCapability
 * - Uses LLM to fix errors via file operations (writeFile, readFile)
 * - Tracks iteration number for machine-controlled retry logic
 * - Returns success/failure for machine to decide on retry
 *
 * Design Notes:
 * - This is a focused error-fixing phase - no planning or validation
 * - Only has file operation tools (no planArchitecture, no validatePrisma/TypeScript)
 * - Machine controls iteration limit (not LLM)
 * - Returns success:true if fixes applied, then machine re-validates
 */
export class ErrorFixingCapability extends BaseCapability {
  private maxToolCalls: number;

  constructor(
    modelName: ModelName,
    io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>,
    maxToolCalls: number = 15, // Reduced from code generation - focused on fixes only
  ) {
    super(modelName, io);
    this.maxToolCalls = maxToolCalls;
  }

  getName(): string {
    return 'ErrorFixing';
  }

  validateContext(context: CapabilityContext): void {
    if (!context.sessionId) {
      throw new Error('ErrorFixingCapability requires context.sessionId');
    }
    if (!context.sandboxPath) {
      throw new Error('ErrorFixingCapability requires context.sandboxPath');
    }
    if (!context.validationErrors || context.validationErrors.length === 0) {
      throw new Error('ErrorFixingCapability requires context.validationErrors (non-empty array)');
    }
  }

  async execute(context: CapabilityContext): Promise<CapabilityResult> {
    this.validateContext(context);

    const { sessionId, sandboxPath, validationErrors, errorFixAttempts = 0, abortSignal } = context;
    const startTime = Date.now();

    try {
      const iteration = errorFixAttempts + 1;
      this.emitMessage(
        'assistant',
        `Fixing validation errors (iteration ${iteration})...`,
        sessionId,
      );

      // Build error-fixing prompt
      const systemPrompt = this.buildSystemPrompt();
      const userPrompt = this.buildUserPrompt(validationErrors!, iteration);

      // Get tools (only file operations, no planning/validation tools)
      const tools = getToolsForCapability({
        inputMode: 'naive', // Always use naive mode (no template tools needed for fixes)
        planning: false, // No planning during fixes
        compilerChecks: false, // No validation tools during fixes
        buildingBlocks: false, // No building blocks during fixes
        maxIterations: 3, // Not used for tool budget here
      });

      // Emit errors for context
      this.emitMessage('system', this.formatErrorSummary(validationErrors!), sessionId);

      let toolCallCount = 0;

      // Stream the LLM response
      const result = streamText({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        tools,
        stopWhen: stepCountIs(this.maxToolCalls),
        abortSignal,
        experimental_context: {
          sessionId,
          io: this.io,
          sandboxPath,
        },
        onStepFinish: async (event) => {
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
      const tokensUsed = {
        input: usage.inputTokens ?? 0,
        output: usage.outputTokens ?? 0,
      };
      const cost = calculateCost(this.modelName, usage.inputTokens ?? 0, usage.outputTokens ?? 0);

      this.emitMessage(
        'assistant',
        `✓ Applied fixes in iteration ${iteration} (${toolCallCount} tool calls)`,
        sessionId,
      );

      return {
        success: true,
        tokensUsed,
        cost,
        toolCalls: toolCallCount,
        contextUpdates: {
          errorFixAttempts: iteration, // Increment iteration count for machine
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
        'Error fixing capability failed',
      );

      this.emitMessage('system', `✗ Error fixing failed: ${errorMessage}`, sessionId);

      return {
        success: false,
        error: errorMessage,
        tokensUsed: { input: 0, output: 0 },
        cost: 0,
        toolCalls: 0,
      };
    }
  }

  // ============================================================================
  // Prompt Building
  // ============================================================================

  private buildSystemPrompt(): string {
    return `You are an expert full-stack developer specialized in fixing TypeScript and Prisma schema errors.

Your task is to fix validation errors in a full-stack application:
- **Database**: Prisma ORM + SQLite
- **Server**: Express 5 + TypeScript + RESTful API
- **Client**: Vite + React 19 + TypeScript + Tailwind CSS 4 + React Router 7

IMPORTANT INSTRUCTIONS:
1. **Read files** to understand the current code before making changes
2. **Fix errors systematically** - address root causes, not symptoms
3. **Write corrected files** with complete, valid content
4. **Verify fixes** - ensure your changes resolve the reported errors
5. **Maintain code quality** - preserve existing structure and patterns

AVAILABLE TOOLS:
- readFile: Read file contents to understand context
- writeFile: Write corrected file contents
- getFileTree: List project structure if needed
- executeCommand: Run allowed commands (npm install, etc.)

CRITICAL: Do NOT try to validate your changes. The system will run validation after you complete your fixes.
Focus ONLY on fixing the reported errors.`;
  }

  private buildUserPrompt(errors: ValidationError[], iteration: number): string {
    const errorsByType = this.groupErrorsByType(errors);

    let prompt = `Fix the following validation errors (iteration ${iteration} of allowed attempts):\n\n`;

    // Add Prisma errors
    if (errorsByType.prisma.length > 0) {
      prompt += `## Prisma Schema Errors (${errorsByType.prisma.length})\n\n`;
      for (const error of errorsByType.prisma) {
        prompt += `- **File**: ${error.file}\n`;
        if (error.line) {
          prompt += `  **Line**: ${error.line}\n`;
        }
        prompt += `  **Error**: ${error.message}\n\n`;
      }
    }

    // Add TypeScript errors
    if (errorsByType.typescript.length > 0) {
      prompt += `## TypeScript Errors (${errorsByType.typescript.length})\n\n`;
      for (const error of errorsByType.typescript) {
        prompt += `- **File**: ${error.file}\n`;
        if (error.line) {
          prompt += `  **Line**: ${error.line}`;
          if (error.column) {
            prompt += `, **Column**: ${error.column}`;
          }
          prompt += '\n';
        }
        if (error.code) {
          prompt += `  **Code**: ${error.code}\n`;
        }
        prompt += `  **Error**: ${error.message}\n\n`;
      }
    }

    prompt += `\n**Instructions**:
1. Read the affected files to understand the code
2. Fix all errors systematically
3. Write the corrected files back

Remember: Focus ONLY on fixing these specific errors. Do not add new features or refactor unrelated code.`;

    return prompt;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private groupErrorsByType(errors: ValidationError[]): {
    prisma: ValidationError[];
    typescript: ValidationError[];
  } {
    return {
      prisma: errors.filter((e) => e.type === 'prisma'),
      typescript: errors.filter((e) => e.type === 'typescript'),
    };
  }

  private formatErrorSummary(errors: ValidationError[]): string {
    const grouped = this.groupErrorsByType(errors);
    const parts: string[] = [];

    if (grouped.prisma.length > 0) {
      parts.push(`${grouped.prisma.length} Prisma error(s)`);
    }

    if (grouped.typescript.length > 0) {
      parts.push(`${grouped.typescript.length} TypeScript error(s)`);
    }

    return `Found ${errors.length} validation errors: ${parts.join(', ')}`;
  }
}
