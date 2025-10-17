import { stepCountIs, streamText } from 'ai';
import type { Server as SocketIOServer } from 'socket.io';
import { tools } from '../tools/index.js';
import type { ClientToServerEvents, ServerToClientEvents } from '../types/index.js';
import { BaseStrategy, type GenerationMetrics } from './base.strategy.js';

// Maximum number of tool calls allowed in a single generation
const MAX_TOOL_CALLS = 20;

/**
 * Naive Strategy: Direct prompt-to-code approach
 *
 * This is the baseline strategy with no planning, no template, and no optimization.
 * The LLM generates the app directly from the user prompt using available tools.
 *
 * Characteristics:
 * - No upfront planning phase
 * - No pre-built template
 * - Direct generation from prompt
 * - Multiple tool calling iterations (up to MAX_TOOL_CALLS steps)
 */
export class NaiveStrategy extends BaseStrategy {
  getName(): string {
    return 'Naive';
  }

  getSystemPrompt(): string {
    return `You are an expert full-stack web application generator. Your goal is to create complete, working applications based on user requirements.

CAPABILITIES:
You have access to four tools to build applications:
1. writeFile - Create/update files with content
2. readFile - Read existing file contents
3. listFiles - List files in a directory
4. executeCommand - Run commands (npm install, npm dev, etc.)

GUIDELINES:
1. Create a complete Vite + React + TypeScript application
2. Always include:
   - package.json with all dependencies (including @vitejs/plugin-react, @types/react, @types/react-dom)
   - vite.config.ts for Vite configuration
   - tsconfig.json for TypeScript
   - index.html as entry point
   - src/main.tsx as React entry
   - src/App.tsx as main component
   - Basic styling (inline or CSS)

3. Use modern React patterns:
   - Functional components with hooks
   - TypeScript for type safety
   - Clean, readable code

4. DO NOT run "npm install" or any install commands - dependencies will be installed automatically when the app runs

5. Keep it simple but functional - focus on working code

6. If you encounter errors, read the files and fix the issues

REQUIRED VERSIONS (use exactly):
{
  "dependencies": {
    "react": "^19.2.0",
    "react-dom": "^19.2.0"
  },
  "devDependencies": {
    "@types/react": "^19.2.2",
    "@types/react-dom": "^19.2.2",
    "@vitejs/plugin-react": "^5.0.4",
    "typescript": "~5.9.3",
    "vite": "^7.1.9"
  }
}

IMPORTANT:
- Use exact versions above
- Write complete file contents (not placeholders)
- Use proper TypeScript types
- Include all necessary imports

Now, generate the application based on the user's requirements.`;
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

      // Emit initial message
      this.emitMessage(io, 'system', `Starting generation with ${this.getName()} strategy...`);

      // Stream text generation with tools
      const result = streamText({
        model: this.model,
        system: this.getSystemPrompt(),
        prompt,
        tools,
        experimental_context: { sessionId, io },
        stopWhen: stepCountIs(MAX_TOOL_CALLS),
        onStepFinish: this.createOnStepFinishHandler(io),
      });

      // Process the full stream for text deltas
      for await (const part of result.fullStream) {
        switch (part.type) {
          case 'text-delta':
            // Stream text deltas to client
            if (part.text) {
              this.emitMessage(io, 'assistant', part.text);
            }
            break;

          case 'finish':
            break;
        }
      }

      // Wait for usage stats (must await after stream is consumed)
      const [usage, steps] = await Promise.all([result.usage, result.steps]);

      // Calculate metrics
      // Note: AI SDK uses inputTokens/outputTokens, not promptTokens/completionTokens
      const duration = Date.now() - startTime;
      const metrics = this.calculateMetrics(
        usage.inputTokens || 0,
        usage.outputTokens || 0,
        duration,
        steps?.length || 0,
      );

      // Log completion
      this.logComplete(sessionId, metrics);

      // Emit completion event
      this.emitComplete(io, metrics);

      return metrics;
    } catch (error) {
      // Handle errors
      const duration = Date.now() - startTime;
      this.emitError(io, error as Error);

      // Return partial metrics
      return this.calculateMetrics(0, 0, duration, 0);
    }
  }
}
