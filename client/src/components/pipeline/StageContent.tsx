import type { PipelineStageEvent } from '@gen-fullstack/shared';
import { typography } from '../../lib/design-tokens';
import { PlanArchitectureDisplay } from '../PlanArchitectureDisplay';
import { ValidationErrorsDisplay } from '../ValidationErrorsDisplay';
import { CodeGenerationContent } from './CodeGenerationContent';
import { CompletingContent } from './CompletingContent';
import { ErrorFixingContent } from './ErrorFixingContent';
import { TemplateLoadingContent } from './TemplateLoadingContent';

export interface StageContentProps {
  /** The pipeline stage to render content for */
  stage: PipelineStageEvent;
  /** Check if a section is expanded (optional, for state persistence) */
  isSectionExpanded?: (id: string, section: string) => boolean;
  /** Toggle a section's expanded state (optional, for state persistence) */
  onToggleSection?: (id: string, section: string) => void;
}

/**
 * Renders modal content based on stage type
 */
export function StageContent({ stage, isSectionExpanded, onToggleSection }: StageContentProps) {
  switch (stage.type) {
    case 'planning': {
      if (stage.data?.plan) {
        return (
          <PlanArchitectureDisplay
            {...stage.data.plan}
            toolId={stage.id}
            isSectionExpanded={isSectionExpanded}
            onToggleSection={onToggleSection}
          />
        );
      }
      return (
        <div className={`${typography.body} text-muted-foreground`}>No plan data available</div>
      );
    }

    case 'code_generation': {
      return <CodeGenerationContent status={stage.status} />;
    }

    case 'validation': {
      if (stage.data?.validationErrors) {
        return (
          <ValidationErrorsDisplay
            errors={stage.data.validationErrors}
            stageId={stage.id}
            isSectionExpanded={isSectionExpanded}
            onToggleSection={onToggleSection}
          />
        );
      }
      return (
        <div className={`${typography.body} text-muted-foreground`}>
          No validation results available
        </div>
      );
    }

    case 'error_fixing': {
      return (
        <ErrorFixingContent
          iteration={stage.data?.iteration}
          maxIterations={stage.data?.maxIterations}
          errorCount={stage.data?.errorCount}
          status={stage.status}
        />
      );
    }

    case 'template_loading': {
      return <TemplateLoadingContent templateName={stage.data?.templateName} />;
    }

    case 'completing': {
      return <CompletingContent summary={stage.data?.summary} />;
    }
  }
}
