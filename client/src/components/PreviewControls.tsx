export interface PreviewControlsProps {
  /** Callback when reload button is clicked */
  onReload: () => void;
  /** Callback when fullscreen toggle is clicked */
  onToggleFullscreen: () => void;
  /** Whether preview is currently in fullscreen mode */
  isFullscreen: boolean;
}

/**
 * PreviewControls component - control buttons for preview iframe
 *
 * Provides reload and fullscreen toggle buttons for controlling
 * the app preview iframe.
 *
 * @example
 * ```tsx
 * <PreviewControls
 *   onReload={() => reloadIframe()}
 *   onToggleFullscreen={() => setFullscreen(!fullscreen)}
 *   isFullscreen={fullscreen}
 * />
 * ```
 */
export function PreviewControls({
  onReload,
  onToggleFullscreen,
  isFullscreen,
}: PreviewControlsProps) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onReload}
        className="p-1.5 hover:bg-gray-100 rounded transition-colors"
        title="Reload preview"
        aria-label="Reload preview"
      >
        <svg
          className="w-4 h-4 text-gray-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          role="img"
          aria-label="Reload icon"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
      </button>
      <button
        type="button"
        onClick={onToggleFullscreen}
        className="p-1.5 hover:bg-gray-100 rounded transition-colors"
        title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
      >
        {!isFullscreen ? (
          <svg
            className="w-4 h-4 text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            role="img"
            aria-label="Maximize icon"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
            />
          </svg>
        ) : (
          <svg
            className="w-4 h-4 text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            role="img"
            aria-label="Minimize icon"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25"
            />
          </svg>
        )}
      </button>
    </div>
  );
}
