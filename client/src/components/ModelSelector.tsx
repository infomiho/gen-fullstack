import * as Select from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { useId } from 'react';
import {
  MODEL_METADATA,
  type StartGenerationPayload,
  formatPricing,
  getModelsByProvider,
  type ModelId,
} from '@gen-fullstack/shared';
import { focus, radius, transitions, typography } from '../lib/design-tokens';
import { HoverInfo } from './HoverInfo';

export interface ModelSelectorProps {
  selectedModel: StartGenerationPayload['model'];
  onModelChange: (model: StartGenerationPayload['model']) => void;
  disabled?: boolean;
}

/**
 * Model selection UI using Radix UI Select
 *
 * Displays available models grouped by provider with technical descriptions:
 * - OpenAI GPT-5 series (gpt-5, gpt-5-mini, gpt-5-nano)
 * - Anthropic Claude series (claude-haiku-4-5, claude-sonnet-4-5, claude-opus-4-1)
 *
 * Model data comes from MODEL_METADATA in shared package (single source of truth)
 */
export function ModelSelector({
  selectedModel,
  onModelChange,
  disabled = false,
}: ModelSelectorProps) {
  const selectId = useId();

  // Get models grouped by provider from shared metadata
  const { openai: openaiModels, anthropic: anthropicModels } = getModelsByProvider();

  const selectedModelData = selectedModel ? MODEL_METADATA[selectedModel as ModelId] : null;

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center gap-2 mb-4">
        <label htmlFor={selectId} className={typography.sectionHeader}>
          Model
        </label>
        <HoverInfo content="Choose the language model to use for generation. Each model has different capabilities, speed, and pricing." />
      </div>

      {/* Radix UI Select */}
      <Select.Root value={selectedModel} onValueChange={onModelChange} disabled={disabled}>
        <Select.Trigger
          id={selectId}
          className={`
            w-full flex items-center justify-between gap-2
            ${radius.md} border border-border bg-background
            px-4 py-3 text-base text-foreground
            ${transitions.colors}
            hover:border-border-hover
            focus:border-primary ${focus.ring}
            disabled:cursor-not-allowed disabled:bg-muted
            disabled:text-muted-foreground disabled:border-muted
            data-[state=open]:border-primary
          `}
          aria-label="Select model"
        >
          <Select.Value>
            {selectedModelData ? (
              <div className="flex items-center justify-between w-full">
                <span className="font-medium">{selectedModelData.label}</span>
                <span className="text-muted-foreground text-sm ml-2">
                  {formatPricing(selectedModel as ModelId)}
                </span>
              </div>
            ) : (
              'Select a model...'
            )}
          </Select.Value>
          <Select.Icon>
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </Select.Icon>
        </Select.Trigger>

        <Select.Portal>
          <Select.Content
            className={`
              ${radius.md} border border-border bg-card shadow-lg
              overflow-hidden z-50
            `}
            position="popper"
            sideOffset={4}
          >
            <Select.Viewport className="p-1">
              {/* OpenAI Models */}
              <Select.Group>
                <Select.Label className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  OpenAI
                </Select.Label>
                {openaiModels.map((modelId) => {
                  const model = MODEL_METADATA[modelId];
                  return (
                    <Select.Item
                      key={modelId}
                      value={modelId}
                      className={`
                        relative flex items-start gap-3 px-3 py-3 cursor-pointer
                        ${radius.md} ${transitions.colors}
                        text-foreground
                        hover:bg-accent hover:text-accent-foreground
                        focus:bg-accent focus:text-accent-foreground focus:outline-none
                        data-[state=checked]:bg-primary/10
                      `}
                    >
                      <Select.ItemText>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center justify-between gap-4">
                            <span className="font-medium">{model.label}</span>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {formatPricing(modelId)}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground">{model.description}</span>
                        </div>
                      </Select.ItemText>
                      <Select.ItemIndicator className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Check className="w-4 h-4" />
                      </Select.ItemIndicator>
                    </Select.Item>
                  );
                })}
              </Select.Group>

              <Select.Separator className="h-px bg-border my-1" />

              {/* Anthropic Models */}
              <Select.Group>
                <Select.Label className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Anthropic
                </Select.Label>
                {anthropicModels.map((modelId) => {
                  const model = MODEL_METADATA[modelId];
                  return (
                    <Select.Item
                      key={modelId}
                      value={modelId}
                      className={`
                        relative flex items-start gap-3 px-3 py-3 cursor-pointer
                        ${radius.md} ${transitions.colors}
                        text-foreground
                        hover:bg-accent hover:text-accent-foreground
                        focus:bg-accent focus:text-accent-foreground focus:outline-none
                        data-[state=checked]:bg-primary/10
                      `}
                    >
                      <Select.ItemText>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center justify-between gap-4">
                            <span className="font-medium">{model.label}</span>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {formatPricing(modelId)}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground">{model.description}</span>
                        </div>
                      </Select.ItemText>
                      <Select.ItemIndicator className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Check className="w-4 h-4" />
                      </Select.ItemIndicator>
                    </Select.Item>
                  );
                })}
              </Select.Group>
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </div>
  );
}
