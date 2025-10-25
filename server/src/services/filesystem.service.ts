import type { Dirent } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { filesystemLogger } from '../lib/logger.js';
import { databaseService } from './database.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Base directory for all generated apps
 * Located at /generated/ in project root
 */
const GENERATED_BASE_DIR = path.resolve(__dirname, '../../../generated');

/**
 * Filesystem service with sandboxing for secure file operations
 *
 * All file operations are restricted to /generated/<sessionId>/ directories
 * to prevent path traversal attacks and ensure isolation between sessions.
 */

/**
 * Get the sandbox directory for a session
 *
 * @param sessionId - Unique session identifier
 * @returns Absolute path to session sandbox directory
 */
export function getSandboxPath(sessionId: string): string {
  // Sanitize sessionId to prevent directory traversal
  const sanitized = sessionId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(GENERATED_BASE_DIR, sanitized);
}

/**
 * Validate that a path is within the sandbox
 *
 * @param filePath - Path to validate
 * @param sessionId - Session identifier
 * @throws Error if path is outside sandbox
 */
function validatePath(filePath: string, sessionId: string): void {
  // Check for Windows-style paths (even on Unix systems for security)
  if (filePath.includes('\\') || /^[a-zA-Z]:/.test(filePath)) {
    throw new Error(
      `Path traversal detected: "${filePath}" contains Windows-style path separators or drive letters`,
    );
  }

  const sandboxPath = getSandboxPath(sessionId);
  const resolvedPath = path.resolve(sandboxPath, filePath);

  // Ensure resolved path is within sandbox
  if (!resolvedPath.startsWith(sandboxPath)) {
    throw new Error(`Path traversal detected: "${filePath}" resolves outside sandbox`);
  }
}

/**
 * Initialize sandbox directory for a session
 *
 * @param sessionId - Session identifier
 * @returns Path to created sandbox directory
 */
export async function initializeSandbox(sessionId: string): Promise<string> {
  const sandboxPath = getSandboxPath(sessionId);

  await fs.mkdir(GENERATED_BASE_DIR, { recursive: true });

  await fs.mkdir(sandboxPath, { recursive: true });

  filesystemLogger.info({ sandboxPath }, 'Initialized sandbox');
  return sandboxPath;
}

/**
 * Write content to a file within the sandbox (atomic operation)
 *
 * This function performs an atomic write operation that ensures files are
 * written to both disk and database, preventing inconsistencies where files
 * exist on disk but not in the database (or vice versa).
 *
 * IMPORTANT: This is the ONLY way to write files in the system. All code
 * paths must use this function to ensure data consistency.
 *
 * @param sessionId - Session identifier
 * @param filePath - Relative path within sandbox
 * @param content - File content
 * @returns Success message with full path
 * @throws {Error} If disk write or database save fails
 */
export async function writeFile(
  sessionId: string,
  filePath: string,
  content: string,
): Promise<string> {
  validatePath(filePath, sessionId);

  const sandboxPath = getSandboxPath(sessionId);
  const fullPath = path.resolve(sandboxPath, filePath);

  const dir = path.dirname(fullPath);
  await fs.mkdir(dir, { recursive: true });

  // Write to disk
  await fs.writeFile(fullPath, content, 'utf-8');

  const relativePath = path.relative(sandboxPath, fullPath);
  filesystemLogger.info({ relativePath, bytes: content.length }, 'Wrote file to disk');

  // Atomically persist to database
  // If this fails, the disk write is still done but we throw to signal the failure
  try {
    await databaseService.saveFile({
      sessionId,
      path: filePath,
      content,
    });
    filesystemLogger.info({ relativePath }, 'Persisted file to database');
  } catch (error) {
    filesystemLogger.error(
      { error, sessionId, path: filePath },
      'Failed to persist file to database - disk write succeeded but database is inconsistent',
    );
    throw new Error(
      `Failed to persist file to database: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  return `Successfully wrote ${content.length} bytes to ${relativePath}`;
}

/**
 * Read content from a file within the sandbox
 *
 * @param sessionId - Session identifier
 * @param filePath - Relative path within sandbox
 * @returns File content
 */
export async function readFile(sessionId: string, filePath: string): Promise<string> {
  validatePath(filePath, sessionId);

  const sandboxPath = getSandboxPath(sessionId);
  const fullPath = path.resolve(sandboxPath, filePath);

  try {
    const content = await fs.readFile(fullPath, 'utf-8');
    const relativePath = path.relative(sandboxPath, fullPath);
    filesystemLogger.info({ relativePath, bytes: content.length }, 'Read file');
    return content;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      // Create a new error object that preserves all errno exception properties
      // This follows immutability principles and preserves the original error context
      const originalError = error as NodeJS.ErrnoException;
      const enhancedError = new Error(`File not found: ${filePath}`) as NodeJS.ErrnoException;
      enhancedError.code = 'ENOENT';
      enhancedError.errno = originalError.errno;
      enhancedError.path = originalError.path;
      enhancedError.syscall = originalError.syscall;
      enhancedError.stack = originalError.stack; // Preserve original stack trace
      throw enhancedError;
    }
    throw error;
  }
}

/**
 * List files in a directory within the sandbox
 *
 * @param sessionId - Session identifier
 * @param dirPath - Relative directory path within sandbox (default: '.')
 * @returns Array of file/directory names with types
 */
export async function listFiles(
  sessionId: string,
  dirPath: string = '.',
): Promise<Array<{ name: string; type: 'file' | 'directory' }>> {
  validatePath(dirPath, sessionId);

  const sandboxPath = getSandboxPath(sessionId);
  const fullPath = path.resolve(sandboxPath, dirPath);

  try {
    const entries = await fs.readdir(fullPath, { withFileTypes: true });
    const result = entries.map((entry) => ({
      name: entry.name,
      type: entry.isDirectory() ? ('directory' as const) : ('file' as const),
    }));

    const relativePath = path.relative(sandboxPath, fullPath);
    filesystemLogger.info(
      { relativePath: relativePath || '.', count: result.length },
      'Listed directory',
    );

    return result;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`Directory not found: ${dirPath}`);
    }
    throw error;
  }
}

/**
 * Clean up sandbox directory for a session
 *
 * @param sessionId - Session identifier
 */
export async function cleanupSandbox(sessionId: string): Promise<void> {
  const sandboxPath = getSandboxPath(sessionId);

  try {
    await fs.rm(sandboxPath, { recursive: true, force: true });
    filesystemLogger.info({ sandboxPath }, 'Cleaned up sandbox');
  } catch (error) {
    filesystemLogger.error({ error, sandboxPath }, 'Failed to cleanup sandbox');
  }
}

/**
 * Check if a file exists within the sandbox
 *
 * @param sessionId - Session identifier
 * @param filePath - Relative path within sandbox
 * @returns True if file exists, false otherwise
 */
export async function fileExists(sessionId: string, filePath: string): Promise<boolean> {
  validatePath(filePath, sessionId);

  const sandboxPath = getSandboxPath(sessionId);
  const fullPath = path.resolve(sandboxPath, filePath);

  try {
    await fs.access(fullPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Install dependencies to package.json without removing existing ones
 *
 * This function is specifically designed for adding npm dependencies to package.json files.
 * It preserves all existing dependencies and only adds or updates the specified ones.
 *
 * Use cases:
 * - Adding new runtime dependencies (dependencies)
 * - Adding new development dependencies (devDependencies)
 * - Updating versions of existing dependencies
 *
 * IMPORTANT: This function ONLY modifies the dependencies and devDependencies fields.
 * All other package.json fields (name, version, scripts, etc.) remain unchanged.
 *
 * @param sessionId - Session identifier
 * @param target - Which package.json to update (root, client, or server)
 * @param dependencies - Runtime dependencies to install (e.g., {"express": "^5.0.0"})
 * @param devDependencies - Development dependencies to install (e.g., {"typescript": "^5.0.0"})
 * @returns Success message with list of installed packages
 * @throws {Error} If package.json doesn't exist, is malformed, or write fails
 */
export async function updatePackageJson(
  sessionId: string,
  target: 'root' | 'client' | 'server',
  dependencies?: Record<string, string>,
  devDependencies?: Record<string, string>,
): Promise<string> {
  const packageJsonPath = target === 'root' ? 'package.json' : `${target}/package.json`;

  // Validate that at least one dependency type is provided with non-empty content
  const hasValidDeps = dependencies && Object.keys(dependencies).length > 0;
  const hasValidDevDeps = devDependencies && Object.keys(devDependencies).length > 0;

  if (!hasValidDeps && !hasValidDevDeps) {
    throw new Error(
      'No dependencies provided. Specify at least one package in dependencies or devDependencies.',
    );
  }

  try {
    // Read existing package.json
    const content = await readFile(sessionId, packageJsonPath);
    const packageJson = JSON.parse(content);

    // Track what we're installing for the return message
    const installed: string[] = [];

    // Install runtime dependencies (merge with existing)
    if (dependencies && Object.keys(dependencies).length > 0) {
      packageJson.dependencies = {
        ...packageJson.dependencies,
        ...dependencies,
      };
      installed.push(...Object.keys(dependencies));
    }

    // Install dev dependencies (merge with existing)
    if (devDependencies && Object.keys(devDependencies).length > 0) {
      packageJson.devDependencies = {
        ...packageJson.devDependencies,
        ...devDependencies,
      };
      installed.push(...Object.keys(devDependencies));
    }

    // Write back with formatting
    await writeFile(sessionId, packageJsonPath, JSON.stringify(packageJson, null, 2));

    filesystemLogger.info(
      { sessionId, target, installed },
      'Installed dependencies to package.json',
    );

    return `Successfully installed ${installed.length} package${installed.length === 1 ? '' : 's'} to ${target}/package.json: ${installed.join(', ')}`;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    filesystemLogger.error({ error, sessionId, target }, 'Failed to install dependencies');
    throw new Error(`Failed to install dependencies to package.json: ${errorMsg}`);
  }
}

/**
 * Template directory location
 */
const TEMPLATE_BASE_DIR = path.resolve(__dirname, '../../../templates');

/**
 * Allowed template names (whitelist for security)
 */
const ALLOWED_TEMPLATES = ['vite-fullstack-base'] as const;

/**
 * Copy template directory to session sandbox
 *
 * Recursively copies all files from the specified template to the session sandbox.
 * This provides a starting point for the LLM to customize.
 *
 * Security features:
 * - Template name validation (no path traversal)
 * - Whitelist of allowed templates
 * - Symlinks are skipped (prevents reading arbitrary files)
 * - Binary files handled correctly (uses copyFile, not UTF-8 read)
 *
 * @param sessionId - Session identifier
 * @param templateName - Name of template directory (e.g., 'vite-fullstack-base')
 * @returns Number of files copied
 * @throws {Error} If template name is invalid, unknown, or not found
 */
export async function copyTemplateToSandbox(
  sessionId: string,
  templateName: string,
): Promise<number> {
  // Security: Validate template name (no path traversal)
  if (templateName.includes('..') || templateName.includes('/') || templateName.includes('\\')) {
    throw new Error(`Invalid template name: ${templateName}`);
  }

  // Security: Whitelist known templates
  if (!ALLOWED_TEMPLATES.includes(templateName as (typeof ALLOWED_TEMPLATES)[number])) {
    throw new Error(`Unknown template: ${templateName}`);
  }

  const templatePath = path.join(TEMPLATE_BASE_DIR, templateName);
  const sandboxPath = getSandboxPath(sessionId);

  // Security: Verify resolved path is within templates directory
  if (!templatePath.startsWith(TEMPLATE_BASE_DIR)) {
    throw new Error(`Path traversal detected in template: ${templateName}`);
  }

  let fileCount = 0;

  /**
   * Handle directory read errors
   */
  function handleReadError(error: unknown): never {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`Template not found: ${templateName}`);
    }
    throw error;
  }

  async function copyRecursive(src: string, dest: string): Promise<void> {
    let entries: Dirent[];
    try {
      entries = await fs.readdir(src, { withFileTypes: true });
    } catch (error) {
      handleReadError(error);
    }

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      // Security: Skip symlinks to prevent reading arbitrary files
      if (entry.isSymbolicLink()) {
        filesystemLogger.warn({ entryName: entry.name }, 'Skipping symlink in template');
        continue;
      }

      if (entry.isDirectory()) {
        await fs.mkdir(destPath, { recursive: true });
        await copyRecursive(srcPath, destPath);
      } else if (entry.isFile()) {
        // Use copyFile to correctly handle both text and binary files
        await fs.copyFile(srcPath, destPath);
        fileCount++;
      }
    }
  }

  await copyRecursive(templatePath, sandboxPath);

  filesystemLogger.info({ templateName, fileCount }, 'Copied template to sandbox');
  return fileCount;
}

/**
 * Get all files recursively from sandbox
 *
 * Reads all files from the sandbox directory and returns their paths and contents.
 * Used for persisting template files to database.
 *
 * @param sessionId - Session identifier
 * @returns Array of files with relative paths and contents
 * @throws {Error} If sandbox doesn't exist or reading fails
 */
export async function getAllFiles(
  sessionId: string,
): Promise<Array<{ relativePath: string; content: string }>> {
  const sandboxPath = getSandboxPath(sessionId);
  const allFiles: Array<{ relativePath: string; content: string }> = [];

  /**
   * Validate that directory is within sandbox
   */
  function validateDirectoryPath(dir: string): void {
    const resolvedDir = path.resolve(dir);
    if (!resolvedDir.startsWith(sandboxPath)) {
      throw new Error(`Directory traversal detected: ${dir} is outside sandbox`);
    }
  }

  /**
   * Read directory entries with error handling
   */
  async function readDirectoryEntries(dir: string): Promise<Dirent[]> {
    try {
      return await fs.readdir(dir, { withFileTypes: true });
    } catch (error) {
      throw new Error(
        `Failed to read directory ${dir}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Process a single directory entry (file or directory)
   */
  async function processEntry(entry: Dirent, dir: string): Promise<void> {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(sandboxPath, fullPath);

    // Skip symlinks for security
    if (entry.isSymbolicLink()) {
      return;
    }

    if (entry.isDirectory()) {
      await readRecursive(fullPath);
    } else if (entry.isFile()) {
      try {
        const content = await fs.readFile(fullPath, 'utf-8');
        allFiles.push({ relativePath, content });
      } catch (_error) {
        // UTF-8 read failed - likely a binary file (images, fonts, etc.)
        filesystemLogger.warn({ relativePath }, 'Skipping non-text file');
      }
    }
  }

  async function readRecursive(dir: string): Promise<void> {
    validateDirectoryPath(dir);
    const entries = await readDirectoryEntries(dir);

    for (const entry of entries) {
      await processEntry(entry, dir);
    }
  }

  await readRecursive(sandboxPath);
  return allFiles;
}
