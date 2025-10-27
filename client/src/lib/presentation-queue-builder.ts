import type { LLMMessage, ToolCall, ToolResult } from '@gen-fullstack/shared';
import type { CapabilityConfigInput } from '@gen-fullstack/shared';
import type { PresentationEvent } from '../stores/presentationStore';

/**
 * Type guards and interfaces for tool call arguments
 */
interface PlanArchitectureArgs {
  databaseModels?: Array<string | { name: string }>;
  apiEndpoints?: Array<
    string | { method?: string; path: string } | { path: string } | { method: string }
  >;
  apiRoutes?: Array<string | { method?: string; path: string }>;
  uiComponents?: Array<string | { name: string }>;
  clientComponents?: Array<string | { name: string }>;
}

interface RequestBlockArgs {
  blockName?: string;
  blockId?: string;
}

interface WriteFileArgs {
  path?: string;
  file_path?: string;
  fileName?: string;
}

interface ValidationResult {
  passed?: boolean;
  success?: boolean;
  errorCount?: number;
  errors?: unknown[];
  iteration?: number;
}

function safeParse<T>(json: string | unknown): T | null {
  try {
    return typeof json === 'string' ? (JSON.parse(json) as T) : (json as T);
  } catch {
    return null;
  }
}

/**
 * Build presentation event queue from session timeline
 *
 * Parses ALL events upfront to create a showcase-ready sequence
 * Independent of replay timing - events are shown at presentation pace
 *
 * @param messages - All LLM messages from timeline
 * @param toolCalls - All tool calls from timeline
 * @param toolResults - All tool results from timeline
 * @param capabilityConfig - Session capability configuration
 * @returns Array of presentation events with durations and data
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Complex timeline parsing logic that processes multiple tool call types with different data structures
export function buildPresentationQueue(
  messages: LLMMessage[],
  toolCalls: ToolCall[],
  toolResults: ToolResult[],
  capabilityConfig?: CapabilityConfigInput,
  sessionDurationMs?: number,
): PresentationEvent[] {
  const events: PresentationEvent[] = [];

  // 1. Generation start
  events.push({
    type: 'generation-start',
    duration: 6000, // 6 seconds - Loading simulation (2s) + Power-ups (3s) + READY (0.5s) + VIBE CODE (0.5s)
  });

  // 2. Template loading (if template mode)
  if (capabilityConfig?.inputMode === 'template') {
    events.push({
      type: 'template-loading',
      duration: 3000, // 3 seconds
    });
  }

  // 3. Process tool calls in chronological order to match real execution
  let totalFileWrites = 0;

  for (const toolCall of toolCalls) {
    switch (toolCall.name) {
      case 'planArchitecture': {
        const args = safeParse<PlanArchitectureArgs>(toolCall.args);
        if (!args) break;

        // Extract and emit model events
        const models = (args.databaseModels || []).map((m) => (typeof m === 'string' ? m : m.name));
        models.forEach((model: string) => {
          events.push({
            type: 'planning',
            duration: 400,
            data: { planItem: { type: 'model', name: model } },
          });
        });

        // Extract and emit endpoint events
        const endpointsArray = args.apiEndpoints || args.apiRoutes || [];
        const endpoints = endpointsArray.map((e) => {
          if (typeof e === 'string') return e;
          if ('method' in e && 'path' in e && e.method && e.path) return `${e.method} ${e.path}`;
          if ('path' in e && e.path) return e.path;
          return String(e);
        });
        endpoints.forEach((endpoint: string) => {
          events.push({
            type: 'planning',
            duration: 400,
            data: { planItem: { type: 'endpoint', name: endpoint } },
          });
        });

        // Extract and emit component events
        const componentsArray = args.uiComponents || args.clientComponents || [];
        const components = componentsArray.map((c) => (typeof c === 'string' ? c : c.name));
        components.forEach((component: string) => {
          events.push({
            type: 'planning',
            duration: 400,
            data: { planItem: { type: 'component', name: component } },
          });
        });
        break;
      }

      case 'requestBlock': {
        const args = safeParse<RequestBlockArgs>(toolCall.args);
        if (!args) break;

        const blockName = args.blockName || args.blockId || 'Building Block';
        events.push({
          type: 'block-request',
          duration: 3000,
          data: { blockName },
        });
        break;
      }

      case 'validatePrismaSchema':
      case 'validateTypeScript': {
        const validationType = toolCall.name === 'validatePrismaSchema' ? 'prisma' : 'typescript';
        events.push({
          type: validationType === 'prisma' ? 'validation-prisma' : 'validation-typescript',
          duration: 3000,
        });

        // Find the validation result and emit it immediately after
        const toolResult = toolResults.find((r) => r.id === toolCall.id);
        if (toolResult) {
          const result = safeParse<ValidationResult>(toolResult.result);
          if (result) {
            const passed = result.passed === true || result.success === true;
            const errorCount = result.errorCount || result.errors?.length || 0;
            const iteration = result.iteration;

            events.push({
              type: 'validation-result',
              duration: passed ? 2000 : 3000,
              data: {
                validationResult: { passed, errorCount, iteration },
              },
            });
          }
        }
        break;
      }

      case 'writeFile': {
        totalFileWrites++;
        const fileName = extractFileFromToolCall(toolCall);
        events.push({
          type: 'file-created',
          duration: 500,
          data: { fileName: fileName || `file-${totalFileWrites}` },
        });

        // Show combo milestone right after milestone files (5, 10, 20, 30, etc.)
        if (
          totalFileWrites === 5 ||
          totalFileWrites === 10 ||
          (totalFileWrites >= 20 && totalFileWrites % 10 === 0)
        ) {
          events.push({
            type: 'combo-milestone',
            duration: 2000,
            data: { comboMilestone: totalFileWrites },
          });
        }
        break;
      }
    }
  }

  // 4. Check for errors
  const lastMessage = messages[messages.length - 1];
  const hasError = lastMessage?.role === 'system' && lastMessage.content.includes('error');

  if (hasError) {
    events.push({
      type: 'error-ko',
      duration: 4000, // 4 seconds - dramatic K.O.
    });
  } else {
    // 5. Victory screen with stats
    // Use provided session duration or calculate from timestamps
    const sessionDuration = sessionDurationMs
      ? sessionDurationMs / 1000
      : messages.length > 0
        ? (messages[messages.length - 1].timestamp - messages[0].timestamp) / 1000
        : 0;

    events.push({
      type: 'victory',
      duration: 6000, // 6 seconds - celebrate!
      data: {
        stats: {
          duration: sessionDuration,
          toolCalls: toolCalls.length,
          filesCreated: totalFileWrites,
          successRate: 100,
          combos: Math.max(10, totalFileWrites), // Use file count as combo proxy
        },
      },
    });
  }

  return events;
}

/**
 * Extract file path from tool call arguments
 */
function extractFileFromToolCall(toolCall: ToolCall): string | undefined {
  if (!toolCall.args) return undefined;

  const args = safeParse<WriteFileArgs>(toolCall.args);
  return args?.path || args?.file_path || args?.fileName;
}
