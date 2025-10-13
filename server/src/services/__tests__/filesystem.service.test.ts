import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  writeFile,
  readFile,
  listFiles,
  initializeSandbox,
  cleanupSandbox,
  getSandboxPath,
} from '../filesystem.service.js';
import { rm, stat } from 'fs/promises';
import { join } from 'path';

describe('Filesystem Service', () => {
  const sessionId = 'test-session-fs-123';

  afterEach(async () => {
    // Clean up after each test
    try {
      await cleanupSandbox(sessionId);
    } catch {
      // Ignore errors if sandbox doesn't exist
    }
  });

  describe('initializeSandbox', () => {
    it('should create sandbox directory', async () => {
      const sandboxPath = await initializeSandbox(sessionId);

      expect(sandboxPath).toContain('generated');
      expect(sandboxPath).toContain(sessionId);

      const stats = await stat(sandboxPath);
      expect(stats.isDirectory()).toBe(true);
    });

    it('should be idempotent (multiple calls create same sandbox)', async () => {
      const path1 = await initializeSandbox(sessionId);
      const path2 = await initializeSandbox(sessionId);

      expect(path1).toBe(path2);
    });
  });

  describe('getSandboxPath', () => {
    it('should return consistent path for session', () => {
      const path1 = getSandboxPath(sessionId);
      const path2 = getSandboxPath(sessionId);

      expect(path1).toBe(path2);
      expect(path1).toContain('generated');
      expect(path1).toContain(sessionId);
    });
  });

  describe('writeFile', () => {
    beforeEach(async () => {
      await initializeSandbox(sessionId);
    });

    it('should write file to sandbox', async () => {
      const result = await writeFile(sessionId, 'test.txt', 'Hello, World!');

      expect(result).toContain('Successfully wrote');
      expect(result).toContain('13 bytes');

      // Verify file was written
      const content = await readFile(sessionId, 'test.txt');
      expect(content).toBe('Hello, World!');
    });

    it('should create nested directories automatically', async () => {
      const result = await writeFile(
        sessionId,
        'deep/nested/dir/file.txt',
        'Nested content'
      );

      expect(result).toContain('Successfully wrote');

      const content = await readFile(sessionId, 'deep/nested/dir/file.txt');
      expect(content).toBe('Nested content');
    });

    it('should overwrite existing files', async () => {
      await writeFile(sessionId, 'overwrite.txt', 'Original content');
      await writeFile(sessionId, 'overwrite.txt', 'New content');

      const content = await readFile(sessionId, 'overwrite.txt');
      expect(content).toBe('New content');
    });

    it('should reject path traversal attempts with ..', async () => {
      await expect(
        writeFile(sessionId, '../escape.txt', 'Malicious content')
      ).rejects.toThrow('Path traversal detected');
    });

    it('should reject absolute paths outside sandbox', async () => {
      await expect(
        writeFile(sessionId, '/etc/passwd', 'Malicious content')
      ).rejects.toThrow('Path traversal detected');
    });

    it('should handle empty content', async () => {
      const result = await writeFile(sessionId, 'empty.txt', '');

      expect(result).toContain('0 bytes');

      const content = await readFile(sessionId, 'empty.txt');
      expect(content).toBe('');
    });
  });

  describe('readFile', () => {
    beforeEach(async () => {
      await initializeSandbox(sessionId);
      await writeFile(sessionId, 'test.txt', 'Test content');
      await writeFile(sessionId, 'nested/file.txt', 'Nested content');
    });

    it('should read existing file', async () => {
      const content = await readFile(sessionId, 'test.txt');
      expect(content).toBe('Test content');
    });

    it('should read nested files', async () => {
      const content = await readFile(sessionId, 'nested/file.txt');
      expect(content).toBe('Nested content');
    });

    it('should throw error for non-existent files', async () => {
      await expect(
        readFile(sessionId, 'nonexistent.txt')
      ).rejects.toThrow('ENOENT');
    });

    it('should reject path traversal attempts', async () => {
      await expect(
        readFile(sessionId, '../escape.txt')
      ).rejects.toThrow('Path traversal detected');
    });

    it('should handle unicode content', async () => {
      const unicodeContent = '你好世界 🚀 こんにちは';
      await writeFile(sessionId, 'unicode.txt', unicodeContent);

      const content = await readFile(sessionId, 'unicode.txt');
      expect(content).toBe(unicodeContent);
    });
  });

  describe('listFiles', () => {
    beforeEach(async () => {
      await initializeSandbox(sessionId);
      await writeFile(sessionId, 'file1.txt', 'Content 1');
      await writeFile(sessionId, 'file2.js', 'Content 2');
      await writeFile(sessionId, 'subdir/nested.txt', 'Nested');
      await writeFile(sessionId, '.hidden', 'Hidden file');
    });

    it('should list files in root directory', async () => {
      const result = await listFiles(sessionId, '.');

      expect(result).toContain('file1.txt');
      expect(result).toContain('file2.js');
      expect(result).toContain('subdir/');
      expect(result).toContain('.hidden');
    });

    it('should list files in subdirectory', async () => {
      const result = await listFiles(sessionId, 'subdir');

      expect(result).toContain('nested.txt');
    });

    it('should indicate directories with trailing slash', async () => {
      const result = await listFiles(sessionId, '.');

      expect(result).toContain('subdir/');
      expect(result).not.toContain('file1.txt/');
    });

    it('should show message for empty directory', async () => {
      await writeFile(sessionId, 'empty_dir/.gitkeep', '');
      const result = await listFiles(sessionId, 'empty_dir');

      expect(result).toContain('.gitkeep');
    });

    it('should throw error for non-existent directory', async () => {
      await expect(
        listFiles(sessionId, 'nonexistent')
      ).rejects.toThrow();
    });

    it('should reject path traversal attempts', async () => {
      await expect(
        listFiles(sessionId, '../..')
      ).rejects.toThrow('Path traversal detected');
    });
  });

  describe('cleanupSandbox', () => {
    beforeEach(async () => {
      await initializeSandbox(sessionId);
      await writeFile(sessionId, 'test.txt', 'Test');
      await writeFile(sessionId, 'nested/file.txt', 'Nested');
    });

    it('should remove sandbox directory completely', async () => {
      const sandboxPath = getSandboxPath(sessionId);

      await cleanupSandbox(sessionId);

      await expect(stat(sandboxPath)).rejects.toThrow('ENOENT');
    });

    it('should not throw error if sandbox does not exist', async () => {
      await cleanupSandbox('nonexistent-session');
      // Should not throw
    });

    it('should remove all nested files and directories', async () => {
      await writeFile(sessionId, 'deep/nested/dir/file.txt', 'Deep');

      await cleanupSandbox(sessionId);

      const sandboxPath = getSandboxPath(sessionId);
      await expect(stat(sandboxPath)).rejects.toThrow('ENOENT');
    });
  });

  describe('Security', () => {
    beforeEach(async () => {
      await initializeSandbox(sessionId);
    });

    const maliciousPaths = [
      '../../../etc/passwd',
      '..\\..\\windows\\system32',
      '/etc/passwd',
      'C:\\Windows\\System32',
      './../../escape',
      'valid/../../../escape',
    ];

    maliciousPaths.forEach((path) => {
      it(`should reject malicious path: ${path}`, async () => {
        await expect(
          writeFile(sessionId, path, 'Malicious')
        ).rejects.toThrow('Path traversal detected');

        await expect(
          readFile(sessionId, path)
        ).rejects.toThrow('Path traversal detected');

        await expect(
          listFiles(sessionId, path)
        ).rejects.toThrow('Path traversal detected');
      });
    });
  });
});
