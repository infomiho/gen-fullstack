import { type CapabilityConfig, DEFAULT_TEMPLATE_NAME } from '@gen-fullstack/shared';
import { CapabilityCard } from './CapabilityCard';
import { HoverInfo } from './HoverInfo';
import { spacing, typography } from '../lib/design-tokens';
import { CAPABILITY_METADATA } from '../lib/capability-metadata';

export interface CapabilitySectionProps {
  config: CapabilityConfig;
  onConfigChange: (config: CapabilityConfig) => void;
  disabled?: boolean;
}

/**
 * Capability selection UI for configuring AI-powered app generation
 *
 * Displays four capability cards:
 * 1. Code Generation (readonly) - always enabled core functionality
 * 2. Smart Planning - optional architectural planning
 * 3. Template Base - optional template starting point
 * 4. Auto Error-Fixing - optional compiler validation
 */
export function CapabilitySection({
  config,
  onConfigChange,
  disabled = false,
}: CapabilitySectionProps) {
  return (
    <div>
      {/* Section header */}
      <div className="flex items-center gap-2 mb-4">
        <h2 className={typography.sectionHeader}>AI Capabilities</h2>
        <HoverInfo content="Select which AI capabilities to enable for your application generation. Capabilities can be combined for more sophisticated results." />
      </div>

      {/* Capability cards */}
      <div className={spacing.controls}>
        {/* Code Generation capability - always enabled, non-deselectable */}
        <CapabilityCard
          id={CAPABILITY_METADATA.codeGeneration.id}
          icon={CAPABILITY_METADATA.codeGeneration.icon}
          iconColor={CAPABILITY_METADATA.codeGeneration.iconColor}
          title={CAPABILITY_METADATA.codeGeneration.label}
          description={CAPABILITY_METADATA.codeGeneration.description}
          hoverInfo={CAPABILITY_METADATA.codeGeneration.hoverInfo}
          checked={true}
          mode="readonly"
        />

        {/* Planning capability */}
        <CapabilityCard
          id={CAPABILITY_METADATA.planning.id}
          icon={CAPABILITY_METADATA.planning.icon}
          iconColor={CAPABILITY_METADATA.planning.iconColor}
          title={CAPABILITY_METADATA.planning.label}
          description={CAPABILITY_METADATA.planning.description}
          hoverInfo={CAPABILITY_METADATA.planning.hoverInfo}
          checked={config.planning}
          onCheckedChange={(checked) =>
            onConfigChange({
              ...config,
              planning: checked,
            })
          }
          mode={disabled ? 'disabled' : 'interactive'}
        />

        {/* Template capability */}
        <CapabilityCard
          id={CAPABILITY_METADATA.template.id}
          icon={CAPABILITY_METADATA.template.icon}
          iconColor={CAPABILITY_METADATA.template.iconColor}
          title={CAPABILITY_METADATA.template.label}
          description={CAPABILITY_METADATA.template.description}
          hoverInfo={CAPABILITY_METADATA.template.hoverInfo}
          checked={config.inputMode === 'template'}
          onCheckedChange={(checked) =>
            onConfigChange({
              ...config,
              inputMode: checked ? 'template' : 'naive',
              templateOptions: checked
                ? {
                    templateName: DEFAULT_TEMPLATE_NAME,
                  }
                : undefined,
            })
          }
          mode={disabled ? 'disabled' : 'interactive'}
        />

        {/* Compiler checks capability */}
        <CapabilityCard
          id={CAPABILITY_METADATA.compiler.id}
          icon={CAPABILITY_METADATA.compiler.icon}
          iconColor={CAPABILITY_METADATA.compiler.iconColor}
          title={CAPABILITY_METADATA.compiler.label}
          description={CAPABILITY_METADATA.compiler.description}
          hoverInfo={CAPABILITY_METADATA.compiler.hoverInfo}
          checked={config.compilerChecks}
          onCheckedChange={(checked) =>
            onConfigChange({
              ...config,
              compilerChecks: checked,
            })
          }
          mode={disabled ? 'disabled' : 'interactive'}
        >
          {/* Nested control: max iterations slider */}
          <div className="space-y-2">
            <label htmlFor="iterations" className="text-xs font-medium text-gray-700">
              Max iterations: {config.maxIterations}
            </label>
            <input
              id="iterations"
              type="range"
              min="1"
              max="5"
              value={config.maxIterations}
              onChange={(e) =>
                onConfigChange({
                  ...config,
                  maxIterations: Number(e.target.value),
                })
              }
              disabled={disabled}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>1</span>
              <span>5</span>
            </div>
          </div>
        </CapabilityCard>
      </div>
    </div>
  );
}
