import { generateText, stepCountIs, streamText } from 'ai';
import type { Server as SocketIOServer } from 'socket.io';
import {
  ARCHITECTURE_DESCRIPTION,
  FILE_STRUCTURE,
  getPlanFirstImplementationGuidelines,
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
    return `You are an expert full-stack software architect. Your task is to create a detailed implementation plan for a full-stack web application with client, server, and database.

TASK:
Analyze the user's requirements and create a comprehensive architectural plan for a FULL-STACK application that includes:

1. **Architecture Overview**
   - Full-stack monorepo structure (client + server + database)
   - Technology decisions:
     * Client: Vite + React 19 + TypeScript
     * Server: Express 5 + TypeScript
     * Database: Prisma ORM + SQLite
     * Tooling: npm workspaces + concurrently
   - API design (RESTful endpoints)
   - Data flow: Client ↔ Express API ↔ Prisma ↔ SQLite

2. **Database Schema Design**
   - Database models and relationships
   - Field types and constraints
   - Indexes and unique constraints
   - Example Prisma schema structure

3. **API Endpoint Design**
   - Required REST endpoints (GET, POST, PUT, DELETE)
   - Request/response formats
   - Error handling strategy
   - Example Express routes

4. **File Structure**
   - Complete file tree for monorepo
   - Purpose of each major file
   - Dependencies between client and server

5. **Component Design (Client)**
   - Main React components needed
   - State management approach
   - API integration patterns
   - Component hierarchy
   - **UI/UX and Styling approach** - Modern, professional design with proper spacing and colors

6. **Implementation Strategy**
   - Step-by-step implementation order:
     1. Root setup (package.json, .env)
     2. Database schema (prisma/schema.prisma)
     3. Server setup (Express + Prisma)
     4. API routes implementation
     5. Client setup (Vite + React)
     6. Client-server integration
   - Key considerations and potential pitfalls
   - Testing approach

GUIDELINES:
- Design for a monorepo with client/, server/, and prisma/ directories
- Plan RESTful API endpoints that match the data requirements
- Consider database relationships and foreign keys
- Think about CORS and API proxying from client to server
- Use Express 5's automatic async error handling
- Keep database models simple but functional
- **Plan for a visually appealing, well-styled UI** - Include design considerations
- Focus on creating a working full-stack application

OUTPUT FORMAT:
Provide a well-structured plan in markdown format with clear sections. Include:
- Database schema outline
- API endpoints list
- File structure tree
- Component breakdown
- UI/UX styling approach (colors, spacing, layout strategy)
- Implementation steps

This plan will guide the implementation phase to create a complete full-stack app.`;
  }

  getSystemPrompt(): string {
    return `You are an expert full-stack web application generator. Your goal is to create complete, working full-stack applications with client, server, and database based on user requirements and an architectural plan.

CAPABILITIES:
You have access to four tools to build applications:
1. writeFile - Create/update files with content
2. readFile - Read existing file contents
3. listFiles - List files in a directory
4. executeCommand - Run commands (npm install, npm dev, etc.)

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
