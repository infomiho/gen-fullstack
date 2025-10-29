import { describe, it, expect } from 'vitest';
import type { PipelineStageEvent, ToolCall } from '@gen-fullstack/shared';
import type { PresentationEvent } from '../../stores/presentationStore';
import {
  parseTemplateLoadingStage,
  parsePlanningStage,
  parseCodeGenerationStage,
  parseValidationStage,
  parseErrorFixingStage,
  parseBlockRequestTool,
  parseWriteFileTool,
  extractFileFromToolCall,
} from '../presentation-event-parsers';

describe('presentation-event-parsers', () => {
  describe('extractFileFromToolCall', () => {
    it('should extract path from args', () => {
      const toolCall: ToolCall = {
        id: '1',
        name: 'writeFile',
        args: { path: 'test.ts' },
        timestamp: 1000,
      };

      expect(extractFileFromToolCall(toolCall)).toBe('test.ts');
    });

    it('should extract file_path from args', () => {
      const toolCall: ToolCall = {
        id: '1',
        name: 'writeFile',
        args: { file_path: 'test.ts' },
        timestamp: 1000,
      };

      expect(extractFileFromToolCall(toolCall)).toBe('test.ts');
    });

    it('should extract fileName from args', () => {
      const toolCall: ToolCall = {
        id: '1',
        name: 'writeFile',
        args: { fileName: 'test.ts' },
        timestamp: 1000,
      };

      expect(extractFileFromToolCall(toolCall)).toBe('test.ts');
    });

    it('should return undefined if no file path in args', () => {
      const toolCall: ToolCall = {
        id: '1',
        name: 'writeFile',
        args: { content: 'test' },
        timestamp: 1000,
      };

      expect(extractFileFromToolCall(toolCall)).toBeUndefined();
    });

    it('should return undefined if args is null', () => {
      const toolCall: ToolCall = {
        id: '1',
        name: 'writeFile',
        args: undefined,
        timestamp: 1000,
      };

      expect(extractFileFromToolCall(toolCall)).toBeUndefined();
    });
  });

  describe('parseTemplateLoadingStage', () => {
    it('should parse started template loading stage', () => {
      const stage: PipelineStageEvent = {
        id: 'stage-1',
        type: 'template_loading',
        status: 'started',
        timestamp: 1000,
        data: {},
      };

      const result = parseTemplateLoadingStage(stage);

      expect(result).toEqual({
        type: 'template-loading',
        duration: 3000,
      });
    });

    it('should parse completed template loading stage (for replay mode)', () => {
      const stage: PipelineStageEvent = {
        id: 'stage-1',
        type: 'template_loading',
        status: 'completed',
        timestamp: 1000,
        data: {},
      };

      const result = parseTemplateLoadingStage(stage);

      expect(result).toEqual({
        type: 'template-loading',
        duration: 3000,
      });
    });

    it('should return null for failed status', () => {
      const stage: PipelineStageEvent = {
        id: 'stage-1',
        type: 'template_loading',
        status: 'failed',
        timestamp: 1000,
        data: {},
      };

      expect(parseTemplateLoadingStage(stage)).toBeNull();
    });
  });

  describe('parsePlanningStage', () => {
    it('should parse database models', () => {
      const stage: PipelineStageEvent = {
        id: 'stage-1',
        type: 'planning',
        status: 'completed',
        timestamp: 1000,
        data: {
          plan: {
            databaseModels: [
              { name: 'User', fields: [], relations: [] },
              { name: 'Post', fields: [], relations: [] },
            ],
          },
        },
      };

      const result = parsePlanningStage(stage);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        type: 'planning',
        duration: 400,
        data: { planItem: { type: 'model', name: 'User' } },
      });
      expect(result[1]).toEqual({
        type: 'planning',
        duration: 400,
        data: { planItem: { type: 'model', name: 'Post' } },
      });
    });

    it('should parse API routes', () => {
      const stage: PipelineStageEvent = {
        id: 'stage-1',
        type: 'planning',
        status: 'completed',
        timestamp: 1000,
        data: {
          plan: {
            apiRoutes: [
              { method: 'GET' as const, path: '/users', description: 'Get users' },
              { method: 'POST' as const, path: '/posts', description: 'Create post' },
            ],
          },
        },
      };

      const result = parsePlanningStage(stage);

      expect(result).toHaveLength(2);
      expect((result[0] as Extract<PresentationEvent, { type: 'planning' }>).data.planItem).toEqual(
        {
          type: 'endpoint',
          name: 'GET /users',
        },
      );
      expect((result[1] as Extract<PresentationEvent, { type: 'planning' }>).data.planItem).toEqual(
        {
          type: 'endpoint',
          name: 'POST /posts',
        },
      );
    });

    it('should parse client components', () => {
      const stage: PipelineStageEvent = {
        id: 'stage-1',
        type: 'planning',
        status: 'completed',
        timestamp: 1000,
        data: {
          plan: {
            clientComponents: [
              { name: 'Header', purpose: 'Site header' },
              { name: 'Footer', purpose: 'Site footer' },
            ],
          },
        },
      };

      const result = parsePlanningStage(stage);

      expect(result).toHaveLength(2);
      expect((result[0] as Extract<PresentationEvent, { type: 'planning' }>).data.planItem).toEqual(
        {
          type: 'component',
          name: 'Header',
        },
      );
      expect((result[1] as Extract<PresentationEvent, { type: 'planning' }>).data.planItem).toEqual(
        {
          type: 'component',
          name: 'Footer',
        },
      );
    });

    it('should include method in route name', () => {
      const stage: PipelineStageEvent = {
        id: 'stage-1',
        type: 'planning',
        status: 'completed',
        timestamp: 1000,
        data: {
          plan: {
            apiRoutes: [{ path: '/users', method: 'GET', description: 'Get users' }],
          },
        },
      };

      const result = parsePlanningStage(stage);

      expect((result[0] as Extract<PresentationEvent, { type: 'planning' }>).data.planItem).toEqual(
        {
          type: 'endpoint',
          name: 'GET /users',
        },
      );
    });

    it('should return empty array if no plan data', () => {
      const stage: PipelineStageEvent = {
        id: 'stage-1',
        type: 'planning',
        status: 'completed',
        timestamp: 1000,
        data: {},
      };

      expect(parsePlanningStage(stage)).toEqual([]);
    });

    it('should return empty array for non-completed status', () => {
      const stage: PipelineStageEvent = {
        id: 'stage-1',
        type: 'planning',
        status: 'started',
        timestamp: 1000,
        data: {
          plan: {
            databaseModels: [{ name: 'User', fields: [], relations: [] }],
          },
        },
      };

      expect(parsePlanningStage(stage)).toEqual([]);
    });
  });

  describe('parseCodeGenerationStage', () => {
    it('should parse started code generation stage', () => {
      const stage: PipelineStageEvent = {
        id: 'stage-1',
        type: 'code_generation',
        status: 'started',
        timestamp: 1000,
        data: {},
      };

      const result = parseCodeGenerationStage(stage);

      expect(result).toEqual({
        type: 'code-generation',
        duration: 2000,
      });
    });

    it('should parse completed code generation stage (for replay mode)', () => {
      const stage: PipelineStageEvent = {
        id: 'stage-1',
        type: 'code_generation',
        status: 'completed',
        timestamp: 1000,
        data: {},
      };

      const result = parseCodeGenerationStage(stage);

      expect(result).toEqual({
        type: 'code-generation',
        duration: 2000,
      });
    });

    it('should return null for failed status', () => {
      const stage: PipelineStageEvent = {
        id: 'stage-1',
        type: 'code_generation',
        status: 'failed',
        timestamp: 1000,
        data: {},
      };

      expect(parseCodeGenerationStage(stage)).toBeNull();
    });
  });

  describe('parseValidationStage', () => {
    it('should parse Prisma validation started (live mode)', () => {
      const stage: PipelineStageEvent = {
        id: 'stage-1',
        type: 'validation',
        status: 'started',
        timestamp: 1000,
        data: {
          validationErrors: [{ type: 'prisma' as const, file: 'schema.prisma', message: 'Error' }],
        },
      };

      const result = parseValidationStage(stage);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: 'validation-prisma',
        duration: 2000,
      });
    });

    it('should parse TypeScript validation started (live mode)', () => {
      const stage: PipelineStageEvent = {
        id: 'stage-1',
        type: 'validation',
        status: 'started',
        timestamp: 1000,
        data: {
          validationErrors: [{ type: 'typescript' as const, file: 'test.ts', message: 'Error' }],
        },
      };

      const result = parseValidationStage(stage);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: 'validation-typescript',
        duration: 2000,
      });
    });

    it('should parse validation completed with both loading and result (replay mode)', () => {
      const stage: PipelineStageEvent = {
        id: 'stage-1',
        type: 'validation',
        status: 'completed',
        timestamp: 1000,
        data: {
          validationErrors: [],
        },
      };

      const result = parseValidationStage(stage);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        type: 'validation-typescript',
        duration: 2000,
      });
      expect(result[1]).toEqual({
        type: 'validation-result',
        duration: 2000,
        data: {
          validationResult: { passed: true, errorCount: 0, iteration: undefined },
        },
      });
    });

    it('should parse validation with errors showing both loading and result', () => {
      const stage: PipelineStageEvent = {
        id: 'stage-1',
        type: 'validation',
        status: 'completed',
        timestamp: 1000,
        data: {
          validationErrors: [
            { type: 'typescript' as const, file: 'test.ts', message: 'Error 1' },
            { type: 'typescript' as const, file: 'test.ts', message: 'Error 2' },
          ],
          iteration: 1,
        },
      };

      const result = parseValidationStage(stage);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        type: 'validation-typescript',
        duration: 2000,
      });
      expect(result[1]).toEqual({
        type: 'validation-result',
        duration: 2500,
        data: {
          validationResult: { passed: false, errorCount: 2, iteration: 1 },
        },
      });
    });

    it('should detect Prisma errors in completed stage', () => {
      const stage: PipelineStageEvent = {
        id: 'stage-1',
        type: 'validation',
        status: 'completed',
        timestamp: 1000,
        data: {
          validationErrors: [
            { type: 'prisma' as const, file: 'schema.prisma', message: 'Error 1' },
          ],
          iteration: 1,
        },
      };

      const result = parseValidationStage(stage);

      expect(result).toHaveLength(2);
      expect(result[0].type).toBe('validation-prisma');
      expect(result[1].type).toBe('validation-result');
    });

    it('should parse validation failed', () => {
      const stage: PipelineStageEvent = {
        id: 'stage-1',
        type: 'validation',
        status: 'failed',
        timestamp: 1000,
        data: {
          validationErrors: [
            { type: 'typescript' as const, file: 'test.ts', message: 'Error 1' },
            { type: 'typescript' as const, file: 'test.ts', message: 'Error 2' },
          ],
          iteration: 2,
        },
      };

      const result = parseValidationStage(stage);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        type: 'validation-typescript',
        duration: 2000,
      });
      expect(result[1]).toEqual({
        type: 'validation-result',
        duration: 2500,
        data: {
          validationResult: { passed: false, errorCount: 2, iteration: 2 },
        },
      });
    });

    it('should return empty array for unknown status', () => {
      const stage: PipelineStageEvent = {
        id: 'stage-1',
        type: 'validation',
        status: 'started',
        timestamp: 1000,
        data: {},
      };

      // No validation errors means it defaults to typescript
      const result = parseValidationStage(stage);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: 'validation-typescript',
        duration: 2000,
      });
    });
  });

  describe('parseErrorFixingStage', () => {
    it('should parse started error fixing stage', () => {
      const stage: PipelineStageEvent = {
        id: 'stage-1',
        type: 'error_fixing',
        status: 'started',
        timestamp: 1000,
        data: {},
      };

      const result = parseErrorFixingStage(stage);

      expect(result).toEqual({
        type: 'error-fixing',
        duration: 3000,
        data: { iteration: undefined, errorCount: undefined },
      });
    });

    it('should parse completed error fixing stage (for replay mode)', () => {
      const stage: PipelineStageEvent = {
        id: 'stage-1',
        type: 'error_fixing',
        status: 'completed',
        timestamp: 1000,
        data: {},
      };

      const result = parseErrorFixingStage(stage);

      expect(result).toEqual({
        type: 'error-fixing',
        duration: 3000,
        data: { iteration: undefined, errorCount: undefined },
      });
    });

    it('should parse error fixing with iteration and error count', () => {
      const stage: PipelineStageEvent = {
        id: 'stage-1',
        type: 'error_fixing',
        status: 'completed',
        timestamp: 1000,
        data: {
          iteration: 2,
          errorCount: 5,
        },
      };

      const result = parseErrorFixingStage(stage);

      expect(result).toEqual({
        type: 'error-fixing',
        duration: 3000,
        data: { iteration: 2, errorCount: 5 },
      });
    });

    it('should extract error count from validationErrors array', () => {
      const stage: PipelineStageEvent = {
        id: 'stage-1',
        type: 'error_fixing',
        status: 'completed',
        timestamp: 1000,
        data: {
          iteration: 1,
          validationErrors: [
            { type: 'typescript' as const, file: 'test.ts', message: 'Error 1' },
            { type: 'typescript' as const, file: 'test.ts', message: 'Error 2' },
          ],
        },
      };

      const result = parseErrorFixingStage(stage);

      expect(result).toEqual({
        type: 'error-fixing',
        duration: 3000,
        data: { iteration: 1, errorCount: 2 },
      });
    });

    it('should return null for failed status', () => {
      const stage: PipelineStageEvent = {
        id: 'stage-1',
        type: 'error_fixing',
        status: 'failed',
        timestamp: 1000,
        data: {},
      };

      expect(parseErrorFixingStage(stage)).toBeNull();
    });
  });

  describe('parseBlockRequestTool', () => {
    it('should parse block request with blockName', () => {
      const toolCall: ToolCall = {
        id: '1',
        name: 'requestBlock',
        args: { blockName: 'auth-password' },
        timestamp: 1000,
      };

      const result = parseBlockRequestTool(toolCall);

      expect(result).toEqual({
        type: 'block-request',
        duration: 3000,
        data: { blockName: 'auth-password' },
      });
    });

    it('should parse block request with blockId', () => {
      const toolCall: ToolCall = {
        id: '1',
        name: 'requestBlock',
        args: { blockId: 'payment-stripe' },
        timestamp: 1000,
      };

      const result = parseBlockRequestTool(toolCall);

      expect(result).toEqual({
        type: 'block-request',
        duration: 3000,
        data: { blockName: 'payment-stripe' },
      });
    });

    it('should use default name if no args', () => {
      const toolCall: ToolCall = {
        id: '1',
        name: 'requestBlock',
        args: {},
        timestamp: 1000,
      };

      const result = parseBlockRequestTool(toolCall);

      expect(
        (result as Extract<PresentationEvent, { type: 'block-request' }> | null)?.data?.blockName,
      ).toBe('Building Block');
    });

    it('should return null if args parsing fails', () => {
      const toolCall: ToolCall = {
        id: '1',
        name: 'requestBlock',
        args: undefined,
        timestamp: 1000,
      };

      expect(parseBlockRequestTool(toolCall)).toBeNull();
    });
  });

  describe('parseWriteFileTool', () => {
    it('should parse single file write', () => {
      const toolCall: ToolCall = {
        id: '1',
        name: 'writeFile',
        args: { path: 'test.ts' },
        timestamp: 1000,
      };
      const seenFiles = new Set<string>();

      const result = parseWriteFileTool(toolCall, 0, seenFiles);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: 'file-created',
        duration: 1000,
        data: { fileName: 'test.ts' },
      });
      expect(seenFiles.has('test.ts')).toBe(true);
    });

    it('should skip file if already written (modification)', () => {
      const toolCall: ToolCall = {
        id: '1',
        name: 'writeFile',
        args: { path: 'test.ts' },
        timestamp: 1000,
      };
      const seenFiles = new Set<string>(['test.ts']); // File already seen

      const result = parseWriteFileTool(toolCall, 0, seenFiles);

      expect(result).toHaveLength(0); // No events for modification
    });

    it('should add combo milestone at 5 files', () => {
      const toolCall: ToolCall = {
        id: '5',
        name: 'writeFile',
        args: { path: 'file5.ts' },
        timestamp: 1000,
      };
      const seenFiles = new Set<string>();

      const result = parseWriteFileTool(toolCall, 4, seenFiles); // 4 existing, this is 5th

      expect(result).toHaveLength(2);
      expect(result[0].type).toBe('file-created');
      expect(
        (result[1] as Extract<PresentationEvent, { type: 'combo-milestone' }>).data.comboMilestone,
      ).toBe(5);
    });

    it('should add combo milestone at 10 files', () => {
      const toolCall: ToolCall = {
        id: '10',
        name: 'writeFile',
        args: { path: 'file10.ts' },
        timestamp: 1000,
      };
      const seenFiles = new Set<string>();

      const result = parseWriteFileTool(toolCall, 9, seenFiles);

      expect(result).toHaveLength(2);
      expect(
        (result[1] as Extract<PresentationEvent, { type: 'combo-milestone' }>).data.comboMilestone,
      ).toBe(10);
    });

    it('should add combo milestone at 20, 30, etc.', () => {
      const seenFiles = new Set<string>();

      let result = parseWriteFileTool(
        { id: '20', name: 'writeFile', args: { path: 'file20.ts' }, timestamp: 1000 },
        19,
        seenFiles,
      );
      expect(result).toHaveLength(2);
      expect(
        (result[1] as Extract<PresentationEvent, { type: 'combo-milestone' }>).data.comboMilestone,
      ).toBe(20);

      result = parseWriteFileTool(
        { id: '30', name: 'writeFile', args: { path: 'file30.ts' }, timestamp: 1000 },
        29,
        seenFiles,
      );
      expect(result).toHaveLength(2);
      expect(
        (result[1] as Extract<PresentationEvent, { type: 'combo-milestone' }>).data.comboMilestone,
      ).toBe(30);
    });

    it('should not add combo at other numbers', () => {
      const seenFiles = new Set<string>();
      const result = parseWriteFileTool(
        { id: '7', name: 'writeFile', args: { path: 'file7.ts' }, timestamp: 1000 },
        6,
        seenFiles,
      );

      expect(result).toHaveLength(1);
    });

    it('should use fallback filename if extraction fails', () => {
      const toolCall: ToolCall = {
        id: '1',
        name: 'writeFile',
        args: {},
        timestamp: 1000,
      };
      const seenFiles = new Set<string>();

      const result = parseWriteFileTool(toolCall, 2, seenFiles);

      expect(
        (result[0] as Extract<PresentationEvent, { type: 'file-created' }>).data.fileName,
      ).toBe('file-3');
    });

    it('should not increment combo count for duplicate files', () => {
      const seenFiles = new Set<string>();

      // First write - should count
      let result = parseWriteFileTool(
        { id: '1', name: 'writeFile', args: { path: 'test.ts' }, timestamp: 1000 },
        0,
        seenFiles,
      );
      expect(result).toHaveLength(1); // file-created only

      // Second write to same file - should not count
      result = parseWriteFileTool(
        { id: '2', name: 'writeFile', args: { path: 'test.ts' }, timestamp: 2000 },
        1,
        seenFiles,
      );
      expect(result).toHaveLength(0); // No events
    });
  });
});
