import { CAPABILITY_METADATA } from '../lib/capability-metadata';

interface CapabilityConfig {
  inputMode?: string;
  planning?: boolean;
  compilerChecks?: boolean;
  buildingBlocks?: boolean;
  maxIterations?: number;
}

interface CapabilitiesListProps {
  capabilityConfig: CapabilityConfig;
}

/**
 * CapabilitiesList component
 *
 * Displays the list of capabilities for a session.
 * Shows enabled capabilities in color, disabled capabilities grayed out and crossed.
 */
export function CapabilitiesList({ capabilityConfig }: CapabilitiesListProps) {
  return (
    <div className="space-y-2">
      {/* Code Generation - always present and enabled */}
      <div className="flex items-center gap-2 text-sm text-gray-700">
        <CAPABILITY_METADATA.codeGeneration.icon
          className={`w-4 h-4 ${CAPABILITY_METADATA.codeGeneration.iconColor} flex-shrink-0`}
        />
        <span>{CAPABILITY_METADATA.codeGeneration.label}</span>
      </div>

      {/* Planning - shown always, grayed and crossed out if disabled */}
      <div
        className={`flex items-center gap-2 text-sm ${capabilityConfig.planning ? 'text-gray-700' : 'text-gray-400 line-through'}`}
      >
        <CAPABILITY_METADATA.planning.icon
          className={`w-4 h-4 ${capabilityConfig.planning ? CAPABILITY_METADATA.planning.iconColor : 'text-gray-400'} flex-shrink-0`}
        />
        <span>{CAPABILITY_METADATA.planning.label}</span>
      </div>

      {/* Template - shown always, grayed and crossed out if disabled */}
      <div
        className={`flex items-center gap-2 text-sm ${capabilityConfig.inputMode === 'template' ? 'text-gray-700' : 'text-gray-400 line-through'}`}
      >
        <CAPABILITY_METADATA.template.icon
          className={`w-4 h-4 ${capabilityConfig.inputMode === 'template' ? CAPABILITY_METADATA.template.iconColor : 'text-gray-400'} flex-shrink-0`}
        />
        <span>{CAPABILITY_METADATA.template.label}</span>
      </div>

      {/* Compiler checks - shown always, grayed and crossed out if disabled */}
      <div
        className={`flex items-center gap-2 text-sm ${capabilityConfig.compilerChecks ? 'text-gray-700' : 'text-gray-400 line-through'}`}
      >
        <CAPABILITY_METADATA.compiler.icon
          className={`w-4 h-4 ${capabilityConfig.compilerChecks ? CAPABILITY_METADATA.compiler.iconColor : 'text-gray-400'} flex-shrink-0`}
        />
        <span>{CAPABILITY_METADATA.compiler.label}</span>
      </div>

      {/* Building Blocks - shown always, grayed and crossed out if disabled */}
      <div
        className={`flex items-center gap-2 text-sm ${capabilityConfig.buildingBlocks ? 'text-gray-700' : 'text-gray-400 line-through'}`}
      >
        <CAPABILITY_METADATA.buildingBlocks.icon
          className={`w-4 h-4 ${capabilityConfig.buildingBlocks ? CAPABILITY_METADATA.buildingBlocks.iconColor : 'text-gray-400'} flex-shrink-0`}
        />
        <span>{CAPABILITY_METADATA.buildingBlocks.label}</span>
      </div>
    </div>
  );
}
