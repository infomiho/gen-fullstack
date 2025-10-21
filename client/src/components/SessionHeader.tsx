import { Link } from 'react-router';
import { padding, transitions, typography } from '../lib/design-tokens';
import { StatusBadge } from './StatusBadge';

interface SessionHeaderProps {
  sessionId: string | undefined;
  status: 'generating' | 'completed' | 'failed';
  isConnected: boolean;
  isOwnSession: boolean;
}

/**
 * SessionHeader component
 *
 * Displays the header for a session page with:
 * - App title and home link
 * - Session ID
 * - Session status badge (with live indicator for active sessions)
 * - Connection status indicator
 */
export function SessionHeader({
  sessionId,
  status,
  isConnected,
  isOwnSession,
}: SessionHeaderProps) {
  const showLiveBadge = status === 'generating' && isConnected && isOwnSession;

  return (
    <header className={`border-b ${padding.page}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className={`${typography.label} text-lg text-gray-900 hover:text-gray-700 ${transitions.colors}`}
          >
            Gen Fullstack
          </Link>
          <span className={typography.caption}>Session: {sessionId}</span>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={status} variant="session" showLiveIndicator={showLiveBadge} />
          <div className="flex items-center gap-1.5">
            <div
              className={`h-1.5 w-1.5 rounded-full ${isConnected ? 'bg-gray-900' : 'bg-gray-300'}`}
            />
            <span className={typography.caption}>{isConnected ? 'connected' : 'disconnected'}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
