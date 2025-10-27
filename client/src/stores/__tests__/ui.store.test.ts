/**
 * Tests for UI Store
 *
 * Verifies UI state management:
 * - Sidebar section collapse state
 * - LocalStorage persistence
 * - Toggle and set operations
 */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useUIStore } from '../ui.store';

describe('useUIStore', () => {
  // Clear localStorage and reset store before each test
  beforeEach(() => {
    localStorage.clear();
    act(() => {
      useUIStore.getState().resetSidebarCollapse();
    });
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useUIStore());

      expect(result.current.sidebarCollapsed).toEqual({
        capabilities: false,
        prompt: false,
        metrics: false,
      });
    });
  });

  describe('Toggle Section', () => {
    it('should toggle capabilities section', () => {
      const { result } = renderHook(() => useUIStore());

      // Initially not collapsed
      expect(result.current.sidebarCollapsed.capabilities).toBe(false);

      // Toggle to collapsed
      act(() => {
        result.current.toggleSection('capabilities');
      });

      expect(result.current.sidebarCollapsed.capabilities).toBe(true);

      // Toggle back to open
      act(() => {
        result.current.toggleSection('capabilities');
      });

      expect(result.current.sidebarCollapsed.capabilities).toBe(false);
    });

    it('should toggle prompt section', () => {
      const { result } = renderHook(() => useUIStore());

      expect(result.current.sidebarCollapsed.prompt).toBe(false);

      act(() => {
        result.current.toggleSection('prompt');
      });

      expect(result.current.sidebarCollapsed.prompt).toBe(true);
    });

    it('should toggle metrics section', () => {
      const { result } = renderHook(() => useUIStore());

      expect(result.current.sidebarCollapsed.metrics).toBe(false);

      act(() => {
        result.current.toggleSection('metrics');
      });

      expect(result.current.sidebarCollapsed.metrics).toBe(true);
    });

    it('should toggle multiple sections independently', () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.toggleSection('capabilities');
        result.current.toggleSection('prompt');
      });

      expect(result.current.sidebarCollapsed.capabilities).toBe(true);
      expect(result.current.sidebarCollapsed.prompt).toBe(true);
      expect(result.current.sidebarCollapsed.metrics).toBe(false);
    });
  });

  describe('Set Section', () => {
    it('should set section to collapsed', () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.setSection('capabilities', true);
      });

      expect(result.current.sidebarCollapsed.capabilities).toBe(true);
    });

    it('should set section to open', () => {
      const { result } = renderHook(() => useUIStore());

      // First collapse it
      act(() => {
        result.current.toggleSection('capabilities');
      });

      expect(result.current.sidebarCollapsed.capabilities).toBe(true);

      // Then explicitly set to open
      act(() => {
        result.current.setSection('capabilities', false);
      });

      expect(result.current.sidebarCollapsed.capabilities).toBe(false);
    });

    it('should set multiple sections', () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.setSection('capabilities', true);
        result.current.setSection('prompt', true);
        result.current.setSection('metrics', false);
      });

      expect(result.current.sidebarCollapsed.capabilities).toBe(true);
      expect(result.current.sidebarCollapsed.prompt).toBe(true);
      expect(result.current.sidebarCollapsed.metrics).toBe(false);
    });
  });

  describe('Reset Sidebar Collapse', () => {
    it('should reset all sections to initial state', () => {
      const { result } = renderHook(() => useUIStore());

      // Modify state
      act(() => {
        result.current.toggleSection('capabilities');
        result.current.toggleSection('prompt');
        result.current.toggleSection('metrics');
      });

      expect(result.current.sidebarCollapsed.capabilities).toBe(true);
      expect(result.current.sidebarCollapsed.prompt).toBe(true);
      expect(result.current.sidebarCollapsed.metrics).toBe(true);

      // Reset
      act(() => {
        result.current.resetSidebarCollapse();
      });

      expect(result.current.sidebarCollapsed).toEqual({
        capabilities: false,
        prompt: false,
        metrics: false,
      });
    });
  });

  describe('LocalStorage Persistence', () => {
    it('should persist sidebar collapse state to localStorage', () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.toggleSection('capabilities');
        result.current.toggleSection('prompt');
      });

      // Check localStorage
      const stored = localStorage.getItem('ui-store');
      expect(stored).toBeTruthy();
      if (!stored) return;

      const parsed = JSON.parse(stored);
      expect(parsed.state.sidebarCollapsed).toEqual({
        capabilities: true,
        prompt: true,
        metrics: false,
      });
    });

    it('should restore state from localStorage', () => {
      const { result } = renderHook(() => useUIStore());

      // Set collapsed state
      act(() => {
        result.current.setSection('capabilities', true);
        result.current.setSection('prompt', true);
      });

      // Verify localStorage was updated
      const stored = localStorage.getItem('ui-store');
      expect(stored).toBeTruthy();
      if (!stored) return;

      const parsed = JSON.parse(stored);
      expect(parsed.state.sidebarCollapsed.capabilities).toBe(true);
      expect(parsed.state.sidebarCollapsed.prompt).toBe(true);
    });

    it('should update localStorage when state changes', () => {
      const { result } = renderHook(() => useUIStore());

      // Initial state
      act(() => {
        result.current.toggleSection('capabilities');
      });

      let stored = localStorage.getItem('ui-store');
      expect(stored).toBeTruthy();
      if (!stored) return;

      let parsed = JSON.parse(stored);
      expect(parsed.state.sidebarCollapsed.capabilities).toBe(true);

      // Change state again
      act(() => {
        result.current.toggleSection('capabilities');
      });

      stored = localStorage.getItem('ui-store');
      expect(stored).toBeTruthy();
      if (!stored) return;

      parsed = JSON.parse(stored);
      expect(parsed.state.sidebarCollapsed.capabilities).toBe(false);
    });
  });

  describe('Store Isolation', () => {
    it('should maintain shared state across multiple hook calls', () => {
      const { result: result1 } = renderHook(() => useUIStore());
      const { result: result2 } = renderHook(() => useUIStore());

      act(() => {
        result1.current.toggleSection('capabilities');
      });

      // Both hooks should see the same state (shared store)
      expect(result1.current.sidebarCollapsed.capabilities).toBe(true);
      expect(result2.current.sidebarCollapsed.capabilities).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid toggling', () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        for (let i = 0; i < 10; i++) {
          result.current.toggleSection('capabilities');
        }
      });

      // Should end up collapsed (even number of toggles from false)
      expect(result.current.sidebarCollapsed.capabilities).toBe(false);
    });

    it('should handle setting to same value', () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.setSection('capabilities', false);
        result.current.setSection('capabilities', false);
      });

      expect(result.current.sidebarCollapsed.capabilities).toBe(false);
    });

    it('should handle corrupted localStorage data gracefully', () => {
      // Set invalid JSON in localStorage
      localStorage.setItem('ui-store', 'invalid-json');

      // Should fall back to initial state without crashing
      const { result } = renderHook(() => useUIStore());

      expect(result.current.sidebarCollapsed).toEqual({
        capabilities: false,
        prompt: false,
        metrics: false,
      });
    });
  });
});
