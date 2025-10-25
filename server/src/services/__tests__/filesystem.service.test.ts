import { stat } from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanupSandbox,
  copyTemplateToSandbox,
  getSandboxPath,
  initializeSandbox,
  installNpmDep,
  listFiles,
  readFile,
  writeFile,
} from '../filesystem.service.js';

// Mock database service to prevent actual database writes in filesystem tests
vi.mock('../database.service.js', () => ({
  databaseService: {
    saveFile: vi.fn().mockResolvedValue({}),
  },
}));

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
      const result = await writeFile(sessionId, 'deep/nested/dir/file.txt', 'Nested content');

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
      await expect(writeFile(sessionId, '../escape.txt', 'Malicious content')).rejects.toThrow(
        'Path traversal detected',
      );
    });

    it('should reject absolute paths outside sandbox', async () => {
      await expect(writeFile(sessionId, '/etc/passwd', 'Malicious content')).rejects.toThrow(
        'Path traversal detected',
      );
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

    it('should throw ENOENT error with code property for non-existent files', async () => {
      try {
        await readFile(sessionId, 'nonexistent.txt');
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
        expect((err as NodeJS.ErrnoException).code).toBe('ENOENT');
        expect((err as Error).message).toContain('File not found');
        expect((err as Error).message).toContain('nonexistent.txt');
      }
    });

    it('should reject path traversal attempts', async () => {
      await expect(readFile(sessionId, '../escape.txt')).rejects.toThrow('Path traversal detected');
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

      const names = result.map((f) => f.name);
      expect(names).toContain('file1.txt');
      expect(names).toContain('file2.js');
      expect(names).toContain('subdir');
      expect(names).toContain('.hidden');
    });

    it('should list files in subdirectory', async () => {
      const result = await listFiles(sessionId, 'subdir');

      const names = result.map((f) => f.name);
      expect(names).toContain('nested.txt');
    });

    it('should indicate directories with trailing slash', async () => {
      const result = await listFiles(sessionId, '.');

      const subdirEntry = result.find((f) => f.name === 'subdir');
      expect(subdirEntry?.type).toBe('directory');

      const file1Entry = result.find((f) => f.name === 'file1.txt');
      expect(file1Entry?.type).toBe('file');
    });

    it('should show message for empty directory', async () => {
      await writeFile(sessionId, 'empty_dir/.gitkeep', '');
      const result = await listFiles(sessionId, 'empty_dir');

      const names = result.map((f) => f.name);
      expect(names).toContain('.gitkeep');
    });

    it('should throw error for non-existent directory', async () => {
      await expect(listFiles(sessionId, 'nonexistent')).rejects.toThrow();
    });

    it('should reject path traversal attempts', async () => {
      await expect(listFiles(sessionId, '../..')).rejects.toThrow('Path traversal detected');
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

  describe('copyTemplateToSandbox', () => {
    beforeEach(async () => {
      await initializeSandbox(sessionId);
    });

    it('should copy template files to sandbox', async () => {
      const fileCount = await copyTemplateToSandbox(sessionId, 'vite-fullstack-base');

      // Should have copied all 15 template files
      expect(fileCount).toBe(15);

      // Verify root files exist
      const rootFiles = await listFiles(sessionId, '.');
      const rootFileNames = rootFiles.map((f) => f.name);
      expect(rootFileNames).toContain('package.json');
      expect(rootFileNames).toContain('.env');

      // Verify client directory exists
      expect(rootFileNames).toContain('client');
      const clientFiles = await listFiles(sessionId, 'client');
      const clientFileNames = clientFiles.map((f) => f.name);
      expect(clientFileNames).toContain('package.json');
      expect(clientFileNames).toContain('vite.config.ts');
      expect(clientFileNames).toContain('src');

      // Verify server directory exists
      expect(rootFileNames).toContain('server');
      const serverFiles = await listFiles(sessionId, 'server');
      const serverFileNames = serverFiles.map((f) => f.name);
      expect(serverFileNames).toContain('package.json');
      expect(serverFileNames).toContain('src');

      // Verify prisma directory exists
      expect(rootFileNames).toContain('prisma');
      const prismaFiles = await listFiles(sessionId, 'prisma');
      const prismaFileNames = prismaFiles.map((f) => f.name);
      expect(prismaFileNames).toContain('schema.prisma');
    });

    it('should copy file contents correctly', async () => {
      await copyTemplateToSandbox(sessionId, 'vite-fullstack-base');

      // Verify root package.json has correct content
      const rootPackageJson = await readFile(sessionId, 'package.json');
      expect(rootPackageJson).toContain('"name": "fullstack-app"');
      expect(rootPackageJson).toContain('"workspaces"');

      // Verify .env has correct content
      const envFile = await readFile(sessionId, '.env');
      expect(envFile).toContain('DATABASE_URL');

      // Verify Prisma schema has correct content
      const prismaSchema = await readFile(sessionId, 'prisma/schema.prisma');
      expect(prismaSchema).toContain('model User');
      expect(prismaSchema).toContain('provider = "sqlite"');

      // Verify server index.ts has correct content
      const serverIndex = await readFile(sessionId, 'server/src/index.ts');
      expect(serverIndex).toContain('express()');
      expect(serverIndex).toContain('PrismaClient');

      // Verify client App.tsx has correct content
      const clientApp = await readFile(sessionId, 'client/src/App.tsx');
      expect(clientApp).toContain('export default function App()');
      expect(clientApp).toContain('useState');
    });

    it('should throw error for non-existent template', async () => {
      await expect(copyTemplateToSandbox(sessionId, 'non-existent-template')).rejects.toThrow(
        'Unknown template: non-existent-template',
      );
    });

    it('should reject path traversal attempts with ..', async () => {
      await expect(copyTemplateToSandbox(sessionId, '../../../etc')).rejects.toThrow(
        'Invalid template name',
      );

      await expect(copyTemplateToSandbox(sessionId, '..\\..\\windows')).rejects.toThrow(
        'Invalid template name',
      );
    });

    it('should reject path traversal attempts with slashes', async () => {
      await expect(copyTemplateToSandbox(sessionId, 'foo/bar')).rejects.toThrow(
        'Invalid template name',
      );

      await expect(copyTemplateToSandbox(sessionId, 'foo\\bar')).rejects.toThrow(
        'Invalid template name',
      );
    });

    it('should only allow whitelisted templates', async () => {
      await expect(copyTemplateToSandbox(sessionId, 'malicious-template')).rejects.toThrow(
        'Unknown template',
      );

      // Even if directory exists, should reject if not whitelisted
      await expect(copyTemplateToSandbox(sessionId, 'some-other-template')).rejects.toThrow(
        'Unknown template',
      );
    });

    it('should handle copying to clean sandbox', async () => {
      // First copy
      const count1 = await copyTemplateToSandbox(sessionId, 'vite-fullstack-base');
      expect(count1).toBe(15);

      // Cleanup and re-initialize
      await cleanupSandbox(sessionId);
      await initializeSandbox(sessionId);

      // Second copy should also work
      const count2 = await copyTemplateToSandbox(sessionId, 'vite-fullstack-base');
      expect(count2).toBe(15);
    });

    it('should overwrite existing files when copying template', async () => {
      // Write a file that will be overwritten
      await writeFile(sessionId, 'package.json', '{"name": "old-content"}');

      // Copy template
      await copyTemplateToSandbox(sessionId, 'vite-fullstack-base');

      // Verify file was overwritten with template content
      const packageJson = await readFile(sessionId, 'package.json');
      expect(packageJson).toContain('"name": "fullstack-app"');
      expect(packageJson).not.toContain('"name": "old-content"');
    });

    it('should preserve directory structure when copying', async () => {
      await copyTemplateToSandbox(sessionId, 'vite-fullstack-base');

      // Verify nested structure is preserved
      const clientSrcFiles = await listFiles(sessionId, 'client/src');
      const clientSrcFileNames = clientSrcFiles.map((f) => f.name);
      expect(clientSrcFileNames).toContain('App.tsx');
      expect(clientSrcFileNames).toContain('App.css');
      expect(clientSrcFileNames).toContain('main.tsx');

      const serverSrcFiles = await listFiles(sessionId, 'server/src');
      const serverSrcFileNames = serverSrcFiles.map((f) => f.name);
      expect(serverSrcFileNames).toContain('index.ts');
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
        await expect(writeFile(sessionId, path, 'Malicious')).rejects.toThrow(
          'Path traversal detected',
        );

        await expect(readFile(sessionId, path)).rejects.toThrow('Path traversal detected');

        await expect(listFiles(sessionId, path)).rejects.toThrow('Path traversal detected');
      });
    });
  });

  describe('installNpmDep', () => {
    beforeEach(async () => {
      await initializeSandbox(sessionId);
      // Create a basic package.json for testing
      await writeFile(
        sessionId,
        'package.json',
        JSON.stringify(
          {
            name: 'test-app',
            version: '1.0.0',
            dependencies: {
              react: '^18.0.0',
            },
            devDependencies: {
              typescript: '^5.0.0',
            },
          },
          null,
          2,
        ),
      );
    });

    it('should install runtime dependencies without removing existing ones', async () => {
      const result = await installNpmDep(sessionId, 'root', {
        express: '^5.0.0',
        zod: '^3.22.0',
      });

      expect(result).toContain('Successfully installed 2');
      expect(result).toContain('express');
      expect(result).toContain('zod');

      const content = await readFile(sessionId, 'package.json');
      const packageJson = JSON.parse(content);

      // Should have both new and existing dependencies
      expect(packageJson.dependencies).toEqual({
        react: '^18.0.0',
        express: '^5.0.0',
        zod: '^3.22.0',
      });
      // Should not modify devDependencies
      expect(packageJson.devDependencies).toEqual({
        typescript: '^5.0.0',
      });
    });

    it('should install dev dependencies without removing existing ones', async () => {
      const result = await installNpmDep(sessionId, 'root', undefined, {
        vitest: '^3.0.0',
        '@types/node': '^20.0.0',
      });

      expect(result).toContain('Successfully installed 2');
      expect(result).toContain('vitest');
      expect(result).toContain('@types/node');

      const content = await readFile(sessionId, 'package.json');
      const packageJson = JSON.parse(content);

      // Should not modify dependencies
      expect(packageJson.dependencies).toEqual({
        react: '^18.0.0',
      });
      // Should have both new and existing devDependencies
      expect(packageJson.devDependencies).toEqual({
        typescript: '^5.0.0',
        vitest: '^3.0.0',
        '@types/node': '^20.0.0',
      });
    });

    it('should install both runtime and dev dependencies', async () => {
      const result = await installNpmDep(
        sessionId,
        'root',
        { express: '^5.0.0' },
        { vitest: '^3.0.0' },
      );

      expect(result).toContain('Successfully installed 2');

      const content = await readFile(sessionId, 'package.json');
      const packageJson = JSON.parse(content);

      expect(packageJson.dependencies).toEqual({
        react: '^18.0.0',
        express: '^5.0.0',
      });
      expect(packageJson.devDependencies).toEqual({
        typescript: '^5.0.0',
        vitest: '^3.0.0',
      });
    });

    it('should throw error when both parameters are undefined', async () => {
      await expect(installNpmDep(sessionId, 'root', undefined, undefined)).rejects.toThrow(
        'No dependencies provided',
      );
    });

    it('should throw error when both parameters are empty objects', async () => {
      await expect(installNpmDep(sessionId, 'root', {}, {})).rejects.toThrow(
        'No dependencies provided',
      );
    });

    it('should throw error when dependencies is empty object and devDependencies is undefined', async () => {
      await expect(installNpmDep(sessionId, 'root', {}, undefined)).rejects.toThrow(
        'No dependencies provided',
      );
    });

    it('should update existing dependency version', async () => {
      const result = await installNpmDep(sessionId, 'root', {
        react: '^19.0.0', // Update existing version
      });

      expect(result).toContain('Successfully installed 1');

      const content = await readFile(sessionId, 'package.json');
      const packageJson = JSON.parse(content);

      expect(packageJson.dependencies.react).toBe('^19.0.0');
    });

    it('should preserve other package.json fields', async () => {
      await installNpmDep(sessionId, 'root', { express: '^5.0.0' });

      const content = await readFile(sessionId, 'package.json');
      const packageJson = JSON.parse(content);

      // Should preserve name, version, etc.
      expect(packageJson.name).toBe('test-app');
      expect(packageJson.version).toBe('1.0.0');
    });

    it('should handle singular dependency correctly in message', async () => {
      const result = await installNpmDep(sessionId, 'root', { express: '^5.0.0' });

      expect(result).toContain('Successfully installed 1');
      expect(result).toContain('express');
    });

    it('should work with client package.json', async () => {
      // Create client directory and package.json
      await writeFile(
        sessionId,
        'client/package.json',
        JSON.stringify(
          {
            name: 'client-app',
            dependencies: {},
          },
          null,
          2,
        ),
      );

      const result = await installNpmDep(sessionId, 'client', { react: '^18.0.0' });

      expect(result).toContain('client/package.json');

      const content = await readFile(sessionId, 'client/package.json');
      const packageJson = JSON.parse(content);

      expect(packageJson.dependencies.react).toBe('^18.0.0');
    });

    it('should work with server package.json', async () => {
      // Create server directory and package.json
      await writeFile(
        sessionId,
        'server/package.json',
        JSON.stringify(
          {
            name: 'server-app',
            dependencies: {},
          },
          null,
          2,
        ),
      );

      const result = await installNpmDep(sessionId, 'server', { express: '^5.0.0' });

      expect(result).toContain('server/package.json');

      const content = await readFile(sessionId, 'server/package.json');
      const packageJson = JSON.parse(content);

      expect(packageJson.dependencies.express).toBe('^5.0.0');
    });
  });
});
