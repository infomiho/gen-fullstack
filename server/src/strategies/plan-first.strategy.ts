import { stepCountIs, streamText, generateText } from 'ai';
import type { Server as SocketIOServer } from 'socket.io';
import { tools } from '../tools/index.js';
import { BaseStrategy, type GenerationMetrics } from './base.strategy.js';
import type { ClientToServerEvents, ServerToClientEvents } from '../types/index.js';

// Maximum number of tool calls allowed in a single generation
const MAX_TOOL_CALLS = 20;

/**
 * Plan-First Strategy: Generate architectural plan before code
 *
 * This strategy improves on the naive approach by creating a high-level plan first,
 * then using that plan as context for implementation. This helps maintain consistency
 * and ensures all requirements are addressed systematically.
 *
 * Characteristics:
 * - Two-phase approach: planning → implementation
 * - Plan includes architecture, file structure, and component design
 * - Implementation uses plan as additional context
 * - Reduces token waste from trial-and-error
 */
export class PlanFirstStrategy extends BaseStrategy {
  getName(): string {
    return 'Plan-First';
  }

  getPlanningPrompt(): string {
    return `You are an expert software architect. Your task is to create a detailed implementation plan for a web application.

TASK:
Analyze the user's requirements and create a comprehensive architectural plan that includes:

1. **Architecture Overview**
   - Technology stack decisions (already using Vite + React + TypeScript)
   - Key architectural patterns to use
   - Data flow and state management approach

2. **File Structure**
   - Complete list of files to create
   - Purpose of each file
   - Dependencies between files

3. **Component Design**
   - Main components needed
   - Props and state for each component
   - Component hierarchy

4. **Implementation Strategy**
   - Step-by-step implementation order
   - Key considerations and potential pitfalls
   - Testing approach

GUIDELINES:
- Be specific and detailed
- Consider edge cases and error handling
- Think about scalability and maintainability
- Keep it practical and implementable
- Focus on creating a working application

OUTPUT FORMAT:
Provide a well-structured plan in markdown format that will guide the implementation phase.`;
  }

  getSystemPrompt(): string {
    return `You are an expert full-stack web application generator. Your goal is to create complete, working applications based on user requirements and an architectural plan.

CAPABILITIES:
You have access to four tools to build applications:
1. writeFile - Create/update files with content
2. readFile - Read existing file contents
3. listFiles - List files in a directory
4. executeCommand - Run commands (npm install, npm dev, etc.)

GUIDELINES:
1. Follow the architectural plan provided
2. Create a complete Vite + React + TypeScript application
3. Always include:
   - package.json with all dependencies (including @vitejs/plugin-react, @types/react, @types/react-dom)
   - vite.config.ts for Vite configuration
   - tsconfig.json for TypeScript
   - index.html as entry point
   - src/main.tsx as React entry
   - src/App.tsx as main component
   - Additional files as specified in the plan

4. Use modern React patterns:
   - Functional components with hooks
   - TypeScript for type safety
   - Clean, readable code

5. DO NOT run "npm install" or any install commands - dependencies will be installed automatically when the app runs

6. Follow the plan systematically, implementing files in the suggested order

7. If you encounter issues, refer back to the plan and adjust accordingly

IMPORTANT:
- Write complete file contents (not placeholders)
- Use proper TypeScript types
- Include all necessary imports
- Stay consistent with the architectural plan

Now, implement the application based on the plan and user requirements.`;
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

      // ==================== PHASE 1: PLANNING ====================
      this.emitMessage(io, 'system', `Starting ${this.getName()} strategy...`);
      this.emitMessage(io, 'system', 'Phase 1: Generating architectural plan...');

      // Generate plan without tools (single call, no streaming for plan)
      const planResult = await generateText({
        model: this.model,
        system: this.getPlanningPrompt(),
        prompt,
      });

      const plan = planResult.text;

      // Emit the plan to client
      this.emitMessage(io, 'assistant', '\n\n## 📋 Architectural Plan\n\n');
      this.emitMessage(io, 'assistant', plan);
      this.emitMessage(io, 'assistant', '\n\n---\n\n');

      // ==================== PHASE 2: IMPLEMENTATION ====================
      this.emitMessage(io, 'system', 'Phase 2: Implementing application based on plan...');

      // Stream implementation with tools, using plan as additional context
      const implementationPrompt = `User Requirements:
${prompt}

Architectural Plan:
${plan}

Implement the application following this plan exactly. Create all files as specified and ensure everything works together.`;

      const result = streamText({
        model: this.model,
        system: this.getSystemPrompt(),
        prompt: implementationPrompt,
        tools,
        experimental_context: { sessionId, io },
        stopWhen: stepCountIs(MAX_TOOL_CALLS),
        onStepFinish: this.createOnStepFinishHandler(io),
      });

      // Process the full stream for text deltas
      for await (const part of result.fullStream) {
        switch (part.type) {
          case 'text-delta':
            if (part.text) {
              this.emitMessage(io, 'assistant', part.text);
            }
            break;

          case 'finish':
            break;
        }
      }

      // Wait for usage stats
      const [usage, steps, planUsage] = await Promise.all([
        result.usage,
        result.steps,
        planResult.usage,
      ]);

      // Calculate combined metrics (planning + implementation)
      const duration = Date.now() - startTime;
      const totalInputTokens = (usage.inputTokens || 0) + (planUsage.inputTokens || 0);
      const totalOutputTokens = (usage.outputTokens || 0) + (planUsage.outputTokens || 0);
      const metrics = this.calculateMetrics(
        totalInputTokens,
        totalOutputTokens,
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
