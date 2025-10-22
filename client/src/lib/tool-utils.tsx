/**
 * Tool rendering utilities
 *
 * Shared utilities for rendering tool parameters and summaries across the app.
 */

import { radius, spacing, typography } from './design-tokens';

/**
 * Get a one-line summary of tool parameters
 *
 * @param toolName - Name of the tool being executed
 * @param args - Tool arguments
 * @returns One-line summary string
 *
 * @example
 * getToolSummary('writeFile', { path: 'src/App.tsx' }) // "Writing to src/App.tsx"
 */
export function getToolSummary(
  toolName: string,
  args: Record<string, unknown> | undefined,
): string {
  if (!args) return 'Loading...';

  switch (toolName) {
    case 'writeFile': {
      const { path } = args as { path?: string };
      return `Writing to ${path || 'unknown'}`;
    }
    case 'readFile': {
      const { path } = args as { path?: string };
      return `Reading ${path || 'unknown'}`;
    }
    case 'listFiles': {
      const { directory } = args as { directory?: string };
      return `Listing ${directory || '.'}`;
    }
    case 'executeCommand': {
      const { command } = args as { command?: string };
      return command || 'unknown command';
    }
    case 'requestBlock': {
      const { blockId } = args as { blockId?: string };
      return `Asking for ${blockId || 'unknown block'}`;
    }
    default:
      return 'Click for details';
  }
}

/**
 * Render tool parameters with custom formatting for each tool type
 *
 * @param toolName - Name of the tool being executed
 * @param args - Tool arguments to display
 * @returns React node with formatted parameters
 *
 * @example
 * renderToolParameters('writeFile', { path: 'src/App.tsx', content: 'export...' })
 */
export function renderToolParameters(
  toolName: string,
  args: Record<string, unknown> | undefined,
): React.ReactNode {
  if (!args) {
    return <div className={`${typography.body} text-gray-400`}>No parameters</div>;
  }

  // Custom formatting for writeFile
  if (toolName === 'writeFile') {
    const { path, content } = args as { path?: string; content?: string };
    return (
      <div className={`${typography.body} ${spacing.form}`}>
        {path && (
          <div>
            <span className="text-gray-500">path:</span>
            <span className={`${typography.mono} text-gray-900 ml-2`}>{path}</span>
          </div>
        )}
        {content && (
          <div>
            <div className="text-gray-500 mb-1">content:</div>
            <pre
              className={`bg-gray-50 p-3 ${radius.sm} border border-gray-200 overflow-x-auto ${typography.mono} max-h-64 overflow-y-auto text-gray-800`}
            >
              {content}
            </pre>
          </div>
        )}
      </div>
    );
  }

  // Custom formatting for readFile
  if (toolName === 'readFile') {
    const { path } = args as { path?: string };
    return (
      <div className={typography.body}>
        <span className="text-gray-500">path:</span>
        <span className={`${typography.mono} text-gray-900 ml-2`}>{path || 'unknown'}</span>
      </div>
    );
  }

  // Custom formatting for listFiles
  if (toolName === 'listFiles') {
    const { directory } = args as { directory?: string };
    return (
      <div className={typography.body}>
        <span className="text-gray-500">directory:</span>
        <span className={`${typography.mono} text-gray-900 ml-2`}>{directory || '.'}</span>
      </div>
    );
  }

  // Custom formatting for executeCommand
  if (toolName === 'executeCommand') {
    const { command } = args as { command?: string };
    return (
      <div className={typography.body}>
        <div className="text-gray-500 mb-1">command:</div>
        <pre
          className={`bg-gray-50 p-3 ${radius.sm} border border-gray-200 overflow-x-auto ${typography.mono} text-gray-800`}
        >
          {command || 'unknown'}
        </pre>
      </div>
    );
  }

  // Default: show raw JSON
  return (
    <pre
      className={`bg-gray-50 p-3 ${radius.sm} border border-gray-200 overflow-x-auto ${typography.mono} text-gray-800`}
    >
      {JSON.stringify(args, null, 2)}
    </pre>
  );
}

/**
 * Truncate a string to a maximum length with ellipsis
 *
 * @param str - String to truncate
 * @param maxLength - Maximum length before truncation
 * @returns Truncated string with ellipsis if needed
 *
 * @example
 * truncate('Hello world', 5) // "Hello..."
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return `${str.slice(0, maxLength)}...`;
}
