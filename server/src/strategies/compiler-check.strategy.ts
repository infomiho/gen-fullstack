import { stepCountIs, streamText } from 'ai';
import type { Server as SocketIOServer } from 'socket.io';
import {
  ARCHITECTURE_DESCRIPTION,
  createFixPrompt,
  DOMAIN_SPECIFIC_WARNING,
  FILE_STRUCTURE,
  getNaiveImplementationSteps,
  SYSTEM_PROMPT_INTRO,
  TOOL_CAPABILITIES,
} from '../config/prompt-snippets.js';
import { tools } from '../tools/index.js';
import type { ClientToServerEvents, ServerToClientEvents } from '../types/index.js';
import { BaseStrategy, type GenerationMetrics } from './base.strategy.js';

// Maximum number of tool calls for initial generation
const MAX_INITIAL_TOOL_CALLS = 20;

// Maximum number of tool calls for fix iterations
const MAX_FIX_TOOL_CALLS = 5;

// Maximum number of TypeScript fix iterations
const MAX_TYPESCRIPT_ITERATIONS = 3;

/**
 * TypeScript error structure parsed from tsc output
 */
interface TypeScriptError {
  file: string;
  line: number;
  column: number;
  code: string; // e.g., "TS2339"
  message: string;
}

/**
 * Schema validation result
 */
interface SchemaValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Compiler Check Strategy: Generate app with Prisma and TypeScript validation
 *
 * This strategy improves on the naive approach by validating the generated code
 * with the actual compilers (Prisma, TypeScript) and iterating with the LLM to
 * fix any errors found.
 *
 * Characteristics:
 * - Three-phase approach: generation → schema validation → type validation
 * - Runs actual compiler checks (not just static analysis)
 * - Iterates with focused prompts to fix specific errors
 * - Ensures generated apps actually compile and run
 *
 * Workflow:
 * 1. Generate initial app (20 tool calls max)
 * 2. Validate Prisma schema and generate client (1 fix attempt if needed)
 * 3. Validate TypeScript in both workspaces (up to 3 fix iterations)
 */
export class CompilerCheckStrategy extends BaseStrategy {
  getName(): string {
    return 'Compiler-Check';
  }

  getSystemPrompt(): string {
    return `${SYSTEM_PROMPT_INTRO}

${DOMAIN_SPECIFIC_WARNING}

${TOOL_CAPABILITIES}

${ARCHITECTURE_DESCRIPTION}

${FILE_STRUCTURE}

${getNaiveImplementationSteps()}`;
  }

  /**
   * System prompt for fixing Prisma schema errors
   */
  getSchemaFixPrompt(): string {
    return createFixPrompt(
      'Prisma schema validation',
      'A Prisma schema was generated but has validation errors.',
      'Fix ONLY the errors in prisma/schema.prisma.',
      [
        'Invalid field types',
        'Missing relation fields',
        'Incorrect syntax',
        'Invalid model names or constraints',
      ],
    );
  }

  /**
   * System prompt for fixing TypeScript errors
   */
  getTypeScriptFixPrompt(): string {
    return createFixPrompt(
      'TypeScript compilation',
      'The application was generated but has TypeScript compilation errors.',
      'Fix the TypeScript errors by updating the relevant files.',
      [
        'Missing imports',
        'Incorrect types from Prisma Client (@prisma/client)',
        'Props type mismatches in React components',
        'Async/await issues',
        'Missing type annotations',
      ],
    );
  }

  /**
   * Validate Prisma schema and generate client
   *
   * @param sessionId - Session identifier
   * @returns Validation result with any errors
   */
  private async validatePrismaSchema(sessionId: string): Promise<SchemaValidationResult> {
    const { executeCommand } = await import('../services/command.service.js');

    // First, validate the schema
    const validateResult = await executeCommand(sessionId, 'npx prisma validate', 60000);

    if (!validateResult.success) {
      const errors = this.parsePrismaErrors(validateResult.stderr);
      return { valid: false, errors };
    }

    // If validation succeeds, generate the Prisma client
    const generateResult = await executeCommand(sessionId, 'npx prisma generate', 60000);

    if (!generateResult.success) {
      const errors = this.parsePrismaErrors(generateResult.stderr);
      return { valid: false, errors };
    }

    return { valid: true, errors: [] };
  }

  /**
   * Parse Prisma error messages from stderr
   *
   * @param stderr - Standard error output from Prisma CLI
   * @returns Array of error messages
   */
  private parsePrismaErrors(stderr: string): string[] {
    const errors: string[] = [];

    // Prisma errors typically contain "Error:" prefix
    const lines = stderr.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('Error:') || trimmed.includes('error')) {
        errors.push(trimmed);
      }
    }

    // If no specific errors found, return the full stderr
    if (errors.length === 0 && stderr.trim()) {
      errors.push(stderr.trim());
    }

    return errors;
  }

  /**
   * Validate TypeScript in both client and server workspaces
   *
   * @param sessionId - Session identifier
   * @returns Array of TypeScript errors from both workspaces
   */
  private async validateTypeScript(sessionId: string): Promise<TypeScriptError[]> {
    const { executeCommand } = await import('../services/command.service.js');

    const allErrors: TypeScriptError[] = [];

    // Check server TypeScript
    const serverResult = await executeCommand(
      sessionId,
      'npx tsc --noEmit --project server/tsconfig.json',
      60000,
    );

    if (!serverResult.success) {
      const serverErrors = this.parseTypeScriptErrors(serverResult.stdout, 'server');
      allErrors.push(...serverErrors);
    }

    // Check client TypeScript
    const clientResult = await executeCommand(
      sessionId,
      'npx tsc --noEmit --project client/tsconfig.json',
      60000,
    );

    if (!clientResult.success) {
      const clientErrors = this.parseTypeScriptErrors(clientResult.stdout, 'client');
      allErrors.push(...clientErrors);
    }

    return allErrors;
  }

  /**
   * Parse TypeScript errors from tsc output
   *
   * @param output - Standard output from tsc command
   * @param workspace - Workspace name (server/client) for context
   * @returns Array of structured TypeScript errors
   */
  private parseTypeScriptErrors(output: string, workspace: string): TypeScriptError[] {
    const errors: TypeScriptError[] = [];

    // TypeScript format: "file(line,col): error TSxxxx: message"
    // or: "file:line:col - error TSxxxx: message"
    const regex = /([^:(]+)\((\d+),(\d+)\):\s*error\s+(TS\d+):\s*(.+)/g;
    const regex2 = /([^:]+):(\d+):(\d+)\s*-\s*error\s+(TS\d+):\s*(.+)/g;

    let match: RegExpExecArray | null;

    // Try format 1: file(line,col): error TSxxxx: message
    match = regex.exec(output);
    while (match !== null) {
      errors.push({
        file: `${workspace}/${match[1].trim()}`,
        line: Number.parseInt(match[2], 10),
        column: Number.parseInt(match[3], 10),
        code: match[4],
        message: match[5].trim(),
      });
      match = regex.exec(output);
    }

    // Try format 2: file:line:col - error TSxxxx: message
    match = regex2.exec(output);
    while (match !== null) {
      errors.push({
        file: `${workspace}/${match[1].trim()}`,
        line: Number.parseInt(match[2], 10),
        column: Number.parseInt(match[3], 10),
        code: match[4],
        message: match[5].trim(),
      });
      match = regex2.exec(output);
    }

    return errors;
  }

  /**
   * Format TypeScript errors for LLM consumption
   *
   * @param errors - Array of TypeScript errors
   * @returns Formatted error string for LLM
   */
  private formatErrorsForLLM(errors: TypeScriptError[]): string {
    const errorCount = errors.length;
    const maxErrorsToShow = 10;

    let message = `TypeScript found ${errorCount} type error${errorCount === 1 ? '' : 's'}:\n\n`;

    const errorsToShow = errors.slice(0, maxErrorsToShow);
    for (let i = 0; i < errorsToShow.length; i++) {
      const e = errorsToShow[i];
      message += `${i + 1}. ${e.file}:${e.line}:${e.column} - ${e.code}: ${e.message}\n`;
    }

    if (errorCount > maxErrorsToShow) {
      message += `\n... and ${errorCount - maxErrorsToShow} more errors\n`;
    }

    message += '\nFix these errors by updating the relevant files.';

    return message;
  }

  async generateApp(
    prompt: string,
    io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>,
    sessionId: string,
  ): Promise<GenerationMetrics> {
    const startTime = Date.now();
    this.logStart(sessionId, prompt);

    // Enable database persistence for this session
    this.setSessionId(sessionId);

    try {
      // Initialize sandbox
      await this.initializeSandbox(sessionId);

      // ==================== PHASE 1: INITIAL GENERATION ====================
      this.emitMessage(io, 'system', `Starting ${this.getName()} strategy...`);
      this.emitMessage(io, 'system', 'Phase 1: Generating application...');

      // Stream text generation with tools
      const result = streamText({
        model: this.model,
        system: this.getSystemPrompt(),
        prompt,
        tools,
        experimental_context: { sessionId, io },
        stopWhen: stepCountIs(MAX_INITIAL_TOOL_CALLS),
        onStepFinish: this.createOnStepFinishHandler(io),
        abortSignal: this.getAbortSignal(),
      });

      // Process stream and get initial metrics
      const initialMetrics = await this.processStreamResult(io, result, startTime);

      // Track cumulative metrics
      let totalInputTokens = initialMetrics.inputTokens;
      let totalOutputTokens = initialMetrics.outputTokens;
      let totalSteps = initialMetrics.steps;

      // ==================== PHASE 2: SCHEMA VALIDATION ====================
      this.emitMessage(io, 'system', 'Phase 2: Validating Prisma schema...');

      const schemaResult = await this.validatePrismaSchema(sessionId);
      let schemaValidationPassed = schemaResult.valid;

      if (!schemaResult.valid) {
        this.emitMessage(
          io,
          'system',
          `⚠️ Schema errors found (${schemaResult.errors.length}). Fixing...`,
        );

        // Single fix iteration for schema
        const fixPrompt = `The following Prisma schema validation errors were found:\n\n${schemaResult.errors.join('\n')}\n\nPlease fix these errors in the schema file.`;

        const fixResult = streamText({
          model: this.model,
          system: this.getSchemaFixPrompt(),
          prompt: fixPrompt,
          tools,
          experimental_context: { sessionId, io },
          stopWhen: stepCountIs(MAX_FIX_TOOL_CALLS),
          onStepFinish: this.createOnStepFinishHandler(io),
          abortSignal: this.getAbortSignal(),
        });

        const fixMetrics = await this.processStreamResult(io, fixResult, startTime);

        // Add to cumulative metrics
        totalInputTokens += fixMetrics.inputTokens;
        totalOutputTokens += fixMetrics.outputTokens;
        totalSteps += fixMetrics.steps;

        // Re-validate
        const retryResult = await this.validatePrismaSchema(sessionId);
        schemaValidationPassed = retryResult.valid;

        if (retryResult.valid) {
          this.emitMessage(io, 'system', '✅ Schema validation passed');
        } else {
          this.emitMessage(io, 'system', '⚠️ Schema still has errors after fix attempt');
        }
      } else {
        this.emitMessage(io, 'system', '✅ Schema validation passed');
      }

      // ==================== PHASE 3: TYPESCRIPT VALIDATION ====================
      this.emitMessage(io, 'system', 'Phase 3: Type checking...');

      let tsIteration = 0;
      let tsErrors = await this.validateTypeScript(sessionId);
      let typeCheckPassed = tsErrors.length === 0;

      while (tsErrors.length > 0 && tsIteration < MAX_TYPESCRIPT_ITERATIONS) {
        tsIteration++;
        this.emitMessage(
          io,
          'system',
          `⚠️ Found ${tsErrors.length} TypeScript error${tsErrors.length === 1 ? '' : 's'}. Fixing (iteration ${tsIteration}/${MAX_TYPESCRIPT_ITERATIONS})...`,
        );

        const fixPrompt = this.formatErrorsForLLM(tsErrors);

        const fixResult = streamText({
          model: this.model,
          system: this.getTypeScriptFixPrompt(),
          prompt: fixPrompt,
          tools,
          experimental_context: { sessionId, io },
          stopWhen: stepCountIs(MAX_FIX_TOOL_CALLS),
          onStepFinish: this.createOnStepFinishHandler(io),
          abortSignal: this.getAbortSignal(),
        });

        const fixMetrics = await this.processStreamResult(io, fixResult, startTime);

        // Add to cumulative metrics
        totalInputTokens += fixMetrics.inputTokens;
        totalOutputTokens += fixMetrics.outputTokens;
        totalSteps += fixMetrics.steps;

        // Re-check
        tsErrors = await this.validateTypeScript(sessionId);
        typeCheckPassed = tsErrors.length === 0;
      }

      if (tsErrors.length === 0) {
        this.emitMessage(io, 'system', '✅ TypeScript validation passed');
      } else {
        this.emitMessage(
          io,
          'system',
          `⚠️ ${tsErrors.length} TypeScript error${tsErrors.length === 1 ? '' : 's'} remain after ${tsIteration} iteration${tsIteration === 1 ? '' : 's'}`,
        );
      }

      // ==================== CALCULATE FINAL METRICS ====================
      const duration = Date.now() - startTime;
      const baseMetrics = this.calculateMetrics(
        totalInputTokens,
        totalOutputTokens,
        duration,
        totalSteps,
      );

      // Add compiler-specific metrics
      const finalMetrics: GenerationMetrics = {
        ...baseMetrics,
        compilerIterations: tsIteration,
        schemaValidationPassed,
        typeCheckPassed,
        totalCompilerErrors: tsErrors.length,
      };

      // Log completion
      this.logComplete(sessionId, finalMetrics);

      // Emit completion event
      this.emitComplete(io, finalMetrics);

      return finalMetrics;
    } catch (error) {
      return this.handleGenerationError(io, startTime, error);
    }
  }
}
