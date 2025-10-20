import { generateText, stepCountIs, streamText } from 'ai';
import type { Server as SocketIOServer } from 'socket.io';
import {
  ARCHITECTURE_DESCRIPTION,
  DOMAIN_SPECIFIC_WARNING,
  FILE_STRUCTURE,
  getPlanFirstImplementationGuidelines,
  SYSTEM_PROMPT_INTRO,
  TOOL_CAPABILITIES,
} from '../config/prompt-snippets.js';
import { tools } from '../tools/index.js';
import type { ClientToServerEvents, ServerToClientEvents } from '../types/index.js';
import { BaseStrategy, type GenerationMetrics } from './base.strategy.js';

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
    return `You are an expert full-stack software architect. Your task is to create a concise, high-level architectural plan for a full-stack web application.

TASK:
Analyze the user's requirements and create a strategic architectural overview for a FULL-STACK application.

ARCHITECTURE CONTEXT:
- Tech Stack: Vite + React 19, Express 5, Prisma + SQLite, TypeScript
- Structure: Monorepo with npm workspaces (client/, server/, prisma/)

PLAN SECTIONS (Keep each section concise):

1. **Data Model** (2-4 sentences)
   - Core database entities and their relationships
   - Key fields and constraints
   - Why this model fits the requirements

2. **API Architecture** (2-4 sentences)
   - Main API endpoints needed (high-level grouping)
   - Data flow between client and server
   - Key architectural decisions

3. **UI Structure** (2-4 sentences)
   - Main UI sections/pages
   - Component organization approach
   - Styling and design direction

4. **Key Implementation Notes** (2-3 bullet points)
   - Critical technical considerations
   - Potential challenges to watch for

GUIDELINES:
- Keep it strategic and concise - aim for ~200-300 words total
- Focus on "what" and "why", not "how"
- Avoid step-by-step implementation details
- No code examples or file listings
- Think architecture, not implementation

OUTPUT FORMAT:
Provide a brief markdown plan with the 4 sections above. Be direct and concise.`;
  }

  getSystemPrompt(): string {
    return `${SYSTEM_PROMPT_INTRO}

You will be implementing an architectural plan that has already been created.

${DOMAIN_SPECIFIC_WARNING}

${TOOL_CAPABILITIES}

${ARCHITECTURE_DESCRIPTION}

${FILE_STRUCTURE}

${getPlanFirstImplementationGuidelines()}`;
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
        abortSignal: this.getAbortSignal(),
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
        abortSignal: this.getAbortSignal(),
      });

      // Process stream and get implementation metrics
      const implMetrics = await this.processStreamResult(io, result, startTime);

      // Get planning usage stats
      const planUsage = await planResult.usage;

      // Calculate combined metrics (planning + implementation)
      const totalInputTokens = implMetrics.inputTokens + (planUsage.inputTokens || 0);
      const totalOutputTokens = implMetrics.outputTokens + (planUsage.outputTokens || 0);
      // Add 1 for the planning step + implementation steps
      const totalSteps = 1 + implMetrics.steps;
      const metrics = this.calculateMetrics(
        totalInputTokens,
        totalOutputTokens,
        implMetrics.duration,
        totalSteps,
      );

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
