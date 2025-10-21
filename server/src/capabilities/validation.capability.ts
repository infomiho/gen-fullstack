import type {
  CapabilityContext,
  CapabilityResult,
  ClientToServerEvents,
  ServerToClientEvents,
} from '../types/index.js';
import type { Server as SocketIOServer } from 'socket.io';
import { BaseCapability } from './base.capability.js';
import type { ModelName } from '../services/llm.service.js';
import { parsePrismaErrors } from '../lib/prisma-error-parser.js';
import type { TypeScriptError } from '../lib/typescript-error-parser.js';

/**
 * Schema validation result
 */
interface SchemaValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validation Capability
 *
 * Validates generated code using actual compilers (Prisma, TypeScript).
 * This ensures the generated application actually compiles and can run.
 *
 * Features:
 * - Prisma schema validation and client generation
 * - TypeScript type checking for both client and server
 * - Dependency installation before validation
 * - Detailed error reporting with file/line/column info
 */
export class ValidationCapability extends BaseCapability {
  private validateSchema: boolean;
  private validateTypeScript: boolean;

  constructor(
    modelName: ModelName,
    io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>,
    options: {
      validateSchema?: boolean;
      validateTypeScript?: boolean;
    } = {},
  ) {
    super(modelName, io);
    this.validateSchema = options.validateSchema ?? true;
    this.validateTypeScript = options.validateTypeScript ?? true;
  }

  getName(): string {
    return 'Validation';
  }

  /**
   * Check if this capability can be skipped
   * Skip if no validation is enabled
   */
  canSkip(_context: CapabilityContext): boolean {
    return !this.validateSchema && !this.validateTypeScript;
  }

  /**
   * Validate context requirements for validation capability
   * Requires sandboxPath to execute compiler commands
   */
  validateContext(context: CapabilityContext): void {
    if (!context.sandboxPath) {
      throw new Error(
        'ValidationCapability requires context.sandboxPath to execute validation commands',
      );
    }
  }

  async execute(context: CapabilityContext): Promise<CapabilityResult> {
    const { sessionId } = context;
    let schemaValidationPassed = true;
    let typeCheckPassed = true;
    const errors: TypeScriptError[] = [];

    try {
      // ==================== DEPENDENCY INSTALLATION ====================
      this.emitStatus('Installing dependencies...', context);

      const { executeCommand } = await import('../services/command.service.js');
      const installResult = await executeCommand(sessionId, 'npm install', 120000);

      if (!installResult.success) {
        const errorMsg = `Dependency installation failed: ${installResult.stderr.substring(0, 200)}`;
        this.emitStatus(`⚠️ ${errorMsg}`, context);

        return {
          success: false,
          error: errorMsg,
          toolCalls: 0,
          contextUpdates: {
            validation: {
              schemaValidationPassed: false,
              typeCheckPassed: false,
              errors: [],
            },
          },
        };
      }

      this.emitStatus('✅ Dependencies installed successfully', context);

      // ==================== SCHEMA VALIDATION ====================
      if (this.validateSchema) {
        this.emitStatus('Validating Prisma schema...', context);

        const schemaResult = await this.validatePrismaSchemaInternal(sessionId);
        schemaValidationPassed = schemaResult.valid;

        if (!schemaResult.valid) {
          this.emitStatus(`⚠️ Schema errors found (${schemaResult.errors.length})`, context);

          // Emit the actual errors to UI for visibility
          const errorList = schemaResult.errors.map((e, i) => `${i + 1}. ${e}`).join('\n');
          this.emitStatus(`Prisma Schema Errors:\n${errorList}`, context);
        } else {
          this.emitStatus('✅ Schema validation passed', context);
        }
      }

      // ==================== TYPESCRIPT VALIDATION ====================
      if (this.validateTypeScript) {
        this.emitStatus('Type checking...', context);

        const tsErrors = await this.validateTypeScriptInternal(sessionId);
        typeCheckPassed = tsErrors.length === 0;

        if (tsErrors.length > 0) {
          this.emitStatus(
            `⚠️ Found ${tsErrors.length} TypeScript error${tsErrors.length === 1 ? '' : 's'}`,
            context,
          );
          errors.push(...tsErrors);
        } else {
          this.emitStatus('✅ Type checking passed', context);
        }
      }

      // Update context with validation results
      return {
        success: true,
        toolCalls: 0, // Validation doesn't use LLM tools
        contextUpdates: {
          validation: {
            schemaValidationPassed,
            typeCheckPassed,
            errors,
          },
        },
      };
    } catch (error) {
      const errorMessage = `Validation capability failed: ${error instanceof Error ? error.message : String(error)}`;
      this.logger.error({ error, sessionId }, errorMessage);

      return {
        success: false,
        error: errorMessage,
        toolCalls: 0,
        contextUpdates: {
          validation: {
            schemaValidationPassed: false,
            typeCheckPassed: false,
            errors: [],
          },
        },
      };
    }
  }

  /**
   * Validate Prisma schema and generate client
   */
  private async validatePrismaSchemaInternal(sessionId: string): Promise<SchemaValidationResult> {
    const { executeCommand } = await import('../services/command.service.js');

    // First, validate the schema
    const validateResult = await executeCommand(sessionId, 'npx prisma validate', 60000);

    if (!validateResult.success) {
      const errors = parsePrismaErrors(validateResult.stderr);
      return { valid: false, errors };
    }

    // If validation succeeds, generate the Prisma client
    const generateResult = await executeCommand(sessionId, 'npx prisma generate', 60000);

    if (!generateResult.success) {
      const errors = parsePrismaErrors(generateResult.stderr);
      return { valid: false, errors };
    }

    return { valid: true, errors: [] };
  }

  /**
   * Validate TypeScript in both client and server workspaces
   */
  private async validateTypeScriptInternal(sessionId: string): Promise<TypeScriptError[]> {
    const { validateTypeScript } = await import('../lib/typescript-validator.js');
    return validateTypeScript(sessionId);
  }
}
