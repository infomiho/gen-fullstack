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
import { getErrorMessage, truncateErrorMessage } from '../lib/error-utils.js';

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
      // Import Docker service for container execution
      const { dockerService } = await import('../services/docker.service.js');

      // Verify container exists (should be created by orchestrator)
      if (!dockerService.hasContainer(sessionId)) {
        throw new Error(
          'Docker container not found. Container should be created before validation.',
        );
      }

      // ==================== DEPENDENCY INSTALLATION ====================
      this.emitStatus('Installing dependencies...', context);

      const installResult = await dockerService.executeCommand(
        sessionId,
        'npm install',
        BaseCapability.INSTALL_TIMEOUT_MS,
      );

      if (!installResult.success) {
        const errorMsg = `Dependency installation failed: ${truncateErrorMessage(installResult.stderr)}`;
        this.emitStatus(`⚠️ ${errorMsg}`, context);

        // Send ERROR event to state machine
        try {
          const containerInfo = dockerService
            .listContainers()
            .find((c) => c.sessionId === sessionId);
          if (containerInfo?.actor) {
            containerInfo.actor.send({ type: 'ERROR', error: errorMsg } as any); // XState v5 type inference limitation
          }
        } catch (sendError) {
          // Log but don't fail validation - error event sending is best-effort
          this.logger.warn(
            { error: sendError, sessionId },
            'Failed to send ERROR event to state machine',
          );
        }

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

        const schemaResult = await this.validatePrismaSchemaInternal(sessionId, dockerService);
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

        const tsErrors = await this.validateTypeScriptInternal(sessionId, dockerService);
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

      // Container stays in 'ready' status after validation
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
      const errorMessage = `Validation capability failed: ${getErrorMessage(error)}`;
      this.logger.error({ error, sessionId }, errorMessage);

      // Send ERROR event to state machine
      try {
        const { dockerService } = await import('../services/docker.service.js');
        if (dockerService.hasContainer(sessionId)) {
          const containerInfo = dockerService
            .listContainers()
            .find((c) => c.sessionId === sessionId);
          if (containerInfo?.actor) {
            containerInfo.actor.send({ type: 'ERROR', error: errorMessage } as any); // XState v5 type inference limitation
          }
        }
      } catch (sendError) {
        // Log but don't fail validation - error event sending is best-effort
        this.logger.warn(
          { error: sendError, sessionId },
          'Failed to send ERROR event to state machine',
        );
      }

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
   * Validate Prisma schema and generate client (using Docker)
   */
  private async validatePrismaSchemaInternal(
    sessionId: string,
    dockerService: typeof import('../services/docker.service.js').dockerService,
  ): Promise<SchemaValidationResult> {
    // First, validate the schema
    const validateResult = await dockerService.executeCommand(
      sessionId,
      'npx prisma validate',
      BaseCapability.VALIDATION_TIMEOUT_MS,
    );

    if (!validateResult.success) {
      const errors = parsePrismaErrors(validateResult.stderr);
      return { valid: false, errors };
    }

    // If validation succeeds, generate the Prisma client
    const generateResult = await dockerService.executeCommand(
      sessionId,
      'npx prisma generate',
      BaseCapability.VALIDATION_TIMEOUT_MS,
    );

    if (!generateResult.success) {
      const errors = parsePrismaErrors(generateResult.stderr);
      return { valid: false, errors };
    }

    return { valid: true, errors: [] };
  }

  /**
   * Validate TypeScript in both client and server workspaces (using Docker)
   */
  private async validateTypeScriptInternal(
    sessionId: string,
    dockerService: typeof import('../services/docker.service.js').dockerService,
  ): Promise<TypeScriptError[]> {
    const { parseTypeScriptErrors } = await import('../lib/typescript-error-parser.js');
    const errors: TypeScriptError[] = [];

    // Validate server TypeScript
    const serverResult = await dockerService.executeCommand(
      sessionId,
      'npx tsc --noEmit --project server/tsconfig.json',
      BaseCapability.TYPECHECK_TIMEOUT_MS,
    );

    if (!serverResult.success) {
      const serverErrors = parseTypeScriptErrors(
        serverResult.stdout + '\n' + serverResult.stderr,
        'server',
      );
      errors.push(...serverErrors);
    }

    // Validate client TypeScript
    const clientResult = await dockerService.executeCommand(
      sessionId,
      'npx tsc --noEmit --project client/tsconfig.json',
      BaseCapability.TYPECHECK_TIMEOUT_MS,
    );

    if (!clientResult.success) {
      const clientErrors = parseTypeScriptErrors(
        clientResult.stdout + '\n' + clientResult.stderr,
        'client',
      );
      errors.push(...clientErrors);
    }

    return errors;
  }
}
