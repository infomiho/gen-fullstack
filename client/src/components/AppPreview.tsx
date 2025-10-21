import type { AppInfo } from '@gen-fullstack/shared';
import { Monitor } from 'lucide-react';
import { useState } from 'react';
import { dimensions, radius, typography } from '../lib/design-tokens';
import { EmptyState } from './EmptyState';
import { PreviewControls } from './PreviewControls';

interface AppPreviewProps {
  appStatus: AppInfo | null;
}

export function AppPreview({ appStatus }: AppPreviewProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [iframeError, setIframeError] = useState(false);

  const isRunning = appStatus?.status === 'running';
  const url = appStatus?.clientUrl;

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
          <h3 className={typography.label}>App Preview</h3>
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
            className={`border-2 border-dashed border-gray-300 bg-gray-50 ${radius.md}`}
            style={{ height: isFullscreen ? '100%' : dimensions.previewHeight }}
          >
            <EmptyState
              icon={<Monitor size={48} />}
              title={
                appStatus?.status === 'starting' || appStatus?.status === 'installing'
                  ? 'Starting app...'
                  : 'No app running'
              }
              description="Click Start App to preview your generated application"
            />
          </div>
        )}
      </div>
    </div>
  );
}
