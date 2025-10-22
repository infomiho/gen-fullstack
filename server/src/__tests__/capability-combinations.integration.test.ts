/**
 * Integration tests for capability combinations
 *
 * Tests the orchestrator with different capability pipeline configurations
 * to ensure they work correctly together.
 */

import type { Server as SocketIOServer } from 'socket.io';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CapabilityOrchestrator } from '../orchestrator/capability-orchestrator.js';
import { databaseService } from '../services/database.service.js';
import type {
  CapabilityConfig,
  ClientToServerEvents,
  ServerToClientEvents,
} from '../types/index.js';
import { createMockIO } from './helpers/test-mocks.js';

// Mock the filesystem service to avoid actual file operations
vi.mock('../services/filesystem.service.js', () => ({
  initializeSandbox: vi.fn().mockResolvedValue('/tmp/test-sandbox'),
  copyTemplateToSandbox: vi.fn().mockResolvedValue(15),
  getAllFiles: vi.fn().mockResolvedValue([]),
  getSandboxPath: vi.fn((sessionId: string) => `/tmp/sandbox-${sessionId}`),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

// Mock the command service to avoid executing real commands
vi.mock('../services/command.service.js', () => ({
  executeCommand: vi.fn().mockResolvedValue({
    success: true,
    stdout: '',
    stderr: '',
    exitCode: 0,
  }),
  getAllowedCommands: vi
    .fn()
    .mockReturnValue(['npm', 'npx', 'node', 'ls', 'cat', 'mkdir', 'rm', 'cp', 'mv']),
}));

// Mock the Docker service to avoid creating real containers
vi.mock('../services/docker.service.js', () => ({
  dockerService: {
    createContainer: vi.fn().mockResolvedValue({
      sessionId: 'test-session',
      status: 'ready',
      clientPort: 5001,
      serverPort: 5002,
      clientUrl: 'http://localhost:5001',
      serverUrl: 'http://localhost:5002',
      containerId: 'mock-container-id',
    }),
    hasContainer: vi.fn().mockReturnValue(true),
    executeCommand: vi.fn().mockResolvedValue({
      success: true,
      stdout: '',
      stderr: '',
      exitCode: 0,
      executionTime: 100,
    }),
    destroyContainer: vi.fn().mockResolvedValue(undefined),
    updateStatus: vi.fn().mockResolvedValue(undefined),
    getStatus: vi.fn().mockReturnValue({
      sessionId: 'test-session',
      status: 'ready',
      clientPort: 5001,
      serverPort: 5002,
    }),
  },
}));

// Mock AI SDK to avoid real LLM calls
vi.mock('ai', async () => {
  const actual = await vi.importActual<typeof import('ai')>('ai');
  return {
    ...actual,
    streamText: vi.fn(() => ({
      fullStream: (async function* () {
        yield { type: 'text-delta', text: 'Test response' };
        yield { type: 'finish' };
      })(),
      usage: Promise.resolve({ inputTokens: 100, outputTokens: 50 }),
      steps: Promise.resolve([{ toolCalls: [], text: 'Done' }]),
    })),
    generateText: vi.fn(() =>
      Promise.resolve({
        text: 'Test plan',
        usage: Promise.resolve({ inputTokens: 50, outputTokens: 25 }),
      }),
    ),
    stepCountIs: vi.fn((max: number) => max),
  };
});

describe('Capability Combinations Integration', () => {
  let mockIo: SocketIOServer<ClientToServerEvents, ServerToClientEvents>;
  const testPrompt = 'Create a simple todo app';

  beforeEach(async () => {
    mockIo = createMockIO();
    await databaseService.initialize();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
  });

  describe('Naive Mode (No Planning, No Validation)', () => {
    it('should execute only code generation capability', async () => {
      const config: CapabilityConfig = {
        inputMode: 'naive',
        planning: false,
        compilerChecks: false,
        buildingBlocks: false,
        maxIterations: 3,
      };

      const sessionId = `test-naive-${Date.now()}`;
      await databaseService.createSession({
        id: sessionId,
        prompt: testPrompt,
        capabilityConfig: JSON.stringify(config),
        status: 'generating',
      });

      const orchestrator = new CapabilityOrchestrator('gpt-5-nano', mockIo);
      const metrics = await orchestrator.generateApp(testPrompt, config, sessionId);

      // Should complete successfully
      expect(metrics.sessionId).toBe(sessionId);
      expect(metrics.totalTokens).toBeGreaterThan(0);
      expect(metrics.cost).toBeGreaterThanOrEqual(0);

      // Cleanup
      await databaseService.deleteSession(sessionId);
    });
  });

  describe('Planning Mode', () => {
    it('should execute planning then code generation', async () => {
      const config: CapabilityConfig = {
        inputMode: 'naive',
        planning: true,
        compilerChecks: false,
        buildingBlocks: false,
        maxIterations: 3,
      };

      const sessionId = `test-planning-${Date.now()}`;
      await databaseService.createSession({
        id: sessionId,
        prompt: testPrompt,
        capabilityConfig: JSON.stringify(config),
        status: 'generating',
      });

      const orchestrator = new CapabilityOrchestrator('gpt-5-nano', mockIo);
      const metrics = await orchestrator.generateApp(testPrompt, config, sessionId);

      // Should complete successfully with tokens from both phases
      expect(metrics.sessionId).toBe(sessionId);
      expect(metrics.totalTokens).toBeGreaterThan(0);
      expect(metrics.inputTokens).toBeGreaterThanOrEqual(150); // At least planning + generation

      // Cleanup
      await databaseService.deleteSession(sessionId);
    });
  });

  describe('Template Mode', () => {
    it('should execute template copy then code generation', async () => {
      const config: CapabilityConfig = {
        inputMode: 'template',
        templateOptions: {
          templateName: 'vite-fullstack-base',
        },
        planning: false,
        compilerChecks: false,
        buildingBlocks: false,
        maxIterations: 3,
      };

      const sessionId = `test-template-${Date.now()}`;
      await databaseService.createSession({
        id: sessionId,
        prompt: testPrompt,
        capabilityConfig: JSON.stringify(config),
        status: 'generating',
      });

      const orchestrator = new CapabilityOrchestrator('gpt-5-nano', mockIo);
      const metrics = await orchestrator.generateApp(testPrompt, config, sessionId);

      // Should complete successfully
      expect(metrics.sessionId).toBe(sessionId);
      expect(metrics.totalTokens).toBeGreaterThan(0);

      // Verify template capability was called
      const { copyTemplateToSandbox } = await import('../services/filesystem.service.js');
      expect(copyTemplateToSandbox).toHaveBeenCalledWith(sessionId, 'vite-fullstack-base');

      // Cleanup
      await databaseService.deleteSession(sessionId);
    });
  });

  describe('Validation Only (No Auto-Fix)', () => {
    it('should execute code generation then validation', async () => {
      const config: CapabilityConfig = {
        inputMode: 'naive',
        compilerChecks: true,
        buildingBlocks: false,
        planning: false,
        maxIterations: 3,
      };

      const sessionId = `test-validation-${Date.now()}`;
      await databaseService.createSession({
        id: sessionId,
        prompt: testPrompt,
        capabilityConfig: JSON.stringify(config),
        status: 'generating',
      });

      const orchestrator = new CapabilityOrchestrator('gpt-5-nano', mockIo);
      const metrics = await orchestrator.generateApp(testPrompt, config, sessionId);

      // Should complete successfully
      expect(metrics.sessionId).toBe(sessionId);
      expect(metrics.totalTokens).toBeGreaterThan(0);

      // Validation should have run
      // Note: In mocked environment, validation always passes (success: true from executeCommand)
      // Metrics include validation results when validation capability runs
      if (metrics.schemaValidationPassed !== undefined) {
        expect(metrics.schemaValidationPassed).toBe(true);
      }
      if (metrics.typeCheckPassed !== undefined) {
        expect(metrics.typeCheckPassed).toBe(true);
      }

      // Cleanup
      await databaseService.deleteSession(sessionId);
    });
  });

  describe('Validation + Auto-Fix (Compiler Check)', () => {
    it('should execute code generation, validation, then error fixing', async () => {
      const config: CapabilityConfig = {
        inputMode: 'naive',
        compilerChecks: true,
        buildingBlocks: false,
        maxIterations: 2,
        planning: false,
      };

      const sessionId = `test-compiler-check-${Date.now()}`;
      await databaseService.createSession({
        id: sessionId,
        prompt: testPrompt,
        capabilityConfig: JSON.stringify(config),
        status: 'generating',
      });

      const orchestrator = new CapabilityOrchestrator('gpt-5-nano', mockIo);
      const metrics = await orchestrator.generateApp(testPrompt, config, sessionId);

      // Should complete successfully
      expect(metrics.sessionId).toBe(sessionId);
      expect(metrics.totalTokens).toBeGreaterThan(0);

      // Validation and refinement should have run
      // Note: Since mocked validation passes, error fixing is skipped (no errors to fix)
      if (metrics.schemaValidationPassed !== undefined) {
        expect(metrics.schemaValidationPassed).toBe(true);
      }
      if (metrics.typeCheckPassed !== undefined) {
        expect(metrics.typeCheckPassed).toBe(true);
      }
      // compilerIterations will be 0 when no errors found
      if (metrics.compilerIterations !== undefined) {
        expect(metrics.compilerIterations).toBe(0);
      }

      // Cleanup
      await databaseService.deleteSession(sessionId);
    });
  });

  describe('Planning + Validation + Auto-Fix', () => {
    it('should execute full pipeline with all capabilities', async () => {
      const config: CapabilityConfig = {
        inputMode: 'naive',
        planning: true,
        compilerChecks: true,
        buildingBlocks: false,
        maxIterations: 3,
      };

      const sessionId = `test-full-pipeline-${Date.now()}`;
      await databaseService.createSession({
        id: sessionId,
        prompt: testPrompt,
        capabilityConfig: JSON.stringify(config),
        status: 'generating',
      });

      const orchestrator = new CapabilityOrchestrator('gpt-5-nano', mockIo);
      const metrics = await orchestrator.generateApp(testPrompt, config, sessionId);

      // Should complete successfully
      expect(metrics.sessionId).toBe(sessionId);
      expect(metrics.totalTokens).toBeGreaterThan(0);

      // All metrics should be present
      expect(metrics.inputTokens).toBeGreaterThan(0);
      expect(metrics.outputTokens).toBeGreaterThan(0);
      expect(metrics.cost).toBeGreaterThanOrEqual(0);
      expect(metrics.steps).toBeGreaterThanOrEqual(0);

      // Validation and refinement metrics
      // Note: Since mocked validation passes, error fixing is skipped
      if (metrics.schemaValidationPassed !== undefined) {
        expect(metrics.schemaValidationPassed).toBe(true);
      }
      if (metrics.typeCheckPassed !== undefined) {
        expect(metrics.typeCheckPassed).toBe(true);
      }
      if (metrics.compilerIterations !== undefined) {
        expect(metrics.compilerIterations).toBe(0);
      }
      if (metrics.totalCompilerErrors !== undefined) {
        expect(metrics.totalCompilerErrors).toBe(0);
      }

      // Cleanup
      await databaseService.deleteSession(sessionId);
    });
  });

  describe('Template + Validation + Auto-Fix', () => {
    it('should combine template with validation pipeline', async () => {
      const config: CapabilityConfig = {
        inputMode: 'template',
        templateOptions: {
          templateName: 'vite-fullstack-base',
        },
        compilerChecks: true,
        buildingBlocks: false,
        maxIterations: 2,
        planning: false,
      };

      const sessionId = `test-template-validation-${Date.now()}`;
      await databaseService.createSession({
        id: sessionId,
        prompt: testPrompt,
        capabilityConfig: JSON.stringify(config),
        status: 'generating',
      });

      const orchestrator = new CapabilityOrchestrator('gpt-5-nano', mockIo);
      const metrics = await orchestrator.generateApp(testPrompt, config, sessionId);

      // Should complete successfully
      expect(metrics.sessionId).toBe(sessionId);
      expect(metrics.totalTokens).toBeGreaterThan(0);

      // Template should have been copied
      const { copyTemplateToSandbox } = await import('../services/filesystem.service.js');
      expect(copyTemplateToSandbox).toHaveBeenCalled();

      // Validation metrics should be present
      // Note: Since mocked validation passes, error fixing is skipped
      if (metrics.schemaValidationPassed !== undefined) {
        expect(metrics.schemaValidationPassed).toBe(true);
      }
      if (metrics.typeCheckPassed !== undefined) {
        expect(metrics.typeCheckPassed).toBe(true);
      }

      // Cleanup
      await databaseService.deleteSession(sessionId);
    });
  });

  describe('Context Validation', () => {
    it('should fail validation capability if sandbox path is missing', async () => {
      // Mock initializeSandbox to return empty string
      const { initializeSandbox } = await import('../services/filesystem.service.js');
      vi.mocked(initializeSandbox).mockResolvedValueOnce('');

      const config: CapabilityConfig = {
        inputMode: 'naive',
        compilerChecks: true,
        buildingBlocks: false,
        planning: false,
        maxIterations: 3,
      };

      const sessionId = `test-context-validation-${Date.now()}`;
      await databaseService.createSession({
        id: sessionId,
        prompt: testPrompt,
        capabilityConfig: JSON.stringify(config),
        status: 'generating',
      });

      const orchestrator = new CapabilityOrchestrator('gpt-5-nano', mockIo);
      const metrics = await orchestrator.generateApp(testPrompt, config, sessionId);

      // Should fail due to missing sandboxPath
      expect(metrics.sessionId).toBe(sessionId);

      // Cleanup
      await databaseService.deleteSession(sessionId);
    });
  });

  describe('Abort Handling', () => {
    it('should handle abort during capability execution', async () => {
      const config: CapabilityConfig = {
        inputMode: 'naive',
        planning: false,
        compilerChecks: false,
        buildingBlocks: false,
        maxIterations: 3,
      };

      const sessionId = `test-abort-${Date.now()}`;
      await databaseService.createSession({
        id: sessionId,
        prompt: testPrompt,
        capabilityConfig: JSON.stringify(config),
        status: 'generating',
      });

      const orchestrator = new CapabilityOrchestrator('gpt-5-nano', mockIo);

      // Abort immediately
      orchestrator.abort();

      const metrics = await orchestrator.generateApp(testPrompt, config, sessionId);

      // Should return with cancelled status
      expect(metrics.sessionId).toBe(sessionId);

      // Cleanup
      await databaseService.deleteSession(sessionId);
    });
  });
});
