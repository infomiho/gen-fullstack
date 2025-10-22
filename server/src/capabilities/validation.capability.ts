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
import type { DockerMachineEvent } from '../services/docker/docker.machine.js';

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
      const installResult = await this.installDependencies(sessionId, context, dockerService);

      if (!installResult.success) {
        return {
          success: false,
          error: installResult.error,
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

      // ==================== SCHEMA VALIDATION ====================
      schemaValidationPassed = await this.performSchemaValidation(
        sessionId,
        context,
        dockerService,
      );

      // ==================== TYPESCRIPT VALIDATION ====================
      const tsResult = await this.performTypeScriptValidation(sessionId, context, dockerService);
      typeCheckPassed = tsResult.passed;
      errors.push(...tsResult.errors);

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
            containerInfo.actor.send({
              type: 'ERROR',
              error: errorMessage,
            } satisfies DockerMachineEvent);
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
   * Perform schema validation
   */
  private async performSchemaValidation(
    sessionId: string,
    context: CapabilityContext,
    dockerService: typeof import('../services/docker.service.js').dockerService,
  ): Promise<boolean> {
    if (!this.validateSchema) {
      return true; // Skip if not enabled
    }

    this.emitStatus('Validating Prisma schema...', context);

    const schemaResult = await this.validatePrismaSchemaInternal(sessionId, dockerService);

    if (!schemaResult.valid) {
      this.emitStatus(`⚠️ Schema errors found (${schemaResult.errors.length})`, context);

      // Emit the actual errors to UI for visibility
      const errorList = schemaResult.errors.map((e, i) => `${i + 1}. ${e}`).join('\n');
      this.emitStatus(`Prisma Schema Errors:\n${errorList}`, context);
      return false;
    }

    this.emitStatus('✅ Schema validation passed', context);
    return true;
  }

  /**
   * Perform TypeScript validation
   */
  private async performTypeScriptValidation(
    sessionId: string,
    context: CapabilityContext,
    dockerService: typeof import('../services/docker.service.js').dockerService,
  ): Promise<{ passed: boolean; errors: TypeScriptError[] }> {
    if (!this.validateTypeScript) {
      return { passed: true, errors: [] }; // Skip if not enabled
    }

    this.emitStatus('Type checking...', context);

    const tsErrors = await this.validateTypeScriptInternal(sessionId, dockerService);
    const passed = tsErrors.length === 0;

    if (tsErrors.length > 0) {
      this.emitStatus(
        `⚠️ Found ${tsErrors.length} TypeScript error${tsErrors.length === 1 ? '' : 's'}`,
        context,
      );
    } else {
      this.emitStatus('✅ Type checking passed', context);
    }

    return { passed, errors: tsErrors };
  }

  /**
   * Install dependencies in Docker container
   */
  private async installDependencies(
    sessionId: string,
    context: CapabilityContext,
    dockerService: typeof import('../services/docker.service.js').dockerService,
  ): Promise<{ success: boolean; error?: string }> {
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
        const containerInfo = dockerService.listContainers().find((c) => c.sessionId === sessionId);
        if (containerInfo?.actor) {
          containerInfo.actor.send({ type: 'ERROR', error: errorMsg } satisfies DockerMachineEvent);
        }
      } catch (sendError) {
        // Log but don't fail validation - error event sending is best-effort
        this.logger.warn(
          { error: sendError, sessionId },
          'Failed to send ERROR event to state machine',
        );
      }

      return { success: false, error: errorMsg };
    }

    this.emitStatus('✅ Dependencies installed successfully', context);
    return { success: true };
  }

  /**
   * Execute Prisma command with error parsing
   *
   * @param sessionId - Session ID for the container
   * @param command - Prisma command to execute (e.g., 'npx prisma validate')
   * @param dockerService - Docker service instance
   * @returns Result with success flag and parsed errors
   */
  private async executePrismaCommand(
    sessionId: string,
    command: string,
    dockerService: typeof import('../services/docker.service.js').dockerService,
  ): Promise<{ success: boolean; errors: string[] }> {
    const result = await dockerService.executeCommand(
      sessionId,
      command,
      BaseCapability.VALIDATION_TIMEOUT_MS,
    );

    if (!result.success) {
      const errors = parsePrismaErrors(result.stderr);
      return { success: false, errors };
    }

    return { success: true, errors: [] };
  }

  /**
   * Validate Prisma schema and generate client (using Docker)
   */
  private async validatePrismaSchemaInternal(
    sessionId: string,
    dockerService: typeof import('../services/docker.service.js').dockerService,
  ): Promise<SchemaValidationResult> {
    // First, validate the schema
    const validateResult = await this.executePrismaCommand(
      sessionId,
      'npx prisma validate',
      dockerService,
    );

    if (!validateResult.success) {
      return { valid: false, errors: validateResult.errors };
    }

    // If validation succeeds, generate the Prisma client
    const generateResult = await this.executePrismaCommand(
      sessionId,
      'npx prisma generate',
      dockerService,
    );

    if (!generateResult.success) {
      return { valid: false, errors: generateResult.errors };
    }

    return { valid: true, errors: [] };
  }

  /**
   * Execute TypeScript type check with error parsing
   *
   * @param sessionId - Session ID for the container
   * @param project - Project to type check ('client' or 'server')
   * @param dockerService - Docker service instance
   * @returns Array of parsed TypeScript errors
   */
  private async executeTypeCheck(
    sessionId: string,
    project: 'client' | 'server',
    dockerService: typeof import('../services/docker.service.js').dockerService,
  ): Promise<TypeScriptError[]> {
    const { parseTypeScriptErrors } = await import('../lib/typescript-error-parser.js');

    const result = await dockerService.executeCommand(
      sessionId,
      `npx tsc --noEmit --project ${project}/tsconfig.json`,
      BaseCapability.TYPECHECK_TIMEOUT_MS,
    );

    if (!result.success) {
      return parseTypeScriptErrors(`${result.stdout}\n${result.stderr}`, project);
    }

    return [];
  }

  /**
   * Validate TypeScript in both client and server workspaces (using Docker)
   */
  private async validateTypeScriptInternal(
    sessionId: string,
    dockerService: typeof import('../services/docker.service.js').dockerService,
  ): Promise<TypeScriptError[]> {
    const errors: TypeScriptError[] = [];

    // Validate server TypeScript
    const serverErrors = await this.executeTypeCheck(sessionId, 'server', dockerService);
    errors.push(...serverErrors);

    // Validate client TypeScript
    const clientErrors = await this.executeTypeCheck(sessionId, 'client', dockerService);
    errors.push(...clientErrors);

    return errors;
  }
}
