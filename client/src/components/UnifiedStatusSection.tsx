import type { AppInfo } from '@gen-fullstack/shared';
import { CirclePlay, Square } from 'lucide-react';
import { button, container, link, spacing, typography } from '../lib/design-tokens';
import { Alert } from './Alert';
import { StatusBadge } from './StatusBadge';

/**
 * Helper: Check if app is in a transitioning state
 */
const isTransitioning = (status: string): boolean =>
  status === 'creating' || status === 'installing' || status === 'starting';

/**
 * Helper: Check if app can be started
 */
const isStartable = (status: string): boolean =>
  status === 'ready' || status === 'stopped' || status === 'failed';

interface UnifiedStatusSectionProps {
  sessionStatus: 'generating' | 'completed' | 'failed';
  isOwnSession: boolean;
  currentSessionId: string | null;
  appStatus: AppInfo | null;
  isGenerating: boolean;
  onStart: (sessionId: string) => void;
  onStop: (sessionId: string) => void;
  onStartClick?: () => void;
}

/**
 * UnifiedStatusSection component
 *
 * Displays both generation and container status in a unified section.
 * Replaces the old split between SessionHeader status badge and AppControls.
 *
 * Layout:
 * - Generation status with live indicator when generating
 * - Container status with URL link when running
 * - Error message if present
 * - Run/Stop button
 */
export function UnifiedStatusSection({
  sessionStatus,
  isOwnSession,
  currentSessionId,
  appStatus,
  isGenerating,
  onStart,
  onStop,
  onStartClick,
}: UnifiedStatusSectionProps) {
  const status: AppInfo['status'] | 'stopped' = appStatus?.status || 'stopped';
  const hasSession = currentSessionId !== null;
  const showLiveIndicator = sessionStatus === 'generating' && isOwnSession;
  const showClientUrl = appStatus?.clientUrl && status === 'running';

  // Helper to get tooltip for start button based on current state
  const getStartButtonTitle = (canStart: boolean): string => {
    if (!hasSession) {
      return 'Generate an app first';
    }
    if (isGenerating) {
      return 'Wait for generation to complete';
    }
    if (status === 'failed') {
      return 'Retry running the application';
    }
    if (canStart) {
      return 'Run the application';
    }
    return `Cannot start app from ${status} state`;
  };

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
    if (isTransitioning(status)) {
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
    const canStart = hasSession && !isGenerating && isStartable(status);

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
      title: getStartButtonTitle(canStart),
    };
  };

  const buttonConfig = getButtonConfig();

  return (
    <div className={spacing.controls}>
      {/* Screen reader announcements for status changes */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {sessionStatus === 'generating' && 'Generation in progress'}
        {sessionStatus === 'completed' && 'Generation completed'}
        {sessionStatus === 'failed' && 'Generation failed'}
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
        <h3 className={typography.sectionHeader}>Status</h3>
      </div>

      {/* Generation Status */}
      <div className={container.light}>
        <div className="flex items-center justify-between gap-3">
          <span className={typography.caption}>Generation</span>
          <StatusBadge
            status={sessionStatus}
            variant="session"
            showLiveIndicator={showLiveIndicator}
            uppercase={true}
          />
        </div>
      </div>

      {/* Container Status */}
      <div className={`${container.light} ${spacing.form}`}>
        <div className="flex items-center justify-between gap-3">
          <span className={typography.caption}>Container</span>
          <StatusBadge status={status} variant="app" uppercase={true} />
        </div>
        {showClientUrl && (
          <a
            href={appStatus.clientUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`block ${link.small} break-all pl-0.5`}
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
