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
  const status = appStatus?.status || 'stopped';
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

    // App is starting (creating, installing, starting) - show disabled "Starting..." button
    if (status === 'creating' || status === 'installing' || status === 'starting') {
      return {
        label: 'Starting...',
        icon: <CirclePlay size={18} />,
        onClick: () => {},
        disabled: true,
        className: button.primary,
        title: 'Application is starting',
      };
    }

    // App is ready/stopped/failed - show start button with CirclePlay icon
    // Allow starting from 'stopped' (no container), 'ready' (container exists), and 'failed' (after fixing issues)
    const canStart =
      hasSession &&
      !isGenerating &&
      (status === 'ready' || status === 'stopped' || status === 'failed');

    // Determine tooltip based on why button is disabled
    let title: string;
    if (!hasSession) {
      title = 'Generate an app first';
    } else if (isGenerating) {
      title = 'Wait for generation to complete';
    } else if (status === 'failed') {
      title = 'Retry running the application';
    } else if (canStart) {
      title = 'Run the application';
    } else {
      title = `Cannot start app from ${status} state`;
    }

    return {
      label: 'Run',
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
      title,
    };
  };

  const buttonConfig = getButtonConfig();

  return (
    <div className={spacing.controls}>
      {/* Screen reader announcements for status changes */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {status === 'creating' && 'App container is being created'}
        {status === 'installing' && 'Installing app dependencies'}
        {status === 'starting' && 'Starting app servers'}
        {status === 'ready' && 'App is ready to run'}
        {status === 'running' && 'App is now running'}
        {status === 'stopped' && 'App has stopped'}
        {status === 'failed' && appStatus?.error
          ? `App failed: ${appStatus.error}`
          : 'App failed to start'}
      </div>

      <div>
        <h3 className={typography.sectionHeader}>Preview</h3>
      </div>

      {/* Status Display */}
      <div>
        <div className="flex items-center gap-3">
          <span className={typography.label}>Status:</span>
          <StatusBadge status={status} variant="app" uppercase={true} />
        </div>
        {appStatus?.clientUrl && status === 'running' && (
          <a
            href={appStatus.clientUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 block text-sm text-blue-600 hover:text-blue-800 underline break-all"
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
