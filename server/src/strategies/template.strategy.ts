import { stepCountIs, streamText } from 'ai';
import type { Server as SocketIOServer } from 'socket.io';
import {
  ARCHITECTURE_DESCRIPTION,
  DOMAIN_SPECIFIC_WARNING,
  FILE_STRUCTURE,
  getTemplateImplementationGuidelines,
  SYSTEM_PROMPT_INTRO,
} from '../config/prompt-snippets.js';
import { strategyLogger } from '../lib/logger.js';
import { tools } from '../tools/index.js';
import type { ClientToServerEvents, ServerToClientEvents } from '../types/index.js';
import { BaseStrategy, type GenerationMetrics } from './base.strategy.js';

// Maximum number of tool calls allowed in a single generation
const MAX_TOOL_CALLS = 20; // Same as naive/plan-first for thorough implementation

/**
 * Template-Based Strategy: Start from pre-built full-stack template
 *
 * This strategy reduces token usage and improves consistency by starting with
 * a complete working template. The LLM only needs to customize and extend the
 * template rather than creating everything from scratch.
 *
 * Characteristics:
 * - Starts with pre-built monorepo template (client + server + database)
 * - LLM modifies and extends template files
 * - Significantly reduced token usage (no need to generate boilerplate)
 * - Better structure consistency across generations
 * - Faster generation time
 *
 * Implementation:
 * - Copies base template from templates/vite-fullstack-base/ to session directory
 * - Provides template structure in system prompt
 * - Guides LLM to extend template rather than create from scratch
 * - Reduces max tool calls to 15 (vs 30 for naive strategy)
 */
export class TemplateStrategy extends BaseStrategy {
  getName(): string {
    return 'Template-Based';
  }

  getSystemPrompt(): string {
    return `${SYSTEM_PROMPT_INTRO}

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

      this.emitMessage(io, 'system', `Starting ${this.getName()} strategy...`);

      // Copy template to sandbox
      this.emitMessage(io, 'system', 'Copying full-stack template to workspace...');

      const { copyTemplateToSandbox, getAllFiles } = await import(
        '../services/filesystem.service.js'
      );
      const { databaseService } = await import('../services/database.service.js');

      let fileCount: number;
      try {
        fileCount = await copyTemplateToSandbox(sessionId, 'vite-fullstack-base');
      } catch (error) {
        throw new Error(
          `Failed to copy template 'vite-fullstack-base': ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      // Persist all template files to database
      this.emitMessage(io, 'system', 'Persisting template files to database...');
      try {
        const templateFiles = await getAllFiles(sessionId);

        // Persist files in parallel for better performance
        await Promise.all(
          templateFiles.map(async (file) => {
            // Save to database
            await databaseService.saveFile({
              sessionId,
              path: file.relativePath,
              content: file.content,
            });

            // Emit file_updated event for real-time UI updates (same pattern as writeFile tool)
            io.to(sessionId).emit('file_updated', {
              path: file.relativePath,
              content: file.content,
            });
          }),
        );

        strategyLogger.info(
          { sessionId, fileCount: templateFiles.length },
          'Persisted template files to database',
        );
      } catch (error) {
        strategyLogger.error({ error, sessionId }, 'Failed to persist template files to database');
        this.emitMessage(
          io,
          'system',
          '⚠️ Warning: Template files may not persist to database. Session recovery may be incomplete.',
        );
        // Don't fail the whole generation, just warn the user
      }

      this.emitMessage(
        io,
        'assistant',
        `Started with a complete full-stack template (${fileCount} files copied):\n- ✅ Root package.json with npm workspaces\n- ✅ Vite + React 19 client setup\n- ✅ Express 5 + TypeScript server\n- ✅ Prisma ORM + SQLite database\n- ✅ Example User model and CRUD API\n\nNow customizing the template based on your requirements...\n\n`,
      );

      // Stream implementation with reduced tool calls (template handles boilerplate)
      const result = streamText({
        model: this.model,
        system: this.getSystemPrompt(),
        prompt,
        tools,
        experimental_context: { sessionId, io },
        stopWhen: stepCountIs(MAX_TOOL_CALLS),
        onStepFinish: this.createOnStepFinishHandler(io),
        abortSignal: this.getAbortSignal(),
      });

      // Process stream and calculate metrics
      const metrics = await this.processStreamResult(io, result, startTime);

      // Log completion
      this.logComplete(sessionId, metrics);

      // Emit completion event
      this.emitComplete(io, metrics);

      return metrics;
    } catch (error) {
      return this.handleGenerationError(io, startTime, error);
    }
  }
}
