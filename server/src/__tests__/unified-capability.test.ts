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
    it('should have fixed tool call budget of 150', () => {
      const mockIo = {} as SocketIOServer<ClientToServerEvents, ServerToClientEvents>;

      // Budget is now fixed at 150 regardless of maxIterations
      // This ensures complete app generation even for complex apps with planning
      const cap1 = new UnifiedCodeGenerationCapability('gpt-5-mini', mockIo, {
        inputMode: 'naive',
        planning: false,
        compilerChecks: false,
        buildingBlocks: false,
        maxIterations: 1,
      });
      expect((cap1 as any).maxToolCalls).toBe(150);

      const cap3 = new UnifiedCodeGenerationCapability('gpt-5-mini', mockIo, {
        inputMode: 'naive',
        planning: false,
        compilerChecks: false,
        buildingBlocks: false,
        maxIterations: 3,
      });
      expect((cap3 as any).maxToolCalls).toBe(150);

      const cap5 = new UnifiedCodeGenerationCapability('gpt-5-mini', mockIo, {
        inputMode: 'naive',
        planning: false,
        compilerChecks: false,
        buildingBlocks: false,
        maxIterations: 5,
      });
      expect((cap5 as any).maxToolCalls).toBe(150);
    });

    it('should use fixed budget regardless of config', () => {
      const mockIo = {} as SocketIOServer<ClientToServerEvents, ServerToClientEvents>;

      const cap = new UnifiedCodeGenerationCapability('gpt-5-mini', mockIo, {
        inputMode: 'template',
        planning: true,
        compilerChecks: true,
        buildingBlocks: true,
        maxIterations: 3,
      });

      expect((cap as any).maxToolCalls).toBe(150);
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
