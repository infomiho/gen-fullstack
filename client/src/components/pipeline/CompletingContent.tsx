import { typography } from '../../lib/design-tokens';

export interface CompletingContentProps {
  /** Optional summary message */
  summary?: string;
}

/**
 * Displays content for the completing stage modal
 */
export function CompletingContent({ summary }: CompletingContentProps) {
  return (
    <div className={`${typography.body}`}>
      {summary ? (
        <div className="text-foreground">{summary}</div>
      ) : (
        <div className="text-muted-foreground">Generation completed successfully.</div>
      )}
    </div>
  );
}
