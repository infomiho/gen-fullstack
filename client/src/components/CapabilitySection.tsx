import { type CapabilityConfig, DEFAULT_TEMPLATE_NAME } from '@gen-fullstack/shared';
import { CAPABILITY_METADATA } from '../lib/capability-metadata';
import { typography } from '../lib/design-tokens';
import { CapabilityCard } from './CapabilityCard';
import { HoverInfo } from './HoverInfo';

export interface CapabilitySectionProps {
  config: CapabilityConfig;
  onConfigChange: (config: CapabilityConfig) => void;
  disabled?: boolean;
}

/**
 * Capability selection UI for configuring AI-powered app generation
 *
 * Displays five capability cards:
 * 1. Code Generation (readonly) - always enabled core functionality
 * 2. Smart Planning - optional architectural planning
 * 3. Template Base - optional template starting point
 * 4. Auto Error-Fixing - optional compiler validation
 * 5. Building Blocks - optional pre-built components
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
        <h2 className={typography.sectionHeader}>Capabilities</h2>
        <HoverInfo content="Select which capabilities to enable for your application generation. Capabilities can be combined for more sophisticated results." />
      </div>

      {/* Capability cards - wrapped grid layout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {/* Code Generation capability - always enabled, non-deselectable */}
        <CapabilityCard
          id={CAPABILITY_METADATA.codeGeneration.id}
          icon={CAPABILITY_METADATA.codeGeneration.icon}
          iconColor={CAPABILITY_METADATA.codeGeneration.iconColor}
          title={CAPABILITY_METADATA.codeGeneration.label}
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
          hoverInfo={CAPABILITY_METADATA.compiler.hoverInfo}
          checked={config.compilerChecks}
          onCheckedChange={(checked) =>
            onConfigChange({
              ...config,
              compilerChecks: checked,
            })
          }
          mode={disabled ? 'disabled' : 'interactive'}
        />

        {/* Building Blocks capability */}
        <CapabilityCard
          id={CAPABILITY_METADATA.buildingBlocks.id}
          icon={CAPABILITY_METADATA.buildingBlocks.icon}
          iconColor={CAPABILITY_METADATA.buildingBlocks.iconColor}
          title={CAPABILITY_METADATA.buildingBlocks.label}
          hoverInfo={CAPABILITY_METADATA.buildingBlocks.hoverInfo}
          checked={config.buildingBlocks}
          onCheckedChange={(checked) =>
            onConfigChange({
              ...config,
              buildingBlocks: checked,
            })
          }
          mode={disabled ? 'disabled' : 'interactive'}
        />
      </div>
    </div>
  );
}
