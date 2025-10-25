import { useRef, useState, useEffect, useCallback } from 'react';
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

  // Get colors from CSS variables for dark mode support
  const [colors, setColors] = useState({
    track: '#f3f4f6',
    progress: '#1f2937',
    handle: '#ffffff',
    handleBorder: '#1f2937',
    markerBorder: '#ffffff',
    gray: '#6b7280',
    blue: '#3b82f6',
    amber: '#f59e0b',
  });

  useEffect(() => {
    // Read colors from CSS variables
    const root = document.documentElement;
    const styles = getComputedStyle(root);

    setColors({
      track: styles.getPropertyValue('--color-muted').trim() || '#f3f4f6',
      progress: styles.getPropertyValue('--color-primary').trim() || '#1f2937',
      handle: styles.getPropertyValue('--color-background').trim() || '#ffffff',
      handleBorder: styles.getPropertyValue('--color-primary').trim() || '#1f2937',
      markerBorder: styles.getPropertyValue('--color-background').trim() || '#ffffff',
      gray: '#6b7280', // Keep fixed gray for consistency
      blue: '#3b82f6', // Keep fixed blue for consistency
      amber: '#f59e0b', // Keep fixed amber for consistency
    });
  }, []);

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

    // Color based on type
    let color = colors.gray; // gray for tool calls
    if (item.type === 'message') {
      color = colors.blue; // blue for messages
    } else if (item.type === 'tool_result') {
      color = colors.amber; // amber for results
    }

    return {
      id: item.id,
      percentage,
      color,
      type: item.type,
    };
  });

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '40px',
        display: 'flex',
        alignItems: 'center',
        padding: '0 1rem',
      }}
    >
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
        style={{
          position: 'relative',
          width: '100%',
          height: '8px',
          backgroundColor: colors.track,
          borderRadius: '4px',
          cursor: 'pointer',
          overflow: 'visible',
        }}
      >
        {/* Progress Bar */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            height: '100%',
            width: `${progressPercentage}%`,
            backgroundColor: colors.progress,
            borderRadius: '4px',
            transition: isDragging ? 'none' : 'width 150ms',
          }}
        />

        {/* Event Markers */}
        {markers.map((marker) => (
          <div
            key={marker.id}
            style={{
              position: 'absolute',
              left: `${marker.percentage}%`,
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: '6px',
              height: '6px',
              backgroundColor: marker.color,
              borderRadius: '50%',
              border: `1px solid ${colors.markerBorder}`,
              pointerEvents: 'none',
            }}
          />
        ))}

        {/* Hover Indicator */}
        {hoverTime !== null && !isDragging && (
          <div
            style={{
              position: 'absolute',
              left: `${(hoverTime / duration) * 100}%`,
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: '2px',
              height: '16px',
              backgroundColor: colors.gray,
              pointerEvents: 'none',
            }}
          />
        )}

        {/* Draggable Handle */}
        <button
          type="button"
          aria-label="Seek handle"
          style={{
            position: 'absolute',
            left: `${progressPercentage}%`,
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: '16px',
            height: '16px',
            backgroundColor: colors.handle,
            border: `2px solid ${colors.handleBorder}`,
            borderRadius: '50%',
            cursor: 'grab',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
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
