import { writeFile as fsWriteFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as databaseService from '../../services/database.service.js';
import * as filesystemService from '../../services/filesystem.service.js';
import { executeCommand, listFiles, readFile, writeFile } from '../index.js';

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
        { path: 'test.txt', content: 'Hello, World!' },
        context as any,
      );

      expect(result).toContain('Successfully wrote');
      expect(result).toContain('test.txt');
    });

    it('should create nested directories', async () => {
      const result = await writeFile.execute?.(
        { path: 'nested/dir/file.txt', content: 'Nested content' },
        context as any,
      );

      expect(result).toContain('Successfully wrote');
      expect(result).toContain('nested/dir/file.txt');
    });

    it('should handle empty content', async () => {
      const result = await writeFile.execute?.({ path: 'empty.txt', content: '' }, context as any);

      expect(result).toContain('Successfully wrote 0 bytes');
    });
  });

  describe('readFile tool', () => {
    it('should read a file successfully', async () => {
      // Setup: Create test file directly with fs (not using tool under test)
      await fsWriteFile(join(sandboxPath, 'read-test.txt'), 'Test content', 'utf-8');

      const result = await readFile.execute?.({ path: 'read-test.txt' }, context as any);

      expect(result).toBe('Test content');
    });

    it('should read nested files', async () => {
      // Setup: Create nested file directly with fs (not using tool under test)
      await mkdir(join(sandboxPath, 'read-subdir'), { recursive: true });
      await fsWriteFile(join(sandboxPath, 'read-subdir/nested.txt'), 'Nested content', 'utf-8');

      const result = await readFile.execute?.({ path: 'read-subdir/nested.txt' }, context as any);

      expect(result).toBe('Nested content');
    });

    it('should throw error for non-existent files', async () => {
      await expect(
        readFile.execute?.({ path: 'nonexistent.txt' }, context as any),
      ).rejects.toThrow();
    });
  });

  describe('listFiles tool', () => {
    it('should list files in root directory', async () => {
      // Setup: Create test directory structure directly with fs
      await mkdir(join(sandboxPath, 'list-subdir'), { recursive: true });
      await fsWriteFile(join(sandboxPath, 'file1.txt'), 'Content 1', 'utf-8');
      await fsWriteFile(join(sandboxPath, 'file2.js'), 'Content 2', 'utf-8');
      await fsWriteFile(join(sandboxPath, 'list-subdir/nested.txt'), 'Nested', 'utf-8');

      const result = await listFiles.execute?.({ directory: '.' }, context as any);

      // Formatted with emojis now
      expect(result).toContain('file1.txt');
      expect(result).toContain('file2.js');
      expect(result).toContain('list-subdir');
      expect(result).toContain('Contents of');
    });

    it('should list files in subdirectory', async () => {
      // Setup: Create test directory structure directly with fs
      await mkdir(join(sandboxPath, 'list2-subdir'), { recursive: true });
      await fsWriteFile(join(sandboxPath, 'list2-subdir/nested.txt'), 'Nested', 'utf-8');

      const result = await listFiles.execute?.({ directory: 'list2-subdir' }, context as any);

      expect(result).toContain('nested.txt');
    });

    it('should show empty directory message', async () => {
      // Setup: Create empty directory directly with fs
      await mkdir(join(sandboxPath, 'empty-dir'), { recursive: true });

      const result = await listFiles.execute?.({ directory: 'empty-dir' }, context as any);

      expect(result).toContain('Contents of');
      expect(result).toContain('empty-dir');
    });
  });

  describe('executeCommand tool', () => {
    it('should execute whitelisted commands', async () => {
      const result = await executeCommand.execute?.(
        { command: 'echo "Hello from test"' },
        context as any,
      );

      expect(result).toContain('Hello from test');
    });

    it('should execute pwd command', async () => {
      const result = await executeCommand.execute?.({ command: 'pwd' }, context as any);

      expect(result).toContain(sandboxPath);
    });

    it('should reject non-whitelisted commands', async () => {
      await expect(
        executeCommand.execute?.({ command: 'rm -rf /' }, context as any),
      ).rejects.toThrow('not whitelisted');
    });

    it('should reject command chaining with &&', async () => {
      await expect(
        executeCommand.execute?.({ command: 'echo "test" && rm file.txt' }, context as any),
      ).rejects.toThrow('chaining');
    });

    it('should reject command chaining with ||', async () => {
      await expect(
        executeCommand.execute?.({ command: 'echo "test" || echo "fail"' }, context as any),
      ).rejects.toThrow('chaining');
    });

    it('should reject command chaining with ;', async () => {
      await expect(
        executeCommand.execute?.({ command: 'echo "test"; echo "another"' }, context as any),
      ).rejects.toThrow('chaining');
    });

    it('should handle command errors gracefully', async () => {
      const result = await executeCommand.execute?.(
        { command: 'ls nonexistent-file-xyz.txt' },
        context as any,
      );

      // executeCommand returns formatted results, doesn't throw
      expect(result).toContain('failed');
      expect(result).toContain('exit code');
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
        writeFile.execute?.({ path: '../outside.txt', content: 'Should fail' }, context as any),
      ).rejects.toThrow();
    });
  });

  describe('readFile tool', () => {
    it('should reject invalid paths (path traversal)', async () => {
      await expect(
        readFile.execute?.({ path: '../outside.txt' }, context as any),
      ).rejects.toThrow();
    });
  });

  describe('listFiles tool', () => {
    it('should reject invalid paths (path traversal)', async () => {
      await expect(
        listFiles.execute?.({ directory: '../outside' }, context as any),
      ).rejects.toThrow();
    });
  });
});
