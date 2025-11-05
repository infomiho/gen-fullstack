import type { Server as SocketIOServer } from 'socket.io';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_MODEL } from '@gen-fullstack/shared';
import { databaseService } from '../../services/database.service.js';
import type { CapabilityContext } from '../../types/index.js';
import { UnifiedCodeGenerationCapability } from '../unified-code-generation.capability.js';

// Mock dependencies
vi.mock('../../services/database.service.js', () => ({
  databaseService: {
    updateSession: vi.fn().mockResolvedValue({
      id: 'test-session-id',
      prompt: 'Build a todo app',
      systemPrompt: null,
      fullUserPrompt: null,
      capabilityConfig: '{}',
      status: 'generating' as const,
      createdAt: new Date(),
      updatedAt: null,
      completedAt: null,
      errorMessage: null,
      inputTokens: null,
      outputTokens: null,
      totalTokens: null,
      cost: null,
      durationMs: null,
      stepCount: null,
    }),
    upsertMessage: vi.fn().mockResolvedValue(undefined),
    upsertToolCall: vi.fn().mockResolvedValue(undefined),
    upsertToolResult: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();
  return {
    ...actual,
    streamText: vi.fn(() => ({
      fullStream: (async function* () {
        yield { type: 'finish' };
      })(),
      usage: Promise.resolve({ inputTokens: 100, outputTokens: 50 }),
      steps: Promise.resolve([]),
    })),
    stepCountIs: vi.fn((n: number) => n),
  };
});

vi.mock('../../config/prompt-builder.js', () => ({
  buildSystemPrompt: vi.fn((config) => {
    const parts = ['BASE_SYSTEM_PROMPT'];
    if (config.inputMode === 'template') parts.push('Pre-configured Template');
    if (config.planning) parts.push('Planning addon');
    if (config.compilerChecks) parts.push('Compiler Validation');
    if (config.buildingBlocks) parts.push('Building Blocks addon');
    return parts.join('\n\n');
  }),
  buildUserPrompt: vi.fn((prompt, plan) => {
    if (!plan) return prompt;
    // Format plan object into readable text
    const planText = [
      'ARCHITECTURAL PLAN:',
      plan.databaseModels
        ? `\nDatabase Models:\n${plan.databaseModels.map((m: any) => `- ${m.name}`).join('\n')}`
        : '',
      plan.apiRoutes
        ? `\nAPI Routes:\n${plan.apiRoutes.map((r: any) => `- ${r.method} ${r.path}`).join('\n')}`
        : '',
      plan.clientComponents
        ? `\nClient Components:\n${plan.clientComponents.map((c: any) => `- ${c.name}`).join('\n')}`
        : '',
    ]
      .filter(Boolean)
      .join('\n');
    return `${planText}\n\nUSER REQUIREMENTS:\n${prompt}`;
  }),
}));

describe('UnifiedCodeGenerationCapability - Prompt Storage', () => {
  let capability: UnifiedCodeGenerationCapability;
  let mockIo: Partial<SocketIOServer>;
  let emitSpy: ReturnType<typeof vi.fn>;
  let toSpy: ReturnType<typeof vi.fn>;
  let context: CapabilityContext;

  beforeEach(() => {
    emitSpy = vi.fn();
    toSpy = vi.fn().mockReturnValue({ emit: emitSpy });
    mockIo = {
      to: toSpy,
    } as unknown as Partial<SocketIOServer>;

    const config = {
      inputMode: 'naive' as const,
      planning: false,
      buildingBlocks: false,
      compilerChecks: false,
      maxIterations: 1,
    };

    capability = new UnifiedCodeGenerationCapability(
      DEFAULT_MODEL, // 'gpt-5-mini'
      mockIo as SocketIOServer,
      config,
    );

    context = {
      sessionId: 'test-session-id',
      prompt: 'Build a todo app',
      sandboxPath: '/tmp/test',
      tokens: { input: 0, output: 0, total: 0 },
      cost: 0,
      toolCalls: 0,
      startTime: Date.now(),
      abortSignal: new AbortController().signal,
    };

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should store system prompt in database', async () => {
    await capability.execute(context);

    expect(databaseService.updateSession).toHaveBeenCalledWith(
      'test-session-id',
      expect.objectContaining({
        systemPrompt: expect.stringContaining('BASE_SYSTEM_PROMPT'),
      }),
    );
  });

  it('should store user prompt in database', async () => {
    await capability.execute(context);

    expect(databaseService.updateSession).toHaveBeenCalledWith(
      'test-session-id',
      expect.objectContaining({
        fullUserPrompt: 'Build a todo app',
      }),
    );
  });

  it('should store full user prompt with architectural plan when present', async () => {
    const contextWithPlan = {
      ...context,
      plan: {
        databaseModels: [
          { name: 'User', fields: ['id String @id', 'name String'] },
          { name: 'Task', fields: ['id String @id', 'title String'] },
        ],
        apiRoutes: [{ method: 'GET' as const, path: '/api/users', description: 'Get all users' }],
        clientComponents: [{ name: 'UserList', purpose: 'Display list of users' }],
      },
    };

    await capability.execute(contextWithPlan);

    expect(databaseService.updateSession).toHaveBeenCalledWith(
      'test-session-id',
      expect.objectContaining({
        fullUserPrompt: expect.stringContaining('Database Models:'),
      }),
    );

    const updateCall = vi.mocked(databaseService.updateSession).mock.calls[0];
    expect(updateCall[1].fullUserPrompt).toContain('Build a todo app');
    expect(updateCall[1].fullUserPrompt).toContain('ARCHITECTURAL PLAN:');
  });

  it('should include template addon in system prompt when inputMode is template', async () => {
    const configWithTemplate = {
      inputMode: 'template' as const,
      planning: false,
      buildingBlocks: false,
      compilerChecks: false,
      maxIterations: 1,
    };

    capability = new UnifiedCodeGenerationCapability(
      DEFAULT_MODEL, // 'gpt-5-mini'
      mockIo as SocketIOServer,
      configWithTemplate,
    );

    await capability.execute(context);

    expect(databaseService.updateSession).toHaveBeenCalledWith(
      'test-session-id',
      expect.objectContaining({
        systemPrompt: expect.stringContaining('Pre-configured Template'),
      }),
    );
  });

  it('should include compiler checks addon in system prompt when enabled', async () => {
    const configWithCompilerChecks = {
      inputMode: 'naive' as const,
      planning: false,
      buildingBlocks: false,
      compilerChecks: true,
      maxIterations: 1,
    };

    capability = new UnifiedCodeGenerationCapability(
      DEFAULT_MODEL, // 'gpt-5-mini'
      mockIo as SocketIOServer,
      configWithCompilerChecks,
    );

    await capability.execute(context);

    expect(databaseService.updateSession).toHaveBeenCalledWith(
      'test-session-id',
      expect.objectContaining({
        systemPrompt: expect.stringContaining('Compiler Validation'),
      }),
    );
  });

  it('should include multiple addons when multiple features are enabled', async () => {
    const configWithMultiple = {
      inputMode: 'template' as const,
      planning: true,
      buildingBlocks: true,
      compilerChecks: true,
      maxIterations: 1,
    };

    capability = new UnifiedCodeGenerationCapability(
      DEFAULT_MODEL, // 'gpt-5-mini'
      mockIo as SocketIOServer,
      configWithMultiple,
    );

    await capability.execute(context);

    const updateCall = vi.mocked(databaseService.updateSession).mock.calls[0];
    const systemPrompt = updateCall[1].systemPrompt;

    expect(systemPrompt).toContain('BASE_SYSTEM_PROMPT');
    expect(systemPrompt).toContain('Pre-configured Template');
    expect(systemPrompt).toContain('Planning addon');
    expect(systemPrompt).toContain('Building Blocks addon');
    expect(systemPrompt).toContain('Compiler Validation');
  });

  it('should not fail generation if prompt storage fails', async () => {
    // Mock updateSession to throw an error
    const mockUpdateSession = vi.mocked(databaseService.updateSession);
    mockUpdateSession.mockRejectedValueOnce(new Error('Database connection lost'));

    // Should not throw - generation should continue
    const result = await capability.execute(context);

    expect(result.success).toBe(true);
  });

  it('should store both prompts before LLM streaming starts', async () => {
    const executionOrder: string[] = [];

    vi.mocked(databaseService.updateSession).mockImplementation(async () => {
      executionOrder.push('updateSession');
      return {
        id: 'test-session-id',
        prompt: 'Build a todo app',
        model: null,
        systemPrompt: null,
        fullUserPrompt: null,
        capabilityConfig: '{}',
        status: 'generating' as const,
        createdAt: new Date(),
        updatedAt: null,
        completedAt: null,
        errorMessage: null,
        inputTokens: null,
        outputTokens: null,
        totalTokens: null,
        cost: null,
        durationMs: null,
        stepCount: null,
      };
    });

    // Mock streamText to track when it's called
    const { streamText } = await import('ai');
    vi.mocked(streamText).mockImplementation((() => {
      executionOrder.push('streamText');
      return {
        fullStream: (async function* () {
          yield { type: 'finish' };
        })(),
        usage: Promise.resolve({ inputTokens: 100, outputTokens: 50 }),
        steps: Promise.resolve([]),
      };
    }) as any);

    await capability.execute(context);

    // updateSession should be called before streamText
    expect(executionOrder[0]).toBe('updateSession');
    expect(executionOrder[1]).toBe('streamText');
  });
});
