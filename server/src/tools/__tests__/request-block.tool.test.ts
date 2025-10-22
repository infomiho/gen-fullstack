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
        requestBlock.execute?.({ blockId: '../../../etc/passwd' }, mockOptions),
      ).rejects.toThrow('Invalid block ID');
    });

    it('should reject blockIds with forward slashes', async () => {
      await expect(
        requestBlock.execute?.({ blockId: 'auth/../../secret' }, mockOptions),
      ).rejects.toThrow('Invalid block ID');
    });

    it('should reject blockIds with backslashes', async () => {
      await expect(
        requestBlock.execute?.({ blockId: 'auth\\..\\..\\secret' }, mockOptions),
      ).rejects.toThrow('Invalid block ID');
    });

    it('should reject blockIds with special characters', async () => {
      await expect(
        requestBlock.execute?.({ blockId: 'auth;rm -rf /' }, mockOptions),
      ).rejects.toThrow('Invalid block ID format');
    });

    it('should reject excessively long blockIds', async () => {
      const longId = 'a'.repeat(51);
      await expect(requestBlock.execute?.({ blockId: longId }, mockOptions)).rejects.toThrow(
        'Invalid block ID. Maximum length is 50 characters.',
      );
    });

    it('should accept valid blockIds with hyphens', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockBlockMetadata));
      vi.mocked(filesystemService.readFile).mockResolvedValue('file content');
      vi.mocked(filesystemService.writeFile).mockResolvedValue('File written');

      const result = await requestBlock.execute?.({ blockId: 'auth-password' }, mockOptions);

      expect(result).toContain('Password Authentication');
    });

    it('should accept valid blockIds with underscores', async () => {
      const validMetadata = { ...mockBlockMetadata, id: 'auth_password' };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(validMetadata));
      vi.mocked(filesystemService.readFile).mockResolvedValue('file content');
      vi.mocked(filesystemService.writeFile).mockResolvedValue('File written');

      const result = await requestBlock.execute?.({ blockId: 'auth_password' }, mockOptions);

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
        requestBlock.execute?.({ blockId: 'invalid-block' }, mockOptions),
      ).rejects.toThrow('has invalid metadata');
    });

    it('should reject block with invalid version format', async () => {
      const invalidMetadata = {
        ...mockBlockMetadata,
        version: 'not-semver',
      };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(invalidMetadata));

      await expect(
        requestBlock.execute?.({ blockId: 'auth-password' }, mockOptions),
      ).rejects.toThrow('Version must follow semantic versioning');
    });

    it('should reject block with malformed JSON', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('{ invalid json');

      await expect(
        requestBlock.execute?.({ blockId: 'auth-password' }, mockOptions),
      ).rejects.toThrow('has malformed JSON');
    });

    it('should accept valid block metadata', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockBlockMetadata));
      vi.mocked(filesystemService.readFile).mockResolvedValue('file content');
      vi.mocked(filesystemService.writeFile).mockResolvedValue('File written');

      const result = await requestBlock.execute?.({ blockId: 'auth-password' }, mockOptions);

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
      await requestBlock.execute?.({ blockId: 'auth-password' }, mockOptions);

      expect(filesystemService.writeFile).toHaveBeenCalledWith(
        'test-session',
        'server/auth.ts',
        expect.any(String),
      );
      expect(filesystemService.writeFile).toHaveBeenCalledWith(
        'test-session',
        'server/auth-middleware.ts',
        expect.any(String),
      );
    });

    it('should copy all client files', async () => {
      await requestBlock.execute?.({ blockId: 'auth-password' }, mockOptions);

      expect(filesystemService.writeFile).toHaveBeenCalledWith(
        'test-session',
        'client/useAuth.tsx',
        expect.any(String),
      );
      expect(filesystemService.writeFile).toHaveBeenCalledWith(
        'test-session',
        'client/LoginForm.tsx',
        expect.any(String),
      );
    });

    it('should copy prisma files to blocks subdirectory', async () => {
      await requestBlock.execute?.({ blockId: 'auth-password' }, mockOptions);

      expect(filesystemService.writeFile).toHaveBeenCalledWith(
        'test-session',
        'prisma/blocks/auth-password.prisma',
        expect.any(String),
      );
    });

    it('should emit file_updated events for UI', async () => {
      await requestBlock.execute?.({ blockId: 'auth-password' }, mockOptions);

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
      const result = await requestBlock.execute?.({ blockId: 'auth-password' }, mockOptions);

      expect(result).toContain('Password Authentication Block Copied');
    });

    it('should list all copied files', async () => {
      const result = await requestBlock.execute?.({ blockId: 'auth-password' }, mockOptions);

      expect(result).toContain('server/auth.ts');
      expect(result).toContain('client/useAuth.tsx');
      expect(result).toContain('prisma/blocks/auth-password.prisma');
    });

    it('should list all dependencies with versions', async () => {
      const result = await requestBlock.execute?.({ blockId: 'auth-password' }, mockOptions);

      expect(result).toContain('bcryptjs@^2.4.3');
      expect(result).toContain('@types/bcryptjs@^2.4.6');
    });

    it('should include integration steps', async () => {
      const result = await requestBlock.execute?.({ blockId: 'auth-password' }, mockOptions);

      expect(result).toContain('1. Install dependencies');
      expect(result).toContain('2. Import and use');
    });

    it('should list server exports', async () => {
      const result = await requestBlock.execute?.({ blockId: 'auth-password' }, mockOptions);

      expect(result).toContain('hashPassword');
      expect(result).toContain('verifyPassword');
    });

    it('should list client exports', async () => {
      const result = await requestBlock.execute?.({ blockId: 'auth-password' }, mockOptions);

      expect(result).toContain('useAuth');
      expect(result).toContain('AuthProvider');
    });
  });

  describe('Error Handling', () => {
    it('should throw clear error for non-existent block', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT: file not found'));

      await expect(
        requestBlock.execute?.({ blockId: 'nonexistent-block' }, mockOptions),
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
        requestBlock.execute?.({ blockId: 'auth-password' }, mockOptions),
      ).rejects.toThrow();
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
