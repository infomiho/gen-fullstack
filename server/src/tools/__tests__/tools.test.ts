import { writeFile as fsWriteFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as filesystemService from '../../services/filesystem.service.js';
import { executeCommand, listFiles, readFile, writeFile } from '../index.js';

describe('Tools', () => {
  const sessionId = 'test-session-123';
  const context = { experimental_context: { sessionId } };
  let testDir: string;

  beforeEach(async () => {
    // Create a temporary test directory (unique per test with random suffix)
    testDir = join(
      tmpdir(),
      `gen-fullstack-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    );
    await mkdir(testDir, { recursive: true });

    // Mock getSandboxPath to use our test directory
    // Use mockImplementation to capture testDir by reference
    vi.spyOn(filesystemService, 'getSandboxPath').mockImplementation(() => testDir);
  });

  afterEach(async () => {
    // Clean up test directory
    await rm(testDir, { recursive: true, force: true });
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

    it('should reject invalid paths (path traversal)', async () => {
      vi.restoreAllMocks(); // Remove mock to test real validation

      await expect(
        writeFile.execute?.({ path: '../outside.txt', content: 'Should fail' }, context as any),
      ).rejects.toThrow();
    });
  });

  describe('readFile tool', () => {
    it('should read a file successfully', async () => {
      // Setup: Create test file directly with fs (not using tool under test)
      await fsWriteFile(join(testDir, 'read-test.txt'), 'Test content', 'utf-8');

      const result = await readFile.execute?.({ path: 'read-test.txt' }, context as any);

      expect(result).toBe('Test content');
    });

    it('should read nested files', async () => {
      // Setup: Create nested file directly with fs (not using tool under test)
      await mkdir(join(testDir, 'read-subdir'), { recursive: true });
      await fsWriteFile(join(testDir, 'read-subdir/nested.txt'), 'Nested content', 'utf-8');

      const result = await readFile.execute?.({ path: 'read-subdir/nested.txt' }, context as any);

      expect(result).toBe('Nested content');
    });

    it('should throw error for non-existent files', async () => {
      await expect(
        readFile.execute?.({ path: 'nonexistent.txt' }, context as any),
      ).rejects.toThrow();
    });

    it('should reject invalid paths (path traversal)', async () => {
      vi.restoreAllMocks(); // Remove mock to test real validation

      await expect(
        readFile.execute?.({ path: '../outside.txt' }, context as any),
      ).rejects.toThrow();
    });
  });

  describe('listFiles tool', () => {
    it('should list files in root directory', async () => {
      // Setup: Create test directory structure directly with fs
      await mkdir(join(testDir, 'list-subdir'), { recursive: true });
      await fsWriteFile(join(testDir, 'file1.txt'), 'Content 1', 'utf-8');
      await fsWriteFile(join(testDir, 'file2.js'), 'Content 2', 'utf-8');
      await fsWriteFile(join(testDir, 'list-subdir/nested.txt'), 'Nested', 'utf-8');

      const result = await listFiles.execute?.({ directory: '.' }, context as any);

      // Formatted with emojis now
      expect(result).toContain('file1.txt');
      expect(result).toContain('file2.js');
      expect(result).toContain('list-subdir');
      expect(result).toContain('Contents of');
    });

    it('should list files in subdirectory', async () => {
      // Setup: Create test directory structure directly with fs
      await mkdir(join(testDir, 'list2-subdir'), { recursive: true });
      await fsWriteFile(join(testDir, 'list2-subdir/nested.txt'), 'Nested', 'utf-8');

      const result = await listFiles.execute?.({ directory: 'list2-subdir' }, context as any);

      expect(result).toContain('nested.txt');
    });

    it('should show empty directory message', async () => {
      // Setup: Create empty directory directly with fs
      await mkdir(join(testDir, 'empty-dir'), { recursive: true });

      const result = await listFiles.execute?.({ directory: 'empty-dir' }, context as any);

      expect(result).toContain('Contents of');
      expect(result).toContain('empty-dir');
    });

    it('should reject invalid paths (path traversal)', async () => {
      vi.restoreAllMocks(); // Remove mock to test real validation

      await expect(
        listFiles.execute?.({ directory: '../outside' }, context as any),
      ).rejects.toThrow();
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

      expect(result).toContain(testDir);
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
