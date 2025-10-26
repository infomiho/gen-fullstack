import type { LucideIcon } from 'lucide-react';
import { Blocks, BrainCircuit, Code2, FileCode, ScanSearch } from 'lucide-react';
import { capabilityIcons } from './design-tokens';

/**
 * Metadata for a single capability
 */
export interface CapabilityMetadata {
  id: string;
  icon: LucideIcon;
  iconColor: string;
  label: string;
  description: string;
  hoverInfo: string;
}

/**
 * Centralized capability metadata registry
 *
 * Single source of truth for all capability UI:
 * - Icons and colors
 * - Labels and descriptions
 * - Hover info text
 *
 * Used by:
 * - CapabilitySection (selection UI)
 * - SessionSidebar (display active capabilities)
 */
export const CAPABILITY_METADATA = {
  codeGeneration: {
    id: 'code-generation',
    icon: Code2,
    iconColor: capabilityIcons.codeGen,
    label: 'Code Generation',
    description: 'Generate complete full-stack applications from prompts',
    hoverInfo:
      'The core capability that generates React + TypeScript client, Express + TypeScript server, and Prisma database schema based on your description.',
  },
  planning: {
    id: 'planning',
    icon: BrainCircuit,
    iconColor: capabilityIcons.planning,
    label: 'Smart Planning',
    description: 'Design architecture first before implementation',
    hoverInfo:
      'Generates an architectural plan including database schema, API endpoints, and component structure before writing any code. This results in more coherent and well-structured applications.',
  },
  template: {
    id: 'template',
    icon: FileCode,
    iconColor: capabilityIcons.template,
    label: 'Template Base',
    description: 'Start from working full-stack template',
    hoverInfo:
      'Begin with a pre-built full-stack template and modify it according to your requirements. This is faster than building from scratch and ensures best practices are followed.',
  },
  compiler: {
    id: 'compiler',
    icon: ScanSearch,
    iconColor: capabilityIcons.compiler,
    label: 'Auto Error-Fixing',
    description: 'Validate and fix TypeScript and Prisma errors',
    hoverInfo:
      'Automatically runs TypeScript and Prisma compiler checks after generation. If errors are found, the AI attempts to fix them iteratively until they pass or reach the maximum iterations.',
  },
  buildingBlocks: {
    id: 'building-blocks',
    icon: Blocks,
    iconColor: capabilityIcons.blocks,
    label: 'Building Blocks',
    description: 'Use pre-built components (auth, CRUD, pagination)',
    hoverInfo:
      'Enable access to production-ready building blocks like authentication, CRUD operations, and pagination. The AI can request and integrate these blocks instead of writing everything from scratch, saving time and reducing errors.',
  },
} as const satisfies Record<string, CapabilityMetadata>;

/**
 * Type for capability keys
 */
export type CapabilityKey = keyof typeof CAPABILITY_METADATA;

/**
 * Badge styles for capability badges (compact display)
 *
 * Centralized styling to maintain consistency across:
 * - CapabilityBadge component (session list metadata)
 * - Filter chips
 * - Any future badge displays
 *
 * Note: Uses 'compilerChecks' and 'buildingBlocks' keys to match
 * the CapabilityConfig type from shared package
 */
export const CAPABILITY_BADGE_STYLES = {
  planning: {
    icon: BrainCircuit,
    bgColor: 'bg-purple-500/10',
    textColor: 'text-purple-600 dark:text-purple-400',
    borderColor: 'border-purple-500/20',
    shortLabel: 'Planning',
  },
  compilerChecks: {
    icon: ScanSearch,
    bgColor: 'bg-orange-500/10',
    textColor: 'text-orange-600 dark:text-orange-400',
    borderColor: 'border-orange-500/20',
    shortLabel: 'Compiler',
  },
  buildingBlocks: {
    icon: Blocks,
    bgColor: 'bg-amber-500/10',
    textColor: 'text-amber-600 dark:text-amber-400',
    borderColor: 'border-amber-500/20',
    shortLabel: 'Blocks',
  },
} as const satisfies Record<
  string,
  {
    icon: LucideIcon;
    bgColor: string;
    textColor: string;
    borderColor: string;
    shortLabel: string;
  }
>;
