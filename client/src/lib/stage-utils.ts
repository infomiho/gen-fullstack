import type { PipelineStageEvent } from '@gen-fullstack/shared';
import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, CheckCircle, Code, Layers, Package, Wrench } from 'lucide-react';

export interface StageIconConfig {
  icon: LucideIcon;
  color: string;
}

/**
 * Get stage icon and color based on stage type
 */
export function getStageIcon(type: PipelineStageEvent['type']): StageIconConfig {
  switch (type) {
    case 'planning':
      return { icon: Layers, color: 'text-amber-500' };
    case 'code_generation':
      return { icon: Code, color: 'text-cyan-500' };
    case 'validation':
      return { icon: AlertTriangle, color: 'text-purple-500' };
    case 'error_fixing':
      return { icon: Wrench, color: 'text-orange-500' };
    case 'template_loading':
      return { icon: Package, color: 'text-blue-500' };
    case 'completing':
      return { icon: CheckCircle, color: 'text-green-500' };
  }
}

/**
 * Get stage display name
 */
export function getStageName(type: PipelineStageEvent['type']): string {
  switch (type) {
    case 'planning':
      return 'Planning Architecture';
    case 'code_generation':
      return 'Code Generation';
    case 'validation':
      return 'Validation';
    case 'error_fixing':
      return 'Error Fixing';
    case 'template_loading':
      return 'Template Loading';
    case 'completing':
      return 'Completing';
  }
}

/**
 * Get planning stage summary
 */
function getPlanningSummary(data: PipelineStageEvent['data']): string {
  if (!data?.plan) return 'Generating architectural plan...';

  const {
    databaseModels = [],
    apiRoutes = [],
    clientRoutes = [],
    clientComponents = [],
  } = data.plan;
  return `${databaseModels.length} models, ${apiRoutes.length} API routes, ${clientRoutes.length} client routes, ${clientComponents.length} components`;
}

/**
 * Get validation stage summary
 */
function getValidationSummary(data: PipelineStageEvent['data']): string {
  if (!data?.validationErrors) return 'Running Prisma + TypeScript checks...';

  const errorCount = data.validationErrors.length;
  if (errorCount === 0) return '✓ No errors found';

  const iteration = data.iteration;
  const suffix = iteration ? ` (Retry ${iteration}/${data.maxIterations ?? 3})` : '';
  return `⚠️ Found ${errorCount} error${errorCount === 1 ? '' : 's'}${suffix}`;
}

/**
 * Get error fixing stage summary
 */
function getErrorFixingSummary(
  data: PipelineStageEvent['data'],
  status: PipelineStageEvent['status'],
): string {
  if (status === 'started') {
    const errorCount = data?.errorCount ?? 0;
    const iteration = data?.iteration;
    const suffix = iteration ? ` (Attempt ${iteration}/${data.maxIterations ?? 3})` : '';
    return `Fixing ${errorCount} error${errorCount === 1 ? '' : 's'}${suffix}`;
  }
  return '✓ Errors fixed';
}

/**
 * Get stage summary for timeline card
 */
export function getStageSummary(stage: PipelineStageEvent): string {
  if (stage.status === 'failed') return 'Failed';

  switch (stage.type) {
    case 'planning':
      return getPlanningSummary(stage.data);
    case 'code_generation':
      return stage.status === 'started' ? 'Generating code...' : 'Code generated successfully';
    case 'validation':
      return getValidationSummary(stage.data);
    case 'error_fixing':
      return getErrorFixingSummary(stage.data, stage.status);
    case 'template_loading':
      return stage.data?.templateName ? `Copied ${stage.data.templateName}` : 'Loading template...';
    case 'completing':
      return stage.data?.summary || 'Finalizing generation...';
  }
}

/**
 * Get status indicator (icon) for stage
 */
export function getStatusIndicator(status: PipelineStageEvent['status']): string {
  switch (status) {
    case 'completed':
      return '●';
    case 'failed':
      return '✕';
    case 'started':
      return '○';
  }
}

/**
 * Get status color class for stage indicator
 */
export function getStatusColor(status: PipelineStageEvent['status']): string {
  switch (status) {
    case 'completed':
      return 'text-green-600';
    case 'failed':
      return 'text-red-600';
    case 'started':
      return 'text-gray-500';
  }
}

/**
 * Get status label for accessibility
 */
export function getStatusLabel(status: PipelineStageEvent['status']): string {
  switch (status) {
    case 'completed':
      return 'Completed';
    case 'failed':
      return 'Failed';
    case 'started':
      return 'In progress';
  }
}

/**
 * Get detailed status text for modal
 */
export function getDetailedStatusText(status: PipelineStageEvent['status']): string {
  switch (status) {
    case 'completed':
      return 'Complete';
    case 'failed':
      return 'Failed';
    case 'started':
      return 'Running';
  }
}

/**
 * Get detailed status color class for modal
 */
export function getDetailedStatusColor(status: PipelineStageEvent['status']): string {
  switch (status) {
    case 'completed':
      return 'text-green-700 dark:text-green-400';
    case 'failed':
      return 'text-red-700 dark:text-red-400';
    case 'started':
      return 'text-yellow-700 dark:text-yellow-400';
  }
}
