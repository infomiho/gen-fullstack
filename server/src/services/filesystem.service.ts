import * as fs from 'node:fs/promises';
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

  // Ensure base directory exists
  await fs.mkdir(GENERATED_BASE_DIR, { recursive: true });

  // Create session sandbox directory
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

  // Create directory if it doesn't exist
  const dir = path.dirname(fullPath);
  await fs.mkdir(dir, { recursive: true });

  // Write file
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
    // Don't throw - cleanup failures shouldn't break the application
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
