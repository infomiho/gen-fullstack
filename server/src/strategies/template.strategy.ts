import { stepCountIs, streamText } from 'ai';
import type { Server as SocketIOServer } from 'socket.io';
import {
  ARCHITECTURE_DESCRIPTION,
  FILE_STRUCTURE,
  getTemplateImplementationGuidelines,
} from '../config/prompt-snippets.js';
import { tools } from '../tools/index.js';
import type { ClientToServerEvents, ServerToClientEvents } from '../types/index.js';
import { BaseStrategy, type GenerationMetrics } from './base.strategy.js';

// Maximum number of tool calls allowed in a single generation
const MAX_TOOL_CALLS = 15; // Fewer than naive since we start with template

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
    return `You are an expert full-stack web application generator. A complete full-stack template has been pre-loaded into your workspace.

YOUR TASK: Customize this template to implement the user's specific requirements.

TEMPLATE STRUCTURE - ALREADY SET UP (DO NOT READ OR MODIFY):
✓ Root package.json with npm workspaces and scripts
✓ client/package.json, vite.config.ts, tsconfig.json (Vite + React 19 configured)
✓ server/package.json, tsconfig.json (Express 5 + Prisma configured)
✓ client/index.html, client/src/main.tsx (HTML template and React entry point)

FILES TO MODIFY (ONLY THESE 4):
1. prisma/schema.prisma - Add your data models (User model already exists as example)
2. server/src/index.ts - Add your API endpoints (User CRUD already exists as example)
3. client/src/App.tsx - Customize UI (User management UI already exists as example)
4. client/src/App.css - Style your UI (Example styles already exist)
5. client/src/components/* - Create new components as needed

EFFICIENT WORKFLOW:
1. Analyze the user's requirements
2. Start implementing immediately (DO NOT use listFiles or readFile on config files):
   a. Update prisma/schema.prisma with the required data models
   b. Add API routes to server/src/index.ts for CRUD operations
   c. Create React components in client/src/components/ for the UI
   d. Update client/src/App.tsx to integrate the new features

EXAMPLE - Task Tracker App:
- Add Task model to prisma/schema.prisma (title, completed, userId fields)
- Add GET/POST/PUT/DELETE /api/tasks endpoints to server/src/index.ts
- Create TaskList.tsx and TaskForm.tsx components in client/src/components/
- Update App.tsx to render and manage tasks

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
          templateFiles.map((file) =>
            databaseService.saveFile({
              sessionId,
              path: file.relativePath,
              content: file.content,
            }),
          ),
        );

        console.log(
          `[Template] Persisted ${templateFiles.length} template files to database for session ${sessionId}`,
        );
      } catch (error) {
        console.error('[Template] Failed to persist template files to database:', error);
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
        `## 🏗️ Template Strategy\n\nStarted with a complete full-stack template (${fileCount} files copied):\n- ✅ Root package.json with npm workspaces\n- ✅ Vite + React 19 client setup\n- ✅ Express 5 + TypeScript server\n- ✅ Prisma ORM + SQLite database\n- ✅ Example User model and CRUD API\n\nNow customizing the template based on your requirements...\n\n`,
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
