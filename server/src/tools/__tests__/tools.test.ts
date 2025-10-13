import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { writeFile, readFile, listFiles, executeCommand } from '../index.js';
import * as filesystemService from '../../services/filesystem.service.js';
import * as commandService from '../../services/command.service.js';
import { join } from 'path';
import { mkdir, rm, writeFile as fsWriteFile } from 'fs/promises';
import { tmpdir } from 'os';

describe('Tools', () => {
  const sessionId = 'test-session-123';
  const context = { experimental_context: { sessionId } };
  let testDir: string;

  beforeEach(async () => {
    // Create a temporary test directory
    testDir = join(tmpdir(), `gen-fullstack-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    // Mock getSandboxPath to use our test directory
    vi.spyOn(filesystemService, 'getSandboxPath' as any).mockReturnValue(testDir);
  });

  afterEach(async () => {
    // Clean up test directory
    await rm(testDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  describe('writeFile tool', () => {
    it('should write a file successfully', async () => {
      const result = await writeFile.execute!(
        { path: 'test.txt', content: 'Hello, World!' },
        context as any
      );

      expect(result).toContain('Successfully wrote');
      expect(result).toContain('test.txt');
    });

    it('should create nested directories', async () => {
      const result = await writeFile.execute!(
        { path: 'nested/dir/file.txt', content: 'Nested content' },
        context as any
      );

      expect(result).toContain('Successfully wrote');
      expect(result).toContain('nested/dir/file.txt');
    });

    it('should handle empty content', async () => {
      const result = await writeFile.execute!(
        { path: 'empty.txt', content: '' },
        context as any
      );

      expect(result).toContain('Successfully wrote 0 bytes');
    });

    it('should reject invalid paths (path traversal)', async () => {
      vi.restoreAllMocks(); // Remove mock to test real validation

      await expect(
        writeFile.execute!(
          { path: '../outside.txt', content: 'Should fail' },
          context as any
        )
      ).rejects.toThrow();
    });
  });

  describe('readFile tool', () => {
    beforeEach(async () => {
      // Create test files
      await fsWriteFile(join(testDir, 'test.txt'), 'Test content', 'utf-8');
      await mkdir(join(testDir, 'subdir'), { recursive: true });
      await fsWriteFile(join(testDir, 'subdir/nested.txt'), 'Nested content', 'utf-8');
    });

    it('should read a file successfully', async () => {
      const result = await readFile.execute!(
        { path: 'test.txt' },
        context as any
      );

      expect(result).toBe('Test content');
    });

    it('should read nested files', async () => {
      const result = await readFile.execute!(
        { path: 'subdir/nested.txt' },
        context as any
      );

      expect(result).toBe('Nested content');
    });

    it('should throw error for non-existent files', async () => {
      await expect(
        readFile.execute!(
          { path: 'nonexistent.txt' },
          context as any
        )
      ).rejects.toThrow();
    });

    it('should reject invalid paths (path traversal)', async () => {
      vi.restoreAllMocks(); // Remove mock to test real validation

      await expect(
        readFile.execute!(
          { path: '../outside.txt' },
          context as any
        )
      ).rejects.toThrow();
    });
  });

  describe('listFiles tool', () => {
    beforeEach(async () => {
      // Create test directory structure
      await mkdir(join(testDir, 'subdir'), { recursive: true });
      await fsWriteFile(join(testDir, 'file1.txt'), 'Content 1', 'utf-8');
      await fsWriteFile(join(testDir, 'file2.js'), 'Content 2', 'utf-8');
      await fsWriteFile(join(testDir, 'subdir/nested.txt'), 'Nested', 'utf-8');
    });

    it('should list files in root directory', async () => {
      const result = await listFiles.execute!(
        { path: '.' },
        context as any
      );

      expect(result).toContain('file1.txt');
      expect(result).toContain('file2.js');
      expect(result).toContain('subdir/');
    });

    it('should list files in subdirectory', async () => {
      const result = await listFiles.execute!(
        { path: 'subdir' },
        context as any
      );

      expect(result).toContain('nested.txt');
    });

    it('should show empty directory message', async () => {
      await mkdir(join(testDir, 'empty'), { recursive: true });

      const result = await listFiles.execute!(
        { path: 'empty' },
        context as any
      );

      expect(result).toContain('empty');
    });

    it('should reject invalid paths (path traversal)', async () => {
      vi.restoreAllMocks(); // Remove mock to test real validation

      await expect(
        listFiles.execute!(
          { path: '../outside' },
          context as any
        )
      ).rejects.toThrow();
    });
  });

  describe('executeCommand tool', () => {
    it('should execute whitelisted commands', async () => {
      const result = await executeCommand.execute!(
        { command: 'echo "Hello from test"' },
        context as any
      );

      expect(result).toContain('Hello from test');
    });

    it('should execute pwd command', async () => {
      const result = await executeCommand.execute!(
        { command: 'pwd' },
        context as any
      );

      expect(result).toContain(testDir);
    });

    it('should reject non-whitelisted commands', async () => {
      await expect(
        executeCommand.execute!(
          { command: 'rm -rf /' },
          context as any
        )
      ).rejects.toThrow('not whitelisted');
    });

    it('should reject command chaining with &&', async () => {
      await expect(
        executeCommand.execute!(
          { command: 'echo "test" && rm file.txt' },
          context as any
        )
      ).rejects.toThrow('chaining');
    });

    it('should reject command chaining with ||', async () => {
      await expect(
        executeCommand.execute!(
          { command: 'echo "test" || echo "fail"' },
          context as any
        )
      ).rejects.toThrow('chaining');
    });

    it('should reject command chaining with ;', async () => {
      await expect(
        executeCommand.execute!(
          { command: 'echo "test"; echo "another"' },
          context as any
        )
      ).rejects.toThrow('chaining');
    });

    it('should handle command errors gracefully', async () => {
      await expect(
        executeCommand.execute!(
          { command: 'ls nonexistent-file-xyz.txt' },
          context as any
        )
      ).rejects.toThrow();
    });
  });
});
