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
    active: 'bg-gray-900 text-white',
    inactive: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
  },
  purple: {
    active: 'bg-purple-600 text-white',
    inactive: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
  },
  yellow: {
    active: 'bg-yellow-600 text-white',
    inactive: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
  },
  blue: {
    active: 'bg-blue-600 text-white',
    inactive: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
  },
  amber: {
    active: 'bg-amber-600 text-white',
    inactive: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
  },
  red: {
    active: 'bg-red-600 text-white',
    inactive: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
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
