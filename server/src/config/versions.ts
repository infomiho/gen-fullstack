/**
 * Required package versions for generated full-stack applications
 *
 * These versions are used in:
 * - Strategy prompts (naive, plan-first)
 * - Docker runner image
 * - Documentation
 */

/**
 * Required package versions for generated full-stack applications.
 * These versions must be kept in sync with the Docker runner image and strategy prompts.
 *
 * @constant
 * @example
 * ```ts
 * import { REQUIRED_VERSIONS } from './config/versions';
 * console.log(REQUIRED_VERSIONS.react); // "^19.2.0"
 * ```
 */
export const REQUIRED_VERSIONS = {
  // Server
  express: '^5.1.0',
  cors: '^2.8.5',

  // Database
  prisma: '^6.10.0',
  prismaClient: '^6.10.0',

  // Client
  react: '^19.2.0',
  reactDom: '^19.2.0',
  vite: '^7.1.9',

  // Build Tools
  concurrently: '^9.2.1',
  typescript: '~5.9.3',
  tsx: '^4.19.2',

  // Plugins
  vitejsPluginReact: '^5.0.4',

  // Types
  typesReact: '^19.2.2',
  typesReactDom: '^19.2.2',
  typesExpress: '^5.0.0',
  typesCors: '^2.8.17',
  typesNode: '^22.10.2',
} as const;

/**
 * Format versions for display in prompts
 */
export function formatVersionsForPrompt(): string {
  return `REQUIRED VERSIONS (use exactly):
- express: ${REQUIRED_VERSIONS.express}
- @prisma/client: ${REQUIRED_VERSIONS.prismaClient}
- prisma: ${REQUIRED_VERSIONS.prisma}
- cors: ${REQUIRED_VERSIONS.cors}
- react: ${REQUIRED_VERSIONS.react}
- react-dom: ${REQUIRED_VERSIONS.reactDom}
- vite: ${REQUIRED_VERSIONS.vite}
- concurrently: ${REQUIRED_VERSIONS.concurrently}
- typescript: ${REQUIRED_VERSIONS.typescript}`;
}
