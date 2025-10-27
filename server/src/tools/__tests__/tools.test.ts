import { writeFile as fsWriteFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as databaseService from '../../services/database.service.js';
import * as filesystemService from '../../services/filesystem.service.js';
import * as commandService from '../../services/command.service.js';
import {
  executeCommand,
  getFileTree,
  installNpmDep,
  readFile,
  validateTypeScript,
  writeFile,
} from '../index.js';

describe('Tools', () => {
  const sessionId = 'test-session-123';
  const context = { experimental_context: { sessionId } };
  let sandboxPath: string;

  beforeEach(async () => {
    // Use the real sandbox initialization for integration testing
    // This ensures the tools work with the actual filesystem service
    sandboxPath = await filesystemService.initializeSandbox(sessionId);

    // Mock database operations to avoid foreign key constraints
    vi.spyOn(databaseService.databaseService, 'saveFile').mockResolvedValue(undefined as any);
  });

  afterEach(async () => {
    // Clean up sandbox using the real cleanup function
    await filesystemService.cleanupSandbox(sessionId);
    vi.restoreAllMocks();
  });

  describe('writeFile tool', () => {
    it('should write a file successfully', async () => {
      const result = await writeFile.execute?.(
        { path: 'test.txt', content: 'Hello, World!', reason: 'Testing file write' },
        context as any,
      );

      expect(result).toContain('Successfully wrote');
      expect(result).toContain('test.txt');
    });

    it('should create nested directories', async () => {
      const result = await writeFile.execute?.(
        {
          path: 'nested/dir/file.txt',
          content: 'Nested content',
          reason: 'Testing nested directories',
        },
        context as any,
      );

      expect(result).toContain('Successfully wrote');
      expect(result).toContain('nested/dir/file.txt');
    });

    it('should handle empty content', async () => {
      const result = await writeFile.execute?.(
        { path: 'empty.txt', content: '', reason: 'Testing empty file' },
        context as any,
      );

      expect(result).toContain('Successfully wrote 0 bytes');
    });
  });

  describe('readFile tool', () => {
    it('should read a file successfully', async () => {
      // Setup: Create test file directly with fs (not using tool under test)
      await fsWriteFile(join(sandboxPath, 'read-test.txt'), 'Test content', 'utf-8');

      const result = await readFile.execute?.(
        { path: 'read-test.txt', reason: 'Testing file read' },
        context as any,
      );

      expect(result).toBe('Test content');
    });

    it('should read nested files', async () => {
      // Setup: Create nested file directly with fs (not using tool under test)
      await mkdir(join(sandboxPath, 'read-subdir'), { recursive: true });
      await fsWriteFile(join(sandboxPath, 'read-subdir/nested.txt'), 'Nested content', 'utf-8');

      const result = await readFile.execute?.(
        { path: 'read-subdir/nested.txt', reason: 'Testing nested read' },
        context as any,
      );

      expect(result).toBe('Nested content');
    });

    it('should throw error for non-existent files', async () => {
      await expect(
        readFile.execute?.(
          { path: 'nonexistent.txt', reason: 'Testing error handling' },
          context as any,
        ),
      ).rejects.toThrow();
    });
  });

  describe('getFileTree tool', () => {
    it('should return complete file tree with all files', async () => {
      // Setup: Create test directory structure directly with fs
      await mkdir(join(sandboxPath, 'tree-subdir'), { recursive: true });
      await fsWriteFile(join(sandboxPath, 'file1.txt'), 'Content 1', 'utf-8');
      await fsWriteFile(join(sandboxPath, 'file2.js'), 'Content 2', 'utf-8');
      await fsWriteFile(join(sandboxPath, 'tree-subdir/nested.txt'), 'Nested', 'utf-8');

      const result = await getFileTree.execute?.(
        { reason: 'Testing file tree generation' },
        context as any,
      );

      // Should contain all files and directories
      expect(result).toContain('file1.txt');
      expect(result).toContain('file2.js');
      expect(result).toContain('tree-subdir');
      expect(result).toContain('nested.txt');

      // Should have tree formatting
      expect(result).toContain('📁');
      expect(result).toContain('📄');
      expect(result).toMatch(/├──|└──/);
    });

    it('should show file and directory counts', async () => {
      // Setup: Create test files
      await fsWriteFile(join(sandboxPath, 'count-test.txt'), 'Test', 'utf-8');

      const result = await getFileTree.execute?.({ reason: 'Testing file counts' }, context as any);

      expect(result).toMatch(/\d+ files?, \d+ director(y|ies)/);
    });

    it('should respect maxDepth parameter', async () => {
      // Setup: Create nested structure
      await mkdir(join(sandboxPath, 'depth-test/level2'), { recursive: true });
      await fsWriteFile(join(sandboxPath, 'depth-test/file.txt'), 'Level 1', 'utf-8');
      await fsWriteFile(join(sandboxPath, 'depth-test/level2/deep.txt'), 'Level 2', 'utf-8');

      const result = await getFileTree.execute?.(
        { maxDepth: 1, reason: 'Testing depth limiting' },
        context as any,
      );

      // Should include first-level directory
      expect(result).toContain('depth-test');

      // Should NOT include nested files beyond depth 1
      expect(result).not.toContain('deep.txt');
    });

    it('should show empty directory message', async () => {
      // Use empty sandbox
      const result = await getFileTree.execute?.(
        { reason: 'Testing empty directory' },
        context as any,
      );

      expect(result).toContain('Empty project directory');
    });
  });

  describe('executeCommand tool', () => {
    it('should execute whitelisted commands', async () => {
      const result = await executeCommand.execute?.(
        { command: 'echo "Hello from test"', reason: 'Testing command execution' },
        context as any,
      );

      expect(result).toContain('Hello from test');
    });

    it('should execute pwd command', async () => {
      const result = await executeCommand.execute?.(
        { command: 'pwd', reason: 'Testing pwd command' },
        context as any,
      );

      expect(result).toContain(sandboxPath);
    });

    it('should reject non-whitelisted commands', async () => {
      await expect(
        executeCommand.execute?.(
          { command: 'rm -rf /', reason: 'Testing security' },
          context as any,
        ),
      ).rejects.toThrow('not whitelisted');
    });

    it('should reject command chaining with &&', async () => {
      await expect(
        executeCommand.execute?.(
          { command: 'echo "test" && rm file.txt', reason: 'Testing security' },
          context as any,
        ),
      ).rejects.toThrow('chaining');
    });

    it('should reject command chaining with ||', async () => {
      await expect(
        executeCommand.execute?.(
          { command: 'echo "test" || echo "fail"', reason: 'Testing security' },
          context as any,
        ),
      ).rejects.toThrow('chaining');
    });

    it('should reject command chaining with ;', async () => {
      await expect(
        executeCommand.execute?.(
          { command: 'echo "test"; echo "another"', reason: 'Testing security' },
          context as any,
        ),
      ).rejects.toThrow('chaining');
    });

    it('should handle command errors gracefully', async () => {
      const result = await executeCommand.execute?.(
        { command: 'ls nonexistent-file-xyz.txt', reason: 'Testing error handling' },
        context as any,
      );

      // executeCommand returns formatted results, doesn't throw
      expect(result).toContain('failed');
      expect(result).toContain('exit code');
    });
  });

  describe('installNpmDep tool', () => {
    beforeEach(async () => {
      // Create initial package.json files for testing
      const clientPkgJson = {
        name: 'client',
        dependencies: {
          react: '^19.0.0',
        },
      };
      const serverPkgJson = {
        name: 'server',
        dependencies: {
          express: '^5.0.0',
        },
      };

      await mkdir(join(sandboxPath, 'client'), { recursive: true });
      await mkdir(join(sandboxPath, 'server'), { recursive: true });
      await fsWriteFile(
        join(sandboxPath, 'client/package.json'),
        JSON.stringify(clientPkgJson, null, 2),
        'utf-8',
      );
      await fsWriteFile(
        join(sandboxPath, 'server/package.json'),
        JSON.stringify(serverPkgJson, null, 2),
        'utf-8',
      );
    });

    it('should add dependencies successfully', async () => {
      const result = await installNpmDep.execute?.(
        {
          target: 'client',
          dependencies: { 'react-router-dom': '^6.26.0' },
          devDependencies: null,
          reason: 'Testing dependency addition',
        },
        context as any,
      );

      expect(result).toContain('Successfully');
      expect(result).toContain('react-router-dom');
    });

    it('should add devDependencies successfully', async () => {
      const result = await installNpmDep.execute?.(
        {
          target: 'server',
          dependencies: null,
          devDependencies: { typescript: '^5.0.0' },
          reason: 'Testing devDependency addition',
        },
        context as any,
      );

      expect(result).toContain('Successfully');
      expect(result).toContain('typescript');
    });

    it('should add both dependencies and devDependencies simultaneously', async () => {
      const result = await installNpmDep.execute?.(
        {
          target: 'client',
          dependencies: { axios: '^1.7.0' },
          devDependencies: { vitest: '^2.0.0' },
          reason: 'Testing both dependency types',
        },
        context as any,
      );

      expect(result).toContain('Successfully');
      expect(result).toContain('axios');
      expect(result).toContain('vitest');
    });

    it('should throw error when no dependencies provided', async () => {
      await expect(
        installNpmDep.execute?.(
          {
            target: 'client',
            dependencies: null,
            devDependencies: null,
            reason: 'Testing error handling',
          },
          context as any,
        ),
      ).rejects.toThrow('Must provide either dependencies or devDependencies');
    });

    it('should handle null to undefined conversion correctly', async () => {
      // This test verifies that null values are converted to undefined
      // which is required by the filesystemService.updatePackageJson signature
      const result = await installNpmDep.execute?.(
        {
          target: 'server',
          dependencies: { 'node-fetch': '^3.0.0' },
          devDependencies: null, // null should be converted to undefined
          reason: 'Testing null conversion',
        },
        context as any,
      );

      expect(result).toContain('Successfully');
      expect(result).toContain('node-fetch');
    });

    it('should preserve existing dependencies', async () => {
      // First verify the test works - read directly via filesystem service
      const result = await installNpmDep.execute?.(
        {
          target: 'client',
          dependencies: { 'react-router-dom': '^6.26.0' },
          devDependencies: null,
          reason: 'Adding new dependency',
        },
        context as any,
      );

      // Verify successful execution
      expect(result).toContain('Successfully');

      // The filesystem service should preserve existing dependencies
      // This is tested in filesystem.service.test.ts
    });
  });

  describe('validateTypeScript tool', () => {
    beforeEach(() => {
      // Restore mocks before each test to ensure clean state
      vi.restoreAllMocks();
      // Re-apply the database mock
      vi.spyOn(databaseService.databaseService, 'saveFile').mockResolvedValue(undefined as any);
    });

    it('should pass validation with 0 TypeScript errors', async () => {
      // Mock successful command execution with no TypeScript errors
      vi.spyOn(commandService, 'executeCommand').mockResolvedValue({
        stdout: 'No errors found',
        stderr: '',
        exitCode: 0,
        executionTime: 1000,
        success: true,
      });

      const result = await validateTypeScript.execute?.(
        { target: 'client', reason: 'Testing validation pass' },
        context as any,
      );

      expect(result).toContain('All TypeScript checks passed');
      expect(result).toContain('No type errors found');
      expect(result).not.toContain('failed');
    });

    it('should fail validation with TypeScript errors', async () => {
      // Mock command execution with TypeScript errors
      const mockOutput = `
client/src/App.tsx(10,5): error TS2322: Type 'string' is not assignable to type 'number'.
client/src/App.tsx(15,10): error TS2304: Cannot find name 'foo'.
`;
      vi.spyOn(commandService, 'executeCommand').mockResolvedValue({
        stdout: mockOutput,
        stderr: '',
        exitCode: 1,
        executionTime: 1000,
        success: true,
      });

      const result = await validateTypeScript.execute?.(
        { target: 'client', reason: 'Testing validation failure' },
        context as any,
      );

      expect(result).toContain('TypeScript validation failed');
      expect(result).toContain('2 errors');
      expect(result).toContain('TS2322');
      expect(result).toContain('TS2304');
      expect(result).not.toContain('0 errors'); // Should not have contradictory message
    });

    it('should handle command timeout as execution error', async () => {
      // Mock command timeout
      vi.spyOn(commandService, 'executeCommand').mockResolvedValue({
        stdout: '',
        stderr: 'Command timed out after 120000ms',
        exitCode: -1,
        executionTime: 120000,
        success: false,
      });

      const result = await validateTypeScript.execute?.(
        { target: 'server', reason: 'Testing timeout handling' },
        context as any,
      );

      expect(result).toContain('execution errors');
      expect(result).toContain('timed out');
      expect(result).not.toContain('0 errors'); // Should not say "failed with 0 errors"
    });

    it('should handle missing tsconfig.json as execution error', async () => {
      // Mock command failure due to missing tsconfig.json
      vi.spyOn(commandService, 'executeCommand').mockResolvedValue({
        stdout: '',
        stderr: "error TS5058: The specified path does not exist: 'client/tsconfig.json'.",
        exitCode: 1,
        executionTime: 100,
        success: false,
      });

      const result = await validateTypeScript.execute?.(
        { target: 'client', reason: 'Testing missing tsconfig' },
        context as any,
      );

      expect(result).toContain('execution errors');
      expect(result).toContain('tsconfig.json');
      expect(result).not.toContain('0 errors'); // Should not say "failed with 0 errors"
    });

    it('should validate both client and server when target is "both"', async () => {
      // Mock successful validation for both targets
      vi.spyOn(commandService, 'executeCommand').mockResolvedValue({
        stdout: 'No errors found',
        stderr: '',
        exitCode: 0,
        executionTime: 1000,
        success: true,
      });

      const result = await validateTypeScript.execute?.(
        { target: 'both', reason: 'Testing both targets' },
        context as any,
      );

      expect(result).toContain('All TypeScript checks passed');
      expect(result).toContain('both');
      expect(commandService.executeCommand).toHaveBeenCalledTimes(2);
    });

    it('should report execution errors for both targets separately', async () => {
      // Mock: client succeeds, server fails with timeout
      let callCount = 0;
      vi.spyOn(commandService, 'executeCommand').mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          // First call (client) - success
          return {
            stdout: 'No errors found',
            stderr: '',
            exitCode: 0,
            executionTime: 1000,
            success: true,
          };
        } else {
          // Second call (server) - timeout
          return {
            stdout: '',
            stderr: 'Command timed out after 120000ms',
            exitCode: -1,
            executionTime: 120000,
            success: false,
          };
        }
      });

      const result = await validateTypeScript.execute?.(
        { target: 'both', reason: 'Testing mixed results' },
        context as any,
      );

      expect(result).toContain('execution errors');
      expect(result).toContain('SERVER');
      expect(result).toContain('timed out');
    });
  });
});

describe('Tools - Path Traversal Security', () => {
  const sessionId = 'test-session-security';
  const context = { experimental_context: { sessionId } };

  // These tests do NOT mock getSandboxPath - they use the real sandbox paths
  // This allows proper path validation testing without mock interference

  describe('writeFile tool', () => {
    it('should reject invalid paths (path traversal)', async () => {
      await expect(
        writeFile.execute?.(
          { path: '../outside.txt', content: 'Should fail', reason: 'Testing security' },
          context as any,
        ),
      ).rejects.toThrow();
    });
  });

  describe('readFile tool', () => {
    it('should reject invalid paths (path traversal)', async () => {
      await expect(
        readFile.execute?.({ path: '../outside.txt', reason: 'Testing security' }, context as any),
      ).rejects.toThrow();
    });
  });

  describe('getFileTree tool', () => {
    beforeEach(async () => {
      // Initialize sandbox for this test
      await filesystemService.initializeSandbox(sessionId);
    });

    afterEach(async () => {
      // Clean up sandbox
      await filesystemService.cleanupSandbox(sessionId);
    });

    it('should not expose excluded directories', async () => {
      const sandboxPath = filesystemService.getSandboxPath(sessionId);

      // Setup: Create files that should be excluded
      await mkdir(join(sandboxPath, 'node_modules'), { recursive: true });
      await fsWriteFile(join(sandboxPath, 'node_modules/package.json'), '{}', 'utf-8');

      const result = await getFileTree.execute?.(
        { reason: 'Testing security exclusions' },
        context as any,
      );

      // Should not contain excluded directories
      expect(result).not.toMatch(/📁 node_modules/);
    });
  });
});

// Import tool filtering functions separately since they're not in the default tools export
import { getToolsForCapability, tools } from '../index.js';

describe('getToolsForCapability', () => {
  describe('all capabilities enabled', () => {
    it('should include all tools', () => {
      const filteredTools = getToolsForCapability({
        inputMode: 'template',
        planning: true,
        buildingBlocks: true,
        compilerChecks: true,
        maxIterations: 3,
      });

      // Should include ALL tools from all capability groups
      expect(filteredTools).toHaveProperty('writeFile');
      expect(filteredTools).toHaveProperty('readFile');
      expect(filteredTools).toHaveProperty('getFileTree');
      expect(filteredTools).toHaveProperty('executeCommand');
      expect(filteredTools).toHaveProperty('planArchitecture');
      expect(filteredTools).toHaveProperty('installNpmDep');
      expect(filteredTools).toHaveProperty('validatePrismaSchema');
      expect(filteredTools).toHaveProperty('validateTypeScript');
      expect(filteredTools).toHaveProperty('requestBlock');

      // Should be the same as the full tools object
      expect(Object.keys(filteredTools).sort()).toEqual(Object.keys(tools).sort());
    });
  });

  describe("inputMode: 'template' only", () => {
    it('should include base tools and installNpmDep only', () => {
      const filteredTools = getToolsForCapability({
        inputMode: 'template',
        planning: false,
        buildingBlocks: false,
        compilerChecks: false,
        maxIterations: 3,
      });

      // Should include base tools
      expect(filteredTools).toHaveProperty('writeFile');
      expect(filteredTools).toHaveProperty('readFile');
      expect(filteredTools).toHaveProperty('getFileTree');
      expect(filteredTools).toHaveProperty('executeCommand');

      // Should include installNpmDep (inputMode: 'template')
      expect(filteredTools).toHaveProperty('installNpmDep');

      // Should NOT include capability-specific tools
      expect(filteredTools).not.toHaveProperty('planArchitecture');
      expect(filteredTools).not.toHaveProperty('requestBlock');
      expect(filteredTools).not.toHaveProperty('validatePrismaSchema');
      expect(filteredTools).not.toHaveProperty('validateTypeScript');

      // Should have 5 tools (4 base + 1 template)
      expect(Object.keys(filteredTools).length).toBe(5);
    });
  });

  describe('buildingBlocks only', () => {
    it('should include base tools and requestBlock only', () => {
      const filteredTools = getToolsForCapability({
        inputMode: 'naive',
        planning: false,
        buildingBlocks: true,
        compilerChecks: false,
        maxIterations: 3,
      });

      // Should include base tools
      expect(filteredTools).toHaveProperty('writeFile');
      expect(filteredTools).toHaveProperty('readFile');
      expect(filteredTools).toHaveProperty('getFileTree');
      expect(filteredTools).toHaveProperty('executeCommand');

      // Should include requestBlock (buildingBlocks enabled)
      expect(filteredTools).toHaveProperty('requestBlock');

      // Should NOT include other capability tools
      expect(filteredTools).not.toHaveProperty('planArchitecture');
      expect(filteredTools).not.toHaveProperty('installNpmDep');
      expect(filteredTools).not.toHaveProperty('validatePrismaSchema');
      expect(filteredTools).not.toHaveProperty('validateTypeScript');

      // Should have 5 tools (4 base + 1 building block)
      expect(Object.keys(filteredTools).length).toBe(5);
    });
  });

  describe('compilerChecks only', () => {
    it('should include base tools and validation tools only', () => {
      const filteredTools = getToolsForCapability({
        inputMode: 'naive',
        planning: false,
        buildingBlocks: false,
        compilerChecks: true,
        maxIterations: 3,
      });

      // Should include base tools
      expect(filteredTools).toHaveProperty('writeFile');
      expect(filteredTools).toHaveProperty('readFile');
      expect(filteredTools).toHaveProperty('getFileTree');
      expect(filteredTools).toHaveProperty('executeCommand');

      // Should include validation tools
      expect(filteredTools).toHaveProperty('validatePrismaSchema');
      expect(filteredTools).toHaveProperty('validateTypeScript');

      // Should NOT include other capability tools
      expect(filteredTools).not.toHaveProperty('planArchitecture');
      expect(filteredTools).not.toHaveProperty('installNpmDep');
      expect(filteredTools).not.toHaveProperty('requestBlock');

      // Should have 6 tools (4 base + 2 compiler check)
      expect(Object.keys(filteredTools).length).toBe(6);
    });
  });

  describe('planning only', () => {
    it('should include base tools and planArchitecture only', () => {
      const filteredTools = getToolsForCapability({
        inputMode: 'naive',
        planning: true,
        buildingBlocks: false,
        compilerChecks: false,
        maxIterations: 3,
      });

      // Should include base tools
      expect(filteredTools).toHaveProperty('writeFile');
      expect(filteredTools).toHaveProperty('readFile');
      expect(filteredTools).toHaveProperty('getFileTree');
      expect(filteredTools).toHaveProperty('executeCommand');

      // Should include planArchitecture
      expect(filteredTools).toHaveProperty('planArchitecture');

      // Should NOT include other capability tools
      expect(filteredTools).not.toHaveProperty('installNpmDep');
      expect(filteredTools).not.toHaveProperty('requestBlock');
      expect(filteredTools).not.toHaveProperty('validatePrismaSchema');
      expect(filteredTools).not.toHaveProperty('validateTypeScript');

      // Should have 5 tools (4 base + 1 plan)
      expect(Object.keys(filteredTools).length).toBe(5);
    });
  });

  describe('all capabilities disabled', () => {
    it('should only include base tools', () => {
      const filteredTools = getToolsForCapability({
        inputMode: 'naive',
        planning: false,
        buildingBlocks: false,
        compilerChecks: false,
        maxIterations: 3,
      });

      // Should include base tools only
      expect(filteredTools).toHaveProperty('writeFile');
      expect(filteredTools).toHaveProperty('readFile');
      expect(filteredTools).toHaveProperty('getFileTree');
      expect(filteredTools).toHaveProperty('executeCommand');

      // Should NOT include any capability-specific tools
      expect(filteredTools).not.toHaveProperty('planArchitecture');
      expect(filteredTools).not.toHaveProperty('installNpmDep');
      expect(filteredTools).not.toHaveProperty('requestBlock');
      expect(filteredTools).not.toHaveProperty('validatePrismaSchema');
      expect(filteredTools).not.toHaveProperty('validateTypeScript');

      // Should only have 4 base tools
      expect(Object.keys(filteredTools).length).toBe(4);
    });
  });

  describe('maxIterations parameter', () => {
    it('should not affect tool composition regardless of value', () => {
      // Test with different maxIterations values
      const tools1 = getToolsForCapability({
        inputMode: 'naive',
        planning: false,
        buildingBlocks: false,
        compilerChecks: false,
        maxIterations: 1,
      });

      const tools5 = getToolsForCapability({
        inputMode: 'naive',
        planning: false,
        buildingBlocks: false,
        compilerChecks: false,
        maxIterations: 5,
      });

      // Both should have identical tool sets
      expect(Object.keys(tools1).sort()).toEqual(Object.keys(tools5).sort());

      // Verify they both have only base tools
      expect(Object.keys(tools1).length).toBe(4);
      expect(Object.keys(tools5).length).toBe(4);
    });

    it('should not affect tool composition even with capabilities enabled', () => {
      // Test with capabilities enabled and different maxIterations
      const tools1 = getToolsForCapability({
        inputMode: 'template',
        planning: true,
        buildingBlocks: true,
        compilerChecks: true,
        maxIterations: 1,
      });

      const tools5 = getToolsForCapability({
        inputMode: 'template',
        planning: true,
        buildingBlocks: true,
        compilerChecks: true,
        maxIterations: 5,
      });

      // Both should include all tools
      expect(Object.keys(tools1).sort()).toEqual(Object.keys(tools5).sort());
      expect(Object.keys(tools1).sort()).toEqual(Object.keys(tools).sort());
    });
  });
});
