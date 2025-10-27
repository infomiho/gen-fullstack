import { useEffect, useRef } from 'react';
import type { LLMMessage, ToolCall } from '@gen-fullstack/shared';
import { usePresentationStore } from '../stores/presentationStore';

/**
 * Hook to wire WebSocket generation events to presentation mode
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
  const { isEnabled, setOverlay, incrementCombo, addToolCall, updateStats, resetStats } =
    usePresentationStore();

  const startTimeRef = useRef<number>(0);
  const previousGeneratingRef = useRef(false);
  const previousToolCallsCountRef = useRef(0);
  const filesCreatedCountRef = useRef(0);

  // Detect generation start
  useEffect(() => {
    if (isEnabled && isGenerating && !previousGeneratingRef.current) {
      // Generation just started
      startTimeRef.current = Date.now();
      resetStats();
      filesCreatedCountRef.current = 0;
      setOverlay('generation-start');
    }

    // Detect generation end
    if (isEnabled && !isGenerating && previousGeneratingRef.current) {
      // Generation just completed
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

    previousGeneratingRef.current = isGenerating;
  }, [isEnabled, isGenerating, messages, setOverlay, updateStats, resetStats]);

  // Track tool calls and update HUD
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Event tracking logic requires multiple conditionals and loops
  useEffect(() => {
    if (!isEnabled || !isGenerating) return;

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
  }, [isEnabled, isGenerating, toolCalls, incrementCombo, addToolCall, updateStats, setOverlay]);

  // Update duration periodically while generating
  useEffect(() => {
    if (!isEnabled || !isGenerating || startTimeRef.current === 0) return;

    const interval = setInterval(() => {
      const duration = (Date.now() - startTimeRef.current) / 1000;
      updateStats({ duration });
    }, 100); // Update every 100ms for smooth counting

    return () => clearInterval(interval);
  }, [isEnabled, isGenerating, updateStats]);
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
