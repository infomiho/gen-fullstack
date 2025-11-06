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

/**
 * Button configuration interface
 */
interface ButtonConfig {
  label: string;
  icon: React.ReactElement;
  onClick: () => void;
  disabled: boolean;
  className: string;
  title: string;
}

/**
 * Helper: Get tooltip for start button based on current state
 */
const getStartButtonTitle = (
  hasSession: boolean,
  isGenerating: boolean,
  status: string,
  canStart: boolean,
): string => {
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

/**
 * Helper: Get stop button configuration
 */
const getStopButtonConfig = (
  currentSessionId: string | null,
  onStop: (sessionId: string) => void,
) => ({
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
});

/**
 * Helper: Get starting button configuration
 */
const getStartingButtonConfig = () => ({
  label: 'Starting...',
  icon: <CirclePlay size={18} />,
  onClick: () => {},
  disabled: true,
  className: button.primary,
  title: 'Application is starting',
});

/**
 * Helper: Get run button configuration
 */
const getRunButtonConfig = (
  hasSession: boolean,
  isGenerating: boolean,
  status: string,
  currentSessionId: string | null,
  onStart: (sessionId: string) => void,
  onStartClick?: () => void,
) => {
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
    title: getStartButtonTitle(hasSession, isGenerating, status, canStart),
  };
};

/**
 * Helper component: Screen reader announcements for status changes
 */
const ScreenReaderAnnouncements = ({
  sessionStatus,
  status,
  appError,
}: {
  sessionStatus: 'pending' | 'generating' | 'completed' | 'failed' | 'cancelled';
  status: AppInfo['status'] | 'stopped';
  appError?: string;
}) => (
  <div className="sr-only" aria-live="polite" aria-atomic="true">
    {sessionStatus === 'pending' && 'Generation pending'}
    {sessionStatus === 'generating' && 'Generation in progress'}
    {sessionStatus === 'completed' && 'Generation completed'}
    {sessionStatus === 'failed' && 'Generation failed'}
    {sessionStatus === 'cancelled' && 'Generation cancelled'}
    {status === 'creating' && 'App container is being created'}
    {status === 'installing' && 'Installing app dependencies'}
    {status === 'starting' && 'Starting app servers'}
    {status === 'ready' && 'App is ready to run'}
    {status === 'running' && 'App is now running'}
    {status === 'stopped' && 'App has stopped'}
    {status === 'failed' && (appError ? `App failed: ${appError}` : 'App failed to start')}
  </div>
);

interface UnifiedStatusSectionProps {
  sessionStatus: 'pending' | 'generating' | 'completed' | 'failed' | 'cancelled';
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

  // Determine button configuration based on app status
  let buttonConfig: ButtonConfig;
  if (status === 'running') {
    buttonConfig = getStopButtonConfig(currentSessionId, onStop);
  } else if (isTransitioning(status)) {
    buttonConfig = getStartingButtonConfig();
  } else {
    buttonConfig = getRunButtonConfig(
      hasSession,
      isGenerating,
      status,
      currentSessionId,
      onStart,
      onStartClick,
    );
  }

  // Map session status for badge (pending/cancelled → generating)
  const badgeSessionStatus =
    sessionStatus === 'pending' || sessionStatus === 'cancelled' ? 'generating' : sessionStatus;

  return (
    <div className={spacing.controls}>
      <ScreenReaderAnnouncements
        sessionStatus={sessionStatus}
        status={status}
        appError={appStatus?.error}
      />

      <div>
        <h3 className={typography.sectionHeader}>Status</h3>
      </div>

      {/* Generation Status */}
      <div className={container.light}>
        <div className="flex items-center justify-between gap-3">
          <span className={typography.caption}>Generation</span>
          <StatusBadge
            status={badgeSessionStatus}
            variant="session"
            showLiveIndicator={showLiveIndicator}
          />
        </div>
      </div>

      {/* Container Status */}
      <div className={`${container.light} ${spacing.form}`}>
        <div className="flex items-center justify-between gap-3">
          <span className={typography.caption}>Container</span>
          <StatusBadge status={status} variant="app" />
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
