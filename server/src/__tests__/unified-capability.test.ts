/**
 * Unified Capability Tests
 *
 * Tests for critical fixes in the unified system:
 * - maxIterations config usage
 * - Tool call budget derivation
 */

import { describe, expect, it } from 'vitest';
import { UnifiedCodeGenerationCapability } from '../capabilities/unified-code-generation.capability.js';
import type { Server as SocketIOServer } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '../types/index.js';

describe('UnifiedCodeGenerationCapability', () => {
  describe('maxIterations Config', () => {
    it('should derive tool call budget from maxIterations config', () => {
      const mockIo = {} as SocketIOServer<ClientToServerEvents, ServerToClientEvents>;

      // Test maxIterations = 1 → 25 tool calls (20 + 1*5)
      const cap1 = new UnifiedCodeGenerationCapability('gpt-5-mini', mockIo, {
        inputMode: 'naive',
        planning: false,
        compilerChecks: false,
        buildingBlocks: false,
        maxIterations: 1,
      });
      expect(cap1['maxToolCalls']).toBe(25);

      // Test maxIterations = 3 → 35 tool calls (20 + 3*5)
      const cap3 = new UnifiedCodeGenerationCapability('gpt-5-mini', mockIo, {
        inputMode: 'naive',
        planning: false,
        compilerChecks: false,
        buildingBlocks: false,
        maxIterations: 3,
      });
      expect(cap3['maxToolCalls']).toBe(35);

      // Test maxIterations = 5 → 45 tool calls (20 + 5*5)
      const cap5 = new UnifiedCodeGenerationCapability('gpt-5-mini', mockIo, {
        inputMode: 'naive',
        planning: false,
        compilerChecks: false,
        buildingBlocks: false,
        maxIterations: 5,
      });
      expect(cap5['maxToolCalls']).toBe(45);
    });

    it('should use default maxIterations value correctly', () => {
      const mockIo = {} as SocketIOServer<ClientToServerEvents, ServerToClientEvents>;

      // Default maxIterations is 3 (from Zod schema)
      const cap = new UnifiedCodeGenerationCapability('gpt-5-mini', mockIo, {
        inputMode: 'naive',
        planning: false,
        compilerChecks: false,
        buildingBlocks: false,
        maxIterations: 3, // Explicit default
      });

      expect(cap['maxToolCalls']).toBe(35); // 20 + (3 * 5)
    });

    it('should calculate different budgets for different iteration counts', () => {
      const mockIo = {} as SocketIOServer<ClientToServerEvents, ServerToClientEvents>;

      const configs = [1, 2, 3, 4, 5];
      const expectedCalls = [25, 30, 35, 40, 45]; // 20 + (n * 5)

      configs.forEach((iterations, index) => {
        const cap = new UnifiedCodeGenerationCapability('gpt-5-mini', mockIo, {
          inputMode: 'naive',
          planning: false,
          compilerChecks: false,
          buildingBlocks: false,
          maxIterations: iterations,
        });

        expect(cap['maxToolCalls']).toBe(expectedCalls[index]);
      });
    });
  });

  describe('Capability Name', () => {
    it('should have correct capability name', () => {
      const mockIo = {} as SocketIOServer<ClientToServerEvents, ServerToClientEvents>;

      const cap = new UnifiedCodeGenerationCapability('gpt-5-mini', mockIo, {
        inputMode: 'naive',
        planning: false,
        compilerChecks: false,
        buildingBlocks: false,
        maxIterations: 3,
      });

      expect(cap.getName()).toBe('UnifiedCodeGeneration');
    });
  });
});
