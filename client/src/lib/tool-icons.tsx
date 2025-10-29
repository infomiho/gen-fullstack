import { TOOL_NAMES } from '@gen-fullstack/shared';
import {
  FileDown,
  FileUp,
  FolderTree,
  Box,
  Layout,
  Database,
  FileCheck,
  PackagePlus,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

/**
 * Tool icon configuration with icon component and color class
 */
export type ToolIconConfig = {
  icon: LucideIcon;
  color: string;
};

/**
 * Returns the appropriate icon and color for a given tool name.
 *
 * Color categories:
 * - Blue: File operations (writeFile, readFile, getFileTree)
 * - Purple: Validation (validatePrismaSchema, validateTypeScript)
 * - Amber: Architecture/Planning (planArchitecture, requestBlock, installNpmDep)
 *
 * @param toolName - The name of the tool (e.g., 'writeFile', 'readFile')
 * @returns Object with icon component and color class
 */
export function getToolIcon(toolName: string): ToolIconConfig {
  switch (toolName) {
    // File operations - Blue
    case TOOL_NAMES.WRITE_FILE:
      return { icon: FileDown, color: 'text-blue-600 dark:text-blue-400' };
    case TOOL_NAMES.READ_FILE:
      return { icon: FileUp, color: 'text-blue-600 dark:text-blue-400' };
    case TOOL_NAMES.GET_FILE_TREE:
      return { icon: FolderTree, color: 'text-blue-600 dark:text-blue-400' };

    // Package management - Amber
    case TOOL_NAMES.INSTALL_NPM_DEP:
      return { icon: PackagePlus, color: 'text-amber-600 dark:text-amber-400' };

    // Architecture & planning - Amber
    case TOOL_NAMES.REQUEST_BLOCK:
      return { icon: Box, color: 'text-amber-600 dark:text-amber-400' };
    case TOOL_NAMES.PLAN_ARCHITECTURE:
      return { icon: Layout, color: 'text-amber-600 dark:text-amber-400' };

    // Validation - Purple
    case TOOL_NAMES.VALIDATE_PRISMA_SCHEMA:
      return { icon: Database, color: 'text-purple-600 dark:text-purple-400' };
    case TOOL_NAMES.VALIDATE_TYPESCRIPT:
      return { icon: FileCheck, color: 'text-purple-600 dark:text-purple-400' };

    // Fallback - Gray
    default:
      return { icon: Wrench, color: 'text-muted-foreground' };
  }
}
