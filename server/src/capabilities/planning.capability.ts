import { generateText } from 'ai';
import { getErrorMessage } from '../lib/error-utils.js';
import { calculateCost } from '../services/llm.service.js';
import type { CapabilityContext, CapabilityResult } from '../types/index.js';
import { BaseCapability } from './base.capability.js';

/**
 * Planning Capability
 *
 * Generates a high-level architectural plan before code generation.
 * This helps maintain consistency and ensures all requirements are addressed systematically.
 *
 * Features:
 * - Creates strategic architectural overview
 * - Defines data model, API architecture, and UI structure
 * - Single LLM call (no tools, no streaming)
 * - Updates context with plan for subsequent capabilities
 */
export class PlanningCapability extends BaseCapability {
  getName(): string {
    return 'Planning';
  }

  private getPlanningPrompt(): string {
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

  async execute(context: CapabilityContext): Promise<CapabilityResult> {
    const { sessionId, prompt, abortSignal } = context;

    try {
      this.emitStatus('Phase 1: Generating architectural plan...', context);

      // Generate plan without tools (single call, no streaming)
      const planResult = await generateText({
        model: this.model,
        system: this.getPlanningPrompt(),
        prompt,
        abortSignal,
      });

      const plan = planResult.text;

      // Emit the plan to client
      this.emitMessage('assistant', '\n\n## 📋 Architectural Plan\n\n', sessionId);
      this.emitMessage('assistant', plan, sessionId);
      this.emitMessage('assistant', '\n\n---\n\n', sessionId);

      // Get token usage and calculate cost
      const usage = await planResult.usage;
      const inputTokens = usage.inputTokens || 0;
      const outputTokens = usage.outputTokens || 0;
      const cost = calculateCost(this.modelName, inputTokens, outputTokens);

      this.logger.info(
        {
          sessionId,
          inputTokens,
          outputTokens,
          cost,
          planLength: plan.length,
        },
        'Planning phase completed',
      );

      return {
        success: true,
        tokensUsed: {
          input: inputTokens,
          output: outputTokens,
        },
        cost, // Include cost in result
        toolCalls: 0, // Planning doesn't use tools
        contextUpdates: {
          plan, // Store plan in context for code generation phase
        },
      };
    } catch (error) {
      const errorMessage = `Planning capability failed: ${getErrorMessage(error)}`;
      this.logger.error({ error, sessionId }, errorMessage);

      return {
        success: false,
        error: errorMessage,
        toolCalls: 0,
      };
    }
  }
}
