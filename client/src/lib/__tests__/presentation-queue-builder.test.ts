import { describe, it, expect } from 'vitest';
import { buildPresentationQueue } from '../presentation-queue-builder';
import type { LLMMessage, ToolCall, ToolResult } from '@gen-fullstack/shared';
import type { CapabilityConfigInput } from '@gen-fullstack/shared';

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
      expect(lastEvent.data?.stats).toBeDefined();
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

  describe('template mode', () => {
    it('should add template-loading event when inputMode is template', () => {
      const config: CapabilityConfigInput = {
        inputMode: 'template',
        planning: false,
        compilerChecks: false,
        templateOptions: { templateName: 'vite-fullstack-base' },
      };

      const queue = buildPresentationQueue([], [], [], config);

      expect(queue[1]).toEqual({
        type: 'template-loading',
        duration: 3000,
      });
    });

    it('should not add template-loading event when inputMode is naive', () => {
      const config: CapabilityConfigInput = {
        inputMode: 'naive',
        planning: false,
        compilerChecks: false,
      };

      const queue = buildPresentationQueue([], [], [], config);

      const hasTemplateLoading = queue.some((e) => e.type === 'template-loading');
      expect(hasTemplateLoading).toBe(false);
    });
  });

  describe('planArchitecture tool call', () => {
    it('should create planning events for database models', () => {
      const toolCalls: ToolCall[] = [
        {
          id: '1',
          name: 'planArchitecture',
          args: {
            databaseModels: ['User', { name: 'Post' }],
          },
          timestamp: 1000,
        },
      ];

      const queue = buildPresentationQueue([], toolCalls, []);

      const planningEvents = queue.filter((e) => e.type === 'planning');
      expect(planningEvents).toHaveLength(2);
      expect(planningEvents[0].data?.planItem).toEqual({ type: 'model', name: 'User' });
      expect(planningEvents[1].data?.planItem).toEqual({ type: 'model', name: 'Post' });
    });

    it('should create planning events for API endpoints', () => {
      const toolCalls: ToolCall[] = [
        {
          id: '1',
          name: 'planArchitecture',
          args: {
            apiEndpoints: [{ method: 'GET', path: '/users' }, { path: '/posts' }, '/comments'],
          },
          timestamp: 1000,
        },
      ];

      const queue = buildPresentationQueue([], toolCalls, []);

      const planningEvents = queue.filter((e) => e.type === 'planning');
      expect(planningEvents).toHaveLength(3);
      expect(planningEvents[0].data?.planItem).toEqual({
        type: 'endpoint',
        name: 'GET /users',
      });
      expect(planningEvents[1].data?.planItem).toEqual({ type: 'endpoint', name: '/posts' });
      expect(planningEvents[2].data?.planItem).toEqual({ type: 'endpoint', name: '/comments' });
    });

    it('should create planning events for UI components', () => {
      const toolCalls: ToolCall[] = [
        {
          id: '1',
          name: 'planArchitecture',
          args: {
            uiComponents: ['Header', { name: 'Footer' }],
          },
          timestamp: 1000,
        },
      ];

      const queue = buildPresentationQueue([], toolCalls, []);

      const planningEvents = queue.filter((e) => e.type === 'planning');
      expect(planningEvents).toHaveLength(2);
      expect(planningEvents[0].data?.planItem).toEqual({ type: 'component', name: 'Header' });
      expect(planningEvents[1].data?.planItem).toEqual({ type: 'component', name: 'Footer' });
    });

    it('should handle malformed planArchitecture args gracefully', () => {
      const toolCalls: ToolCall[] = [
        {
          id: '1',
          name: 'planArchitecture',
          args: undefined,
          timestamp: 1000,
        },
      ];

      const queue = buildPresentationQueue([], toolCalls, []);

      // Should not crash, just skip the event
      const planningEvents = queue.filter((e) => e.type === 'planning');
      expect(planningEvents).toHaveLength(0);
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

  describe('validation tool calls', () => {
    it('should create validation events for Prisma schema', () => {
      const toolCalls: ToolCall[] = [
        {
          id: '1',
          name: 'validatePrismaSchema',
          args: {},
          timestamp: 1000,
        },
      ];

      const toolResults: ToolResult[] = [
        {
          id: '1',
          toolName: 'validatePrismaSchema',
          result: JSON.stringify({ passed: true, errorCount: 0 }),
          timestamp: 1500,
        },
      ];

      const queue = buildPresentationQueue([], toolCalls, toolResults);

      const validationEvents = queue.filter((e) => e.type.startsWith('validation'));
      expect(validationEvents).toHaveLength(2);
      expect(validationEvents[0].type).toBe('validation-prisma');
      expect(validationEvents[1].type).toBe('validation-result');
      expect(validationEvents[1].data?.validationResult).toEqual({
        passed: true,
        errorCount: 0,
        iteration: undefined,
      });
    });

    it('should create validation events for TypeScript', () => {
      const toolCalls: ToolCall[] = [
        {
          id: '1',
          name: 'validateTypeScript',
          args: {},
          timestamp: 1000,
        },
      ];

      const toolResults: ToolResult[] = [
        {
          id: '1',
          toolName: 'validateTypeScript',
          result: JSON.stringify({ success: true, errors: [] }),
          timestamp: 1500,
        },
      ];

      const queue = buildPresentationQueue([], toolCalls, toolResults);

      const validationEvents = queue.filter((e) => e.type.startsWith('validation'));
      expect(validationEvents).toHaveLength(2);
      expect(validationEvents[0].type).toBe('validation-typescript');
      expect(validationEvents[1].type).toBe('validation-result');
    });

    it('should handle validation failure', () => {
      const toolCalls: ToolCall[] = [
        {
          id: '1',
          name: 'validateTypeScript',
          args: {},
          timestamp: 1000,
        },
      ];

      const toolResults: ToolResult[] = [
        {
          id: '1',
          toolName: 'validateTypeScript',
          result: JSON.stringify({ passed: false, errorCount: 5, iteration: 2 }),
          timestamp: 1500,
        },
      ];

      const queue = buildPresentationQueue([], toolCalls, toolResults);

      const resultEvent = queue.find((e) => e.type === 'validation-result');
      expect(resultEvent?.data?.validationResult).toEqual({
        passed: false,
        errorCount: 5,
        iteration: 2,
      });
      expect(resultEvent?.duration).toBe(3000); // Failed validations have longer duration
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
      expect(fileEvent?.duration).toBe(500);
    });

    it('should create combo-milestone event at 5 files', () => {
      const toolCalls: ToolCall[] = Array.from({ length: 5 }, (_, i) => ({
        id: `${i}`,
        name: 'writeFile',
        args: { path: `file${i}.ts` },
        timestamp: 1000 + i,
      }));

      const queue = buildPresentationQueue([], toolCalls, []);

      const comboEvent = queue.find((e) => e.type === 'combo-milestone');
      expect(comboEvent).toBeDefined();
      expect(comboEvent?.data?.comboMilestone).toBe(5);
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
      expect(comboEvents).toHaveLength(4); // At 5, 10, 20, 30
      expect(comboEvents[0].data?.comboMilestone).toBe(5);
      expect(comboEvents[1].data?.comboMilestone).toBe(10);
      expect(comboEvents[2].data?.comboMilestone).toBe(20);
      expect(comboEvents[3].data?.comboMilestone).toBe(30);
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

      const queue = buildPresentationQueue(messages, [], [], undefined, 12345);

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
