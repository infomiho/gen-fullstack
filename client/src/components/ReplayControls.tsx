import { Play, Pause } from 'lucide-react';
import { formatTime } from '../lib/replay-utils';
import { useReplayStore, type PlaybackSpeed } from '../stores/replay.store';

/**
 * ReplayControls Component
 *
 * Provides playback controls for replay mode:
 * - Play/Pause button
 * - Speed selector (0.5x, 1x, 2x, 5x)
 * - Time display (current / total)
 */
export function ReplayControls() {
  const { isPlaying, playbackSpeed, currentTime, duration, play, pause, setSpeed } =
    useReplayStore();

  const speedOptions: PlaybackSpeed[] = [0.5, 1, 2, 5];

  return (
    <div className="flex items-center gap-3 border-b bg-gray-50 px-4 py-3">
      {/* Play/Pause Button */}
      <button
        onClick={isPlaying ? pause : play}
        className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-900 p-2 text-white transition-opacity hover:opacity-80"
        type="button"
      >
        {isPlaying ? <Pause size={20} /> : <Play size={20} />}
      </button>

      {/* Speed Selector */}
      <div className="flex gap-1">
        {speedOptions.map((speed) => (
          <button
            key={speed}
            type="button"
            onClick={() => setSpeed(speed)}
            className={`rounded px-3 py-1.5 text-sm transition-colors ${
              playbackSpeed === speed
                ? 'bg-gray-900 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            {speed}x
          </button>
        ))}
      </div>

      {/* Time Display */}
      <div className="ml-auto font-mono text-sm text-gray-600">
        {formatTime(currentTime)} / {formatTime(duration)}
      </div>
    </div>
  );
}
