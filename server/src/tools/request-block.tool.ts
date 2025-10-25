import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { tool } from 'ai';
import { z } from 'zod';
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
 * Transform block file path to destination path in generated app
 * Block files are stored as: server/auth.ts, client/LoginForm.tsx
 * But must be copied to: server/src/auth.ts, client/src/LoginForm.tsx
 */
function transformBlockFilePath(blockFilePath: string): string {
  // server/foo.ts -> server/src/foo.ts
  if (blockFilePath.startsWith('server/')) {
    return blockFilePath.replace(/^server\//, 'server/src/');
  }
  // client/Foo.tsx -> client/src/Foo.tsx
  if (blockFilePath.startsWith('client/')) {
    return blockFilePath.replace(/^client\//, 'client/src/');
  }
  // prisma files and others remain unchanged
  return blockFilePath;
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

  // Copy server files (transform server/ -> server/src/)
  for (const file of metadata.files.server) {
    const sourcePath = path.join(blockPath, file);
    const content = await fs.readFile(sourcePath, 'utf-8');
    const destPath = transformBlockFilePath(file);
    await filesystemService.writeFile(sessionId, destPath, content);
    copiedFiles.push(destPath);
  }

  // Copy client files (transform client/ -> client/src/)
  for (const file of metadata.files.client) {
    const sourcePath = path.join(blockPath, file);
    const content = await fs.readFile(sourcePath, 'utf-8');
    const destPath = transformBlockFilePath(file);
    await filesystemService.writeFile(sessionId, destPath, content);
    copiedFiles.push(destPath);
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
 * Extract all relative imports from TypeScript/JavaScript content
 * Handles various import styles: import/export from, dynamic imports, type imports
 */
function extractRelativeImports(content: string): string[] {
  const imports = new Set<string>();

  // Pattern 1: import/export from statements
  const importFromPattern = /(?:import|export)\s+(?:type\s+)?.*?from\s+['"](\.[^'"]+)['"]/g;
  for (const match of content.matchAll(importFromPattern)) {
    imports.add(match[1]);
  }

  // Pattern 2: dynamic imports
  const dynamicImportPattern = /import\s*\(\s*['"](\.[^'"]+)['"]\s*\)/g;
  for (const match of content.matchAll(dynamicImportPattern)) {
    imports.add(match[1]);
  }

  // Pattern 3: re-exports
  const reExportPattern = /export\s+\*\s+from\s+['"](\.[^'"]+)['"]/g;
  for (const match of content.matchAll(reExportPattern)) {
    imports.add(match[1]);
  }

  return Array.from(imports);
}

/**
 * Check if a file is a TypeScript/JavaScript code file
 */
function isCodeFile(filePath: string): boolean {
  return /\.(ts|tsx|js|jsx)$/.test(filePath);
}

/**
 * Build cache of file paths and contents from copied files
 */
async function buildFileCache(
  sessionId: string,
  copiedFiles: string[],
  maxFileSize: number,
): Promise<{
  fileCache: Set<string>;
  fileContents: Map<string, string>;
  warnings: string[];
}> {
  const fileCache = new Set<string>();
  const fileContents = new Map<string, string>();
  const warnings: string[] = [];

  for (const file of copiedFiles) {
    fileCache.add(file);
    const withoutExt = file.replace(/\.(ts|tsx|js|jsx)$/, '');
    fileCache.add(withoutExt);

    if (isCodeFile(file)) {
      try {
        const content = await filesystemService.readFile(sessionId, file);

        if (content.length > maxFileSize) {
          warnings.push(
            `⚠️ File ${file} is too large to verify imports (${content.length} bytes, max ${maxFileSize})`,
          );
          continue;
        }

        fileContents.set(file, content);
      } catch (_error) {
        warnings.push(`❌ CRITICAL: File ${file} was supposed to be copied but doesn't exist`);
      }
    }
  }

  return { fileCache, fileContents, warnings };
}

/**
 * Check if an import path is safe (no path traversal)
 */
function isSafeImportPath(
  resolvedPath: string,
  sessionId: string,
  file: string,
  importPath: string,
): boolean {
  if (resolvedPath.includes('..')) {
    databaseLogger.warn(
      { sessionId, file, importPath },
      'Suspicious import path with parent directory reference',
    );
    return false;
  }
  return true;
}

/**
 * Check if imported file exists in the file cache
 */
function checkImportExists(resolvedPath: string, fileCache: Set<string>): boolean {
  const possibleExtensions = ['', '.ts', '.tsx', '.js', '.jsx'];
  return possibleExtensions.some((ext) => fileCache.has(resolvedPath + ext));
}

/**
 * Verify imports for a single file
 */
function verifyFileImports(
  sessionId: string,
  file: string,
  content: string,
  fileCache: Set<string>,
): string[] {
  const warnings: string[] = [];
  const imports = extractRelativeImports(content);

  for (const importPath of imports) {
    const dir = path.dirname(file);
    const resolvedPath = path.normalize(path.join(dir, importPath));

    if (!isSafeImportPath(resolvedPath, sessionId, file, importPath)) {
      continue;
    }

    if (!checkImportExists(resolvedPath, fileCache)) {
      warnings.push(
        `⚠️ File ${file} imports '${importPath}' but this file doesn't exist. Check if it should be added to block.json or if the import path is correct.`,
      );
    }
  }

  return warnings;
}

/**
 * Verify that all copied files exist and check for missing dependencies
 * @returns Array of warnings if any issues are detected
 */
async function verifyBlockIntegration(sessionId: string, copiedFiles: string[]): Promise<string[]> {
  const MAX_FILE_SIZE = 1_000_000; // 1MB limit to prevent regex catastrophic backtracking

  // Build file cache
  const { fileCache, fileContents, warnings } = await buildFileCache(
    sessionId,
    copiedFiles,
    MAX_FILE_SIZE,
  );

  // Verify imports for each file
  for (const [file, content] of fileContents.entries()) {
    try {
      const fileWarnings = verifyFileImports(sessionId, file, content, fileCache);
      warnings.push(...fileWarnings);
    } catch (error) {
      databaseLogger.warn({ error, sessionId, file }, 'Failed to verify imports for file');
      warnings.push(
        `⚠️ Failed to verify imports in ${file}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  return warnings;
}

/**
 * Format integration guide as markdown
 */
function formatIntegrationGuide(
  metadata: BlockMetadata,
  copiedFiles: string[],
  warnings: string[],
): string {
  let guide = `# ${metadata.name} Block Copied\n\n`;

  // Show warnings first if any
  if (warnings.length > 0) {
    guide += `## ⚠️ Warnings\n`;
    for (const warning of warnings) {
      guide += `${warning}\n`;
    }
    guide += `\n`;
  }

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
 * Helper: Install block dependencies to appropriate package.json
 */
async function installBlockDependencies(
  sessionId: string,
  blockId: string,
  dependencies: Record<string, string>,
  copiedFiles: string[],
  warnings: string[],
) {
  if (Object.keys(dependencies).length === 0) {
    return;
  }

  try {
    const hasServerFiles = copiedFiles.some((f) => f.startsWith('server/'));
    const hasClientFiles = copiedFiles.some((f) => f.startsWith('client/'));

    if (hasServerFiles) {
      await filesystemService.installNpmDep(sessionId, 'server', dependencies, undefined);
      databaseLogger.info(
        { sessionId, blockId, dependencies },
        'Auto-installed block dependencies to server',
      );
    }

    if (hasClientFiles && !hasServerFiles) {
      await filesystemService.installNpmDep(sessionId, 'client', dependencies, undefined);
      databaseLogger.info(
        { sessionId, blockId, dependencies },
        'Auto-installed block dependencies to client',
      );
    }
  } catch (error) {
    databaseLogger.warn({ error, sessionId, blockId }, 'Failed to auto-install block dependencies');
    warnings.push(
      `⚠️ CRITICAL: Failed to auto-install dependencies. You MUST manually add these to package.json using installNpmDep tool: ${Object.keys(dependencies).join(', ')}`,
    );
  }
}

/**
 * Helper: Emit file_updated events for copied files
 */
async function emitFileUpdates(
  sessionId: string,
  copiedFiles: string[],
  io: ReturnType<typeof extractToolContext>['io'],
) {
  if (!io) return;

  for (const file of copiedFiles) {
    try {
      const content = await filesystemService.readFile(sessionId, file);
      io.to(sessionId).emit('file_updated', {
        path: file,
        content,
      });
    } catch (error) {
      databaseLogger.warn({ error, sessionId, file }, 'Failed to emit file_updated for block file');
    }
  }
}

/**
 * Helper: Log block request results
 */
function logBlockResults(
  sessionId: string,
  blockId: string,
  copiedFiles: string[],
  warnings: string[],
) {
  databaseLogger.info(
    {
      sessionId,
      blockId,
      filesCount: copiedFiles.length,
      warningsCount: warnings.length,
    },
    'Block requested and copied',
  );

  if (warnings.length > 0) {
    databaseLogger.warn({ sessionId, blockId, warnings }, 'Block integration has warnings');
  }
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
    reason: z
      .string()
      .min(10)
      .max(200)
      .describe(
        'Brief explanation of why you need this block and how it fits into the application (10-200 characters)',
      ),
  }),
  execute: async ({ blockId }, { experimental_context: context }) => {
    const { sessionId, io } = extractToolContext(context);

    try {
      const metadata = await loadBlockMetadata(blockId);
      const copiedFiles = await copyBlockFiles(sessionId, blockId, metadata);
      const warnings = await verifyBlockIntegration(sessionId, copiedFiles);

      await installBlockDependencies(
        sessionId,
        blockId,
        metadata.dependencies,
        copiedFiles,
        warnings,
      );
      await emitFileUpdates(sessionId, copiedFiles, io);

      const guide = formatIntegrationGuide(metadata, copiedFiles, warnings);
      logBlockResults(sessionId, blockId, copiedFiles, warnings);

      return guide;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error requesting block';
      databaseLogger.error({ error, sessionId, blockId }, 'Failed to request block');
      throw new Error(errorMessage);
    }
  },
});
