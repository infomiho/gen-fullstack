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

    // After validation, we know validationErrors exists and is non-empty
    const errors = validationErrors as ValidationError[];
    const startTime = Date.now();

    try {
      const iteration = errorFixAttempts + 1;

      // Build error-fixing prompt
      const systemPrompt = this.buildSystemPrompt();
      const userPrompt = this.buildUserPrompt(errors, iteration);

      // Get tools (only file operations, no planning/validation tools)
      const tools = getToolsForCapability({
        inputMode: 'naive', // Always use naive mode (no template tools needed for fixes)
        planning: false, // No planning during fixes
        compilerChecks: false, // No validation tools during fixes
        buildingBlocks: false, // No building blocks during fixes
        maxIterations: 3, // Not used for tool budget here
      });

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

          if (event.text?.trim()) {
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
- **Server**: Express 5 + TypeScript + RESTful API (uses "type": "module")
- **Client**: Vite + React 19 + TypeScript + Tailwind CSS 4 + React Router 7

${this.getTypeScriptErrorFixingGuidance()}

${this.getPrismaErrorFixingGuidance()}

AVAILABLE TOOLS:
- readFile: Read file contents to understand context
- writeFile: Write corrected file contents
- getFileTree: List project structure if needed
- executeCommand: Run allowed commands (npm install, etc.)

WORKFLOW:
1. Read the affected files to understand the current code
2. Fix errors one at a time or by related groups
3. Write corrected files back with complete, valid content
4. The system will re-validate automatically after you finish

CRITICAL: Do NOT try to validate your changes. The system will run validation after you complete your fixes.
Focus ONLY on fixing the reported errors. Do NOT add new features or refactor unrelated code.`;
  }

  private getTypeScriptErrorFixingGuidance(): string {
    return `## FIXING TYPESCRIPT ERRORS

CRITICAL - ES MODULE IMPORTS:
This project uses "type": "module" in package.json. Many npm packages (jsonwebtoken, bcryptjs, etc.)
are CommonJS modules that require DEFAULT imports, NOT namespace imports:

✅ CORRECT:
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
const token = jwt.sign(payload, secret);

❌ WRONG (passes TypeScript but fails at runtime):
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';
const token = jwt.sign(payload, secret);  // Runtime error: jwt.sign is not a function

Why this fails: With ES modules, namespace imports (import * as) create a module object where
CommonJS exports are nested under a .default property. TypeScript may not catch this, but it
WILL fail at runtime in the Docker container.

FIX STRATEGY BY ERROR CODE:

TS2769 "No overload matches this call":
→ Fix argument TYPES first, not imports
→ Example: jwt.sign(payload, secret as string, { expiresIn: '15m' })
→ Use type assertions to match expected types
→ ONLY change imports if you're using namespace imports incorrectly

TS2304 "Cannot find name":
→ Missing import or typo in variable/function name
→ Check spelling and add proper import statements

TS2345 "Argument type mismatch":
→ Type assertion: req.body as CreateUserInput
→ Cast to expected type: userId as string

TS2339 "Property does not exist on type":
→ Check if property exists in type definition
→ If using @prisma/client types, run "npx prisma generate" to regenerate types
→ May need to add property to interface or type definition

VALIDATION WORKFLOW:
- Fix ONE error or one group of related errors at a time
- Write the corrected file
- System will re-validate automatically (do NOT call validation tools yourself)
- If you see the same errors again, your fix didn't work - try a different approach`;
  }

  private getPrismaErrorFixingGuidance(): string {
    return `## FIXING PRISMA SCHEMA ERRORS

COMMON ERROR PATTERNS:

"Reference causes a cycle" / "Cycle path: Model A → Model B → Model C":
→ Break the cycle by adding onUpdate: NoAction to ONE relation in the cycle
→ Example: @relation(fields: [userId], references: [id], onUpdate: NoAction)
→ You only need to fix ONE relation, not all of them

"Multiple cascade paths between Model A and Model B":
→ When deleting/updating a record cascades through multiple paths
→ Add onUpdate: NoAction to ONE of the relations in the path
→ Example: author User @relation(fields: [authorId], references: [id], onUpdate: NoAction)

"Self-relation must have onDelete and onUpdate set to NoAction":
→ Self-referencing relations (e.g., Employee → manager: Employee) require BOTH actions
→ Example: manager Employee? @relation(name: "management", fields: [managerId], references: [id],
                                       onDelete: NoAction, onUpdate: NoAction)

"Missing opposite relation field on model X":
→ Every relation needs a field on BOTH models
→ If Post has "author: User", then User must have "posts: Post[]"
→ Prisma requires both sides of the relationship to be defined

"Missing references argument in @relation":
→ Specify which field to reference in the @relation attribute
→ Example: @relation(fields: [userId], references: [id])

REFERENTIAL ACTIONS GUIDE:
- Use onUpdate: NoAction when breaking cycles or multiple cascade paths
- Use onDelete: Cascade when child records should be deleted with parent
- Default if not specified: onDelete: Restrict, onUpdate: Cascade

AFTER FIXING PRISMA SCHEMA:
Always run "npx prisma generate" with executeCommand to regenerate @prisma/client types.
This updates TypeScript types to match your new schema.`;
  }

  /**
   * Format a single validation error with all its fields
   */
  private formatValidationError(error: ValidationError): string {
    const lines = [`- **File**: ${error.file}`];

    if (error.line) {
      let lineInfo = `  **Line**: ${error.line}`;
      if (error.column) {
        lineInfo += `, **Column**: ${error.column}`;
      }
      lines.push(lineInfo);
    }

    if (error.code) {
      lines.push(`  **Code**: ${error.code}`);
    }

    lines.push(`  **Error**: ${error.message}`);
    lines.push(''); // blank line

    return lines.join('\n');
  }

  /**
   * Build a section with header and formatted errors
   */
  private buildErrorSection(title: string, errors: ValidationError[]): string {
    if (errors.length === 0) return '';

    const header = `## ${title} (${errors.length})\n\n`;
    const body = errors.map((e) => this.formatValidationError(e)).join('');
    return header + body;
  }

  private buildUserPrompt(errors: ValidationError[], iteration: number): string {
    const errorsByType = this.groupErrorsByType(errors);

    const sections = [
      `Fix the following validation errors (iteration ${iteration} of allowed attempts):\n\n`,
      this.buildErrorSection('Prisma Schema Errors', errorsByType.prisma),
      this.buildErrorSection('TypeScript Errors', errorsByType.typescript),
      '\n**Instructions**:',
      '1. Read the affected files to understand the code',
      '2. Fix all errors systematically',
      '3. Write the corrected files back',
      '',
      'Remember: Focus ONLY on fixing these specific errors. Do not add new features or refactor unrelated code.',
    ];

    return sections.join('\n');
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
}
