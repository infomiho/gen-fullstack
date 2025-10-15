import type { AppInfo } from '@gen-fullstack/shared';
import { radius, spacing, typography } from '../lib/design-tokens';

interface AppPreviewProps {
  appStatus: AppInfo | null;
}

export function AppPreview({ appStatus }: AppPreviewProps) {
  const isRunning = appStatus?.status === 'running';
  const url = appStatus?.url;

  return (
    <div className={spacing.controls}>
      <div>
        <h3 className={typography.header}>App Preview</h3>
      </div>

      {isRunning && url ? (
        <div className="relative w-full" style={{ height: '600px' }}>
          <iframe
            key={`${url}-${appStatus?.status}`}
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
