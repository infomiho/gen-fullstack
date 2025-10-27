import { useEffect, useRef } from 'react';
import type { LLMMessage, ToolCall } from '@gen-fullstack/shared';
import { usePresentationStore } from '../stores/presentationStore';
import { useReplayStore } from '../stores/replay.store';

/**
 * Hook to wire generation events to presentation mode
 *
 * Works with both:
 * - Live generations (via WebSocket, isGenerating flag)
 * - Replay mode (via replay store, isPlaying flag)
 *
 * Handles:
 * - Generation start → "READY... FIGHT!" overlay
 * - Tool calls → HUD updates, combo tracking
 * - File writes → Achievement toast with confetti
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

  // Determine if we're in an active session (live or replay)
  const isActive = isReplayMode ? isPlaying : isGenerating;

  // Detect session start (live or replay)
  useEffect(() => {
    if (isEnabled && isActive && !previousActiveRef.current) {
      // Session just started (live generation or replay playback)
      startTimeRef.current = Date.now();
      resetStats();
      filesCreatedCountRef.current = 0;
      setOverlay('generation-start');
    }

    // Detect session end (live or replay)
    if (isEnabled && !isActive && previousActiveRef.current) {
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

        // Show file created overlay for writeFile calls
        if (toolCall.name === 'writeFile' && fileName) {
          filesCreatedCountRef.current++;
          updateStats({ filesCreated: filesCreatedCountRef.current });

          // Briefly show file creation, then return to HUD
          setOverlay('file-created');
        }
      }

      // Update duration in real-time
      if (startTimeRef.current > 0) {
        const duration = (Date.now() - startTimeRef.current) / 1000;
        updateStats({ duration });
      }
    }

    previousToolCallsCountRef.current = newToolCallsCount;
  }, [isEnabled, isActive, toolCalls, incrementCombo, addToolCall, updateStats, setOverlay]);

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
