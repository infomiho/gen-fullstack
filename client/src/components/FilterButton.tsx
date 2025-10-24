interface FilterButtonProps {
  /**
   * Button label text
   */
  label: string;
  /**
   * Whether this filter is currently active
   */
  isActive: boolean;
  /**
   * Click handler
   */
  onClick: () => void;
  /**
   * Button color variant (defaults to gray)
   */
  variant?: 'gray' | 'purple' | 'yellow' | 'blue' | 'amber' | 'red';
}

const variantStyles = {
  gray: {
    active: 'bg-primary text-primary-foreground',
    inactive: 'bg-muted text-foreground hover:bg-muted/80',
  },
  purple: {
    active: 'bg-purple-600 text-white',
    inactive: 'bg-muted text-foreground hover:bg-muted/80',
  },
  yellow: {
    active: 'bg-yellow-600 text-white',
    inactive: 'bg-muted text-foreground hover:bg-muted/80',
  },
  blue: {
    active: 'bg-blue-600 text-white',
    inactive: 'bg-muted text-foreground hover:bg-muted/80',
  },
  amber: {
    active: 'bg-amber-600 text-white',
    inactive: 'bg-muted text-foreground hover:bg-muted/80',
  },
  red: {
    active: 'bg-red-600 text-white',
    inactive: 'bg-muted text-foreground hover:bg-muted/80',
  },
} as const;

/**
 * FilterButton component for displaying filter options
 *
 * Used in LogViewer and other components with filterable content.
 *
 * @example
 * ```tsx
 * <FilterButton
 *   label="All"
 *   isActive={filter === 'all'}
 *   onClick={() => setFilter('all')}
 *   variant="gray"
 * />
 * ```
 */
export function FilterButton({ label, isActive, onClick, variant = 'gray' }: FilterButtonProps) {
  const styles = variantStyles[variant];
  const colorClass = isActive ? styles.active : styles.inactive;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2 py-1 text-xs rounded transition-colors ${colorClass}`}
    >
      {label}
    </button>
  );
}
