import type { AppInfo } from '@gen-fullstack/shared';
import { useState } from 'react';
import { radius, spacing, typography } from '../lib/design-tokens';

interface AppPreviewProps {
  appStatus: AppInfo | null;
}

interface PreviewHeaderProps {
  isRunning: boolean;
  url: string | undefined;
  isFullscreen: boolean;
  onReload: () => void;
  onMaximize: () => void;
  onMinimize: () => void;
}

function PreviewHeader({
  isRunning,
  url,
  isFullscreen,
  onReload,
  onMaximize,
  onMinimize,
}: PreviewHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <h3 className={typography.header}>App Preview</h3>
      {isRunning && url && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onReload}
            className="p-1.5 hover:bg-gray-100 rounded transition-colors"
            title="Reload preview"
          >
            <svg
              className="w-4 h-4 text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <title>Reload</title>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
          {!isFullscreen ? (
            <button
              type="button"
              onClick={onMaximize}
              className="p-1.5 hover:bg-gray-100 rounded transition-colors"
              title="Maximize preview"
            >
              <svg
                className="w-4 h-4 text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <title>Maximize</title>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                />
              </svg>
            </button>
          ) : (
            <button
              type="button"
              onClick={onMinimize}
              className="p-1.5 hover:bg-gray-100 rounded transition-colors"
              title="Minimize preview"
            >
              <svg
                className="w-4 h-4 text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <title>Minimize</title>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25"
                />
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function AppPreview({ appStatus }: AppPreviewProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const isRunning = appStatus?.status === 'running';
  const url = appStatus?.url;

  const handleReload = () => {
    setIframeKey((prev) => prev + 1);
  };

  const handleMaximize = () => {
    setIsFullscreen(true);
  };

  const handleMinimize = () => {
    setIsFullscreen(false);
  };

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-white flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200">
          <PreviewHeader
            isRunning={isRunning}
            url={url}
            isFullscreen={isFullscreen}
            onReload={handleReload}
            onMaximize={handleMaximize}
            onMinimize={handleMinimize}
          />
        </div>
        <div className="flex-1 overflow-hidden">
          {isRunning && url ? (
            <iframe
              key={`${url}-${appStatus?.status}-${iframeKey}`}
              src={url}
              title="App Preview"
              className="w-full h-full border-0"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
            />
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className={spacing.controls}>
      <div className="mb-3">
        <PreviewHeader
          isRunning={isRunning}
          url={url}
          isFullscreen={isFullscreen}
          onReload={handleReload}
          onMaximize={handleMaximize}
          onMinimize={handleMinimize}
        />
      </div>

      {isRunning && url ? (
        <div className="relative w-full" style={{ height: '600px' }}>
          <iframe
            key={`${url}-${appStatus?.status}-${iframeKey}`}
            src={url}
            title="App Preview"
            className={`w-full h-full border border-gray-200 bg-white ${radius.md}`}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
          />
        </div>
      ) : (
        <div
          className={`flex items-center justify-center border-2 border-dashed border-gray-300 bg-gray-50 ${radius.md}`}
          style={{ height: '600px' }}
        >
          <div className="text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <title>Computer monitor icon</title>
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
  );
}
