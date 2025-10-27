import { useEffect, useRef } from 'react';
import { usePresentationStore } from '../stores/presentationStore';

/**
 * Presentation playback hook
 *
 * Handles auto-advancing through presentation events at their specified durations
 * Independent of replay timing - uses presentation-specific pacing
 *
 * Features:
 * - Auto-advance when isAutoPlaying is true
 * - Respects each event's duration
 * - Automatically pauses at end
 * - Clean timeout management
 */
export function usePresentationPlayback() {
  const isAutoPlaying = usePresentationStore((state) => state.isAutoPlaying);
  const currentEventIndex = usePresentationStore((state) => state.currentEventIndex);
  const presentationQueue = usePresentationStore((state) => state.presentationQueue);

  const advanceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Clear any existing timeout
    if (advanceTimeoutRef.current) {
      clearTimeout(advanceTimeoutRef.current);
      advanceTimeoutRef.current = null;
    }

    if (!isAutoPlaying) return;

    // Check if we're at end
    if (currentEventIndex >= presentationQueue.length - 1) {
      return;
    }

    // Get actions without subscribing
    const { nextEvent } = usePresentationStore.getState();

    // Get current event duration
    const currentEvent = presentationQueue[currentEventIndex];
    if (!currentEvent) return;

    // Schedule next event after current event's duration
    advanceTimeoutRef.current = setTimeout(() => {
      nextEvent();
    }, currentEvent.duration);

    return () => {
      if (advanceTimeoutRef.current) {
        clearTimeout(advanceTimeoutRef.current);
      }
    };
  }, [isAutoPlaying, currentEventIndex, presentationQueue]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (advanceTimeoutRef.current) {
        clearTimeout(advanceTimeoutRef.current);
      }
    };
  }, []);
}
