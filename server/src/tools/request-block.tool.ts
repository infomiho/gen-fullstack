import { tool } from 'ai';
import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';
import { databaseLogger } from '../lib/logger.js';
import * as filesystemService from '../services/filesystem.service.js';
import { extractToolContext } from './tool-utils.js';

/**
 * Zod schema for block metadata validation
 * Provides runtime validation and type inference for block.json files
 */
const BlockMetadataSchema = z.object({
  id: z.string().min(1, 'Block ID is required'),
  name: z.string().min(1, 'Block name is required'),
  version: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/, 'Version must follow semantic versioning (e.g., 1.0.0)'),
  description: z.string().min(1, 'Block description is required'),
  dependencies: z.record(z.string(), z.string()).default({}),
  files: z.object({
    server: z.array(z.string()),
    client: z.array(z.string()),
    prisma: z.array(z.string()),
  }),
  integrationGuide: z.object({
    steps: z.array(z.string().min(1)),
    exports: z.object({
      server: z.array(z.string()),
      client: z.array(z.string()),
    }),
  }),
});

/**
 * Block metadata type inferred from Zod schema
 * Single source of truth for both runtime and compile-time validation
 */
type BlockMetadata = z.infer<typeof BlockMetadataSchema>;

/**
 * Get the absolute path to the blocks directory
 */
function getBlocksBasePath(): string {
  // Blocks directory is at project root (one level up from server directory)
  // When running with pnpm --filter server dev, cwd is /path/to/project/server
  return path.join(process.cwd(), '..', 'blocks');
}

/**
 * Validate blockId to prevent path traversal attacks
 * @throws Error if blockId is invalid
 */
function validateBlockId(blockId: string): void {
  // Only allow alphanumeric characters, hyphens, and underscores
  if (!/^[a-z0-9_-]+$/i.test(blockId)) {
    throw new Error(
      'Invalid block ID format. Only alphanumeric characters, hyphens, and underscores are allowed.',
    );
  }

  // Prevent directory traversal attempts
  if (blockId.includes('..') || blockId.includes('/') || blockId.includes('\\')) {
    throw new Error('Invalid block ID. Path traversal is not allowed.');
  }

  // Additional safety: limit length to prevent abuse
  if (blockId.length > 50) {
    throw new Error('Invalid block ID. Maximum length is 50 characters.');
  }
}

/**
 * Load block metadata from block.json with runtime validation
 * @throws Error if block doesn't exist or has invalid metadata
 */
async function loadBlockMetadata(blockId: string): Promise<BlockMetadata> {
  // Validate blockId before using it in file paths
  validateBlockId(blockId);

  const blocksPath = getBlocksBasePath();
  const blockJsonPath = path.join(blocksPath, blockId, 'block.json');

  try {
    const content = await fs.readFile(blockJsonPath, 'utf-8');
    const parsed = JSON.parse(content);

    // Validate metadata structure with Zod
    const metadata = BlockMetadataSchema.parse(parsed);
    return metadata;
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Provide detailed validation error messages
      const issues = error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join(', ');
      throw new Error(`Block "${blockId}" has invalid metadata: ${issues}`);
    }
    if (error instanceof SyntaxError) {
      throw new Error(`Block "${blockId}" has malformed JSON in block.json`);
    }
    throw new Error(`Block "${blockId}" not found or invalid`);
  }
}

/**
 * Copy block files to session sandbox
 */
async function copyBlockFiles(
  sessionId: string,
  blockId: string,
  metadata: BlockMetadata,
): Promise<string[]> {
  const blocksPath = getBlocksBasePath();
  const blockPath = path.join(blocksPath, blockId);
  const copiedFiles: string[] = [];

  // Copy server files
  for (const file of metadata.files.server) {
    const sourcePath = path.join(blockPath, file);
    const content = await fs.readFile(sourcePath, 'utf-8');
    await filesystemService.writeFile(sessionId, file, content);
    copiedFiles.push(file);
  }

  // Copy client files
  for (const file of metadata.files.client) {
    const sourcePath = path.join(blockPath, file);
    const content = await fs.readFile(sourcePath, 'utf-8');
    await filesystemService.writeFile(sessionId, file, content);
    copiedFiles.push(file);
  }

  // Copy prisma files (to prisma/blocks/ subdirectory)
  for (const file of metadata.files.prisma) {
    const sourcePath = path.join(blockPath, file);
    const content = await fs.readFile(sourcePath, 'utf-8');
    // Save to prisma/blocks/{blockId}.prisma for reference
    const destPath = `prisma/blocks/${blockId}.prisma`;
    await filesystemService.writeFile(sessionId, destPath, content);
    copiedFiles.push(destPath);
  }

  return copiedFiles;
}

/**
 * Format integration guide as markdown
 */
function formatIntegrationGuide(metadata: BlockMetadata, copiedFiles: string[]): string {
  let guide = `# ${metadata.name} Block Copied\n\n`;

  guide += `## Files Copied\n`;
  for (const file of copiedFiles) {
    guide += `- ${file}\n`;
  }

  guide += `\n## Dependencies\n`;
  const deps = Object.entries(metadata.dependencies);
  if (deps.length > 0) {
    for (const [pkg, version] of deps) {
      guide += `- ${pkg}@${version}\n`;
    }
  } else {
    guide += 'None\n';
  }

  guide += `\n## Integration Steps\n`;
  for (const step of metadata.integrationGuide.steps) {
    guide += `${step}\n`;
  }

  guide += `\n## Server Exports\n`;
  for (const exp of metadata.integrationGuide.exports.server) {
    guide += `- ${exp}\n`;
  }

  guide += `\n## Client Exports\n`;
  for (const exp of metadata.integrationGuide.exports.client) {
    guide += `- ${exp}\n`;
  }

  return guide;
}

/**
 * Request a building block to be copied to the session workspace
 */
export const requestBlock = tool({
  description: `Request a pre-built building block to be copied into your project. Available blocks:
- auth-password: Complete username/password authentication with bcrypt, sessions, and React components

After requesting a block, you'll receive:
1. All block files copied to your workspace
2. Integration guide with step-by-step instructions
3. List of dependencies to install
4. API documentation and usage examples

Use this to quickly add common features without writing boilerplate code.`,
  inputSchema: z.object({
    blockId: z
      .string()
      .describe('ID of the block to request (e.g., "auth-password"). Only one block at a time.'),
  }),
  execute: async ({ blockId }, { experimental_context: context }) => {
    const { sessionId, io } = extractToolContext(context);

    try {
      // Load block metadata
      const metadata = await loadBlockMetadata(blockId);

      // Copy block files to session sandbox
      const copiedFiles = await copyBlockFiles(sessionId, blockId, metadata);

      // Emit file_updated events for each copied file (for UI update)
      if (io) {
        for (const file of copiedFiles) {
          try {
            const content = await filesystemService.readFile(sessionId, file);
            io.to(sessionId).emit('file_updated', {
              path: file,
              content,
            });
          } catch (error) {
            databaseLogger.warn(
              { error, sessionId, file },
              'Failed to emit file_updated for block file',
            );
          }
        }
      }

      // Format integration guide
      const guide = formatIntegrationGuide(metadata, copiedFiles);

      databaseLogger.info(
        {
          sessionId,
          blockId,
          filesCount: copiedFiles.length,
        },
        'Block requested and copied',
      );

      return guide;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error requesting block';
      databaseLogger.error({ error, sessionId, blockId }, 'Failed to request block');
      throw new Error(errorMessage);
    }
  },
});
