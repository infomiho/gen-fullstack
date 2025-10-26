import { Search, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { focus, transitions, typography } from '../lib/design-tokens';
import { CAPABILITY_METADATA } from '../lib/capability-metadata';

export interface SessionFiltersState {
  search: string;
  status: 'all' | 'completed' | 'failed' | 'generating';
  capabilities: {
    template: boolean;
    planning: boolean;
    compilerChecks: boolean;
    buildingBlocks: boolean;
  };
}

interface SessionFiltersProps {
  filters: SessionFiltersState;
  onFiltersChange: (filters: SessionFiltersState) => void;
  sessionCount: number; // Total sessions matching filters
  totalCount: number; // Total sessions available
}

/**
 * SessionFilters component
 *
 * Provides comprehensive filtering UI:
 * - Search input (real-time text filtering)
 * - Status filter chips (All, Completed, Failed, Generating)
 * - Input mode dropdown (All, Naive, Template)
 * - Capability checkboxes (Planning, Compiler Checks, Building Blocks)
 */
export function SessionFilters({
  filters,
  onFiltersChange,
  sessionCount,
  totalCount,
}: SessionFiltersProps) {
  const updateFilter = <K extends keyof SessionFiltersState>(
    key: K,
    value: SessionFiltersState[K],
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const updateCapability = (capability: keyof SessionFiltersState['capabilities']) => {
    onFiltersChange({
      ...filters,
      capabilities: {
        ...filters.capabilities,
        [capability]: !filters.capabilities[capability],
      },
    });
  };

  const clearSearch = () => {
    updateFilter('search', '');
  };

  const hasActiveFilters =
    filters.search ||
    filters.status !== 'all' ||
    filters.capabilities.template ||
    filters.capabilities.planning ||
    filters.capabilities.compilerChecks ||
    filters.capabilities.buildingBlocks;

  return (
    <div className="space-y-4">
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search sessions by prompt..."
          value={filters.search}
          onChange={(e) => updateFilter('search', e.target.value)}
          className={`w-full rounded-md border border-border bg-background pl-10 pr-10 py-2 text-sm text-foreground placeholder:text-muted-foreground ${focus.ring} ${transitions.colors}`}
        />
        {filters.search && (
          <button
            type="button"
            onClick={clearSearch}
            className={`absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground ${transitions.colors}`}
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Filters row */}
      <div className="space-y-4">
        {/* Status filters */}
        <div>
          <div className={`${typography.label} mb-2 block`}>Status</div>
          <div className="flex flex-wrap gap-2">
            <StatusChip
              label="All"
              active={filters.status === 'all'}
              onClick={() => updateFilter('status', 'all')}
            />
            <StatusChip
              label="Completed"
              active={filters.status === 'completed'}
              onClick={() => updateFilter('status', 'completed')}
              variant="completed"
            />
            <StatusChip
              label="Failed"
              active={filters.status === 'failed'}
              onClick={() => updateFilter('status', 'failed')}
              variant="failed"
            />
            <StatusChip
              label="Generating"
              active={filters.status === 'generating'}
              onClick={() => updateFilter('status', 'generating')}
              variant="generating"
            />
          </div>
        </div>

        {/* Capability filters - compact chips */}
        <div>
          <div className={`${typography.label} mb-2 block`}>Capabilities</div>
          <div className="flex flex-wrap gap-2">
            <CapabilityFilterChip
              icon={CAPABILITY_METADATA.template.icon}
              label={CAPABILITY_METADATA.template.label}
              active={filters.capabilities.template}
              onClick={() => updateCapability('template')}
            />
            <CapabilityFilterChip
              icon={CAPABILITY_METADATA.planning.icon}
              label={CAPABILITY_METADATA.planning.label}
              active={filters.capabilities.planning}
              onClick={() => updateCapability('planning')}
            />
            <CapabilityFilterChip
              icon={CAPABILITY_METADATA.compiler.icon}
              label={CAPABILITY_METADATA.compiler.label}
              active={filters.capabilities.compilerChecks}
              onClick={() => updateCapability('compilerChecks')}
            />
            <CapabilityFilterChip
              icon={CAPABILITY_METADATA.buildingBlocks.icon}
              label={CAPABILITY_METADATA.buildingBlocks.label}
              active={filters.capabilities.buildingBlocks}
              onClick={() => updateCapability('buildingBlocks')}
            />
          </div>
        </div>
      </div>

      {/* Results summary */}
      <div className="flex items-center justify-between text-sm text-muted-foreground border-t border-border pt-3">
        <span>
          {hasActiveFilters
            ? `Showing ${sessionCount} of ${totalCount} sessions`
            : `${totalCount} sessions`}
        </span>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={() =>
              onFiltersChange({
                search: '',
                status: 'all',
                capabilities: {
                  template: false,
                  planning: false,
                  compilerChecks: false,
                  buildingBlocks: false,
                },
              })
            }
            className={`text-xs font-medium text-primary hover:underline ${transitions.colors}`}
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * StatusChip - Filter chip for status selection
 */
interface StatusChipProps {
  label: string;
  active: boolean;
  onClick: () => void;
  variant?: 'completed' | 'failed' | 'generating';
}

function StatusChip({ label, active, onClick, variant }: StatusChipProps) {
  const variantClasses = variant
    ? {
        completed: active
          ? 'bg-green-500/20 text-green-700 dark:text-green-300 border-green-500'
          : 'hover:bg-green-500/10 hover:text-green-600 dark:hover:text-green-400',
        failed: active
          ? 'bg-red-500/20 text-red-700 dark:text-red-300 border-red-500'
          : 'hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400',
        generating: active
          ? 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500'
          : 'hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-blue-400',
      }[variant]
    : '';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={`Filter by ${label.toLowerCase()} status`}
      className={`rounded-md border px-3 py-1.5 text-xs font-medium ${transitions.colors} ${
        active
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-border bg-background text-muted-foreground hover:bg-muted'
      } ${variantClasses}`}
    >
      {label}
    </button>
  );
}

/**
 * CapabilityFilterChip - Compact filter chip for capabilities with icon
 */
interface CapabilityFilterChipProps {
  icon: LucideIcon;
  label: string;
  active: boolean;
  onClick: () => void;
}

function CapabilityFilterChip({ icon: Icon, label, active, onClick }: CapabilityFilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={`Filter by ${label} capability`}
      className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium ${transitions.colors} ${
        active
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-border bg-background text-muted-foreground hover:bg-muted'
      }`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </button>
  );
}
