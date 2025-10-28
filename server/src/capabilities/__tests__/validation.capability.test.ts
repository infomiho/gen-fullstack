import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import type { Server as SocketIOServer } from 'socket.io';
import { ValidationCapability } from '../validation.capability.js';
import type { CapabilityContext } from '../../types/index.js';

// Mock command service
vi.mock('../../services/command.service.js', () => ({
  executeCommand: vi.fn(),
}));

// Mock LLM service
vi.mock('../../services/llm.service.js', () => ({
  getModel: vi.fn(() => ({})),
  calculateCost: vi.fn(() => 0),
}));

describe('ValidationCapability', () => {
  let capability: ValidationCapability;
  let mockIo: SocketIOServer;
  let mockContext: CapabilityContext;

  beforeEach(() => {
    // Mock Socket.IO
    mockIo = {
      to: vi.fn(() => ({
        emit: vi.fn(),
      })),
      emit: vi.fn(),
    } as any;

    // Create capability instance
    capability = new ValidationCapability('gpt-5-mini', mockIo);

    // Mock context
    mockContext = {
      sessionId: 'test-session-123',
      prompt: 'Build a todo list app',
      sandboxPath: '/tmp/sandbox-123',
      tokens: { input: 0, output: 0, total: 0 },
      cost: 0,
      toolCalls: 0,
      startTime: Date.now(),
      abortSignal: new AbortController().signal,
    };
  });

  describe('getName', () => {
    it('returns "Validation"', () => {
      expect(capability.getName()).toBe('Validation');
    });
  });

  describe('validateContext', () => {
    it('validates required fields', () => {
      expect(() => capability.validateContext(mockContext)).not.toThrow();
    });

    it('throws if sessionId is missing', () => {
      const invalidContext = { ...mockContext, sessionId: undefined as any };
      expect(() => capability.validateContext(invalidContext)).toThrow(
        'ValidationCapability requires context.sessionId',
      );
    });

    it('throws if sandboxPath is missing', () => {
      const invalidContext = { ...mockContext, sandboxPath: undefined as any };
      expect(() => capability.validateContext(invalidContext)).toThrow(
        'ValidationCapability requires context.sandboxPath',
      );
    });
  });

  describe('execute', () => {
    it('returns empty errors when all checks pass', async () => {
      const { executeCommand } = await import('../../services/command.service.js');
      const mockExecuteCommand = executeCommand as Mock;

      // Mock successful npm install (added in validation phase)
      mockExecuteCommand.mockResolvedValueOnce({
        success: true,
        exitCode: 0,
        stdout: 'Dependencies installed',
        stderr: '',
      });

      // Mock successful Prisma validation
      mockExecuteCommand.mockResolvedValueOnce({
        success: true,
        exitCode: 0,
        stdout: 'The schema is valid',
        stderr: '',
      });

      // Mock successful TypeScript validation (client)
      mockExecuteCommand.mockResolvedValueOnce({
        success: true,
        exitCode: 0,
        stdout: '',
        stderr: '',
      });

      // Mock successful TypeScript validation (server)
      mockExecuteCommand.mockResolvedValueOnce({
        success: true,
        exitCode: 0,
        stdout: '',
        stderr: '',
      });

      const result = await capability.execute(mockContext);

      expect(result.success).toBe(true);
      expect(result.contextUpdates?.validationErrors).toEqual([]);
      expect(result.tokensUsed?.input).toBe(0); // No LLM calls
      expect(result.tokensUsed?.output).toBe(0);
    });

    it('returns Prisma errors when schema validation fails', async () => {
      const { executeCommand } = await import('../../services/command.service.js');
      const mockExecuteCommand = executeCommand as Mock;

      // Mock successful npm install
      mockExecuteCommand.mockResolvedValueOnce({
        success: true,
        exitCode: 0,
        stdout: 'Dependencies installed',
        stderr: '',
      });

      // Mock Prisma validation failure
      mockExecuteCommand.mockResolvedValueOnce({
        success: false,
        exitCode: 1,
        stdout: '',
        stderr: `Error validating model "User": Field "email" has invalid type`,
      });

      // Mock TypeScript validations passing
      mockExecuteCommand.mockResolvedValueOnce({
        success: true,
        exitCode: 0,
        stdout: '',
        stderr: '',
      });

      mockExecuteCommand.mockResolvedValueOnce({
        success: true,
        exitCode: 0,
        stdout: '',
        stderr: '',
      });

      const result = await capability.execute(mockContext);

      expect(result.success).toBe(true);
      expect(result.contextUpdates?.validationErrors).toHaveLength(1);
      expect(result.contextUpdates?.validationErrors?.[0]).toMatchObject({
        type: 'prisma',
        file: 'prisma/schema.prisma',
      });
    });

    it('returns TypeScript errors when type checking fails', async () => {
      const { executeCommand } = await import('../../services/command.service.js');
      const mockExecuteCommand = executeCommand as Mock;

      // Mock successful npm install
      mockExecuteCommand.mockResolvedValueOnce({
        success: true,
        exitCode: 0,
        stdout: 'Dependencies installed',
        stderr: '',
      });

      // Mock Prisma validation passing
      mockExecuteCommand.mockResolvedValueOnce({
        success: true,
        exitCode: 0,
        stdout: 'The schema is valid',
        stderr: '',
      });

      // Mock TypeScript validation failure (client)
      mockExecuteCommand.mockResolvedValueOnce({
        success: false,
        exitCode: 1,
        stdout: `client/src/App.tsx(10,5): error TS2304: Cannot find name 'foo'.`,
        stderr: '',
      });

      // Mock TypeScript validation passing (server)
      mockExecuteCommand.mockResolvedValueOnce({
        success: true,
        exitCode: 0,
        stdout: '',
        stderr: '',
      });

      const result = await capability.execute(mockContext);

      expect(result.success).toBe(true);
      expect(result.contextUpdates?.validationErrors).toHaveLength(1);
      expect(result.contextUpdates?.validationErrors?.[0]).toMatchObject({
        type: 'typescript',
        file: 'client/src/App.tsx',
        line: 10,
        column: 5,
        code: 'TS2304',
      });
    });

    it('returns multiple errors from different sources', async () => {
      const { executeCommand } = await import('../../services/command.service.js');
      const mockExecuteCommand = executeCommand as Mock;

      // Mock successful npm install
      mockExecuteCommand.mockResolvedValueOnce({
        success: true,
        exitCode: 0,
        stdout: 'Dependencies installed',
        stderr: '',
      });

      // Mock Prisma validation failure
      mockExecuteCommand.mockResolvedValueOnce({
        success: false,
        exitCode: 1,
        stdout: '',
        stderr: `Error validating model "User"`,
      });

      // Mock TypeScript validation failure (client)
      mockExecuteCommand.mockResolvedValueOnce({
        success: false,
        exitCode: 1,
        stdout: `client/src/App.tsx(10,5): error TS2304: Cannot find name 'foo'.`,
        stderr: '',
      });

      // Mock TypeScript validation failure (server)
      mockExecuteCommand.mockResolvedValueOnce({
        success: false,
        exitCode: 1,
        stdout: `server/src/index.ts(5,1): error TS2322: Type 'string' is not assignable to type 'number'.`,
        stderr: '',
      });

      const result = await capability.execute(mockContext);

      expect(result.success).toBe(true);
      expect(result.contextUpdates?.validationErrors).toHaveLength(3);

      // Check we have one of each type
      const errorTypes = result.contextUpdates?.validationErrors?.map((e) => e.type);
      expect(errorTypes).toContain('prisma');
      expect(errorTypes?.filter((t) => t === 'typescript')).toHaveLength(2);
    });

    it('handles command execution errors gracefully', async () => {
      const { executeCommand } = await import('../../services/command.service.js');
      const mockExecuteCommand = executeCommand as Mock;

      // Mock successful npm install
      mockExecuteCommand.mockResolvedValueOnce({
        success: true,
        exitCode: 0,
        stdout: 'Dependencies installed',
        stderr: '',
      });

      // Mock Prisma validation error - returns error in ValidationError format
      mockExecuteCommand.mockResolvedValueOnce({
        success: true,
        exitCode: 0,
        stdout: 'Schema valid',
        stderr: '',
      });

      // Mock TypeScript command throwing actual execution error (timeout, etc.)
      // The capability catches these and returns them as ValidationErrors
      mockExecuteCommand.mockRejectedValueOnce(new Error('Command timeout'));

      mockExecuteCommand.mockRejectedValueOnce(new Error('Command timeout'));

      const result = await capability.execute(mockContext);

      // Validation capability returns success:true but with validation errors
      expect(result.success).toBe(true);
      expect(result.contextUpdates?.validationErrors).toBeDefined();
      expect(
        result.contextUpdates?.validationErrors?.some((e) => e.message.includes('timeout')),
      ).toBe(true);
    });
  });
});
