/**
 * Tests for Connection Store
 *
 * Verifies WebSocket connection state management:
 * - Socket instance storage
 * - Connection status tracking
 */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useConnectionStore } from '../connection';

describe('useConnectionStore', () => {
  // Reset store before each test
  beforeEach(() => {
    act(() => {
      useConnectionStore.setState({
        socket: null,
        isConnected: false,
      });
    });
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useConnectionStore());

      expect(result.current.socket).toBeNull();
      expect(result.current.isConnected).toBe(false);
    });
  });

  describe('Socket Management', () => {
    it('should set socket instance', () => {
      const { result } = renderHook(() => useConnectionStore());

      const mockSocket = {
        id: 'socket-123',
        connected: true,
      } as any;

      act(() => {
        result.current.setSocket(mockSocket);
      });

      expect(result.current.socket).toBe(mockSocket);
    });

    it('should clear socket instance', () => {
      const { result } = renderHook(() => useConnectionStore());

      const mockSocket = {
        id: 'socket-123',
        connected: true,
      } as any;

      act(() => {
        result.current.setSocket(mockSocket);
        result.current.setSocket(null);
      });

      expect(result.current.socket).toBeNull();
    });

    it('should replace socket instance', () => {
      const { result } = renderHook(() => useConnectionStore());

      const mockSocket1 = {
        id: 'socket-1',
        connected: true,
      } as any;

      const mockSocket2 = {
        id: 'socket-2',
        connected: true,
      } as any;

      act(() => {
        result.current.setSocket(mockSocket1);
      });

      expect(result.current.socket).toBe(mockSocket1);

      act(() => {
        result.current.setSocket(mockSocket2);
      });

      expect(result.current.socket).toBe(mockSocket2);
    });
  });

  describe('Connection Status', () => {
    it('should set connected state to true', () => {
      const { result } = renderHook(() => useConnectionStore());

      act(() => {
        result.current.setConnected(true);
      });

      expect(result.current.isConnected).toBe(true);
    });

    it('should set connected state to false', () => {
      const { result } = renderHook(() => useConnectionStore());

      act(() => {
        result.current.setConnected(true);
        result.current.setConnected(false);
      });

      expect(result.current.isConnected).toBe(false);
    });

    it('should toggle connection state', () => {
      const { result } = renderHook(() => useConnectionStore());

      act(() => {
        result.current.setConnected(true);
      });
      expect(result.current.isConnected).toBe(true);

      act(() => {
        result.current.setConnected(false);
      });
      expect(result.current.isConnected).toBe(false);

      act(() => {
        result.current.setConnected(true);
      });
      expect(result.current.isConnected).toBe(true);
    });
  });

  describe('Independent State Updates', () => {
    it('should update socket without affecting connection status', () => {
      const { result } = renderHook(() => useConnectionStore());

      const mockSocket = {
        id: 'socket-123',
        connected: true,
      } as any;

      act(() => {
        result.current.setConnected(true);
        result.current.setSocket(mockSocket);
      });

      expect(result.current.isConnected).toBe(true);
      expect(result.current.socket).toBe(mockSocket);

      act(() => {
        result.current.setSocket(null);
      });

      // Connection status should remain unchanged
      expect(result.current.isConnected).toBe(true);
      expect(result.current.socket).toBeNull();
    });

    it('should update connection status without affecting socket', () => {
      const { result } = renderHook(() => useConnectionStore());

      const mockSocket = {
        id: 'socket-123',
        connected: true,
      } as any;

      act(() => {
        result.current.setSocket(mockSocket);
        result.current.setConnected(false);
      });

      expect(result.current.socket).toBe(mockSocket);
      expect(result.current.isConnected).toBe(false);
    });
  });

  describe('Store Isolation', () => {
    it('should maintain shared state across multiple hook calls', () => {
      const { result: result1 } = renderHook(() => useConnectionStore());
      const { result: result2 } = renderHook(() => useConnectionStore());

      const mockSocket = {
        id: 'socket-123',
        connected: true,
      } as any;

      act(() => {
        result1.current.setSocket(mockSocket);
        result1.current.setConnected(true);
      });

      // Both hooks should see the same state (shared store)
      expect(result1.current.socket).toBe(mockSocket);
      expect(result1.current.isConnected).toBe(true);
      expect(result2.current.socket).toBe(mockSocket);
      expect(result2.current.isConnected).toBe(true);
    });
  });

  describe('Rapid Updates', () => {
    it('should handle rapid connection state changes', () => {
      const { result } = renderHook(() => useConnectionStore());

      act(() => {
        for (let i = 0; i < 100; i++) {
          result.current.setConnected(i % 2 === 0);
        }
      });

      // Final state should be false (99 % 2 === 1, so last call was setConnected(false))
      expect(result.current.isConnected).toBe(false);
    });

    it('should handle rapid socket replacements', () => {
      const { result } = renderHook(() => useConnectionStore());

      const mockSockets = Array.from({ length: 10 }, (_, i) => ({
        id: `socket-${i}`,
        connected: true,
      })) as any[];

      act(() => {
        mockSockets.forEach((socket) => {
          result.current.setSocket(socket);
        });
      });

      // Final socket should be the last one
      expect(result.current.socket).toBe(mockSockets[9]);
    });
  });
});
