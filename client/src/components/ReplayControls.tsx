import { Play, Pause } from 'lucide-react';
import { formatTime } from '../lib/replay-utils';
import { useReplayStore } from '../stores/replay.store';
import { transitions, typography, focus } from '../lib/design-tokens';

/**
 * ReplayControls Component
 *
 * Provides playback controls for replay mode:
 * - Play/Pause button
 * - Time display (current / total)
 *
 * Playback speed is fixed at 10x for fast demonstrations.
 */
export function ReplayControls() {
  const { isPlaying, currentTime, duration, play, pause } = useReplayStore();

  return (
    <div className="flex items-center gap-2 border-b border-gray-200 bg-white px-4 py-3">
      {/* Play/Pause Button */}
      <button
        onClick={isPlaying ? pause : play}
        className={`flex h-8 w-8 items-center justify-center rounded bg-gray-900 text-white ${transitions.colors} hover:bg-gray-800 ${focus.ring}`}
        type="button"
        aria-label={isPlaying ? 'Pause playback' : 'Play playback'}
      >
        {isPlaying ? <Pause size={16} /> : <Play size={16} />}
      </button>

      {/* Time Display */}
      <div className={`ml-auto ${typography.mono} text-gray-600`}>
        {formatTime(currentTime)} / {formatTime(duration)}
      </div>
    </div>
  );
}
