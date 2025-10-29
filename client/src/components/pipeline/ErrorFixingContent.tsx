import { typography } from '../../lib/design-tokens';

export interface ErrorFixingContentProps {
  /** The iteration number */
  iteration?: number;
  /** Maximum allowed iterations */
  maxIterations?: number;
  /** Number of errors being fixed */
  errorCount?: number;
  /** The stage status */
  status: 'started' | 'completed' | 'failed';
}

/**
 * Displays content for the error fixing stage modal
 */
export function ErrorFixingContent({
  iteration,
  maxIterations = 3,
  errorCount = 0,
  status,
}: ErrorFixingContentProps) {
  return (
    <div className={`${typography.body}`}>
      <div className="text-foreground mb-2">
        {status === 'started' ? (
          <>
            The LLM is fixing {errorCount} compilation error{errorCount === 1 ? '' : 's'} found
            during validation.
            {iteration && (
              <>
                {' '}
                This is attempt {iteration}/{maxIterations}.
              </>
            )}
          </>
        ) : (
          'Error fixing completed. The LLM has applied fixes to resolve the validation errors.'
        )}
      </div>
      <div className="text-muted-foreground text-sm">
        Check the timeline below for detailed tool calls showing the fixes applied.
      </div>
    </div>
  );
}
