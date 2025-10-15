/**
 * Language detection utilities
 *
 * Utilities for detecting programming language from file extensions.
 */

/**
 * Language extension map for CodeMirror
 */
export const LANGUAGE_MAP: Record<string, string> = {
  js: 'javascript',
  jsx: 'jsx',
  ts: 'typescript',
  tsx: 'tsx',
  json: 'json',
  html: 'html',
  css: 'css',
  md: 'markdown',
  py: 'python',
  sh: 'bash',
  yml: 'yaml',
  yaml: 'yaml',
  sql: 'sql',
  xml: 'xml',
  txt: 'text',
};

/**
 * Get language identifier from file path
 *
 * @param path - File path or name
 * @returns Language identifier string
 *
 * @example
 * getLanguage('src/App.tsx') // "tsx"
 * getLanguage('package.json') // "json"
 * getLanguage('README.md') // "markdown"
 */
export function getLanguage(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  return LANGUAGE_MAP[ext || ''] || 'text';
}

/**
 * Check if a file extension is supported for syntax highlighting
 *
 * @param path - File path or name
 * @returns True if language is supported
 *
 * @example
 * isLanguageSupported('App.tsx') // true
 * isLanguageSupported('image.png') // false
 */
export function isLanguageSupported(path: string): boolean {
  const ext = path.split('.').pop()?.toLowerCase();
  return ext !== undefined && ext in LANGUAGE_MAP;
}

/**
 * Get file extension from path
 *
 * @param path - File path
 * @returns File extension without dot, or empty string if none
 *
 * @example
 * getFileExtension('src/App.tsx') // "tsx"
 * getFileExtension('README') // ""
 */
export function getFileExtension(path: string): string {
  const parts = path.split('.');
  return parts.length > 1 ? parts.pop()?.toLowerCase() || '' : '';
}
