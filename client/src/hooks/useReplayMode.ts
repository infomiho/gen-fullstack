import { useEffect, useMemo } from 'react';
import {
  getReplayFiles,
  getReplayMessages,
  getReplayPipelineStages,
  getReplayToolCalls,
  getReplayToolResults,
} from '../lib/replay-utils';
import { useReplayStore, REPLAY_SPEED } from '../stores/replay.store';

/**
 * Custom hook to manage replay mode functionality
 *
 * Handles:
 * - Playback timer with requestAnimationFrame
 * - Filtering timeline data based on currentTime
 * - Subscribing to replay state changes
 *
 * @returns Replay data (messages, toolCalls, toolResults, pipelineStages, files) or empty arrays if not in replay mode
 */
export function useReplayMode() {
  // Subscribe to specific slices to control re-renders
  const isReplayModeActive = useReplayStore((state) => state.isReplayMode);
  const isPlaying = useReplayStore((state) => state.isPlaying);
  const replayCurrentTime = useReplayStore((state) => state.currentTime);
  // Subscribe to data slices needed for replay computation
  const timelineItems = useReplayStore((state) => state.timelineItems);
  const sessionStartTime = useReplayStore((state) => state.sessionStartTime);
  const replayFiles = useReplayStore((state) => state.files);

  // Replay playback timer - runs at 60 FPS when playing
  useEffect(() => {
    if (!isReplayModeActive || !isPlaying) return;

    let lastTimestamp = performance.now();
    let animationFrameId: number;

    const tick = (timestamp: number) => {
      // Use getState() to avoid subscription overhead in 60 FPS animation loop
      // This prevents circular updates - we only WRITE to store, don't subscribe
      const state = useReplayStore.getState();

      // Check if still playing
      if (!state.isPlaying) return;

      const deltaMs = timestamp - lastTimestamp;
      lastTimestamp = timestamp;

      const newTime = state.currentTime + deltaMs * REPLAY_SPEED;

      if (newTime >= state.duration) {
        state.setCurrentTime(state.duration);
        state.pause();
      } else {
        state.setCurrentTime(newTime);
        animationFrameId = requestAnimationFrame(tick);
      }
    };

    animationFrameId = requestAnimationFrame(tick);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isReplayModeActive, isPlaying]);

  // Compute replay data using useMemo to avoid recreating objects on every render
  const replayData = useMemo(() => {
    if (!isReplayModeActive) {
      return { messages: [], toolCalls: [], toolResults: [], pipelineStages: [], files: [] };
    }

    return {
      messages: getReplayMessages(timelineItems, sessionStartTime, replayCurrentTime),
      toolCalls: getReplayToolCalls(timelineItems, sessionStartTime, replayCurrentTime),
      toolResults: getReplayToolResults(timelineItems, sessionStartTime, replayCurrentTime),
      pipelineStages: getReplayPipelineStages(timelineItems, sessionStartTime, replayCurrentTime),
      files: getReplayFiles(replayFiles, sessionStartTime, replayCurrentTime),
    };
  }, [isReplayModeActive, replayCurrentTime, timelineItems, sessionStartTime, replayFiles]);

  return {
    isReplayMode: isReplayModeActive,
    replayData,
  };
}
