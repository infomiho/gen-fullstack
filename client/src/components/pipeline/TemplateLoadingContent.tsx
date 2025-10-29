import { typography } from '../../lib/design-tokens';

export interface TemplateLoadingContentProps {
  /** The template name */
  templateName?: string;
}

/**
 * Displays content for the template loading stage modal
 */
export function TemplateLoadingContent({ templateName }: TemplateLoadingContentProps) {
  return (
    <div className={`${typography.body}`}>
      <div className="mb-2">
        <span className="text-muted-foreground">Template: </span>
        <span className={`${typography.mono} text-foreground`}>{templateName || 'Unknown'}</span>
      </div>
      <div className="text-muted-foreground text-sm">
        Template files have been copied to the sandbox and are ready for code generation.
      </div>
    </div>
  );
}
