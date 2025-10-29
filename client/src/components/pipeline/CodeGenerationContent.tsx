import type { PipelineStageEvent } from '@gen-fullstack/shared';
import { typography } from '../../lib/design-tokens';

export interface CodeGenerationContentProps {
  /** The stage status */
  status: PipelineStageEvent['status'];
}

/**
 * Displays content for the code generation stage modal
 */
export function CodeGenerationContent({ status }: CodeGenerationContentProps) {
  return (
    <div className={`${typography.body}`}>
      <div className="text-foreground mb-2">
        {status === 'started'
          ? 'The LLM is generating code using the available tools (writeFile, readFile, executeCommand, etc.).'
          : 'Code generation completed. The LLM has written all necessary files and executed required commands.'}
      </div>
      <div className="text-muted-foreground text-sm">
        Check the timeline below for detailed tool calls and LLM messages.
      </div>
    </div>
  );
}
