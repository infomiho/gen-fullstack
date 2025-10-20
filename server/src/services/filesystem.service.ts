import * as fs from 'node:fs/promises';
import type { Dirent } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

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

  console.log(`[Filesystem] Initialized sandbox: ${sandboxPath}`);
  return sandboxPath;
}

/**
 * Write content to a file within the sandbox
 *
 * @param sessionId - Session identifier
 * @param filePath - Relative path within sandbox
 * @param content - File content
 * @returns Success message with full path
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

  await fs.writeFile(fullPath, content, 'utf-8');

  const relativePath = path.relative(sandboxPath, fullPath);
  console.log(`[Filesystem] Wrote file: ${relativePath}`);

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
    console.log(`[Filesystem] Read file: ${relativePath} (${content.length} bytes)`);
    return content;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`File not found: ${filePath}`);
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
    console.log(`[Filesystem] Listed directory: ${relativePath || '.'} (${result.length} entries)`);

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
    console.log(`[Filesystem] Cleaned up sandbox: ${sandboxPath}`);
  } catch (error) {
    console.error(`[Filesystem] Failed to cleanup sandbox: ${error}`);
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
        console.warn(`[Filesystem] Skipping symlink in template: ${entry.name}`);
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

  console.log(`[Filesystem] Copied template '${templateName}' to sandbox: ${fileCount} files`);
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
        console.warn(`[Filesystem] Skipping non-text file ${relativePath}`);
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
