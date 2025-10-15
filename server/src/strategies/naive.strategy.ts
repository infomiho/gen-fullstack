import { stepCountIs, streamText } from 'ai';
import type { Socket } from 'socket.io';
import { tools } from '../tools/index.js';
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

IMPORTANT:
- Write complete file contents (not placeholders)
- Use proper TypeScript types
- Include all necessary imports
- Test your work by running commands to verify it builds

Now, generate the application based on the user's requirements.`;
  }

  async generateApp(prompt: string, socket: Socket, sessionId: string): Promise<GenerationMetrics> {
    const startTime = Date.now();
    this.logStart(sessionId, prompt);

    try {
      // Initialize sandbox
      await this.initializeSandbox(sessionId);

      // Emit initial message
      this.emitMessage(socket, 'system', `Starting generation with ${this.getName()} strategy...`);

      // Stream text generation with tools
      const result = streamText({
        model: this.model,
        system: this.getSystemPrompt(),
        prompt,
        tools,
        experimental_context: { sessionId, socket },
        stopWhen: stepCountIs(MAX_TOOL_CALLS),
        onStepFinish({ toolCalls, toolResults }) {
          // Emit complete tool calls with all data
          // AI SDK 5.0 changed property names: toolCall.args → toolCall.input, toolCall.id → toolCall.toolCallId
          for (const toolCall of toolCalls) {
            const toolInput =
              typeof toolCall.input === 'object' && toolCall.input !== null
                ? (toolCall.input as Record<string, unknown>)
                : {};

            socket.emit('tool_call', {
              id: toolCall.toolCallId,
              name: toolCall.toolName,
              args: toolInput,
              timestamp: Date.now(),
            });
          }

          // Emit complete tool results
          for (const toolResult of toolResults) {
            const resultData = {
              id: `result-${toolResult.toolCallId}`,
              toolName: toolResult.toolName,
              result:
                typeof toolResult.output === 'string'
                  ? toolResult.output
                  : JSON.stringify(toolResult.output),
              timestamp: Date.now(),
            };
            socket.emit('tool_result', resultData);

            // Note: file_updated events are now emitted immediately from the writeFile tool
            // during execution, not here after the fact. This provides real-time file streaming.
          }
        },
      });

      const stepCount = 0;

      // Process the full stream for text deltas
      for await (const part of result.fullStream) {
        switch (part.type) {
          case 'text-delta':
            // Stream text deltas to client
            if (part.text) {
              this.emitMessage(socket, 'assistant', part.text);
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
        steps?.length || stepCount,
      );

      // Log completion
      this.logComplete(sessionId, metrics);

      // Emit completion event
      this.emitComplete(socket, metrics);

      return metrics;
    } catch (error) {
      // Handle errors
      const duration = Date.now() - startTime;
      this.emitError(socket, error as Error);

      // Return partial metrics
      return this.calculateMetrics(0, 0, duration, 0);
    }
  }
}
