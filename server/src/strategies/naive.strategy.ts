import { stepCountIs, streamText } from 'ai';
import type { Server as SocketIOServer } from 'socket.io';
import {
  ARCHITECTURE_DESCRIPTION,
  FILE_STRUCTURE,
  getNaiveImplementationSteps,
} from '../config/prompt-snippets.js';
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
    return `You are an expert full-stack web application generator. Your goal is to create complete, working full-stack applications with client, server, and database.

CAPABILITIES:
You have access to four tools to build applications:
1. writeFile - Create/update files with content
2. readFile - Read existing file contents
3. listFiles - List files in a directory
4. executeCommand - Run commands (npm install, npm dev, etc.)

${ARCHITECTURE_DESCRIPTION}

${FILE_STRUCTURE}

${getNaiveImplementationSteps()}`;
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
