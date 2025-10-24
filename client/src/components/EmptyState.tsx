import type { ReactNode } from 'react';

interface EmptyStateProps {
  /**
   * Icon to display (lucide-react component or custom SVG)
   */
  icon?: ReactNode;
  /**
   * Primary message
   */
  title: string;
  /**
   * Optional secondary message
   */
  description?: string;
  /**
   * Optional action button or link
   */
  action?: ReactNode;
  /**
   * Optional custom className for the container
   */
  className?: string;
}

/**
 * Empty state component for displaying placeholder content
 * when no data is available.
 *
 * @example
 * ```tsx
 * <EmptyState
 *   icon={<Bot size={48} />}
 *   title="No messages yet"
 *   description="Start generating to see LLM interactions..."
 * />
 * ```
 */
export function EmptyState({ icon, title, description, action, className = '' }: EmptyStateProps) {
  return (
    <div className={`flex h-full items-center justify-center text-muted-foreground ${className}`}>
      <div className="text-center">
        {icon && <div className="flex justify-center mb-4 opacity-50">{icon}</div>}
        <p className="text-sm text-muted-foreground">{title}</p>
        {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
        {action && <div className="mt-4">{action}</div>}
      </div>
    </div>
  );
}
