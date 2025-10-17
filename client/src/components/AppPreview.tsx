import type { AppInfo } from '@gen-fullstack/shared';
import { useState } from 'react';
import { dimensions, radius, typography } from '../lib/design-tokens';

interface AppPreviewProps {
  appStatus: AppInfo | null;
}

interface PreviewControlsProps {
  onReload: () => void;
  onToggleFullscreen: () => void;
  isFullscreen: boolean;
}

/**
 * Preview control buttons (reload, maximize/minimize)
 * Extracted as separate component to avoid repetition
 */
function PreviewControls({ onReload, onToggleFullscreen, isFullscreen }: PreviewControlsProps) {
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

export function AppPreview({ appStatus }: AppPreviewProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [iframeError, setIframeError] = useState(false);

  const isRunning = appStatus?.status === 'running';
  const url = appStatus?.url;

  const handleReload = () => {
    setIframeKey((prev) => prev + 1);
    setIframeError(false);
  };

  const handleToggleFullscreen = () => {
    setIsFullscreen((prev) => !prev);
  };

  // Single render path with CSS-only fullscreen to avoid iframe remount
  return (
    <div className={isFullscreen ? 'fixed inset-0 z-50 bg-white flex flex-col' : ''}>
      {/* Header - sticky in fullscreen mode */}
      <div
        className={
          isFullscreen
            ? 'px-6 pt-4 pb-3 border-b border-gray-200 sticky top-0 bg-white z-10'
            : 'mb-3'
        }
      >
        <div className="flex items-center justify-between">
          <h3 className={typography.header}>App Preview</h3>
          {isRunning && url && (
            <PreviewControls
              onReload={handleReload}
              onToggleFullscreen={handleToggleFullscreen}
              isFullscreen={isFullscreen}
            />
          )}
        </div>
      </div>

      {/* Content - iframe or placeholder */}
      <div
        className={isFullscreen ? 'flex-1 overflow-hidden relative' : 'relative'}
        style={{ height: isFullscreen ? undefined : dimensions.previewHeight }}
      >
        {isRunning && url ? (
          <>
            <iframe
              key={`${url}-${iframeKey}`}
              src={url}
              title="App Preview"
              className={
                isFullscreen
                  ? 'w-full h-full border-0'
                  : `w-full h-full border border-gray-200 bg-white ${radius.md}`
              }
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
              onError={() => setIframeError(true)}
              onLoad={() => setIframeError(false)}
            />
            {iframeError && (
              <div className="absolute inset-0 flex items-center justify-center bg-red-50">
                <div className="text-center p-6">
                  <svg
                    className="mx-auto h-12 w-12 text-red-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    role="img"
                    aria-label="Error warning icon"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  <p className="mt-4 text-sm font-medium text-red-700">Failed to load preview</p>
                  <p className="mt-1 text-xs text-red-600">
                    The app may still be starting or encountered an error.
                  </p>
                  <button
                    type="button"
                    onClick={handleReload}
                    className="mt-4 px-4 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
                  >
                    Try Reloading
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div
            className={`flex items-center justify-center border-2 border-dashed border-gray-300 bg-gray-50 ${radius.md}`}
            style={{ height: isFullscreen ? '100%' : dimensions.previewHeight }}
          >
            <div className="text-center">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                role="img"
                aria-label="Computer monitor icon"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
              <p className="mt-4 text-sm text-gray-500">
                {appStatus?.status === 'starting' || appStatus?.status === 'installing'
                  ? 'Starting app...'
                  : 'No app running'}
              </p>
              <p className="mt-1 text-xs text-gray-400">
                Click "Start App" to preview your generated application
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
