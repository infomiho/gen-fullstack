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

TEMPLATE STRUCTURE:
The following structure is already in place:
- client/ directory: Vite + React 19 + TypeScript
- server/ directory: Express 5 + TypeScript with example routes
- prisma/ directory: Database schema with example User model
- Root package.json with npm workspaces and configuration files

EFFICIENT WORKFLOW:
1. Analyze the user's requirements to understand what needs to be built
2. Optional: Use listFiles once if you need to see the exact template structure
3. Start implementing immediately:
   a. Update prisma/schema.prisma with the required data models
   b. Create API routes in server/src/ for CRUD operations
   c. Build React components in client/src/components/ for the UI
   d. Update client/src/App.tsx to integrate the new features

IMPLEMENTATION EXAMPLE:
For a "task tracker" app, you would:
- Add Task model to prisma/schema.prisma (with fields like title, completed, userId)
- Create GET/POST/PUT/DELETE /api/tasks endpoints in server/src/index.ts
- Build TaskList and TaskForm React components in client/src/components/
- Update App.tsx to render and manage tasks

TOOLS AVAILABLE:
1. writeFile - Create or update files (use extensively to implement features)
2. readFile - Read existing files (use only when you need to check current content)
3. listFiles - List directory contents (use sparingly, template structure is documented above)
4. executeCommand - Run commands like npm install

${ARCHITECTURE_DESCRIPTION}

${FILE_STRUCTURE}

${getTemplateImplementationGuidelines()}

FOCUS: Don't spend time exploring the template - it's documented above. Your goal is to write code that implements the user's requirements by extending the existing template structure.`;
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
