import { useCallback, useEffect, useRef } from 'react';
import type { LLMMessage, ToolCall } from '@gen-fullstack/shared';
import { usePresentationStore } from '../stores/presentationStore';
import { useReplayStore } from '../stores/replay.store';
import { presentationTokens } from '../lib/presentation-tokens';

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
 * - Tool calls → HUD updates, combo tracking
 * - File writes → Achievement toast with confetti (queued)
 * - Errors → "K.O." screen
 * - Generation complete → Victory screen with stats
 */
export function usePresentationEvents(
  isGenerating: boolean,
  messages: LLMMessage[],
  toolCalls: ToolCall[],
) {
  const { isReplayMode, isPlaying } = useReplayStore();
  const { isEnabled, setOverlay, incrementCombo, addToolCall, updateStats, resetStats } =
    usePresentationStore();

  const startTimeRef = useRef<number>(0);
  const previousActiveRef = useRef(false);
  const previousToolCallsCountRef = useRef(0);
  const filesCreatedCountRef = useRef(0);

  // Queue for file creation overlays
  const overlayQueueRef = useRef<Array<{ type: 'file-created'; fileName: string }>>([]);
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
      setOverlay('file-created');

      // Schedule next overlay after minimum duration
      overlayTimeoutRef.current = setTimeout(() => {
        processQueueImpl();
      }, presentationTokens.timing.toastDuration);
    },
    [setOverlay],
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
      overlayQueueRef.current = []; // Clear queue
      isShowingOverlayRef.current = false;
      if (overlayTimeoutRef.current) {
        clearTimeout(overlayTimeoutRef.current);
      }
      setOverlay('generation-start');
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
  }, [isEnabled, isActive, messages, setOverlay, updateStats, resetStats]);

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

        // Queue file created overlay for writeFile calls
        if (toolCall.name === 'writeFile' && fileName) {
          filesCreatedCountRef.current++;
          updateStats({ filesCreated: filesCreatedCountRef.current });

          // Add to queue for presentation-paced display
          overlayQueueRef.current.push({ type: 'file-created', fileName });

          // Start processing queue if not already showing an overlay
          if (!isShowingOverlayRef.current) {
            processQueue();
          }
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
