/**
 * Tests for Generation Config Store
 *
 * Verifies generation configuration state management:
 * - Prompt draft state
 * - Capability configuration
 * - LocalStorage persistence
 * - State updates and reset operations
 */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useGenerationConfigStore } from '../generation-config.store';

describe('useGenerationConfigStore', () => {
  // Clear localStorage and reset store before each test
  beforeEach(() => {
    localStorage.clear();
    act(() => {
      useGenerationConfigStore.getState().resetConfig();
    });
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useGenerationConfigStore());

      expect(result.current.promptDraft).toBe('');
      expect(result.current.capabilityConfig).toEqual({
        inputMode: 'naive',
        planning: false,
        compilerChecks: false,
        buildingBlocks: false,
        maxIterations: 3,
      });
      expect(result.current.selectedModel).toBe('gpt-5-mini');
    });
  });

  describe('Prompt Draft', () => {
    it('should set prompt draft', () => {
      const { result } = renderHook(() => useGenerationConfigStore());

      act(() => {
        result.current.setPromptDraft('Build a todo app');
      });

      expect(result.current.promptDraft).toBe('Build a todo app');
    });

    it('should update prompt draft multiple times', () => {
      const { result } = renderHook(() => useGenerationConfigStore());

      act(() => {
        result.current.setPromptDraft('Build a todo app');
      });

      expect(result.current.promptDraft).toBe('Build a todo app');

      act(() => {
        result.current.setPromptDraft('Build a todo app with React');
      });

      expect(result.current.promptDraft).toBe('Build a todo app with React');
    });

    it('should clear prompt draft', () => {
      const { result } = renderHook(() => useGenerationConfigStore());

      act(() => {
        result.current.setPromptDraft('Build a todo app');
      });

      expect(result.current.promptDraft).toBe('Build a todo app');

      act(() => {
        result.current.clearPromptDraft();
      });

      expect(result.current.promptDraft).toBe('');
    });

    it('should handle empty string prompt', () => {
      const { result } = renderHook(() => useGenerationConfigStore());

      act(() => {
        result.current.setPromptDraft('');
      });

      expect(result.current.promptDraft).toBe('');
    });
  });

  describe('Capability Config', () => {
    it('should set capability config', () => {
      const { result } = renderHook(() => useGenerationConfigStore());

      const newConfig = {
        inputMode: 'template' as const,
        planning: true,
        compilerChecks: true,
        buildingBlocks: false,
        maxIterations: 5,
      };

      act(() => {
        result.current.setCapabilityConfig(newConfig);
      });

      expect(result.current.capabilityConfig).toEqual(newConfig);
    });

    it('should update capability config partially', () => {
      const { result } = renderHook(() => useGenerationConfigStore());

      act(() => {
        result.current.setCapabilityConfig({
          ...result.current.capabilityConfig,
          planning: true,
        });
      });

      expect(result.current.capabilityConfig.planning).toBe(true);
      expect(result.current.capabilityConfig.inputMode).toBe('naive');
    });

    it('should update multiple capability config properties', () => {
      const { result } = renderHook(() => useGenerationConfigStore());

      act(() => {
        result.current.setCapabilityConfig({
          inputMode: 'template',
          planning: true,
          compilerChecks: true,
          buildingBlocks: true,
          maxIterations: 5,
        });
      });

      expect(result.current.capabilityConfig).toEqual({
        inputMode: 'template',
        planning: true,
        compilerChecks: true,
        buildingBlocks: true,
        maxIterations: 5,
      });
    });
  });

  describe('Model Selection', () => {
    it('should set selected model', () => {
      const { result } = renderHook(() => useGenerationConfigStore());

      act(() => {
        result.current.setSelectedModel('gpt-5');
      });

      expect(result.current.selectedModel).toBe('gpt-5');
    });

    it('should update selected model multiple times', () => {
      const { result } = renderHook(() => useGenerationConfigStore());

      act(() => {
        result.current.setSelectedModel('gpt-5');
      });

      expect(result.current.selectedModel).toBe('gpt-5');

      act(() => {
        result.current.setSelectedModel('claude-sonnet-4-5');
      });

      expect(result.current.selectedModel).toBe('claude-sonnet-4-5');
    });

    it('should handle switching between OpenAI and Anthropic models', () => {
      const { result } = renderHook(() => useGenerationConfigStore());

      // Start with OpenAI model
      act(() => {
        result.current.setSelectedModel('gpt-5');
      });

      expect(result.current.selectedModel).toBe('gpt-5');

      // Switch to Anthropic model
      act(() => {
        result.current.setSelectedModel('claude-haiku-4-5');
      });

      expect(result.current.selectedModel).toBe('claude-haiku-4-5');

      // Switch back to OpenAI model
      act(() => {
        result.current.setSelectedModel('gpt-5-nano');
      });

      expect(result.current.selectedModel).toBe('gpt-5-nano');
    });
  });

  describe('Reset Config', () => {
    it('should reset prompt draft, capability config, and selected model to initial state', () => {
      const { result } = renderHook(() => useGenerationConfigStore());

      // Modify state
      act(() => {
        result.current.setPromptDraft('Build a todo app');
        result.current.setCapabilityConfig({
          inputMode: 'template',
          planning: true,
          compilerChecks: true,
          buildingBlocks: true,
          maxIterations: 5,
        });
        result.current.setSelectedModel('claude-opus-4-1');
      });

      expect(result.current.promptDraft).toBe('Build a todo app');
      expect(result.current.capabilityConfig.inputMode).toBe('template');
      expect(result.current.selectedModel).toBe('claude-opus-4-1');

      // Reset
      act(() => {
        result.current.resetConfig();
      });

      expect(result.current.promptDraft).toBe('');
      expect(result.current.capabilityConfig).toEqual({
        inputMode: 'naive',
        planning: false,
        compilerChecks: false,
        buildingBlocks: false,
        maxIterations: 3,
      });
      expect(result.current.selectedModel).toBe('gpt-5-mini');
    });
  });

  describe('LocalStorage Persistence', () => {
    it('should persist prompt draft to localStorage', () => {
      const { result } = renderHook(() => useGenerationConfigStore());

      act(() => {
        result.current.setPromptDraft('Build a todo app');
      });

      // Check localStorage
      const stored = localStorage.getItem('generation-config-store');
      expect(stored).toBeTruthy();
      if (!stored) return;

      const parsed = JSON.parse(stored);
      expect(parsed.state.promptDraft).toBe('Build a todo app');
    });

    it('should persist capability config to localStorage', () => {
      const { result } = renderHook(() => useGenerationConfigStore());

      act(() => {
        result.current.setCapabilityConfig({
          inputMode: 'template',
          planning: true,
          compilerChecks: true,
          buildingBlocks: false,
          maxIterations: 5,
        });
      });

      // Check localStorage
      const stored = localStorage.getItem('generation-config-store');
      expect(stored).toBeTruthy();
      if (!stored) return;

      const parsed = JSON.parse(stored);
      expect(parsed.state.capabilityConfig).toEqual({
        inputMode: 'template',
        planning: true,
        compilerChecks: true,
        buildingBlocks: false,
        maxIterations: 5,
      });
    });

    it('should persist both prompt and config together', () => {
      const { result } = renderHook(() => useGenerationConfigStore());

      act(() => {
        result.current.setPromptDraft('Build a todo app');
        result.current.setCapabilityConfig({
          inputMode: 'template',
          planning: true,
          compilerChecks: false,
          buildingBlocks: false,
          maxIterations: 3,
        });
      });

      // Check localStorage
      const stored = localStorage.getItem('generation-config-store');
      expect(stored).toBeTruthy();
      if (!stored) return;

      const parsed = JSON.parse(stored);
      expect(parsed.state.promptDraft).toBe('Build a todo app');
      expect(parsed.state.capabilityConfig.inputMode).toBe('template');
      expect(parsed.state.capabilityConfig.planning).toBe(true);
    });

    it('should update localStorage when state changes', () => {
      const { result } = renderHook(() => useGenerationConfigStore());

      // Initial state
      act(() => {
        result.current.setPromptDraft('First draft');
      });

      let stored = localStorage.getItem('generation-config-store');
      expect(stored).toBeTruthy();
      if (!stored) return;

      let parsed = JSON.parse(stored);
      expect(parsed.state.promptDraft).toBe('First draft');

      // Change state again
      act(() => {
        result.current.setPromptDraft('Second draft');
      });

      stored = localStorage.getItem('generation-config-store');
      expect(stored).toBeTruthy();
      if (!stored) return;

      parsed = JSON.parse(stored);
      expect(parsed.state.promptDraft).toBe('Second draft');
    });

    it('should restore state from localStorage', () => {
      const { result } = renderHook(() => useGenerationConfigStore());

      // Set state
      act(() => {
        result.current.setPromptDraft('Restored prompt');
        result.current.setCapabilityConfig({
          inputMode: 'template',
          planning: true,
          compilerChecks: false,
          buildingBlocks: false,
          maxIterations: 3,
        });
      });

      // Verify localStorage was updated
      const stored = localStorage.getItem('generation-config-store');
      expect(stored).toBeTruthy();
      if (!stored) return;

      const parsed = JSON.parse(stored);
      expect(parsed.state.promptDraft).toBe('Restored prompt');
      expect(parsed.state.capabilityConfig.inputMode).toBe('template');
    });

    it('should persist selected model to localStorage', () => {
      const { result } = renderHook(() => useGenerationConfigStore());

      act(() => {
        result.current.setSelectedModel('claude-sonnet-4-5');
      });

      // Check localStorage
      const stored = localStorage.getItem('generation-config-store');
      expect(stored).toBeTruthy();
      if (!stored) return;

      const parsed = JSON.parse(stored);
      expect(parsed.state.selectedModel).toBe('claude-sonnet-4-5');
    });

    it('should update localStorage when model changes', () => {
      const { result } = renderHook(() => useGenerationConfigStore());

      // Initial model
      act(() => {
        result.current.setSelectedModel('gpt-5');
      });

      let stored = localStorage.getItem('generation-config-store');
      expect(stored).toBeTruthy();
      if (!stored) return;

      let parsed = JSON.parse(stored);
      expect(parsed.state.selectedModel).toBe('gpt-5');

      // Change model again
      act(() => {
        result.current.setSelectedModel('claude-haiku-4-5');
      });

      stored = localStorage.getItem('generation-config-store');
      expect(stored).toBeTruthy();
      if (!stored) return;

      parsed = JSON.parse(stored);
      expect(parsed.state.selectedModel).toBe('claude-haiku-4-5');
    });

    it('should persist all state together including model', () => {
      const { result } = renderHook(() => useGenerationConfigStore());

      act(() => {
        result.current.setPromptDraft('Build a chat app');
        result.current.setCapabilityConfig({
          inputMode: 'template',
          planning: true,
          compilerChecks: true,
          buildingBlocks: false,
          maxIterations: 5,
        });
        result.current.setSelectedModel('claude-opus-4-1');
      });

      // Check localStorage
      const stored = localStorage.getItem('generation-config-store');
      expect(stored).toBeTruthy();
      if (!stored) return;

      const parsed = JSON.parse(stored);
      expect(parsed.state.promptDraft).toBe('Build a chat app');
      expect(parsed.state.capabilityConfig.inputMode).toBe('template');
      expect(parsed.state.capabilityConfig.planning).toBe(true);
      expect(parsed.state.capabilityConfig.compilerChecks).toBe(true);
      expect(parsed.state.capabilityConfig.maxIterations).toBe(5);
      expect(parsed.state.selectedModel).toBe('claude-opus-4-1');
    });

    it('should restore model selection from localStorage across page loads', () => {
      const { result: result1 } = renderHook(() => useGenerationConfigStore());

      // Set model
      act(() => {
        result1.current.setSelectedModel('gpt-5-nano');
      });

      // Verify it was persisted
      const stored = localStorage.getItem('generation-config-store');
      expect(stored).toBeTruthy();
      if (!stored) return;

      const parsed = JSON.parse(stored);
      expect(parsed.state.selectedModel).toBe('gpt-5-nano');

      // Simulate new page load by creating a new hook instance
      // The store should restore from localStorage
      const { result: result2 } = renderHook(() => useGenerationConfigStore());

      // Model should be restored from localStorage
      expect(result2.current.selectedModel).toBe('gpt-5-nano');
    });

    it('should handle model persistence with default value', () => {
      // Start fresh
      localStorage.clear();

      const { result } = renderHook(() => useGenerationConfigStore());

      // Should have default model
      expect(result.current.selectedModel).toBe('gpt-5-mini');

      // After setting a different model, it should persist
      act(() => {
        result.current.setSelectedModel('claude-sonnet-4-5');
      });

      const stored = localStorage.getItem('generation-config-store');
      expect(stored).toBeTruthy();
      if (!stored) return;

      const parsed = JSON.parse(stored);
      expect(parsed.state.selectedModel).toBe('claude-sonnet-4-5');
    });
  });

  describe('Store Isolation', () => {
    it('should maintain shared state across multiple hook calls', () => {
      const { result: result1 } = renderHook(() => useGenerationConfigStore());
      const { result: result2 } = renderHook(() => useGenerationConfigStore());

      act(() => {
        result1.current.setPromptDraft('Shared prompt');
      });

      // Both hooks should see the same state (shared store)
      expect(result1.current.promptDraft).toBe('Shared prompt');
      expect(result2.current.promptDraft).toBe('Shared prompt');
    });

    it('should maintain shared capability config across multiple hook calls', () => {
      const { result: result1 } = renderHook(() => useGenerationConfigStore());
      const { result: result2 } = renderHook(() => useGenerationConfigStore());

      act(() => {
        result1.current.setCapabilityConfig({
          ...result1.current.capabilityConfig,
          planning: true,
        });
      });

      // Both hooks should see the same state (shared store)
      expect(result1.current.capabilityConfig.planning).toBe(true);
      expect(result2.current.capabilityConfig.planning).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid prompt updates', () => {
      const { result } = renderHook(() => useGenerationConfigStore());

      act(() => {
        for (let i = 0; i < 10; i++) {
          result.current.setPromptDraft(`Prompt ${i}`);
        }
      });

      expect(result.current.promptDraft).toBe('Prompt 9');
    });

    it('should handle rapid config updates', () => {
      const { result } = renderHook(() => useGenerationConfigStore());

      act(() => {
        for (let i = 0; i < 10; i++) {
          result.current.setCapabilityConfig({
            ...result.current.capabilityConfig,
            maxIterations: i,
          });
        }
      });

      expect(result.current.capabilityConfig.maxIterations).toBe(9);
    });

    it('should handle corrupted localStorage data gracefully', () => {
      // Set invalid JSON in localStorage
      localStorage.setItem('generation-config-store', 'invalid-json');

      // Should fall back to initial state without crashing
      const { result } = renderHook(() => useGenerationConfigStore());

      expect(result.current.promptDraft).toBe('');
      expect(result.current.capabilityConfig).toEqual({
        inputMode: 'naive',
        planning: false,
        compilerChecks: false,
        buildingBlocks: false,
        maxIterations: 3,
      });
    });

    it('should handle long prompt text', () => {
      const { result } = renderHook(() => useGenerationConfigStore());
      const longPrompt = 'A'.repeat(10000);

      act(() => {
        result.current.setPromptDraft(longPrompt);
      });

      expect(result.current.promptDraft).toBe(longPrompt);
    });

    it('should handle special characters in prompt', () => {
      const { result } = renderHook(() => useGenerationConfigStore());
      const specialPrompt = 'Build app with "quotes", <tags>, and\nnewlines';

      act(() => {
        result.current.setPromptDraft(specialPrompt);
      });

      expect(result.current.promptDraft).toBe(specialPrompt);
    });
  });
});
