import type { Socket } from 'socket.io';
import { streamText, stepCountIs } from 'ai';
import { BaseStrategy, type GenerationMetrics } from './base.strategy.js';
import { tools } from '../tools/index.js';

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
 * - Multiple tool calling iterations (up to 20 steps)
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
   - package.json with all dependencies
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

4. After creating files, run "npm install" to install dependencies

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
        experimental_context: { sessionId },
        stopWhen: stepCountIs(20), // Allow up to 20 tool calls
        maxSteps: 20,
        onStepFinish({ toolCalls, toolResults }) {
          // Emit complete tool calls with all data
          for (const toolCall of toolCalls) {
            console.log(`[Naive] Tool call: ${toolCall.toolName}`, toolCall.args);
            socket.emit('tool_call', {
              id: toolCall.toolCallId,
              name: toolCall.toolName,
              args: toolCall.args,
            });
          }

          // Emit complete tool results
          for (const toolResult of toolResults) {
            console.log(`[Naive] Tool result: ${toolResult.toolName}`);
            socket.emit('tool_result', {
              id: `result-${toolResult.toolCallId}`,
              toolName: toolResult.toolName,
              result:
                typeof toolResult.result === 'string'
                  ? toolResult.result
                  : JSON.stringify(toolResult.result),
            });
          }
        },
      });

      let stepCount = 0;

      // Process the full stream for text deltas
      for await (const part of result.fullStream) {
        switch (part.type) {
          case 'text-delta':
            // Stream text deltas to client
            if (part.textDelta) {
              this.emitMessage(socket, 'assistant', part.textDelta);
            }
            break;

          case 'step-finish':
            stepCount++;
            console.log(`[${this.getName()}] Step ${stepCount} finished`);
            break;

          case 'finish':
            console.log(`[${this.getName()}] Generation finished`);
            break;
        }
      }

      // Wait for final result to get usage stats
      const { usage, text, steps } = await result;

      // Calculate metrics
      const duration = Date.now() - startTime;
      const metrics = this.calculateMetrics(
        usage.promptTokens || 0,
        usage.completionTokens || 0,
        duration,
        steps?.length || 0,
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
