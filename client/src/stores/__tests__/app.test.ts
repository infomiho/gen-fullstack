/**
 * Tests for App Store
 *
 * Verifies app execution state management:
 * - App status tracking
 * - Log accumulation and truncation
 * - Build event tracking
 */

import type { AppInfo, AppLog, BuildEvent } from '@gen-fullstack/shared';
import { MAX_LOGS } from '@gen-fullstack/shared';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useAppStore } from '../app';

describe('useAppStore', () => {
  // Reset store before each test
  beforeEach(() => {
    act(() => {
      useAppStore.getState().reset();
    });
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useAppStore());

      expect(result.current.appStatus).toBeNull();
      expect(result.current.appLogs).toEqual([]);
      expect(result.current.buildEvents).toEqual([]);
    });
  });

  describe('App Status Management', () => {
    it('should set app status', () => {
      const { result } = renderHook(() => useAppStore());

      const status: AppInfo = {
        sessionId: 'test-session',
        status: 'running',
        clientPort: 5173,
        serverPort: 3000,
        clientUrl: 'http://localhost:5173',
        serverUrl: 'http://localhost:3000',
        containerId: 'container-123',
      };

      act(() => {
        result.current.setAppStatus(status);
      });

      expect(result.current.appStatus).toEqual(status);
    });

    it('should update app status', () => {
      const { result } = renderHook(() => useAppStore());

      const status1: AppInfo = {
        sessionId: 'test-session',
        status: 'creating',
      };

      const status2: AppInfo = {
        sessionId: 'test-session',
        status: 'running',
        clientPort: 5173,
        serverPort: 3000,
      };

      act(() => {
        result.current.setAppStatus(status1);
      });

      expect(result.current.appStatus?.status).toBe('creating');

      act(() => {
        result.current.setAppStatus(status2);
      });

      expect(result.current.appStatus?.status).toBe('running');
    });

    it('should clear app status', () => {
      const { result } = renderHook(() => useAppStore());

      const status: AppInfo = {
        sessionId: 'test-session',
        status: 'running',
      };

      act(() => {
        result.current.setAppStatus(status);
        result.current.setAppStatus(null);
      });

      expect(result.current.appStatus).toBeNull();
    });

    it('should handle all status types', () => {
      const { result } = renderHook(() => useAppStore());

      const statuses: AppInfo['status'][] = [
        'idle',
        'creating',
        'installing',
        'starting',
        'running',
        'failed',
        'stopped',
      ];

      statuses.forEach((status) => {
        act(() => {
          result.current.setAppStatus({
            sessionId: 'test-session',
            status,
          });
        });

        expect(result.current.appStatus?.status).toBe(status);
      });
    });
  });

  describe('App Log Management', () => {
    it('should add app logs', () => {
      const { result } = renderHook(() => useAppStore());

      const log: AppLog = {
        sessionId: 'test-session',
        timestamp: Date.now(),
        type: 'stdout',
        level: 'info',
        message: 'Starting server...',
      };

      act(() => {
        result.current.addAppLog(log);
      });

      expect(result.current.appLogs).toHaveLength(1);
      expect(result.current.appLogs[0]).toEqual(log);
    });

    it('should accumulate multiple logs', () => {
      const { result } = renderHook(() => useAppStore());

      const logs: AppLog[] = [
        {
          sessionId: 'test-session',
          timestamp: Date.now(),
          type: 'stdout',
          level: 'info',
          message: 'Log 1',
        },
        {
          sessionId: 'test-session',
          timestamp: Date.now(),
          type: 'stderr',
          level: 'error',
          message: 'Log 2',
        },
        {
          sessionId: 'test-session',
          timestamp: Date.now(),
          type: 'stdout',
          level: 'command',
          message: 'Log 3',
        },
      ];

      act(() => {
        logs.forEach((log) => {
          result.current.addAppLog(log);
        });
      });

      expect(result.current.appLogs).toHaveLength(3);
    });

    it('should clear app logs', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.addAppLog({
          sessionId: 'test-session',
          timestamp: Date.now(),
          type: 'stdout',
          level: 'info',
          message: 'Test',
        });
        result.current.clearAppLogs();
      });

      expect(result.current.appLogs).toEqual([]);
    });
  });

  describe('Build Event Management', () => {
    it('should add build events', () => {
      const { result } = renderHook(() => useAppStore());

      const buildEvent: BuildEvent = {
        sessionId: 'test-session',
        timestamp: Date.now(),
        event: 'start',
      };

      act(() => {
        result.current.addBuildEvent(buildEvent);
      });

      expect(result.current.buildEvents).toHaveLength(1);
      expect(result.current.buildEvents[0]).toEqual(buildEvent);
    });

    it('should track build lifecycle', () => {
      const { result } = renderHook(() => useAppStore());

      const events: BuildEvent[] = [
        {
          sessionId: 'test-session',
          timestamp: Date.now(),
          event: 'start',
        },
        {
          sessionId: 'test-session',
          timestamp: Date.now() + 1000,
          event: 'success',
          details: 'Build completed',
        },
      ];

      act(() => {
        events.forEach((event) => {
          result.current.addBuildEvent(event);
        });
      });

      expect(result.current.buildEvents).toHaveLength(2);
      expect(result.current.buildEvents[0].event).toBe('start');
      expect(result.current.buildEvents[1].event).toBe('success');
    });

    it('should clear build events', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.addBuildEvent({
          sessionId: 'test-session',
          timestamp: Date.now(),
          event: 'start',
        });
        result.current.clearBuildEvents();
      });

      expect(result.current.buildEvents).toEqual([]);
    });
  });

  describe('Log Truncation', () => {
    it('should not truncate when under limit', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        for (let i = 0; i < 100; i++) {
          result.current.addAppLog({
            sessionId: 'test-session',
            timestamp: Date.now(),
            type: 'stdout',
            level: 'info',
            message: `Log ${i}`,
          });
        }
      });

      const truncation = result.current.checkAndTruncateLogs();

      expect(truncation.truncated).toBe(false);
      expect(result.current.appLogs).toHaveLength(100);
    });

    it('should truncate logs when exceeding MAX_LOGS', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        for (let i = 0; i < MAX_LOGS + 50; i++) {
          result.current.addAppLog({
            sessionId: 'test-session',
            timestamp: Date.now(),
            type: 'stdout',
            level: 'info',
            message: `Log ${i}`,
          });
        }
      });

      let truncation!: { truncated: boolean; count: number };

      act(() => {
        truncation = result.current.checkAndTruncateLogs();
      });

      expect(truncation.truncated).toBe(true);
      expect(truncation.count).toBe(50);
      expect(result.current.appLogs).toHaveLength(MAX_LOGS);
      // First log should be the 51st one added (first 50 removed)
      expect(result.current.appLogs[0].message).toBe('Log 50');
    });

    it('should handle multiple truncation checks', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        for (let i = 0; i < MAX_LOGS + 100; i++) {
          result.current.addAppLog({
            sessionId: 'test-session',
            timestamp: Date.now(),
            type: 'stdout',
            level: 'info',
            message: `Log ${i}`,
          });
        }
      });

      let truncation1!: { truncated: boolean; count: number };
      let truncation2!: { truncated: boolean; count: number };

      act(() => {
        truncation1 = result.current.checkAndTruncateLogs();
        truncation2 = result.current.checkAndTruncateLogs();
      });

      expect(truncation1.truncated).toBe(true);
      expect(truncation1.count).toBe(100);
      expect(truncation2.truncated).toBe(false); // Already truncated
      expect(result.current.appLogs).toHaveLength(MAX_LOGS);
    });
  });

  describe('Reset Functionality', () => {
    it('should reset all state to initial values', () => {
      const { result } = renderHook(() => useAppStore());

      // Populate state
      act(() => {
        result.current.setAppStatus({
          sessionId: 'test-session',
          status: 'running',
        });
        result.current.addAppLog({
          sessionId: 'test-session',
          timestamp: Date.now(),
          type: 'stdout',
          level: 'info',
          message: 'Test',
        });
        result.current.addBuildEvent({
          sessionId: 'test-session',
          timestamp: Date.now(),
          event: 'start',
        });
      });

      expect(result.current.appStatus).not.toBeNull();
      expect(result.current.appLogs).toHaveLength(1);
      expect(result.current.buildEvents).toHaveLength(1);

      // Reset
      act(() => {
        result.current.reset();
      });

      expect(result.current.appStatus).toBeNull();
      expect(result.current.appLogs).toEqual([]);
      expect(result.current.buildEvents).toEqual([]);
    });
  });

  describe('Store Isolation', () => {
    it('should maintain shared state across multiple hook calls', () => {
      const { result: result1 } = renderHook(() => useAppStore());
      const { result: result2 } = renderHook(() => useAppStore());

      act(() => {
        result1.current.setAppStatus({
          sessionId: 'test-session',
          status: 'running',
        });
      });

      // Both hooks should see the same state (shared store)
      expect(result1.current.appStatus?.status).toBe('running');
      expect(result2.current.appStatus?.status).toBe('running');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty log messages', () => {
      const { result } = renderHook(() => useAppStore());

      const log: AppLog = {
        sessionId: 'test-session',
        timestamp: Date.now(),
        type: 'stdout',
        level: 'info',
        message: '',
      };

      act(() => {
        result.current.addAppLog(log);
      });

      expect(result.current.appLogs).toHaveLength(1);
      expect(result.current.appLogs[0].message).toBe('');
    });

    it('should handle app status with error', () => {
      const { result } = renderHook(() => useAppStore());

      const status: AppInfo = {
        sessionId: 'test-session',
        status: 'failed',
        error: 'Container failed to start',
      };

      act(() => {
        result.current.setAppStatus(status);
      });

      expect(result.current.appStatus?.error).toBe('Container failed to start');
    });

    it('should handle build event with details', () => {
      const { result } = renderHook(() => useAppStore());

      const buildEvent: BuildEvent = {
        sessionId: 'test-session',
        timestamp: Date.now(),
        event: 'error',
        details: 'TypeScript compilation failed',
      };

      act(() => {
        result.current.addBuildEvent(buildEvent);
      });

      expect(result.current.buildEvents[0].details).toBe('TypeScript compilation failed');
    });

    it('should handle rapid log additions', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        for (let i = 0; i < 1000; i++) {
          result.current.addAppLog({
            sessionId: 'test-session',
            timestamp: Date.now(),
            type: 'stdout',
            level: 'info',
            message: `Rapid log ${i}`,
          });
        }
      });

      // Should automatically truncate to MAX_LOGS
      act(() => {
        result.current.checkAndTruncateLogs();
      });

      expect(result.current.appLogs.length).toBeLessThanOrEqual(MAX_LOGS);
    });
  });
});
