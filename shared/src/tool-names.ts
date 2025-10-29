/**
 * Tool Name Constants
 *
 * Central source of truth for all LLM tool names used across the application.
 * Import these constants instead of hardcoding strings to ensure:
 * - Type safety (compiler errors for typos)
 * - Consistency across client and server
 * - Easy refactoring (change in one place)
 */

/**
 * Tool name constants with const assertion for literal types
 */
export const TOOL_NAMES = {
  // Base tools (always available)
  WRITE_FILE: 'writeFile',
  READ_FILE: 'readFile',
  GET_FILE_TREE: 'getFileTree',

  // Planning tools (available when planning: true)
  PLAN_ARCHITECTURE: 'planArchitecture',

  // Template tools (available when inputMode: 'template')
  INSTALL_NPM_DEP: 'installNpmDep',

  // Compiler check tools (available when compilerChecks: true)
  VALIDATE_PRISMA_SCHEMA: 'validatePrismaSchema',
  VALIDATE_TYPESCRIPT: 'validateTypeScript',

  // Building block tools (available when buildingBlocks: true)
  REQUEST_BLOCK: 'requestBlock',

  // Pipeline tools (internal, not LLM tools - used for timeline visualization)
  INSTALL_DEPENDENCIES: 'installDependencies',
} as const;

/**
 * Type-safe union of all tool names
 * Can be used for function parameters, validation, etc.
 */
export type ToolName = (typeof TOOL_NAMES)[keyof typeof TOOL_NAMES];

/**
 * Tool categories for documentation and organization
 */
export const TOOL_CATEGORIES = {
  base: [TOOL_NAMES.WRITE_FILE, TOOL_NAMES.READ_FILE, TOOL_NAMES.GET_FILE_TREE],
  planning: [TOOL_NAMES.PLAN_ARCHITECTURE],
  template: [TOOL_NAMES.INSTALL_NPM_DEP],
  compilerChecks: [TOOL_NAMES.VALIDATE_PRISMA_SCHEMA, TOOL_NAMES.VALIDATE_TYPESCRIPT],
  buildingBlocks: [TOOL_NAMES.REQUEST_BLOCK],
} as const;
