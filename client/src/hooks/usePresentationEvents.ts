import { useCallback, useEffect, useRef } from 'react';
import type { LLMMessage, ToolCall, ToolResult, CapabilityConfig } from '@gen-fullstack/shared';
import { usePresentationStore } from '../stores/presentationStore';
import { useReplayStore } from '../stores/replay.store';

/**
 * Hook to wire generation events to presentation mode
 *
 * Works with both:
 * - Live generations (via WebSocket, isGenerating flag)
 * - Replay mode (via replay store, isPlaying flag)
 *
 * Features:
 * - Presentation-specific pacing (independent of replay speed)
 * - Queued overlays with minimum display durations
 * - Smooth transitions between events
 *
 * Handles:
 * - Generation start → "READY... FIGHT!" overlay
 * - Template mode → Template loading overlay
 * - Planning → Architecture planning overlay with stats
 * - Building blocks → Block request overlay
 * - Tool calls → HUD updates, combo tracking
 * - File writes → Combo milestone overlays (5x, 10x, 20x+)
 * - Validation → Compiler check loading and results
 * - Errors → "K.O." screen
 * - Generation complete → Victory screen with stats
 */
export function usePresentationEvents(
  isGenerating: boolean,
  messages: LLMMessage[],
  toolCalls: ToolCall[],
  toolResults: ToolResult[],
  capabilityConfig?: CapabilityConfig,
) {
  const { isReplayMode, isPlaying } = useReplayStore();
  const {
    isEnabled,
    setOverlay,
    setOverlayData,
    incrementCombo,
    addToolCall,
    updateStats,
    resetStats,
  } = usePresentationStore();

  const startTimeRef = useRef<number>(0);
  const previousActiveRef = useRef(false);
  const previousToolCallsCountRef = useRef(0);
  const previousToolResultsCountRef = useRef(0);
  const filesCreatedCountRef = useRef(0);
  const hasShownTemplateOverlayRef = useRef(false);
  const pendingPlanToolCallIdRef = useRef<string | null>(null);
  const pendingValidationToolCallsRef = useRef<Set<string>>(new Set());

  // Queue for overlays with presentation-specific pacing
  const overlayQueueRef = useRef<
    Array<
      | { type: 'template-loading'; duration: number }
      | {
          type: 'planning';
          planSummary: { models: number; endpoints: number; components: number };
          duration: number;
        }
      | { type: 'block-request'; blockName: string; duration: number }
      | { type: 'combo-milestone'; milestone: number; duration: number }
      | { type: 'validation-prisma'; duration: number }
      | { type: 'validation-typescript'; duration: number }
      | {
          type: 'validation-result';
          result: { passed: boolean; errorCount?: number; iteration?: number };
          duration: number;
        }
    >
  >([]);
  const isShowingOverlayRef = useRef(false);
  const overlayTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Determine if we're in an active session (live or replay)
  const isActive = isReplayMode ? isPlaying : isGenerating;

  // Process overlay queue - show next overlay after minimum duration
  const processQueue = useCallback(
    function processQueueImpl() {
      if (overlayQueueRef.current.length === 0) {
        isShowingOverlayRef.current = false;
        setOverlay('tool-hud'); // Return to HUD when queue is empty
        return;
      }

      const nextOverlay = overlayQueueRef.current.shift();
      if (!nextOverlay) return;

      isShowingOverlayRef.current = true;

      // Set overlay data and type based on overlay
      switch (nextOverlay.type) {
        case 'template-loading':
          setOverlay('template-loading');
          break;
        case 'planning':
          setOverlayData({ planSummary: nextOverlay.planSummary });
          setOverlay('planning');
          break;
        case 'block-request':
          setOverlayData({ blockName: nextOverlay.blockName });
          setOverlay('block-request');
          break;
        case 'combo-milestone':
          setOverlayData({ comboMilestone: nextOverlay.milestone });
          setOverlay('combo-milestone');
          break;
        case 'validation-prisma':
          setOverlay('validation-prisma');
          break;
        case 'validation-typescript':
          setOverlay('validation-typescript');
          break;
        case 'validation-result':
          setOverlayData({ validationResult: nextOverlay.result });
          setOverlay('validation-result');
          break;
      }

      // Schedule next overlay after minimum duration
      overlayTimeoutRef.current = setTimeout(() => {
        processQueueImpl();
      }, nextOverlay.duration);
    },
    [setOverlay, setOverlayData],
  );

  // Cleanup overlay timeout on unmount
  useEffect(() => {
    return () => {
      if (overlayTimeoutRef.current) {
        clearTimeout(overlayTimeoutRef.current);
      }
    };
  }, []);

  // Detect session start (live or replay)
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Session lifecycle management requires multiple conditionals and state checks
  useEffect(() => {
    if (isEnabled && isActive && !previousActiveRef.current) {
      // Session just started (live generation or replay playback)
      startTimeRef.current = Date.now();
      resetStats();
      filesCreatedCountRef.current = 0;
      hasShownTemplateOverlayRef.current = false;
      overlayQueueRef.current = []; // Clear queue
      isShowingOverlayRef.current = false;
      if (overlayTimeoutRef.current) {
        clearTimeout(overlayTimeoutRef.current);
      }
      setOverlay('generation-start');

      // Queue template loading overlay if using template mode
      if (capabilityConfig?.inputMode === 'template') {
        overlayQueueRef.current.push({
          type: 'template-loading',
          duration: 3000, // 3 seconds
        });
        hasShownTemplateOverlayRef.current = true;
      }
    }

    // Detect session end (live or replay)
    if (isEnabled && !isActive && previousActiveRef.current) {
      // Clear overlay queue and timeout
      overlayQueueRef.current = [];
      isShowingOverlayRef.current = false;
      if (overlayTimeoutRef.current) {
        clearTimeout(overlayTimeoutRef.current);
      }

      // Session just completed/paused
      const duration = (Date.now() - startTimeRef.current) / 1000;
      const lastMessage = messages[messages.length - 1];
      const hasError = lastMessage?.role === 'system' && lastMessage.content.includes('error');

      if (hasError) {
        // Show K.O. for errors
        setOverlay('error-ko');
      } else {
        // Show victory screen for success
        updateStats({
          duration,
          successRate: 100,
        });
        setOverlay('victory');
      }
    }

    previousActiveRef.current = isActive;
  }, [isEnabled, isActive, messages, setOverlay, updateStats, resetStats, capabilityConfig]);

  // Track tool calls and update HUD (works for both live and replay)
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Event tracking logic requires multiple conditionals and loops
  useEffect(() => {
    if (!isEnabled || !isActive) return;

    const newToolCallsCount = toolCalls.length;
    if (newToolCallsCount > previousToolCallsCountRef.current) {
      // New tool call detected
      const newToolCalls = toolCalls.slice(previousToolCallsCountRef.current);

      for (const toolCall of newToolCalls) {
        // Update combo
        incrementCombo();

        // Add to recent activity
        const fileName = getFileNameFromToolCall(toolCall);
        addToolCall(toolCall.name, fileName);

        // Update stats
        updateStats({ toolCalls: newToolCallsCount });

        // Handle capability-specific tool calls
        switch (toolCall.name) {
          case 'planArchitecture':
            // Track tool call ID to parse result later
            pendingPlanToolCallIdRef.current = toolCall.id;
            break;

          case 'requestBlock':
            // Extract block name from args
            try {
              const args =
                typeof toolCall.args === 'string' ? JSON.parse(toolCall.args) : toolCall.args;
              const blockName = args?.blockName || 'Building Block';
              overlayQueueRef.current.push({
                type: 'block-request',
                blockName,
                duration: 3000, // 3 seconds
              });
              if (!isShowingOverlayRef.current) {
                processQueue();
              }
            } catch {
              // Ignore parse errors
            }
            break;

          case 'validatePrismaSchema':
            // Queue loading overlay immediately
            overlayQueueRef.current.push({
              type: 'validation-prisma',
              duration: 3000, // 3 seconds loading
            });
            // Track for result parsing
            pendingValidationToolCallsRef.current.add(toolCall.id);
            if (!isShowingOverlayRef.current) {
              processQueue();
            }
            break;

          case 'validateTypeScript':
            // Queue loading overlay immediately
            overlayQueueRef.current.push({
              type: 'validation-typescript',
              duration: 3000, // 3 seconds loading
            });
            // Track for result parsing
            pendingValidationToolCallsRef.current.add(toolCall.id);
            if (!isShowingOverlayRef.current) {
              processQueue();
            }
            break;

          case 'writeFile':
            if (fileName) {
              filesCreatedCountRef.current++;
              updateStats({ filesCreated: filesCreatedCountRef.current });

              // Check for combo milestones
              const count = filesCreatedCountRef.current;
              if (count === 5 || count === 10 || (count >= 20 && count % 10 === 0)) {
                overlayQueueRef.current.push({
                  type: 'combo-milestone',
                  milestone: count,
                  duration: 1000, // 1 second
                });
                if (!isShowingOverlayRef.current) {
                  processQueue();
                }
              }
            }
            break;
        }
      }

      // Update duration in real-time
      if (startTimeRef.current > 0) {
        const duration = (Date.now() - startTimeRef.current) / 1000;
        updateStats({ duration });
      }
    }

    previousToolCallsCountRef.current = newToolCallsCount;
  }, [isEnabled, isActive, toolCalls, incrementCombo, addToolCall, updateStats, processQueue]);

  // Track tool results to parse plan summaries and validation results
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Tool result parsing requires multiple conditionals for different overlay types
  useEffect(() => {
    if (!isEnabled || !isActive) return;

    const newToolResultsCount = toolResults.length;
    if (newToolResultsCount > previousToolResultsCountRef.current) {
      // New tool results detected
      const newToolResults = toolResults.slice(previousToolResultsCountRef.current);

      for (const toolResult of newToolResults) {
        // Check if this is a planArchitecture result
        if (pendingPlanToolCallIdRef.current === toolResult.id) {
          try {
            // Parse plan summary from result
            const plan = JSON.parse(toolResult.result);
            const models = plan.databaseSchema?.models?.length || 0;
            const endpoints = plan.apiEndpoints?.length || 0;
            const components = plan.uiComponents?.length || 0;

            // Queue planning overlay with actual data
            overlayQueueRef.current.push({
              type: 'planning',
              planSummary: { models, endpoints, components },
              duration: 5000, // 5 seconds (important moment!)
            });

            if (!isShowingOverlayRef.current) {
              processQueue();
            }
          } catch {
            // If parsing fails, use placeholder data
            overlayQueueRef.current.push({
              type: 'planning',
              planSummary: { models: 0, endpoints: 0, components: 0 },
              duration: 5000,
            });
            if (!isShowingOverlayRef.current) {
              processQueue();
            }
          }

          pendingPlanToolCallIdRef.current = null;
        }

        // Check if this is a validation result
        if (pendingValidationToolCallsRef.current.has(toolResult.id)) {
          try {
            // Parse validation result
            const result = JSON.parse(toolResult.result);
            const passed = result.passed === true || result.success === true;
            const errorCount = result.errorCount || result.errors?.length || 0;
            const iteration = result.iteration;

            // Queue validation result overlay
            overlayQueueRef.current.push({
              type: 'validation-result',
              result: { passed, errorCount, iteration },
              duration: passed ? 2000 : 3000, // 2s for success, 3s for errors
            });

            if (!isShowingOverlayRef.current) {
              processQueue();
            }
          } catch {
            // Ignore parse errors
          }

          pendingValidationToolCallsRef.current.delete(toolResult.id);
        }
      }
    }

    previousToolResultsCountRef.current = newToolResultsCount;
  }, [isEnabled, isActive, toolResults, processQueue]);

  // Update duration periodically while active (live or replay)
  useEffect(() => {
    if (!isEnabled || !isActive || startTimeRef.current === 0) return;

    const interval = setInterval(() => {
      const duration = (Date.now() - startTimeRef.current) / 1000;
      updateStats({ duration });
    }, 100); // Update every 100ms for smooth counting

    return () => clearInterval(interval);
  }, [isEnabled, isActive, updateStats]);
}

/**
 * Extract file name from tool call arguments
 */
function getFileNameFromToolCall(toolCall: ToolCall): string | undefined {
  if (!toolCall.args) return undefined;

  try {
    const args = typeof toolCall.args === 'string' ? JSON.parse(toolCall.args) : toolCall.args;
    return args.path || args.file_path || args.fileName;
  } catch {
    return undefined;
  }
}
