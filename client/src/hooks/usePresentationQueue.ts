import { useEffect, useRef } from 'react';
import type { LLMMessage, ToolCall, PipelineStageEvent } from '@gen-fullstack/shared';
import type { CapabilityConfig } from '@gen-fullstack/shared';
import { buildPresentationQueue } from '../lib/presentation-queue-builder';
import { usePresentationStore } from '../stores/presentationStore';

/**
 * Hook to load presentation queue when entering presentation mode
 *
 * Handles:
 * - Detect when presentation mode is first enabled
 * - Build presentation queue from session data
 * - Set capability config for overlays
 * - Load queue into presentation store
 *
 * @param isEnabled - Whether presentation mode is enabled
 * @param messages - All messages from session
 * @param toolCalls - All tool calls from session
 * @param pipelineStages - All pipeline stages from session
 * @param capabilityConfig - Session capability configuration
 * @param durationMs - Session duration in milliseconds
 */
export function usePresentationQueue(
  isEnabled: boolean,
  messages: LLMMessage[],
  toolCalls: ToolCall[],
  pipelineStages: PipelineStageEvent[],
  capabilityConfig: CapabilityConfig | undefined,
  durationMs: number | undefined,
) {
  const previouslyEnabledRef = useRef(false);

  useEffect(() => {
    // Only build queue when first entering presentation mode
    if (isEnabled && !previouslyEnabledRef.current) {
      const queue = buildPresentationQueue(messages, toolCalls, pipelineStages, durationMs);

      // Set the capability config for overlays to use
      usePresentationStore.getState().setCurrentConfig(capabilityConfig || null);
      usePresentationStore.getState().loadPresentationQueue(queue);
    }
    previouslyEnabledRef.current = isEnabled;
  }, [isEnabled, messages, toolCalls, pipelineStages, capabilityConfig, durationMs]);
}
