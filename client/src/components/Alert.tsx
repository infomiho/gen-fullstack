import { radius, typography } from '../lib/design-tokens';

export interface AlertProps {
  /** Alert variant determines color scheme */
  variant: 'error' | 'warning' | 'info' | 'success';
  /** Alert message content */
  children: React.ReactNode;
  /** Optional className for additional styling */
  className?: string;
}

/**
 * Alert component - displays messages with color-coded styling
 *
 * Used to show contextual messages with clear visual indicators:
 * - Red: error messages
 * - Amber: warning messages
 * - Blue: informational messages
 * - Green: success messages
 *
 * @example
 * ```tsx
 * <Alert variant="error">Failed to start application</Alert>
 * <Alert variant="warning">This session is currently generating</Alert>
 * <Alert variant="info">Container is being created</Alert>
 * <Alert variant="success">Application started successfully</Alert>
 * ```
 */
export function Alert({ variant, children, className = '' }: AlertProps) {
  const getVariantStyles = () => {
    switch (variant) {
      case 'error':
        return {
          container: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/50',
          text: 'text-red-700 dark:text-red-400',
        };
      case 'warning':
        return {
          container: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/50',
          text: 'text-amber-700 dark:text-amber-400',
        };
      case 'info':
        return {
          container: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/50',
          text: 'text-blue-700 dark:text-blue-400',
        };
      case 'success':
        return {
          container: 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900/50',
          text: 'text-green-700 dark:text-green-400',
        };
    }
  };

  const styles = getVariantStyles();

  return (
    <div className={`p-3 border ${radius.md} ${styles.container} ${className}`}>
      <p className={`${typography.caption} ${styles.text}`}>{children}</p>
    </div>
  );
}
