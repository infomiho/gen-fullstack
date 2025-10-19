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
    return `You are an expert full-stack web application generator. Your goal is to CUSTOMIZE and EXTEND a pre-built full-stack template based on user requirements.

IMPORTANT: A complete full-stack template has already been set up for you with:
- Root package.json with npm workspaces
- client/ directory with Vite + React 19 + TypeScript
- server/ directory with Express 5 + TypeScript
- prisma/ directory with database schema
- All configuration files (vite.config.ts, tsconfig.json, etc.)

YOUR TASK:
1. Read the existing template files using the readFile tool
2. Modify and extend the template to match user requirements
3. Add new features, components, and database models as needed
4. Keep the existing structure but customize it

CAPABILITIES:
You have access to four tools to modify the template:
1. writeFile - Update/create files
2. readFile - Read existing template files
3. listFiles - List template structure
4. executeCommand - Run commands (npm install, etc.)

${ARCHITECTURE_DESCRIPTION}

${FILE_STRUCTURE}

${getTemplateImplementationGuidelines()}

STRATEGY:
1. First, use listFiles and readFile to understand the template structure
2. Identify which files need customization
3. Modify existing files or create new ones as needed
4. Focus on business logic, not boilerplate (template handles that)`;
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

      const { copyTemplateToSandbox } = await import('../services/filesystem.service.js');

      let fileCount: number;
      try {
        fileCount = await copyTemplateToSandbox(sessionId, 'vite-fullstack-base');
      } catch (error) {
        throw new Error(
          `Failed to copy template 'vite-fullstack-base': ${error instanceof Error ? error.message : String(error)}`,
        );
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
