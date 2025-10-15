import { describe, it, expect } from 'vitest';
import { getLevelColor, getLevelLabel, filterLogs } from './log-utils';
import type { AppLog } from '@gen-fullstack/shared';

describe('log-utils', () => {
  describe('getLevelColor', () => {
    it('returns red for error level', () => {
      const result = getLevelColor('error');
      expect(result).toBe('text-red-600');
    });

    it('returns yellow for warn level', () => {
      const result = getLevelColor('warn');
      expect(result).toBe('text-yellow-600');
    });

    it('returns blue for info level', () => {
      const result = getLevelColor('info');
      expect(result).toBe('text-blue-600');
    });
  });

  describe('getLevelLabel', () => {
    it('returns "ERROR" for error level', () => {
      const result = getLevelLabel('error');
      expect(result).toBe('ERROR');
    });

    it('returns "WARN" for warn level', () => {
      const result = getLevelLabel('warn');
      expect(result).toBe('WARN');
    });

    it('returns "INFO" for info level', () => {
      const result = getLevelLabel('info');
      expect(result).toBe('INFO');
    });
  });

  describe('filterLogs', () => {
    const sampleLogs: AppLog[] = [
      {
        sessionId: 'test-123',
        timestamp: 1000,
        type: 'stdout',
        level: 'info',
        message: 'Starting server',
      },
      {
        sessionId: 'test-123',
        timestamp: 2000,
        type: 'stdout',
        level: 'warn',
        message: 'Deprecation warning',
      },
      {
        sessionId: 'test-123',
        timestamp: 3000,
        type: 'stderr',
        level: 'error',
        message: 'Failed to connect',
      },
      {
        sessionId: 'test-123',
        timestamp: 4000,
        type: 'stdout',
        level: 'info',
        message: 'Server running on port 3000',
      },
    ];

    it('returns all logs when level filter is null and search is empty', () => {
      const result = filterLogs(sampleLogs, null, '');
      expect(result).toHaveLength(4);
      expect(result).toEqual(sampleLogs);
    });

    it('filters by error level', () => {
      const result = filterLogs(sampleLogs, 'error', '');
      expect(result).toHaveLength(1);
      expect(result[0].level).toBe('error');
    });

    it('filters by warn level', () => {
      const result = filterLogs(sampleLogs, 'warn', '');
      expect(result).toHaveLength(1);
      expect(result[0].level).toBe('warn');
    });

    it('filters by info level', () => {
      const result = filterLogs(sampleLogs, 'info', '');
      expect(result).toHaveLength(2);
      expect(result[0].level).toBe('info');
      expect(result[1].level).toBe('info');
    });

    it('filters by search text (case-insensitive)', () => {
      const result = filterLogs(sampleLogs, null, 'server');
      expect(result).toHaveLength(2);
      expect(result[0].message).toContain('Starting server');
      expect(result[1].message).toContain('Server running');
    });

    it('filters by search text with different case', () => {
      const result = filterLogs(sampleLogs, null, 'SERVER');
      expect(result).toHaveLength(2);
    });

    it('combines level filter and search text', () => {
      const result = filterLogs(sampleLogs, 'info', 'server');
      expect(result).toHaveLength(2);
      expect(result.every((log) => log.level === 'info')).toBe(true);
    });

    it('returns empty array when no matches', () => {
      const result = filterLogs(sampleLogs, 'error', 'nonexistent');
      expect(result).toHaveLength(0);
    });

    it('handles empty logs array', () => {
      const result = filterLogs([], 'info', 'test');
      expect(result).toHaveLength(0);
    });

    it('returns all logs when level is null', () => {
      const result = filterLogs(sampleLogs, null, '');
      expect(result).toHaveLength(4);
    });

    it('filters partial text matches', () => {
      const result = filterLogs(sampleLogs, null, 'port');
      expect(result).toHaveLength(1);
      expect(result[0].message).toContain('port 3000');
    });
  });
});
