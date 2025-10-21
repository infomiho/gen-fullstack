import type {
  CapabilityContext,
  CapabilityResult,
  ClientToServerEvents,
  ServerToClientEvents,
} from '../types/index.js';
import type { Server as SocketIOServer } from 'socket.io';
import { BaseCapability } from './base.capability.js';
import type { ModelName } from '../services/llm.service.js';
import { strategyLogger } from '../lib/logger.js';

/**
 * Template Capability
 *
 * Copies a pre-built full-stack template to the sandbox as a starting point.
 * This reduces token usage and improves consistency by avoiding boilerplate generation.
 *
 * Features:
 * - Copies template files from templates/ directory
 * - Persists files to database for session recovery
 * - Emits file_updated events for real-time UI
 * - Updates context with template metadata
 */
export class TemplateCapability extends BaseCapability {
  private templateName: string;

  constructor(
    modelName: ModelName,
    io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>,
    templateName: string = 'vite-fullstack-base',
  ) {
    super(modelName, io);
    this.templateName = templateName;
  }

  getName(): string {
    return 'Template';
  }

  async execute(context: CapabilityContext): Promise<CapabilityResult> {
    const { sessionId } = context;

    try {
      this.emitStatus('Copying full-stack template to workspace...', context);

      // Dynamic import to avoid circular dependencies
      const { copyTemplateToSandbox, getAllFiles } = await import(
        '../services/filesystem.service.js'
      );
      const { databaseService } = await import('../services/database.service.js');

      // Copy template files to sandbox
      let fileCount: number;
      try {
        fileCount = await copyTemplateToSandbox(sessionId, this.templateName);
      } catch (error) {
        const errorMessage = `Failed to copy template '${this.templateName}': ${error instanceof Error ? error.message : String(error)}`;
        this.logger.error({ error, sessionId, templateName: this.templateName }, errorMessage);

        return {
          success: false,
          error: errorMessage,
          toolCalls: 0,
        };
      }

      // Persist all template files to database
      this.emitStatus('Persisting template files to database...', context);
      const templateFiles: string[] = [];

      try {
        const files = await getAllFiles(sessionId);

        // Persist files in parallel for better performance
        await Promise.all(
          files.map(async (file) => {
            // Save to database
            await databaseService.saveFile({
              sessionId,
              path: file.relativePath,
              content: file.content,
            });

            // Emit file_updated event for real-time UI updates
            this.io.to(sessionId).emit('file_updated', {
              path: file.relativePath,
              content: file.content,
            });

            // Track file paths for context
            templateFiles.push(file.relativePath);
          }),
        );

        strategyLogger.info(
          { sessionId, fileCount: files.length, templateName: this.templateName },
          'Persisted template files to database',
        );
      } catch (error) {
        strategyLogger.error(
          { error, sessionId, templateName: this.templateName },
          'Failed to persist template files to database',
        );
        this.emitStatus(
          '⚠️ Warning: Template files may not persist to database. Session recovery may be incomplete.',
          context,
        );
        // Don't fail the whole generation, just warn the user
      }

      // Emit success message
      this.emitMessage(
        'assistant',
        `Started with a complete full-stack template (${fileCount} files copied):\n- ✅ Root package.json with npm workspaces\n- ✅ Vite + React 19 client setup\n- ✅ Express 5 + TypeScript server\n- ✅ Prisma ORM + SQLite database\n- ✅ Example User model and CRUD API\n\nNow customizing the template based on your requirements...\n\n`,
        sessionId,
      );

      return {
        success: true,
        toolCalls: 0, // Template copying doesn't use LLM tools
        contextUpdates: {
          templateFiles,
        },
      };
    } catch (error) {
      const errorMessage = `Template capability failed: ${error instanceof Error ? error.message : String(error)}`;
      this.logger.error({ error, sessionId, templateName: this.templateName }, errorMessage);

      return {
        success: false,
        error: errorMessage,
        toolCalls: 0,
      };
    }
  }
}
