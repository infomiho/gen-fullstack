/**
 * Tool rendering utilities
 *
 * Shared utilities for rendering tool parameters and summaries across the app.
 */

import {
  TOOL_NAMES,
  type ApiRoute,
  type ClientComponent,
  type ClientRoute,
  type DatabaseModel,
} from '@gen-fullstack/shared';
import { PlanArchitectureDisplay } from '../components/PlanArchitectureDisplay';
import { radius, spacing, typography } from './design-tokens';

/**
 * Helper functions for generating tool summaries
 */
function getWriteFileSummary(args: Record<string, unknown>): string {
  const { path } = args as { path?: string };
  return `Writing to ${path || 'unknown'}`;
}

function getReadFileSummary(args: Record<string, unknown>): string {
  const { path } = args as { path?: string };
  return `Reading ${path || 'unknown'}`;
}

function getFileTreeSummary(): string {
  return 'Getting file tree';
}

function getRequestBlockSummary(args: Record<string, unknown>): string {
  const { blockId } = args as { blockId?: string };
  return `Asking for ${blockId || 'unknown block'}`;
}

function getPlanArchitectureSummary(args: Record<string, unknown>): string {
  const { databaseModels, apiRoutes, clientRoutes, clientComponents } = args as {
    databaseModels?: Array<unknown>;
    apiRoutes?: Array<unknown>;
    clientRoutes?: Array<unknown>;
    clientComponents?: Array<unknown>;
  };
  const parts = [
    databaseModels?.length && `${databaseModels.length} models`,
    apiRoutes?.length && `${apiRoutes.length} API routes`,
    clientRoutes?.length && `${clientRoutes.length} client routes`,
    clientComponents?.length && `${clientComponents.length} components`,
  ].filter(Boolean);
  return `Planning: ${parts.join(', ')}`;
}

function getInstallNpmDepSummary(args: Record<string, unknown>): string {
  const { target, dependencies, devDependencies } = args as {
    target?: string;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const depCount = Object.keys(dependencies || {}).length;
  const devDepCount = Object.keys(devDependencies || {}).length;
  const parts = [
    depCount && `${depCount} dep${depCount > 1 ? 's' : ''}`,
    devDepCount && `${devDepCount} devDep${devDepCount > 1 ? 's' : ''}`,
  ].filter(Boolean);
  return `Installing to ${target || 'unknown'}: ${parts.join(', ')}`;
}

function getInstallDependenciesSummary(args: Record<string, unknown>): string {
  const { path } = args as { path?: string };
  return `Installing dependencies in ${path || 'unknown'}`;
}

/**
 * Mapping of tool names to their summary generator functions
 */
const toolSummaryHandlers: Record<string, (args: Record<string, unknown>) => string> = {
  [TOOL_NAMES.WRITE_FILE]: getWriteFileSummary,
  [TOOL_NAMES.READ_FILE]: getReadFileSummary,
  [TOOL_NAMES.GET_FILE_TREE]: getFileTreeSummary,
  [TOOL_NAMES.REQUEST_BLOCK]: getRequestBlockSummary,
  [TOOL_NAMES.PLAN_ARCHITECTURE]: getPlanArchitectureSummary,
  [TOOL_NAMES.INSTALL_NPM_DEP]: getInstallNpmDepSummary,
  [TOOL_NAMES.INSTALL_DEPENDENCIES]: getInstallDependenciesSummary,
};

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

  const handler = toolSummaryHandlers[toolName];
  return handler ? handler(args) : 'Click for details';
}

/**
 * Render tool parameters with custom formatting for each tool type
 *
 * @param toolName - Name of the tool being executed
 * @param args - Tool arguments to display
 * @param toolId - Optional tool ID for state management
 * @param isSectionExpanded - Optional function to check if a section is expanded
 * @param onToggleSection - Optional function to toggle a section's expanded state
 * @returns React node with formatted parameters
 *
 * @example
 * renderToolParameters('writeFile', { path: 'src/App.tsx', content: 'export...' })
 */
export function renderToolParameters(
  toolName: string,
  args: Record<string, unknown> | undefined,
  toolId?: string,
  isSectionExpanded?: (toolId: string, section: string) => boolean,
  onToggleSection?: (toolId: string, section: string) => void,
): React.ReactNode {
  if (!args) {
    return <div className={`${typography.body} text-muted-foreground`}>No parameters</div>;
  }

  // Custom formatting for writeFile
  if (toolName === TOOL_NAMES.WRITE_FILE) {
    const { path, content } = args as { path?: string; content?: string };
    return (
      <div className={`${typography.body} ${spacing.form}`}>
        {path && (
          <div>
            <span className="text-muted-foreground">path:</span>
            <span className={`${typography.mono} text-foreground ml-2`}>{path}</span>
          </div>
        )}
        {content && (
          <div>
            <div className="text-muted-foreground mb-1">content:</div>
            <pre
              className={`bg-muted p-3 ${radius.sm} border border-border overflow-x-auto ${typography.mono} max-h-64 overflow-y-auto text-foreground`}
            >
              {content}
            </pre>
          </div>
        )}
      </div>
    );
  }

  // Custom formatting for readFile
  if (toolName === TOOL_NAMES.READ_FILE) {
    const { path } = args as { path?: string };
    return (
      <div className={typography.body}>
        <span className="text-muted-foreground">path:</span>
        <span className={`${typography.mono} text-foreground ml-2`}>{path || 'unknown'}</span>
      </div>
    );
  }

  // Custom formatting for getFileTree
  if (toolName === TOOL_NAMES.GET_FILE_TREE) {
    return (
      <div className={typography.body}>
        <div className="text-muted-foreground">Full tree</div>
      </div>
    );
  }

  // Custom formatting for installDependencies
  if (toolName === TOOL_NAMES.INSTALL_DEPENDENCIES) {
    const { path } = args as { path?: string };
    return (
      <div className={typography.body}>
        <div className="text-muted-foreground mb-1">Running npm install in:</div>
        <pre
          className={`bg-muted p-3 ${radius.sm} border border-border overflow-x-auto ${typography.mono} text-foreground`}
        >
          {path || 'unknown'}
        </pre>
      </div>
    );
  }

  // Custom formatting for planArchitecture
  if (toolName === TOOL_NAMES.PLAN_ARCHITECTURE) {
    const { databaseModels, apiRoutes, clientRoutes, clientComponents } = args as {
      databaseModels?: DatabaseModel[];
      apiRoutes?: ApiRoute[];
      clientRoutes?: ClientRoute[];
      clientComponents?: ClientComponent[];
    };

    return (
      <PlanArchitectureDisplay
        databaseModels={databaseModels}
        apiRoutes={apiRoutes}
        clientRoutes={clientRoutes}
        clientComponents={clientComponents}
        toolId={toolId}
        isSectionExpanded={isSectionExpanded}
        onToggleSection={onToggleSection}
      />
    );
  }

  // Default: show raw JSON
  return (
    <pre
      className={`bg-muted p-3 ${radius.sm} border border-border overflow-x-auto ${typography.mono} text-foreground`}
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
