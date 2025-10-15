import type { AppInfo } from '@gen-fullstack/shared';
import { button, padding, spacing, typography } from '../lib/design-tokens';

interface AppControlsProps {
  currentSessionId: string | null;
  appStatus: AppInfo | null;
  isGenerating: boolean;
  onStart: (sessionId: string) => void;
  onStop: (sessionId: string) => void;
  onRestart: (sessionId: string) => void;
}

export function AppControls({
  currentSessionId,
  appStatus,
  isGenerating,
  onStart,
  onStop,
  onRestart,
}: AppControlsProps) {
  const status = appStatus?.status || 'idle';
  const hasSession = currentSessionId !== null;

  // Determine which buttons to show based on status and session
  // Don't allow starting during generation (files incomplete)
  const canStart =
    hasSession &&
    !isGenerating &&
    (status === 'idle' || status === 'stopped' || status === 'failed');
  const canStop = hasSession && (status === 'running' || status === 'starting');
  const canRestart = hasSession && !isGenerating && (status === 'running' || status === 'failed');

  // Status badge color
  const getStatusColor = () => {
    switch (status) {
      case 'running':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'creating':
      case 'installing':
      case 'starting':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'stopped':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  return (
    <div className={spacing.controls}>
      <div>
        <h3 className={typography.header}>App Execution</h3>
      </div>

      {/* Status Display */}
      <div className="flex items-center gap-3">
        <span className={typography.label}>Status:</span>
        <span
          className={`inline-flex items-center ${padding.compact} rounded border ${getStatusColor()} ${typography.caption} uppercase font-medium`}
        >
          {status}
        </span>
        {appStatus?.url && (
          <a
            href={appStatus.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:text-blue-800 underline"
          >
            {appStatus.url}
          </a>
        )}
      </div>

      {/* Error Display */}
      {appStatus?.error && (
        <div className="rounded border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-800">{appStatus.error}</p>
        </div>
      )}

      {/* Control Buttons */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => currentSessionId && onStart(currentSessionId)}
          disabled={!canStart}
          className={button.primary}
          title={
            !hasSession
              ? 'Generate an app first'
              : isGenerating
                ? 'Wait for generation to complete'
                : ''
          }
        >
          Start
        </button>
        <button
          type="button"
          onClick={() => currentSessionId && onStop(currentSessionId)}
          disabled={!canStop}
          className={button.secondary}
        >
          Stop
        </button>
        <button
          type="button"
          onClick={() => currentSessionId && onRestart(currentSessionId)}
          disabled={!canRestart}
          className={button.secondary}
        >
          Restart
        </button>
      </div>
    </div>
  );
}
