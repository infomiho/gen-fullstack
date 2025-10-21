import { useId, useState } from 'react';
import type { CapabilityConfig } from '@gen-fullstack/shared';
import { focus, input, radius, spacing, transitions, typography } from '../lib/design-tokens';

type ModelName = 'gpt-5' | 'gpt-5-mini' | 'gpt-5-nano';

interface CapabilityBuilderProps {
  value: CapabilityConfig;
  onChange: (config: CapabilityConfig) => void;
  model: ModelName;
  onModelChange: (model: ModelName) => void;
  disabled?: boolean;
}

/**
 * CapabilityBuilder - Interactive UI for configuring generation capabilities
 *
 * Configuration interface with three independent dimensions:
 * - Input Mode: Naive (from scratch) or Template (start from base)
 * - Planning: Generate architectural plan before coding
 * - Compiler Checks: Validate and auto-fix errors (Prisma + TypeScript)
 *
 * Features:
 * - Input mode radio buttons (Naive, Template)
 * - Planning toggle switch
 * - Compiler Checks toggle switch with iteration control
 * - Preset configurations for quick start
 */
export function CapabilityBuilder({
  value,
  onChange,
  model,
  onModelChange,
  disabled,
}: CapabilityBuilderProps) {
  const inputModeId = useId();
  const modelId = useId();
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleInputModeChange = (inputMode: CapabilityConfig['inputMode']) => {
    onChange({ ...value, inputMode });
  };

  const handlePlanningChange = (planning: boolean) => {
    onChange({ ...value, planning });
  };

  const handleCompilerChecksChange = (compilerChecks: boolean) => {
    onChange({ ...value, compilerChecks });
  };

  const handleMaxIterationsChange = (maxIterations: number) => {
    onChange({ ...value, maxIterations });
  };

  const applyPreset = (preset: 'quick' | 'self-correcting' | 'comprehensive') => {
    switch (preset) {
      case 'quick':
        onChange({ inputMode: 'naive', planning: false, compilerChecks: false, maxIterations: 3 });
        break;
      case 'self-correcting':
        onChange({
          inputMode: 'naive',
          planning: false,
          compilerChecks: true,
          maxIterations: 3,
        });
        break;
      case 'comprehensive':
        onChange({
          inputMode: 'naive',
          planning: true,
          compilerChecks: true,
          maxIterations: 3,
        });
        break;
    }
  };

  return (
    <div className={spacing.sections}>
      {/* Model Selection */}
      <div>
        <label htmlFor={modelId} className={`block mb-2 ${typography.label}`}>
          Model
        </label>
        <select
          id={modelId}
          value={model}
          onChange={(e) => onModelChange(e.target.value as ModelName)}
          disabled={disabled}
          className={`${input.select} ${focus.ring}`}
        >
          <option value="gpt-5-nano">GPT-5 Nano - Fast & cheap ($0.05/$0.40 per 1M tokens)</option>
          <option value="gpt-5-mini">
            GPT-5 Mini - Balanced (default) ($0.25/$2 per 1M tokens)
          </option>
          <option value="gpt-5">GPT-5 - Premium quality ($1.25/$10 per 1M tokens)</option>
        </select>
      </div>

      {/* Presets */}
      <div>
        {/* biome-ignore lint/a11y/noLabelWithoutControl: Section header, not associated with specific control */}
        <label className={`block mb-3 ${typography.label}`}>Quick Start</label>
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => applyPreset('quick')}
            disabled={disabled}
            className={`px-3 py-1.5 text-sm border ${radius.md} ${transitions.colors} ${focus.ring}
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-gray-400'}`}
          >
            ⚡ Quick Start
          </button>
          <button
            type="button"
            onClick={() => applyPreset('self-correcting')}
            disabled={disabled}
            className={`px-3 py-1.5 text-sm border ${radius.md} ${transitions.colors} ${focus.ring}
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-gray-400'}`}
          >
            🔧 Self-Correcting
          </button>
          <button
            type="button"
            onClick={() => applyPreset('comprehensive')}
            disabled={disabled}
            className={`px-3 py-1.5 text-sm border ${radius.md} ${transitions.colors} ${focus.ring}
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-gray-400'}`}
          >
            📋 Comprehensive
          </button>
        </div>
      </div>

      {/* Advanced toggle */}
      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className={`text-sm text-gray-600 hover:text-gray-900 ${transitions.colors} ${focus.ring} ${radius.sm}`}
      >
        {showAdvanced ? '▼' : '▶'} Advanced Configuration
      </button>

      {/* Advanced configuration */}
      {showAdvanced && (
        <div className={`${spacing.sections} pl-4 border-l-2 border-gray-200`}>
          {/* Input Mode - Radio Buttons */}
          <div>
            {/* biome-ignore lint/a11y/noLabelWithoutControl: Section header for radio button group */}
            <label className={`block mb-2 ${typography.label}`}>Input Mode</label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name={inputModeId}
                  value="naive"
                  checked={value.inputMode === 'naive'}
                  onChange={(e) =>
                    handleInputModeChange(e.target.value as CapabilityConfig['inputMode'])
                  }
                  disabled={disabled}
                  className={`${focus.ring}`}
                />
                <span className={typography.body}>
                  <strong>Naive</strong> - Generate from scratch
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name={inputModeId}
                  value="template"
                  checked={value.inputMode === 'template'}
                  onChange={(e) =>
                    handleInputModeChange(e.target.value as CapabilityConfig['inputMode'])
                  }
                  disabled={disabled}
                  className={`${focus.ring}`}
                />
                <span className={typography.body}>
                  <strong>Template</strong> - Start from pre-built base
                </span>
              </label>
            </div>
          </div>

          {/* Template Options */}
          {value.inputMode === 'template' && (
            <div className="pl-4 border-l border-gray-200">
              {/* biome-ignore lint/a11y/noLabelWithoutControl: Label for adjacent select dropdown */}
              <label className={`block mb-2 ${typography.label}`}>Template</label>
              <select
                value={value.templateOptions?.templateName ?? 'vite-fullstack-base'}
                onChange={(e) =>
                  onChange({
                    ...value,
                    templateOptions: { templateName: e.target.value },
                  })
                }
                disabled={disabled}
                className={`${input.select} ${focus.ring}`}
              >
                <option value="vite-fullstack-base">Vite Fullstack Base</option>
              </select>
            </div>
          )}

          {/* Planning Switch */}
          <div>
            {/* biome-ignore lint/a11y/noLabelWithoutControl: Section header for checkbox below */}
            <label className={`block mb-2 ${typography.label}`}>Planning</label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={value.planning ?? false}
                onChange={(e) => handlePlanningChange(e.target.checked)}
                disabled={disabled}
                className={`${focus.ring}`}
              />
              <span className={typography.body}>Generate architectural plan before coding</span>
            </label>
          </div>

          {/* Compiler Checks Switch */}
          <div>
            {/* biome-ignore lint/a11y/noLabelWithoutControl: Section header for checkbox below */}
            <label className={`block mb-2 ${typography.label}`}>Compiler Checks</label>
            <div className="space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={value.compilerChecks ?? false}
                  onChange={(e) => handleCompilerChecksChange(e.target.checked)}
                  disabled={disabled}
                  className={`${focus.ring}`}
                />
                <span className={typography.body}>
                  Validate and auto-fix errors (Prisma + TypeScript)
                </span>
              </label>

              {value.compilerChecks && (
                <div className="pl-6">
                  {/* biome-ignore lint/a11y/noLabelWithoutControl: Label for adjacent number input */}
                  <label className={`block mb-1 ${typography.caption}`}>Max iterations</label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={value.maxIterations ?? 3}
                    onChange={(e) => handleMaxIterationsChange(Number.parseInt(e.target.value, 10))}
                    disabled={disabled}
                    className={`w-20 ${input.base}`}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Current config summary */}
      <div className={`text-xs text-gray-500 p-3 bg-gray-50 ${radius.md}`}>
        <strong>Active: </strong>
        {value.inputMode === 'template' ? 'Template' : 'Naive'}
        {value.planning && ' + Planning'}
        {' + Code Generation'}
        {value.compilerChecks && ' + Compiler Checks'}
      </div>
    </div>
  );
}
