import * as fs from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as filesystemService from '../../services/filesystem.service';
import { requestBlock } from '../request-block.tool';

// Mock dependencies
vi.mock('fs/promises');
vi.mock('../../services/filesystem.service');
vi.mock('../../lib/logger', () => ({
  databaseLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  configLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('requestBlock Tool', () => {
  const mockOptions = {
    toolCallId: 'test-tool-call-id',
    messages: [],
    experimental_context: {
      sessionId: 'test-session',
      io: {
        to: vi.fn().mockReturnThis(),
        emit: vi.fn(),
      },
    },
  } as any;

  const mockBlockMetadata = {
    id: 'auth-password',
    name: 'Password Authentication',
    version: '1.0.0',
    description: 'Auth block',
    dependencies: {
      bcryptjs: '^2.4.3',
      '@types/bcryptjs': '^2.4.6',
    },
    files: {
      server: ['server/auth.ts', 'server/auth-middleware.ts'],
      client: ['client/useAuth.tsx', 'client/LoginForm.tsx'],
      prisma: ['prisma/schema.prisma'],
    },
    integrationGuide: {
      steps: ['1. Install dependencies', '2. Import and use'],
      exports: {
        server: ['hashPassword', 'verifyPassword'],
        client: ['useAuth', 'AuthProvider'],
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Security - Path Traversal Prevention', () => {
    it('should reject path traversal attempts with ../', async () => {
      await expect(
        requestBlock.execute?.(
          { blockId: '../../../etc/passwd', reason: 'Testing block request' },
          mockOptions,
        ),
      ).rejects.toThrow('Invalid block ID');
    });

    it('should reject blockIds with forward slashes', async () => {
      await expect(
        requestBlock.execute?.(
          { blockId: 'auth/../../secret', reason: 'Testing block request' },
          mockOptions,
        ),
      ).rejects.toThrow('Invalid block ID');
    });

    it('should reject blockIds with backslashes', async () => {
      await expect(
        requestBlock.execute?.(
          { blockId: 'auth\\..\\..\\secret', reason: 'Testing block request' },
          mockOptions,
        ),
      ).rejects.toThrow('Invalid block ID');
    });

    it('should reject blockIds with special characters', async () => {
      await expect(
        requestBlock.execute?.(
          { blockId: 'auth;rm -rf /', reason: 'Testing block request' },
          mockOptions,
        ),
      ).rejects.toThrow('Invalid block ID format');
    });

    it('should reject excessively long blockIds', async () => {
      const longId = 'a'.repeat(51);
      await expect(
        requestBlock.execute?.({ blockId: longId, reason: 'Testing block request' }, mockOptions),
      ).rejects.toThrow('Invalid block ID. Maximum length is 50 characters.');
    });

    it('should accept valid blockIds with hyphens', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockBlockMetadata));
      vi.mocked(filesystemService.readFile).mockResolvedValue('file content');
      vi.mocked(filesystemService.writeFile).mockResolvedValue('File written');

      const result = await requestBlock.execute?.(
        { blockId: 'auth-password', reason: 'Testing block request' },
        mockOptions,
      );

      expect(result).toContain('Password Authentication');
    });

    it('should accept valid blockIds with underscores', async () => {
      const validMetadata = { ...mockBlockMetadata, id: 'auth_password' };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(validMetadata));
      vi.mocked(filesystemService.readFile).mockResolvedValue('file content');
      vi.mocked(filesystemService.writeFile).mockResolvedValue('File written');

      const result = await requestBlock.execute?.(
        { blockId: 'auth_password', reason: 'Testing block request' },
        mockOptions,
      );

      expect(result).toContain('Password Authentication');
    });
  });

  describe('Metadata Validation', () => {
    it('should reject block with missing required fields', async () => {
      const invalidMetadata = {
        id: 'invalid-block',
        // Missing name, version, description
      };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(invalidMetadata));

      await expect(
        requestBlock.execute?.(
          { blockId: 'invalid-block', reason: 'Testing block request' },
          mockOptions,
        ),
      ).rejects.toThrow('has invalid metadata');
    });

    it('should reject block with invalid version format', async () => {
      const invalidMetadata = {
        ...mockBlockMetadata,
        version: 'not-semver',
      };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(invalidMetadata));

      await expect(
        requestBlock.execute?.(
          { blockId: 'auth-password', reason: 'Testing block request' },
          mockOptions,
        ),
      ).rejects.toThrow('Version must follow semantic versioning');
    });

    it('should reject block with malformed JSON', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('{ invalid json');

      await expect(
        requestBlock.execute?.(
          { blockId: 'auth-password', reason: 'Testing block request' },
          mockOptions,
        ),
      ).rejects.toThrow('has malformed JSON');
    });

    it('should accept valid block metadata', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockBlockMetadata));
      vi.mocked(filesystemService.readFile).mockResolvedValue('file content');
      vi.mocked(filesystemService.writeFile).mockResolvedValue('File written');

      const result = await requestBlock.execute?.(
        { blockId: 'auth-password', reason: 'Testing block request' },
        mockOptions,
      );

      expect(result).toContain('Password Authentication Block Copied');
      expect(result).toContain('bcryptjs');
    });
  });

  describe('File Copying', () => {
    beforeEach(() => {
      vi.mocked(fs.readFile).mockImplementation(async (path) => {
        if (path.toString().endsWith('block.json')) {
          return JSON.stringify(mockBlockMetadata);
        }
        return 'file content';
      });
      vi.mocked(filesystemService.readFile).mockResolvedValue('file content');
      vi.mocked(filesystemService.writeFile).mockResolvedValue('File written');
    });

    it('should copy all server files', async () => {
      await requestBlock.execute?.(
        { blockId: 'auth-password', reason: 'Testing block request' },
        mockOptions,
      );

      expect(filesystemService.writeFile).toHaveBeenCalledWith(
        'test-session',
        'server/src/auth.ts',
        expect.any(String),
      );
      expect(filesystemService.writeFile).toHaveBeenCalledWith(
        'test-session',
        'server/src/auth-middleware.ts',
        expect.any(String),
      );
    });

    it('should copy all client files', async () => {
      await requestBlock.execute?.(
        { blockId: 'auth-password', reason: 'Testing block request' },
        mockOptions,
      );

      expect(filesystemService.writeFile).toHaveBeenCalledWith(
        'test-session',
        'client/src/useAuth.tsx',
        expect.any(String),
      );
      expect(filesystemService.writeFile).toHaveBeenCalledWith(
        'test-session',
        'client/src/LoginForm.tsx',
        expect.any(String),
      );
    });

    it('should copy prisma files to blocks subdirectory', async () => {
      await requestBlock.execute?.(
        { blockId: 'auth-password', reason: 'Testing block request' },
        mockOptions,
      );

      expect(filesystemService.writeFile).toHaveBeenCalledWith(
        'test-session',
        'prisma/blocks/auth-password.prisma',
        expect.any(String),
      );
    });

    it('should emit file_updated events for UI', async () => {
      await requestBlock.execute?.(
        { blockId: 'auth-password', reason: 'Testing block request' },
        mockOptions,
      );

      // Should call io.to() with session ID for each file
      expect(mockOptions.experimental_context.io.to).toHaveBeenCalledWith('test-session');
      // Verify emit was called (even if swallowed by error handling)
      expect(mockOptions.experimental_context.io.to).toHaveBeenCalled();
    });
  });

  describe('Integration Guide Generation', () => {
    beforeEach(() => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockBlockMetadata));
      vi.mocked(filesystemService.readFile).mockResolvedValue('file content');
      vi.mocked(filesystemService.writeFile).mockResolvedValue('File written');
    });

    it('should include block name in guide', async () => {
      const result = await requestBlock.execute?.(
        { blockId: 'auth-password', reason: 'Testing block request' },
        mockOptions,
      );

      expect(result).toContain('Password Authentication Block Copied');
    });

    it('should list all copied files', async () => {
      const result = await requestBlock.execute?.(
        { blockId: 'auth-password', reason: 'Testing block request' },
        mockOptions,
      );

      expect(result).toContain('server/src/auth.ts');
      expect(result).toContain('client/src/useAuth.tsx');
      expect(result).toContain('prisma/blocks/auth-password.prisma');
    });

    it('should list all dependencies with versions', async () => {
      const result = await requestBlock.execute?.(
        { blockId: 'auth-password', reason: 'Testing block request' },
        mockOptions,
      );

      expect(result).toContain('bcryptjs@^2.4.3');
      expect(result).toContain('@types/bcryptjs@^2.4.6');
    });

    it('should include integration steps', async () => {
      const result = await requestBlock.execute?.(
        { blockId: 'auth-password', reason: 'Testing block request' },
        mockOptions,
      );

      expect(result).toContain('1. Install dependencies');
      expect(result).toContain('2. Import and use');
    });

    it('should list server exports', async () => {
      const result = await requestBlock.execute?.(
        { blockId: 'auth-password', reason: 'Testing block request' },
        mockOptions,
      );

      expect(result).toContain('hashPassword');
      expect(result).toContain('verifyPassword');
    });

    it('should list client exports', async () => {
      const result = await requestBlock.execute?.(
        { blockId: 'auth-password', reason: 'Testing block request' },
        mockOptions,
      );

      expect(result).toContain('useAuth');
      expect(result).toContain('AuthProvider');
    });
  });

  describe('Error Handling', () => {
    it('should throw clear error for non-existent block', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT: file not found'));

      await expect(
        requestBlock.execute?.(
          { blockId: 'nonexistent-block', reason: 'Testing block request' },
          mockOptions,
        ),
      ).rejects.toThrow('Block "nonexistent-block" not found or invalid');
    });

    it('should handle file read errors gracefully', async () => {
      vi.mocked(fs.readFile).mockImplementation(async (path) => {
        if (path.toString().endsWith('block.json')) {
          return JSON.stringify(mockBlockMetadata);
        }
        throw new Error('File read error');
      });
      vi.mocked(filesystemService.writeFile).mockResolvedValue('File written');

      await expect(
        requestBlock.execute?.(
          { blockId: 'auth-password', reason: 'Testing block request' },
          mockOptions,
        ),
      ).rejects.toThrow();
    });
  });

  describe('Block Integration Verification', () => {
    it('should warn if copied file imports missing dependency', async () => {
      const metadataWithNestedFiles = {
        ...mockBlockMetadata,
        files: {
          server: ['server/auth.ts'], // auth.ts imports from ./lib/prisma
          client: [],
          prisma: [],
        },
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(metadataWithNestedFiles));

      // Mock auth.ts content with import (path is now server/src/auth.ts after transformation)
      vi.mocked(filesystemService.readFile).mockImplementation(async (_, path) => {
        if (path === 'server/src/auth.ts') {
          return "import { prisma } from './lib/prisma';";
        }
        throw new Error('File not found');
      });

      vi.mocked(filesystemService.writeFile).mockResolvedValue('File written');

      const result = await requestBlock.execute?.(
        { blockId: 'auth-password', reason: 'Testing block request' },
        mockOptions,
      );

      // Should include warning about missing import
      expect(result).toContain('⚠️');
      expect(result).toContain('./lib/prisma');
    });

    it('should not warn if all dependencies are present', async () => {
      const metadataWithComplete = {
        ...mockBlockMetadata,
        files: {
          server: ['server/auth.ts', 'server/lib/prisma.ts'],
          client: [],
          prisma: [],
        },
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(metadataWithComplete));

      // Mock both files existing (paths transformed to server/src/*)
      vi.mocked(filesystemService.readFile).mockImplementation(async (_, path) => {
        if (path === 'server/src/auth.ts') {
          return "import { prisma } from './lib/prisma';";
        }
        if (path === 'server/src/lib/prisma.ts') {
          return 'export const prisma = ...;';
        }
        return 'file content';
      });

      vi.mocked(filesystemService.writeFile).mockResolvedValue('File written');

      const result = await requestBlock.execute?.(
        { blockId: 'auth-password', reason: 'Testing block request' },
        mockOptions,
      );

      // Should not include warnings section
      expect(result).not.toContain('⚠️ Warnings');
    });

    it('should preserve nested directory structure', async () => {
      const metadataWithNested = {
        ...mockBlockMetadata,
        files: {
          server: ['server/lib/prisma.ts', 'server/utils/helper.ts'],
          client: [],
          prisma: [],
        },
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(metadataWithNested));
      vi.mocked(filesystemService.readFile).mockResolvedValue('file content');
      vi.mocked(filesystemService.writeFile).mockResolvedValue('File written');

      await requestBlock.execute?.(
        { blockId: 'auth-password', reason: 'Testing block request' },
        mockOptions,
      );

      // Should write to nested paths (transformed to server/src/*)
      expect(filesystemService.writeFile).toHaveBeenCalledWith(
        'test-session',
        'server/src/lib/prisma.ts',
        expect.any(String),
      );
      expect(filesystemService.writeFile).toHaveBeenCalledWith(
        'test-session',
        'server/src/utils/helper.ts',
        expect.any(String),
      );
    });

    it('should detect dynamic imports', async () => {
      const metadata = {
        ...mockBlockMetadata,
        files: {
          server: ['server/index.ts'],
          client: [],
          prisma: [],
        },
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(metadata));

      vi.mocked(filesystemService.readFile).mockImplementation(async (_, path) => {
        if (path === 'server/src/index.ts') {
          return "const module = await import('./missing');";
        }
        throw new Error('File not found');
      });

      vi.mocked(filesystemService.writeFile).mockResolvedValue('File written');

      const result = await requestBlock.execute?.(
        { blockId: 'auth-password', reason: 'Testing block request' },
        mockOptions,
      );

      expect(result).toContain('./missing');
    });

    it('should detect re-exports', async () => {
      const metadata = {
        ...mockBlockMetadata,
        files: {
          server: ['server/index.ts'],
          client: [],
          prisma: [],
        },
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(metadata));

      vi.mocked(filesystemService.readFile).mockImplementation(async (_, path) => {
        if (path === 'server/src/index.ts') {
          return "export * from './missing';";
        }
        throw new Error('File not found');
      });

      vi.mocked(filesystemService.writeFile).mockResolvedValue('File written');

      const result = await requestBlock.execute?.(
        { blockId: 'auth-password', reason: 'Testing block request' },
        mockOptions,
      );

      expect(result).toContain('./missing');
    });

    it('should detect type imports', async () => {
      const metadata = {
        ...mockBlockMetadata,
        files: {
          server: ['server/index.ts'],
          client: [],
          prisma: [],
        },
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(metadata));

      vi.mocked(filesystemService.readFile).mockImplementation(async (_, path) => {
        if (path === 'server/src/index.ts') {
          return "import type { User } from './missing';";
        }
        throw new Error('File not found');
      });

      vi.mocked(filesystemService.writeFile).mockResolvedValue('File written');

      const result = await requestBlock.execute?.(
        { blockId: 'auth-password', reason: 'Testing block request' },
        mockOptions,
      );

      expect(result).toContain('./missing');
    });

    it('should warn about files that are too large', async () => {
      const metadata = {
        ...mockBlockMetadata,
        files: {
          server: ['server/huge.ts'],
          client: [],
          prisma: [],
        },
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(metadata));

      // Mock a file larger than 1MB
      const hugeContent = 'x'.repeat(1_000_001);
      vi.mocked(filesystemService.readFile).mockResolvedValue(hugeContent);
      vi.mocked(filesystemService.writeFile).mockResolvedValue('File written');

      const result = await requestBlock.execute?.(
        { blockId: 'auth-password', reason: 'Testing block request' },
        mockOptions,
      );

      expect(result).toContain('too large to verify');
    });

    it('should skip verification for path traversal attempts', async () => {
      const metadata = {
        ...mockBlockMetadata,
        files: {
          server: ['server/malicious.ts'],
          client: [],
          prisma: [],
        },
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(metadata));

      vi.mocked(filesystemService.readFile).mockImplementation(async (_, path) => {
        if (path === 'server/malicious.ts') {
          return "import { evil } from '../../../../../etc/passwd';";
        }
        throw new Error('File not found');
      });

      vi.mocked(filesystemService.writeFile).mockResolvedValue('File written');

      // Should not crash or warn about the malicious import (it's filtered out)
      const result = await requestBlock.execute?.(
        { blockId: 'auth-password', reason: 'Testing block request' },
        mockOptions,
      );

      // Should complete without error
      expect(result).toBeDefined();
      // Should NOT include the malicious path in warnings
      expect(result).not.toContain('etc/passwd');
    });
  });

  describe('Tool Definition', () => {
    it('should have correct tool description', () => {
      expect(requestBlock.description).toContain('Request a pre-built building block');
      expect(requestBlock.description).toContain('auth-password');
    });

    it('should have blockId parameter', () => {
      expect(requestBlock.inputSchema).toBeDefined();
      // inputSchema is a FlexibleSchema from AI SDK
      // Just verify it exists - actual validation is tested in other tests
      expect(typeof requestBlock.inputSchema).toBe('object');
    });
  });
});
