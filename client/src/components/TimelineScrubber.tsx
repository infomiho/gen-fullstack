import { useCallback, useEffect, useRef, useState } from 'react';
import { useReplayStore } from '../stores/replay.store';

/**
 * TimelineScrubber Component
 *
 * Provides a visual timeline with:
 * - Draggable progress bar for seeking
 * - Event markers showing when messages/tools occurred
 * - Click to jump to position
 * - Hover preview showing time
 */
export function TimelineScrubber() {
  const { currentTime, duration, timelineItems, sessionStartTime, seekTo } = useReplayStore();

  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  /**
   * Calculate time from mouse X position
   * Memoized to prevent stale closures in event handlers
   */
  const getTimeFromX = useCallback(
    (clientX: number): number => {
      if (!trackRef.current) return 0;

      const rect = trackRef.current.getBoundingClientRect();
      const x = clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, x / rect.width));
      return percentage * duration;
    },
    [duration],
  );

  /**
   * Handle mouse down on track or handle
   */
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    const time = getTimeFromX(e.clientX);
    seekTo(time);
  };

  /**
   * Handle mouse move (dragging)
   */
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const time = getTimeFromX(e.clientX);
      seekTo(time);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, getTimeFromX, seekTo]);

  /**
   * Handle hover to show preview
   */
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) return;
    const time = getTimeFromX(e.clientX);
    setHoverTime(time);
  };

  const handleMouseLeave = () => {
    setHoverTime(null);
  };

  /**
   * Calculate marker positions
   */
  const markers = timelineItems.map((item) => {
    const relativeTime = item.timestamp - sessionStartTime;
    const percentage = duration > 0 ? (relativeTime / duration) * 100 : 0;

    return {
      id: item.id,
      percentage,
      type: item.type,
    };
  });

  return (
    <div className="relative w-full h-10 flex items-center px-4">
      {/* Track */}
      <div
        ref={trackRef}
        role="slider"
        aria-valuemin={0}
        aria-valuemax={duration}
        aria-valuenow={currentTime}
        tabIndex={0}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="relative w-full h-2 bg-muted rounded cursor-pointer overflow-visible"
      >
        {/* Progress Bar */}
        <div
          className="absolute left-0 top-0 h-full bg-primary rounded transition-[width] duration-150"
          style={{
            width: `${progressPercentage}%`,
            transition: isDragging ? 'none' : 'width 150ms',
          }}
        />

        {/* Event Markers */}
        {markers.map((marker) => (
          <div
            key={marker.id}
            className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full border border-background pointer-events-none ${
              marker.type === 'message'
                ? 'bg-blue-500'
                : marker.type === 'tool_result'
                  ? 'bg-amber-500'
                  : 'bg-gray-500'
            }`}
            style={{ left: `${marker.percentage}%` }}
          />
        ))}

        {/* Hover Indicator */}
        {hoverTime !== null && !isDragging && (
          <div
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-4 bg-gray-500 pointer-events-none"
            style={{ left: `${(hoverTime / duration) * 100}%` }}
          />
        )}

        {/* Draggable Handle */}
        <button
          type="button"
          aria-label="Seek handle"
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-background border-2 border-primary rounded-full cursor-grab shadow-md transition-[left] duration-150"
          style={{
            left: `${progressPercentage}%`,
            transition: isDragging ? 'none' : 'left 150ms',
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
            setIsDragging(true);
          }}
        />
      </div>
    </div>
  );
}
