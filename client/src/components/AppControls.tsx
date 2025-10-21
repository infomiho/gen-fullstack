import type { AppInfo } from '@gen-fullstack/shared';
import { CirclePlay, Square } from 'lucide-react';
import { button, spacing, typography } from '../lib/design-tokens';
import { Alert } from './Alert';
import { StatusBadge } from './StatusBadge';

interface AppControlsProps {
  currentSessionId: string | null;
  appStatus: AppInfo | null;
  isGenerating: boolean;
  onStart: (sessionId: string) => void;
  onStop: (sessionId: string) => void;
  onStartClick?: () => void;
}

export function AppControls({
  currentSessionId,
  appStatus,
  isGenerating,
  onStart,
  onStop,
  onStartClick,
}: AppControlsProps) {
  const status = appStatus?.status || 'idle';
  const hasSession = currentSessionId !== null;

  // Determine button state based on app status
  const getButtonConfig = () => {
    // App is running - show stop button with subtle gray styling and square icon
    if (status === 'running') {
      return {
        label: 'Stop',
        icon: <Square size={16} className="fill-current" />,
        onClick: () => {
          if (!currentSessionId) {
            return;
          }
          onStop(currentSessionId);
        },
        disabled: false,
        className: button.tertiary,
        title: 'Stop the running application',
      };
    }

    // App is starting - show disabled starting button
    if (status === 'starting' || status === 'creating' || status === 'installing') {
      return {
        label: 'Starting...',
        icon: null,
        onClick: () => {},
        disabled: true,
        className: button.primary,
        title: 'Application is starting, please wait',
      };
    }

    // App is idle/stopped/failed - show start button with CirclePlay icon
    const canStart = hasSession && !isGenerating;
    return {
      label: 'Start',
      icon: <CirclePlay size={18} />,
      onClick: () => {
        if (!currentSessionId) {
          return;
        }
        onStartClick?.();
        onStart(currentSessionId);
      },
      disabled: !canStart,
      className: button.primary,
      title: !hasSession
        ? 'Generate an app first'
        : isGenerating
          ? 'Wait for generation to complete'
          : 'Start the application',
    };
  };

  const buttonConfig = getButtonConfig();

  return (
    <div className={spacing.controls}>
      {/* Screen reader announcements for status changes */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {status === 'creating' && 'App container is being created'}
        {status === 'installing' && 'Installing dependencies'}
        {status === 'starting' && 'App is starting'}
        {status === 'running' && 'App is now running'}
        {status === 'stopped' && 'App has stopped'}
        {status === 'failed' && appStatus?.error
          ? `App failed: ${appStatus.error}`
          : 'App failed to start'}
      </div>

      <div>
        <h3 className={typography.header}>App Execution</h3>
      </div>

      {/* Status Display */}
      <div className="flex items-center gap-3">
        <span className={typography.label}>Status:</span>
        <StatusBadge status={status} variant="app" uppercase={true} />
        {appStatus?.clientUrl && status === 'running' && (
          <a
            href={appStatus.clientUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:text-blue-800 underline"
          >
            {appStatus.clientUrl}
          </a>
        )}
      </div>

      {/* Error Display */}
      {appStatus?.error && <Alert variant="error">{appStatus.error}</Alert>}

      {/* Single Control Button */}
      <button
        type="button"
        onClick={buttonConfig.onClick}
        disabled={buttonConfig.disabled}
        className={buttonConfig.className}
        title={buttonConfig.title}
        aria-label={`${buttonConfig.label} application`}
      >
        <div className="flex items-center justify-center gap-2">
          {buttonConfig.icon}
          {buttonConfig.label}
        </div>
      </button>
    </div>
  );
}
