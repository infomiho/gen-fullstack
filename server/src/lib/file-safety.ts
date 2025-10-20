/**
 * File Safety Checks
 *
 * Detects potentially destructive file operations (like large code deletions)
 * and provides warnings to prevent accidental loss of functionality.
 */

// Configuration constants
const FILE_SAFETY_MIN_SIZE = 100; // Skip check for files under 100 chars
const FILE_SAFETY_REDUCTION_THRESHOLD = 0.5; // Flag 50%+ reductions

/**
 * Result of a file safety check
 */
export interface FileSafetyCheck {
  /** Whether the operation is considered safe */
  isSafe: boolean;
  /** Warning message if unsafe (undefined if safe) */
  warning?: string;
  /** Original file size in characters */
  oldSize: number;
  /** New file size in characters */
  newSize: number;
  /** Percentage of code reduction (0-100) */
  reductionPercent: number;
}

/**
 * Check if a file replacement operation is safe
 *
 * Detects large code deletions that may indicate destructive "fixes"
 * (e.g., LLM removing working code to fix import errors).
 *
 * @param oldContent - Current file content
 * @param newContent - New file content to write
 * @param path - File path (for warning message)
 * @returns Safety check result with warning if unsafe
 *
 * @example
 * ```typescript
 * const oldCode = 'x'.repeat(1000);
 * const newCode = 'x'.repeat(300);
 * const result = checkFileSafety(oldCode, newCode, 'src/index.ts');
 * // result.isSafe === false
 * // result.reductionPercent === 70
 * // result.warning === "⚠️ WARNING: Replacing src/index.ts with 70% less code..."
 * ```
 */
export function checkFileSafety(
  oldContent: string,
  newContent: string,
  path: string,
): FileSafetyCheck {
  const oldSize = oldContent.length;
  const newSize = newContent.length;

  // Skip check for small files to avoid false positives
  if (oldSize <= FILE_SAFETY_MIN_SIZE) {
    return { isSafe: true, oldSize, newSize, reductionPercent: 0 };
  }

  const reductionPercent = Math.round(((oldSize - newSize) / oldSize) * 100);

  // Flag if new content is less than or equal to threshold of old content
  if (newSize <= oldSize * FILE_SAFETY_REDUCTION_THRESHOLD) {
    return {
      isSafe: false,
      warning: `⚠️ WARNING: Replacing ${path} with ${reductionPercent}% less code (${oldSize} → ${newSize} chars). Verify this is intentional.`,
      oldSize,
      newSize,
      reductionPercent,
    };
  }

  return { isSafe: true, oldSize, newSize, reductionPercent };
}
