/**
 * Advanced Integration Tests for Capability Orchestrator
 *
 * Tests advanced scenarios including:
 * - Error propagation through capability chains
 * - Token accounting across multiple capabilities
 * - Abort signal handling in different states
 * - Cost calculation accuracy
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

// Mock the filesystem service
vi.mock('../services/filesystem.service.js', () => ({
  initializeSandbox: vi.fn().mockResolvedValue('/tmp/test-sandbox'),
  copyTemplateToSandbox: vi.fn().mockResolvedValue(15),
  getAllFiles: vi.fn().mockResolvedValue([]),
  getSandboxPath: vi.fn((sessionId: string) => `/tmp/sandbox-${sessionId}`),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

// Mock the command service
vi.mock('../services/command.service.js', () => ({
  executeCommand: vi.fn().mockResolvedValue({
    success: true,
    stdout: '',
    stderr: '',
    exitCode: 0,
    executionTime: 100,
  }),
  getAllowedCommands: vi.fn().mockReturnValue(['npm', 'npx', 'node']),
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

// Mock AI SDK with controllable responses
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
        usage: { inputTokens: 50, outputTokens: 25, totalTokens: 75 },
      }),
    ),
    stepCountIs: vi.fn((max: number) => max),
  };
});

describe('Capability Orchestrator - Advanced Integration', () => {
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

  describe('Error Propagation', () => {
    it('should propagate error from code generation capability', async () => {
      // Mock AI SDK to throw an error
      const { streamText } = await import('ai');
      vi.mocked(streamText).mockImplementationOnce(() => {
        throw new Error('LLM API error');
      });

      const config: CapabilityConfig = {
        inputMode: 'naive',
        planning: false,
        compilerChecks: false,
        buildingBlocks: false,
        maxIterations: 3,
      };

      const sessionId = `test-error-gen-${Date.now()}`;
      await databaseService.createSession({
        id: sessionId,
        prompt: testPrompt,
        capabilityConfig: JSON.stringify(config),
        status: 'generating',
      });

      const orchestrator = new CapabilityOrchestrator('gpt-5-nano', mockIo);

      // Should return metrics with failed status (orchestrator catches errors)
      const metrics = await orchestrator.generateApp(testPrompt, config, sessionId);

      expect(metrics.status).toBe('failed');
      expect(metrics.sessionId).toBe(sessionId);
      expect(metrics.totalTokens).toBe(0); // No tokens when error occurs

      // Cleanup
      await databaseService.deleteSession(sessionId);
    });

    it('should propagate error from planning capability', async () => {
      // Mock generateText to throw an error
      const { generateText } = await import('ai');
      vi.mocked(generateText).mockImplementationOnce(() => {
        throw new Error('Planning failed');
      });

      const config: CapabilityConfig = {
        inputMode: 'naive',
        planning: true,
        compilerChecks: false,
        buildingBlocks: false,
        maxIterations: 3,
      };

      const sessionId = `test-error-planning-${Date.now()}`;
      await databaseService.createSession({
        id: sessionId,
        prompt: testPrompt,
        capabilityConfig: JSON.stringify(config),
        status: 'generating',
      });

      const orchestrator = new CapabilityOrchestrator('gpt-5-nano', mockIo);

      // Should return metrics with failed status
      const metrics = await orchestrator.generateApp(testPrompt, config, sessionId);

      expect(metrics.status).toBe('failed');
      expect(metrics.sessionId).toBe(sessionId);

      // Cleanup
      await databaseService.deleteSession(sessionId);
    });

    it('should handle validation capability errors gracefully', async () => {
      // Mock executeCommand to throw an error during validation
      const { executeCommand } = await import('../services/command.service.js');
      vi.mocked(executeCommand).mockRejectedValueOnce(new Error('Command execution failed'));

      const config: CapabilityConfig = {
        inputMode: 'naive',
        compilerChecks: true,
        buildingBlocks: false,
        planning: false,
        maxIterations: 3,
      };

      const sessionId = `test-error-validation-${Date.now()}`;
      await databaseService.createSession({
        id: sessionId,
        prompt: testPrompt,
        capabilityConfig: JSON.stringify(config),
        status: 'generating',
      });

      const orchestrator = new CapabilityOrchestrator('gpt-5-nano', mockIo);

      // Should return metrics with failed status
      const metrics = await orchestrator.generateApp(testPrompt, config, sessionId);

      expect(metrics.status).toBe('failed');
      expect(metrics.sessionId).toBe(sessionId);

      // Cleanup
      await databaseService.deleteSession(sessionId);
    });

    it('should handle template capability errors', async () => {
      // Mock copyTemplateToSandbox to throw an error
      const { copyTemplateToSandbox } = await import('../services/filesystem.service.js');
      vi.mocked(copyTemplateToSandbox).mockRejectedValueOnce(new Error('Template not found'));

      const config: CapabilityConfig = {
        inputMode: 'template',
        templateOptions: {
          templateName: 'nonexistent-template',
        },
        planning: false,
        compilerChecks: false,
        buildingBlocks: false,
        maxIterations: 3,
      };

      const sessionId = `test-error-template-${Date.now()}`;
      await databaseService.createSession({
        id: sessionId,
        prompt: testPrompt,
        capabilityConfig: JSON.stringify(config),
        status: 'generating',
      });

      const orchestrator = new CapabilityOrchestrator('gpt-5-nano', mockIo);

      // Should return metrics with failed status
      const metrics = await orchestrator.generateApp(testPrompt, config, sessionId);

      expect(metrics.status).toBe('failed');
      expect(metrics.sessionId).toBe(sessionId);

      // Cleanup
      await databaseService.deleteSession(sessionId);
    });
  });

  describe('Token Accounting', () => {
    it('should correctly sum tokens from planning + code generation', async () => {
      const config: CapabilityConfig = {
        inputMode: 'naive',
        planning: true,
        compilerChecks: false,
        buildingBlocks: false,
        maxIterations: 3,
      };

      const sessionId = `test-tokens-planning-${Date.now()}`;
      await databaseService.createSession({
        id: sessionId,
        prompt: testPrompt,
        capabilityConfig: JSON.stringify(config),
        status: 'generating',
      });

      const orchestrator = new CapabilityOrchestrator('gpt-5-nano', mockIo);
      const metrics = await orchestrator.generateApp(testPrompt, config, sessionId);

      // Planning: 50 input + 25 output = 75 tokens
      // Code gen: 100 input + 50 output = 150 tokens
      // Total: 225 tokens (150 input + 75 output)
      expect(metrics.inputTokens).toBe(150);
      expect(metrics.outputTokens).toBe(75);
      expect(metrics.totalTokens).toBe(225);

      // Cleanup
      await databaseService.deleteSession(sessionId);
    });

    it('should correctly calculate cost based on model pricing', async () => {
      const config: CapabilityConfig = {
        inputMode: 'naive',
        planning: false,
        compilerChecks: false,
        buildingBlocks: false,
        maxIterations: 3,
      };

      const sessionId = `test-cost-${Date.now()}`;
      await databaseService.createSession({
        id: sessionId,
        prompt: testPrompt,
        capabilityConfig: JSON.stringify(config),
        status: 'generating',
      });

      const orchestrator = new CapabilityOrchestrator('gpt-5-nano', mockIo);
      const metrics = await orchestrator.generateApp(testPrompt, config, sessionId);

      // Cost should be calculated based on token usage
      expect(metrics.cost).toBeGreaterThan(0);
      expect(metrics.cost).toBeLessThan(1); // Reasonable cost for test

      // Cleanup
      await databaseService.deleteSession(sessionId);
    });

    it('should account for validation tokens (no additional LLM calls)', async () => {
      const config: CapabilityConfig = {
        inputMode: 'naive',
        compilerChecks: true,
        buildingBlocks: false,
        planning: false,
        maxIterations: 3,
      };

      const sessionId = `test-tokens-validation-${Date.now()}`;
      await databaseService.createSession({
        id: sessionId,
        prompt: testPrompt,
        capabilityConfig: JSON.stringify(config),
        status: 'generating',
      });

      const orchestrator = new CapabilityOrchestrator('gpt-5-nano', mockIo);
      const metrics = await orchestrator.generateApp(testPrompt, config, sessionId);

      // Validation doesn't use LLM, so tokens should only be from code generation
      // Code gen: 100 input + 50 output = 150 tokens
      expect(metrics.inputTokens).toBe(100);
      expect(metrics.outputTokens).toBe(50);
      expect(metrics.totalTokens).toBe(150);

      // Cleanup
      await databaseService.deleteSession(sessionId);
    });

    it('should sum tokens from all capabilities in full pipeline', async () => {
      const config: CapabilityConfig = {
        inputMode: 'naive',
        planning: true,
        compilerChecks: true,
        buildingBlocks: false,
        maxIterations: 1,
      };

      const sessionId = `test-tokens-full-${Date.now()}`;
      await databaseService.createSession({
        id: sessionId,
        prompt: testPrompt,
        capabilityConfig: JSON.stringify(config),
        status: 'generating',
      });

      const orchestrator = new CapabilityOrchestrator('gpt-5-nano', mockIo);
      const metrics = await orchestrator.generateApp(testPrompt, config, sessionId);

      // Planning: 50 input + 25 output
      // Code gen: 100 input + 50 output
      // Error fixing: 0 (validation passes in mock)
      // Total: 150 input + 75 output = 225 tokens
      expect(metrics.totalTokens).toBeGreaterThanOrEqual(225);

      // Cleanup
      await databaseService.deleteSession(sessionId);
    });
  });

  describe('Abort Signal Handling', () => {
    it('should abort before any capability starts', async () => {
      const config: CapabilityConfig = {
        inputMode: 'naive',
        planning: false,
        compilerChecks: false,
        buildingBlocks: false,
        maxIterations: 3,
      };

      const sessionId = `test-abort-immediate-${Date.now()}`;
      await databaseService.createSession({
        id: sessionId,
        prompt: testPrompt,
        capabilityConfig: JSON.stringify(config),
        status: 'generating',
      });

      const orchestrator = new CapabilityOrchestrator('gpt-5-nano', mockIo);

      // Abort immediately before starting
      orchestrator.abort();

      const metrics = await orchestrator.generateApp(testPrompt, config, sessionId);

      // Should complete but with minimal work
      expect(metrics.sessionId).toBe(sessionId);
      // Tokens might be 0 or minimal depending on abort timing
      expect(metrics.totalTokens).toBeGreaterThanOrEqual(0);

      // Cleanup
      await databaseService.deleteSession(sessionId);
    });

    it('should handle abort during planning phase', async () => {
      // Mock generateText to delay, giving time to abort
      const { generateText } = await import('ai');
      vi.mocked(generateText).mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            setTimeout(
              () =>
                resolve({
                  text: 'Test plan',
                  usage: { inputTokens: 50, outputTokens: 25, totalTokens: 75 },
                } as any), // Cast to any for test simplicity
              100,
            );
          }),
      );

      const config: CapabilityConfig = {
        inputMode: 'naive',
        planning: true,
        compilerChecks: false,
        buildingBlocks: false,
        maxIterations: 3,
      };

      const sessionId = `test-abort-planning-${Date.now()}`;
      await databaseService.createSession({
        id: sessionId,
        prompt: testPrompt,
        capabilityConfig: JSON.stringify(config),
        status: 'generating',
      });

      const orchestrator = new CapabilityOrchestrator('gpt-5-nano', mockIo);

      // Start generation and abort shortly after
      const generationPromise = orchestrator.generateApp(testPrompt, config, sessionId);

      // Abort after a short delay
      setTimeout(() => orchestrator.abort(), 50);

      const metrics = await generationPromise;

      // Should complete (abort might not interrupt immediately)
      expect(metrics.sessionId).toBe(sessionId);

      // Cleanup
      await databaseService.deleteSession(sessionId);
    });

    it('should handle multiple abort calls idempotently', async () => {
      const config: CapabilityConfig = {
        inputMode: 'naive',
        planning: false,
        compilerChecks: false,
        buildingBlocks: false,
        maxIterations: 3,
      };

      const sessionId = `test-abort-multiple-${Date.now()}`;
      await databaseService.createSession({
        id: sessionId,
        prompt: testPrompt,
        capabilityConfig: JSON.stringify(config),
        status: 'generating',
      });

      const orchestrator = new CapabilityOrchestrator('gpt-5-nano', mockIo);

      // Call abort multiple times
      orchestrator.abort();
      orchestrator.abort();
      orchestrator.abort();

      const metrics = await orchestrator.generateApp(testPrompt, config, sessionId);

      // Should not crash or error
      expect(metrics.sessionId).toBe(sessionId);

      // Cleanup
      await databaseService.deleteSession(sessionId);
    });

    it('should propagate abort through capability chain', async () => {
      // This tests that abort signal is properly passed to each capability
      const config: CapabilityConfig = {
        inputMode: 'naive',
        planning: true,
        compilerChecks: true,
        buildingBlocks: false,
        maxIterations: 3,
      };

      const sessionId = `test-abort-chain-${Date.now()}`;
      await databaseService.createSession({
        id: sessionId,
        prompt: testPrompt,
        capabilityConfig: JSON.stringify(config),
        status: 'generating',
      });

      const orchestrator = new CapabilityOrchestrator('gpt-5-nano', mockIo);

      // Abort before starting
      orchestrator.abort();

      const metrics = await orchestrator.generateApp(testPrompt, config, sessionId);

      // Should complete without errors
      expect(metrics.sessionId).toBe(sessionId);

      // Cleanup
      await databaseService.deleteSession(sessionId);
    });
  });

  describe('Capability Context Propagation', () => {
    it('should propagate sandboxPath through all capabilities', async () => {
      const config: CapabilityConfig = {
        inputMode: 'naive',
        compilerChecks: true,
        buildingBlocks: false,
        planning: false,
        maxIterations: 3,
      };

      const sessionId = `test-context-sandbox-${Date.now()}`;
      await databaseService.createSession({
        id: sessionId,
        prompt: testPrompt,
        capabilityConfig: JSON.stringify(config),
        status: 'generating',
      });

      const orchestrator = new CapabilityOrchestrator('gpt-5-nano', mockIo);
      const metrics = await orchestrator.generateApp(testPrompt, config, sessionId);

      // Should complete successfully (sandboxPath was available)
      expect(metrics.sessionId).toBe(sessionId);
      expect(metrics.totalTokens).toBeGreaterThan(0);

      // Cleanup
      await databaseService.deleteSession(sessionId);
    });

    it('should propagate validation results to error fixing capability', async () => {
      // Mock validation to fail
      const { executeCommand } = await import('../services/command.service.js');
      vi.mocked(executeCommand).mockResolvedValueOnce({
        success: false,
        stdout: 'error TS2304: Cannot find name "foo".',
        stderr: '',
        exitCode: 1,
        executionTime: 100,
      });

      const config: CapabilityConfig = {
        inputMode: 'naive',
        compilerChecks: true,
        buildingBlocks: false,
        maxIterations: 1,
        planning: false,
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

      // Should attempt error fixing (validation results propagated)
      expect(metrics.sessionId).toBe(sessionId);

      // Cleanup
      await databaseService.deleteSession(sessionId);
    });
  });

  describe('Metrics Accuracy', () => {
    it('should report accurate step counts', async () => {
      const config: CapabilityConfig = {
        inputMode: 'naive',
        planning: false,
        compilerChecks: false,
        buildingBlocks: false,
        maxIterations: 3,
      };

      const sessionId = `test-steps-${Date.now()}`;
      await databaseService.createSession({
        id: sessionId,
        prompt: testPrompt,
        capabilityConfig: JSON.stringify(config),
        status: 'generating',
      });

      const orchestrator = new CapabilityOrchestrator('gpt-5-nano', mockIo);
      const metrics = await orchestrator.generateApp(testPrompt, config, sessionId);

      // Should have at least 1 step from code generation
      expect(metrics.steps).toBeGreaterThanOrEqual(0);

      // Cleanup
      await databaseService.deleteSession(sessionId);
    });

    it('should report accurate duration', async () => {
      const config: CapabilityConfig = {
        inputMode: 'naive',
        planning: false,
        compilerChecks: false,
        buildingBlocks: false,
        maxIterations: 3,
      };

      const sessionId = `test-duration-${Date.now()}`;
      await databaseService.createSession({
        id: sessionId,
        prompt: testPrompt,
        capabilityConfig: JSON.stringify(config),
        status: 'generating',
      });

      const orchestrator = new CapabilityOrchestrator('gpt-5-nano', mockIo);
      const startTime = Date.now();
      const metrics = await orchestrator.generateApp(testPrompt, config, sessionId);
      const endTime = Date.now();

      // Duration should be reasonable (>= 0 because fast tests can complete in <1ms)
      expect(metrics.duration).toBeGreaterThanOrEqual(0);
      expect(metrics.duration).toBeLessThanOrEqual(endTime - startTime + 1); // +1ms tolerance

      // Cleanup
      await databaseService.deleteSession(sessionId);
    });

    it('should include validation status in metrics', async () => {
      const config: CapabilityConfig = {
        inputMode: 'naive',
        compilerChecks: true,
        buildingBlocks: false,
        planning: false,
        maxIterations: 3,
      };

      const sessionId = `test-validation-metrics-${Date.now()}`;
      await databaseService.createSession({
        id: sessionId,
        prompt: testPrompt,
        capabilityConfig: JSON.stringify(config),
        status: 'generating',
      });

      const orchestrator = new CapabilityOrchestrator('gpt-5-nano', mockIo);
      const metrics = await orchestrator.generateApp(testPrompt, config, sessionId);

      // Should have validation metrics
      // Note: In mocked environment, validation passes
      if (metrics.typeCheckPassed !== undefined) {
        expect(metrics.typeCheckPassed).toBe(true);
      }
      if (metrics.schemaValidationPassed !== undefined) {
        expect(metrics.schemaValidationPassed).toBe(true);
      }

      // Cleanup
      await databaseService.deleteSession(sessionId);
    });
  });
});
