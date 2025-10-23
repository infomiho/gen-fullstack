import { describe, it, expect } from 'vitest';
import {
  formatTime,
  getReplayFiles,
  getReplayMessages,
  getReplayToolCalls,
  getReplayToolResults,
} from '../replay-utils';

describe('replay-utils', () => {
  describe('formatTime', () => {
    it('should format 0 milliseconds', () => {
      expect(formatTime(0)).toBe('00:00');
    });

    it('should format seconds only', () => {
      expect(formatTime(5000)).toBe('00:05');
      expect(formatTime(30000)).toBe('00:30');
      expect(formatTime(59000)).toBe('00:59');
    });

    it('should format minutes and seconds', () => {
      expect(formatTime(60000)).toBe('01:00');
      expect(formatTime(90000)).toBe('01:30');
      expect(formatTime(125000)).toBe('02:05');
    });

    it('should format large durations', () => {
      expect(formatTime(600000)).toBe('10:00');
      expect(formatTime(3661000)).toBe('61:01');
    });
  });

  describe('getReplayMessages', () => {
    const sessionStartTime = 1000;

    it('should return empty array when no messages', () => {
      const result = getReplayMessages([], sessionStartTime, 5000);
      expect(result).toEqual([]);
    });

    it('should filter messages by currentTime', () => {
      const items = [
        {
          id: '1',
          type: 'message' as const,
          timestamp: 2000,
          data: { role: 'user', content: 'Hello' },
        },
        {
          id: '2',
          type: 'message' as const,
          timestamp: 3000,
          data: { role: 'assistant', content: 'Hi' },
        },
        {
          id: '3',
          type: 'message' as const,
          timestamp: 7000,
          data: { role: 'user', content: 'Later' },
        },
      ];

      const result = getReplayMessages(items, sessionStartTime, 5000);

      expect(result).toHaveLength(2);
      expect(result[0].content).toBe('Hello');
      expect(result[1].content).toBe('Hi');
    });

    it('should filter out messages with missing data', () => {
      const items = [
        {
          id: '1',
          type: 'message' as const,
          timestamp: 2000,
          data: { role: 'user', content: 'Valid' },
        },
        {
          id: '2',
          type: 'message' as const,
          timestamp: 3000,
          data: { content: 'No role' },
        },
        {
          id: '3',
          type: 'message' as const,
          timestamp: 4000,
          data: { role: 'user' },
        },
      ];

      const result = getReplayMessages(items, sessionStartTime, 5000);

      expect(result).toHaveLength(1);
      expect(result[0].content).toBe('Valid');
    });

    it('should include messages at exact currentTime', () => {
      const items = [
        {
          id: '1',
          type: 'message' as const,
          timestamp: 6000, // Exactly at sessionStartTime + currentTime
          data: { role: 'user', content: 'Exact' },
        },
      ];

      const result = getReplayMessages(items, sessionStartTime, 5000);

      expect(result).toHaveLength(1);
      expect(result[0].content).toBe('Exact');
    });
  });

  describe('getReplayToolCalls', () => {
    const sessionStartTime = 1000;

    it('should return empty array when no tool calls', () => {
      const result = getReplayToolCalls([], sessionStartTime, 5000);
      expect(result).toEqual([]);
    });

    it('should filter tool calls by currentTime', () => {
      const items = [
        {
          id: '1',
          type: 'tool_call' as const,
          timestamp: 2000,
          data: { name: 'readFile', parameters: { path: 'test.ts' } },
        },
        {
          id: '2',
          type: 'tool_call' as const,
          timestamp: 3000,
          data: { name: 'writeFile', parameters: { path: 'new.ts' } },
        },
        {
          id: '3',
          type: 'tool_call' as const,
          timestamp: 8000,
          data: { name: 'later', parameters: {} },
        },
      ];

      const result = getReplayToolCalls(items, sessionStartTime, 5000);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('readFile');
      expect(result[1].name).toBe('writeFile');
    });

    it('should filter out tool calls with missing data', () => {
      const items = [
        {
          id: '1',
          type: 'tool_call' as const,
          timestamp: 2000,
          data: { name: 'valid', parameters: {} },
        },
        {
          id: '2',
          type: 'tool_call' as const,
          timestamp: 3000,
          data: { parameters: {} },
        },
        {
          id: '3',
          type: 'tool_call' as const,
          timestamp: 4000,
          data: { name: 'noParams' },
        },
      ];

      const result = getReplayToolCalls(items, sessionStartTime, 5000);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('valid');
    });
  });

  describe('getReplayToolResults', () => {
    const sessionStartTime = 1000;

    it('should return empty array when no tool results', () => {
      const result = getReplayToolResults([], sessionStartTime, 5000);
      expect(result).toEqual([]);
    });

    it('should filter tool results by currentTime', () => {
      const items = [
        {
          id: '1',
          type: 'tool_result' as const,
          timestamp: 2000,
          data: { result: 'Success', toolName: 'readFile' },
        },
        {
          id: '2',
          type: 'tool_result' as const,
          timestamp: 3000,
          data: { result: 'Done', toolName: 'writeFile' },
        },
        {
          id: '3',
          type: 'tool_result' as const,
          timestamp: 9000,
          data: { result: 'Later', toolName: 'other' },
        },
      ];

      const result = getReplayToolResults(items, sessionStartTime, 5000);

      expect(result).toHaveLength(2);
      expect(result[0].result).toBe('Success');
      expect(result[1].result).toBe('Done');
    });

    it('should handle missing toolName', () => {
      const items = [
        {
          id: '1',
          type: 'tool_result' as const,
          timestamp: 2000,
          data: { result: 'Success' },
        },
      ];

      const result = getReplayToolResults(items, sessionStartTime, 5000);

      expect(result).toHaveLength(1);
      expect(result[0].toolName).toBe('');
    });
  });

  describe('getReplayFiles', () => {
    const sessionStartTime = 1000;

    it('should return empty array when no files', () => {
      const result = getReplayFiles([], sessionStartTime, 5000);
      expect(result).toEqual([]);
    });

    it('should filter files by currentTime', () => {
      const files = [
        { path: 'file1.ts', timestamp: 2000, content: 'content1' },
        { path: 'file2.ts', timestamp: 3000, content: 'content2' },
        { path: 'file3.ts', timestamp: 8000, content: 'content3' },
      ];

      const result = getReplayFiles(files, sessionStartTime, 5000);

      expect(result).toHaveLength(2);
      expect(result[0].path).toBe('file1.ts');
      expect(result[1].path).toBe('file2.ts');
    });

    it('should not include timestamp in output', () => {
      const files = [{ path: 'test.ts', timestamp: 2000, content: 'test' }];

      const result = getReplayFiles(files, sessionStartTime, 5000);

      expect(result[0]).toEqual({
        path: 'test.ts',
        content: 'test',
      });
      expect(result[0]).not.toHaveProperty('timestamp');
    });
  });
});
