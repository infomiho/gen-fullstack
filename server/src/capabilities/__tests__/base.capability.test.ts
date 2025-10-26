import type { Server as SocketIOServer } from 'socket.io';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ModelName } from '../../services/llm.service';
import type { CapabilityContext, CapabilityResult } from '../../types';
import { BaseCapability } from '../base.capability';

/**
 * Test capability implementation
 */
class TestCapability extends BaseCapability {
  getName(): string {
    return 'test';
  }

  async execute(_context: CapabilityContext): Promise<CapabilityResult> {
    return {
      success: true,
      toolCalls: 0,
    };
  }
}

describe('BaseCapability - Error Handling', () => {
  let capability: TestCapability;
  let mockIo: Partial<SocketIOServer>;
  let emitSpy: ReturnType<typeof vi.fn>;
  let toSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    emitSpy = vi.fn();
    toSpy = vi.fn().mockReturnThis();
    mockIo = {
      to: toSpy,
      emit: emitSpy,
    } as unknown as Partial<SocketIOServer>;

    capability = new TestCapability('openai/gpt-4o' as ModelName, mockIo as SocketIOServer);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createOnStepFinishHandler - Error Detection', () => {
    it('should detect tool errors with error.message property', () => {
      const handler = (capability as any).createOnStepFinishHandler('test-session');

      handler({
        toolCalls: [{ toolCallId: 'tc-1', toolName: 'writeFile', input: { path: 'test.txt' } }],
        toolResults: [
          {
            toolCallId: 'tc-1',
            toolName: 'writeFile',
            error: { message: 'File not found' },
          },
        ],
      });

      // Verify WebSocket emission
      expect(toSpy).toHaveBeenCalledWith('test-session');
      expect(emitSpy).toHaveBeenCalledWith(
        'tool_result',
        expect.objectContaining({
          result: 'Error: File not found',
        }),
      );
    });

    it('should detect tool errors with error as string', () => {
      const handler = (capability as any).createOnStepFinishHandler('test-session');

      handler({
        toolCalls: [],
        toolResults: [
          {
            toolCallId: 'tc-2',
            toolName: 'executeCommand',
            error: 'Command failed with exit code 1',
          },
        ],
      });

      expect(emitSpy).toHaveBeenCalledWith(
        'tool_result',
        expect.objectContaining({
          result: 'Error: Command failed with exit code 1',
        }),
      );
    });

    it('should handle successful tool results without error flag', () => {
      const handler = (capability as any).createOnStepFinishHandler('test-session');

      handler({
        toolCalls: [],
        toolResults: [
          {
            toolCallId: 'tc-3',
            toolName: 'readFile',
            output: 'File contents here',
          },
        ],
      });

      expect(emitSpy).toHaveBeenCalledWith(
        'tool_result',
        expect.objectContaining({
          result: 'File contents here',
        }),
      );
    });

    it('should avoid duplicate Error: prefix', () => {
      const handler = (capability as any).createOnStepFinishHandler('test-session');

      handler({
        toolCalls: [],
        toolResults: [
          {
            toolCallId: 'tc-4',
            toolName: 'requestBlock',
            error: { message: 'Error: Block not found' },
          },
        ],
      });

      expect(emitSpy).toHaveBeenCalledWith(
        'tool_result',
        expect.objectContaining({
          result: 'Error: Block not found',
        }),
      );
    });

    it('should handle multiple tool results with mixed success/error', () => {
      const handler = (capability as any).createOnStepFinishHandler('test-session');

      handler({
        toolCalls: [],
        toolResults: [
          {
            toolCallId: 'tc-5',
            toolName: 'writeFile',
            output: 'Successfully wrote 100 bytes',
          },
          {
            toolCallId: 'tc-6',
            toolName: 'readFile',
            error: { message: 'Permission denied' },
          },
        ],
      });

      // Should emit two tool results
      expect(emitSpy).toHaveBeenCalledTimes(2);

      // First should be success
      expect(emitSpy).toHaveBeenNthCalledWith(
        1,
        'tool_result',
        expect.objectContaining({
          toolName: 'writeFile',
          result: 'Successfully wrote 100 bytes',
        }),
      );

      // Second should be error
      expect(emitSpy).toHaveBeenNthCalledWith(
        2,
        'tool_result',
        expect.objectContaining({
          toolName: 'readFile',
          result: 'Error: Permission denied',
        }),
      );
    });

    it('should log warnings for tool errors', () => {
      const warnSpy = vi.spyOn((capability as any).logger, 'warn');
      const handler = (capability as any).createOnStepFinishHandler('test-session');

      handler({
        toolCalls: [],
        toolResults: [
          {
            toolCallId: 'tc-7',
            toolName: 'executeCommand',
            error: { message: 'Command not found' },
          },
        ],
      });

      expect(warnSpy).toHaveBeenCalledWith(
        {
          toolCallId: 'tc-7',
          toolName: 'executeCommand',
          error: { message: 'Command not found' },
        },
        'Tool execution failed',
      );
    });

    it('should not log warnings for successful tool executions', () => {
      const warnSpy = vi.spyOn((capability as any).logger, 'warn');
      const handler = (capability as any).createOnStepFinishHandler('test-session');

      handler({
        toolCalls: [],
        toolResults: [
          {
            toolCallId: 'tc-8',
            toolName: 'getFileTree',
            output:
              '.\n├── 📄 file1.txt\n└── 📄 file2.js\n\n2 files, 0 directories\n(excluded: node_modules, dist, .git, coverage, .cache, etc.)',
          },
        ],
      });

      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('should emit tool calls before tool results', () => {
      const handler = (capability as any).createOnStepFinishHandler('test-session');

      handler({
        toolCalls: [{ toolCallId: 'tc-9', toolName: 'writeFile', input: { path: 'test.txt' } }],
        toolResults: [
          {
            toolCallId: 'tc-9',
            toolName: 'writeFile',
            output: 'Success',
          },
        ],
      });

      // Should emit tool_call first, then tool_result
      expect(emitSpy).toHaveBeenCalledTimes(2);
      expect(emitSpy).toHaveBeenNthCalledWith(1, 'tool_call', expect.any(Object));
      expect(emitSpy).toHaveBeenNthCalledWith(2, 'tool_result', expect.any(Object));
    });
  });
});
