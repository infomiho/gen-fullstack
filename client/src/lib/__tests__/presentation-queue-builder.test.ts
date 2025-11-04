import { describe, it, expect } from 'vitest';
import { buildPresentationQueue } from '../presentation-queue-builder';
import type { LLMMessage, ToolCall, PipelineStageEvent } from '@gen-fullstack/shared';
import type { PresentationEvent } from '../../stores/presentationStore';

describe('buildPresentationQueue', () => {
  describe('basic structure', () => {
    it('should always start with generation-start event', () => {
      const queue = buildPresentationQueue([], [], []);

      expect(queue[0]).toEqual({
        type: 'generation-start',
        duration: 6000,
      });
    });

    it('should end with victory event when no errors', () => {
      const messages: LLMMessage[] = [
        { id: '1', role: 'assistant', content: 'Done', timestamp: 1000 },
      ];

      const queue = buildPresentationQueue(messages, [], []);

      const lastEvent = queue[queue.length - 1];
      expect(lastEvent.type).toBe('victory');
      expect(
        (lastEvent as Extract<PresentationEvent, { type: 'victory' }>).data.stats,
      ).toBeDefined();
    });

    it('should end with error-ko event when errors present', () => {
      const messages: LLMMessage[] = [
        { id: '1', role: 'system', content: 'error occurred', timestamp: 1000 },
      ];

      const queue = buildPresentationQueue(messages, [], []);

      const lastEvent = queue[queue.length - 1];
      expect(lastEvent.type).toBe('error-ko');
      expect(lastEvent.duration).toBe(4000);
    });
  });

  describe('template loading pipeline stage', () => {
    it('should add template-loading event when pipeline stage is present', () => {
      const pipelineStages: PipelineStageEvent[] = [
        {
          id: 'stage-1',
          type: 'template_loading' as const,
          status: 'started' as const,
          timestamp: 1000,
          data: {
            templateName: 'vite-fullstack-base',
          },
        },
      ];

      const queue = buildPresentationQueue([], [], pipelineStages);

      expect(queue[1]).toEqual({
        type: 'template-loading',
        duration: 3000,
      });
    });

    it('should not add template-loading event when no template stage present', () => {
      const queue = buildPresentationQueue([], [], []);

      const hasTemplateLoading = queue.some((e) => e.type === 'template-loading');
      expect(hasTemplateLoading).toBe(false);
    });
  });

  describe('planning pipeline stage', () => {
    it('should create planning events for database models', () => {
      const pipelineStages: PipelineStageEvent[] = [
        {
          id: 'stage-1',
          type: 'planning' as const,
          status: 'completed' as const,
          timestamp: 1000,
          data: {
            plan: {
              databaseModels: [
                { name: 'User', fields: [], relations: [] },
                { name: 'Post', fields: [], relations: [] },
              ],
            },
          },
        },
      ];

      const queue = buildPresentationQueue([], [], pipelineStages);

      const planningEvents = queue.filter((e) => e.type === 'planning');
      expect(planningEvents).toHaveLength(2);
      expect(planningEvents[0].data?.planItem).toEqual({ type: 'model', name: 'User' });
      expect(planningEvents[1].data?.planItem).toEqual({ type: 'model', name: 'Post' });
    });

    it('should create planning events for API endpoints', () => {
      const pipelineStages: PipelineStageEvent[] = [
        {
          id: 'stage-1',
          type: 'planning' as const,
          status: 'completed' as const,
          timestamp: 1000,
          data: {
            plan: {
              apiRoutes: [
                { method: 'GET' as const, path: '/users', description: 'Get users' },
                { method: 'POST' as const, path: '/posts', description: 'Create post' },
                { method: 'GET' as const, path: '/comments', description: 'Get comments' },
              ],
            },
          },
        },
      ];

      const queue = buildPresentationQueue([], [], pipelineStages);

      const planningEvents = queue.filter((e) => e.type === 'planning');
      expect(planningEvents).toHaveLength(3);
      expect(planningEvents[0].data?.planItem).toEqual({
        type: 'endpoint',
        name: 'GET /users',
      });
      expect(planningEvents[1].data?.planItem).toEqual({ type: 'endpoint', name: 'POST /posts' });
      expect(planningEvents[2].data?.planItem).toEqual({ type: 'endpoint', name: 'GET /comments' });
    });

    it('should create planning events for UI components', () => {
      const pipelineStages: PipelineStageEvent[] = [
        {
          id: 'stage-1',
          type: 'planning' as const,
          status: 'completed' as const,
          timestamp: 1000,
          data: {
            plan: {
              clientComponents: [
                { name: 'Header', purpose: 'Site header' },
                { name: 'Footer', purpose: 'Site footer' },
              ],
            },
          },
        },
      ];

      const queue = buildPresentationQueue([], [], pipelineStages);

      const planningEvents = queue.filter((e) => e.type === 'planning');
      expect(planningEvents).toHaveLength(2);
      expect(planningEvents[0].data?.planItem).toEqual({ type: 'component', name: 'Header' });
      expect(planningEvents[1].data?.planItem).toEqual({ type: 'component', name: 'Footer' });
    });

    it('should handle planning stage without plan data gracefully', () => {
      const pipelineStages: PipelineStageEvent[] = [
        {
          id: 'stage-1',
          type: 'planning' as const,
          status: 'completed' as const,
          timestamp: 1000,
          data: {},
        },
      ];

      const queue = buildPresentationQueue([], [], pipelineStages);

      // Should not crash, just skip the event
      const planningEvents = queue.filter((e) => e.type === 'planning');
      expect(planningEvents).toHaveLength(0);
    });
  });

  describe('code generation pipeline stage', () => {
    it('should add code-generation event when pipeline stage is present', () => {
      const pipelineStages: PipelineStageEvent[] = [
        {
          id: 'stage-1',
          type: 'code_generation' as const,
          status: 'started' as const,
          timestamp: 1000,
          data: {},
        },
      ];

      const queue = buildPresentationQueue([], [], pipelineStages);

      expect(queue[1]).toEqual({
        type: 'code-generation',
        duration: 2000,
      });
    });

    it('should not add code-generation event when no code generation stage present', () => {
      const queue = buildPresentationQueue([], [], []);

      const hasCodeGen = queue.some((e) => e.type === 'code-generation');
      expect(hasCodeGen).toBe(false);
    });
  });

  describe('error fixing pipeline stage', () => {
    it('should add error-fixing event when pipeline stage is present', () => {
      const pipelineStages: PipelineStageEvent[] = [
        {
          id: 'stage-1',
          type: 'error_fixing' as const,
          status: 'started' as const,
          timestamp: 1000,
          data: {},
        },
      ];

      const queue = buildPresentationQueue([], [], pipelineStages);

      expect(queue[1]).toEqual({
        type: 'error-fixing',
        duration: 3000,
        data: { iteration: undefined, errorCount: undefined },
      });
    });

    it('should include iteration and error count in error-fixing event', () => {
      const pipelineStages: PipelineStageEvent[] = [
        {
          id: 'stage-1',
          type: 'error_fixing' as const,
          status: 'started' as const,
          timestamp: 1000,
          data: {
            iteration: 2,
            errorCount: 5,
          },
        },
      ];

      const queue = buildPresentationQueue([], [], pipelineStages);

      const fixingEvent = queue.find((e) => e.type === 'error-fixing');
      expect(fixingEvent).toBeDefined();
      expect(fixingEvent?.data?.iteration).toBe(2);
      expect(fixingEvent?.data?.errorCount).toBe(5);
      expect(fixingEvent?.duration).toBe(3000);
    });

    it('should not add error-fixing event when no error fixing stage present', () => {
      const queue = buildPresentationQueue([], [], []);

      const hasErrorFixing = queue.some((e) => e.type === 'error-fixing');
      expect(hasErrorFixing).toBe(false);
    });
  });

  describe('requestBlock tool call', () => {
    it('should create block-request event with blockName', () => {
      const toolCalls: ToolCall[] = [
        {
          id: '1',
          name: 'requestBlock',
          args: { blockName: 'auth-password' },
          timestamp: 1000,
        },
      ];

      const queue = buildPresentationQueue([], toolCalls, []);

      const blockEvent = queue.find((e) => e.type === 'block-request');
      expect(blockEvent).toBeDefined();
      expect(blockEvent?.data?.blockName).toBe('auth-password');
      expect(blockEvent?.duration).toBe(3000);
    });

    it('should use blockId as fallback', () => {
      const toolCalls: ToolCall[] = [
        {
          id: '1',
          name: 'requestBlock',
          args: { blockId: 'payment-stripe' },
          timestamp: 1000,
        },
      ];

      const queue = buildPresentationQueue([], toolCalls, []);

      const blockEvent = queue.find((e) => e.type === 'block-request');
      expect(blockEvent?.data?.blockName).toBe('payment-stripe');
    });
  });

  describe('validation pipeline stage', () => {
    it('should create validation events for Prisma schema (replay mode - completed only)', () => {
      const pipelineStages: PipelineStageEvent[] = [
        {
          id: 'stage-1',
          type: 'validation' as const,
          status: 'completed' as const,
          timestamp: 1000,
          data: {
            validationErrors: [],
          },
        },
      ];

      const queue = buildPresentationQueue([], [], pipelineStages);

      const validationEvents = queue.filter((e) => e.type.startsWith('validation'));
      // In replay mode, completed generates both loading + result
      expect(validationEvents).toHaveLength(2);
      expect(validationEvents[0].type).toBe('validation-typescript');
      expect(validationEvents[1].type).toBe('validation-result');
      expect(
        (validationEvents[1] as Extract<PresentationEvent, { type: 'validation-result' }>).data
          .validationResult,
      ).toEqual({
        passed: true,
        errorCount: 0,
        iteration: undefined,
      });
    });

    it('should create validation events for TypeScript (replay mode - completed only)', () => {
      const pipelineStages: PipelineStageEvent[] = [
        {
          id: 'stage-1',
          type: 'validation' as const,
          status: 'completed' as const,
          timestamp: 1000,
          data: {
            validationErrors: [],
          },
        },
      ];

      const queue = buildPresentationQueue([], [], pipelineStages);

      const validationEvents = queue.filter((e) => e.type.startsWith('validation'));
      // In replay mode, completed generates both loading + result
      expect(validationEvents).toHaveLength(2);
      expect(validationEvents[0].type).toBe('validation-typescript');
      expect(validationEvents[1].type).toBe('validation-result');
    });

    it('should handle validation failure (replay mode - completed only)', () => {
      const pipelineStages: PipelineStageEvent[] = [
        {
          id: 'stage-1',
          type: 'validation' as const,
          status: 'completed' as const,
          timestamp: 1000,
          data: {
            validationErrors: [
              { type: 'typescript' as const, file: 'test.ts', message: 'Error 1' },
              { type: 'typescript' as const, file: 'test.ts', message: 'Error 2' },
              { type: 'typescript' as const, file: 'test.ts', message: 'Error 3' },
              { type: 'typescript' as const, file: 'test.ts', message: 'Error 4' },
              { type: 'typescript' as const, file: 'test.ts', message: 'Error 5' },
            ],
            iteration: 2,
          },
        },
      ];

      const queue = buildPresentationQueue([], [], pipelineStages);

      const validationEvents = queue.filter((e) => e.type.startsWith('validation'));
      expect(validationEvents).toHaveLength(2); // loading + result

      const resultEvent = queue.find((e) => e.type === 'validation-result');
      expect(resultEvent?.data?.validationResult).toEqual({
        passed: false,
        errorCount: 5,
        iteration: 2,
      });
      expect(resultEvent?.duration).toBe(2500); // Failed validations have longer duration
    });
  });

  describe('writeFile tool call', () => {
    it('should create file-created event', () => {
      const toolCalls: ToolCall[] = [
        {
          id: '1',
          name: 'writeFile',
          args: { path: 'test.ts' },
          timestamp: 1000,
        },
      ];

      const queue = buildPresentationQueue([], toolCalls, []);

      const fileEvent = queue.find((e) => e.type === 'file-created');
      expect(fileEvent).toBeDefined();
      expect(fileEvent?.data?.fileName).toBe('test.ts');
      expect(fileEvent?.duration).toBe(350); // First file uses longer delay
    });

    it('should create combo-milestone event at 10 files', () => {
      const toolCalls: ToolCall[] = Array.from({ length: 10 }, (_, i) => ({
        id: `${i}`,
        name: 'writeFile',
        args: { path: `file${i}.ts` },
        timestamp: 1000 + i,
      }));

      const queue = buildPresentationQueue([], toolCalls, []);

      const comboEvent = queue.find((e) => e.type === 'combo-milestone');
      expect(comboEvent).toBeDefined();
      expect(comboEvent?.data?.comboMilestone).toBe(10);
    });

    it('should create combo-milestone events at 10, 20, 30 files', () => {
      const toolCalls: ToolCall[] = Array.from({ length: 30 }, (_, i) => ({
        id: `${i}`,
        name: 'writeFile',
        args: { path: `file${i}.ts` },
        timestamp: 1000 + i,
      }));

      const queue = buildPresentationQueue([], toolCalls, []);

      const comboEvents = queue.filter((e) => e.type === 'combo-milestone');
      expect(comboEvents).toHaveLength(3); // At 10, 20, 30
      expect(comboEvents[0].data?.comboMilestone).toBe(10);
      expect(comboEvents[1].data?.comboMilestone).toBe(20);
      expect(comboEvents[2].data?.comboMilestone).toBe(30);
    });

    it('should extract fileName from different arg formats', () => {
      const toolCalls: ToolCall[] = [
        {
          id: '1',
          name: 'writeFile',
          args: { path: 'test1.ts' },
          timestamp: 1000,
        },
        {
          id: '2',
          name: 'writeFile',
          args: { file_path: 'test2.ts' },
          timestamp: 1001,
        },
        {
          id: '3',
          name: 'writeFile',
          args: { fileName: 'test3.ts' },
          timestamp: 1002,
        },
      ];

      const queue = buildPresentationQueue([], toolCalls, []);

      const fileEvents = queue.filter((e) => e.type === 'file-created');
      expect(fileEvents[0].data?.fileName).toBe('test1.ts');
      expect(fileEvents[1].data?.fileName).toBe('test2.ts');
      expect(fileEvents[2].data?.fileName).toBe('test3.ts');
    });

    it('should only show file-created overlay on first write (not modifications)', () => {
      const toolCalls: ToolCall[] = [
        {
          id: '1',
          name: 'writeFile',
          args: { path: 'test.ts' },
          timestamp: 1000,
        },
        {
          id: '2',
          name: 'writeFile',
          args: { path: 'other.ts' },
          timestamp: 1001,
        },
        {
          id: '3',
          name: 'writeFile',
          args: { path: 'test.ts' }, // Duplicate - modification
          timestamp: 1002,
        },
        {
          id: '4',
          name: 'writeFile',
          args: { path: 'other.ts' }, // Duplicate - modification
          timestamp: 1003,
        },
        {
          id: '5',
          name: 'writeFile',
          args: { path: 'new.ts' },
          timestamp: 1004,
        },
      ];

      const queue = buildPresentationQueue([], toolCalls, []);

      const fileEvents = queue.filter((e) => e.type === 'file-created');
      expect(fileEvents).toHaveLength(3); // Only first writes to test.ts, other.ts, and new.ts
      expect(fileEvents[0].data?.fileName).toBe('test.ts');
      expect(fileEvents[1].data?.fileName).toBe('other.ts');
      expect(fileEvents[2].data?.fileName).toBe('new.ts');
    });

    it('should only count unique files toward combo milestones', () => {
      const toolCalls: ToolCall[] = [
        ...Array.from({ length: 10 }, (_, i) => ({
          id: `${i}`,
          name: 'writeFile',
          args: { path: `file${i}.ts` },
          timestamp: 1000 + i,
        })),
        // Duplicate writes (modifications)
        {
          id: '10',
          name: 'writeFile',
          args: { path: 'file0.ts' },
          timestamp: 1010,
        },
        {
          id: '11',
          name: 'writeFile',
          args: { path: 'file1.ts' },
          timestamp: 1011,
        },
      ];

      const queue = buildPresentationQueue([], toolCalls, []);

      const comboEvents = queue.filter((e) => e.type === 'combo-milestone');
      expect(comboEvents).toHaveLength(1); // Only at 10 unique files
      expect(comboEvents[0].data?.comboMilestone).toBe(10);

      const fileEvents = queue.filter((e) => e.type === 'file-created');
      expect(fileEvents).toHaveLength(10); // Only unique files
    });
  });

  describe('victory stats calculation', () => {
    it('should calculate stats correctly', () => {
      const messages: LLMMessage[] = [
        { id: '1', role: 'assistant', content: 'Start', timestamp: 0 },
        { id: '2', role: 'assistant', content: 'End', timestamp: 5000 },
      ];

      const toolCalls: ToolCall[] = [
        {
          id: '1',
          name: 'writeFile',
          args: { path: 'file1.ts' },
          timestamp: 1000,
        },
        {
          id: '2',
          name: 'writeFile',
          args: { path: 'file2.ts' },
          timestamp: 2000,
        },
        {
          id: '3',
          name: 'writeFile',
          args: { path: 'file3.ts' },
          timestamp: 3000,
        },
      ];

      const queue = buildPresentationQueue(messages, toolCalls, []);

      const victoryEvent = queue.find((e) => e.type === 'victory');
      expect(victoryEvent?.data?.stats).toEqual({
        duration: 5, // 5000ms / 1000
        toolCalls: 3,
        filesCreated: 3,
        successRate: 100,
        combos: 10, // Max of 10 or filesCreated (3)
      });
    });

    it('should use provided sessionDurationMs if available', () => {
      const messages: LLMMessage[] = [
        { id: '1', role: 'assistant', content: 'Done', timestamp: 1000 },
      ];

      const queue = buildPresentationQueue(messages, [], [], 12345);

      const victoryEvent = queue.find((e) => e.type === 'victory');
      expect(victoryEvent?.data?.stats?.duration).toBe(12.345); // 12345ms / 1000
    });
  });

  describe('edge cases', () => {
    it('should handle empty timeline', () => {
      const queue = buildPresentationQueue([], [], []);

      expect(queue.length).toBeGreaterThan(0);
      expect(queue[0].type).toBe('generation-start');
      expect(queue[queue.length - 1].type).toBe('victory');
    });

    it('should handle tool calls without args', () => {
      const toolCalls: ToolCall[] = [
        {
          id: '1',
          name: 'writeFile',
          args: undefined,
          timestamp: 1000,
        },
      ];

      const queue = buildPresentationQueue([], toolCalls, []);

      // Should not crash
      const fileEvents = queue.filter((e) => e.type === 'file-created');
      expect(fileEvents).toHaveLength(1);
    });

    it('should handle pre-parsed args object', () => {
      const toolCalls: ToolCall[] = [
        {
          id: '1',
          name: 'writeFile',
          args: { path: 'test.ts' } as any,
          timestamp: 1000,
        },
      ];

      const queue = buildPresentationQueue([], toolCalls, []);

      const fileEvent = queue.find((e) => e.type === 'file-created');
      expect(fileEvent?.data?.fileName).toBe('test.ts');
    });
  });
});
