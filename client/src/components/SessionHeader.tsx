import { Link } from 'react-router';
import { padding, transitions, typography } from '../lib/design-tokens';
import { StatusBadge } from './StatusBadge';

interface SessionHeaderProps {
  sessionId: string | undefined;
  status: 'generating' | 'completed' | 'failed';
  isOwnSession: boolean;
}

/**
 * SessionHeader component
 *
 * Displays the header for a session page with:
 * - App title and home link
 * - Session ID
 * - Session status badge (with live indicator for active sessions)
 */
export function SessionHeader({ sessionId, status, isOwnSession }: SessionHeaderProps) {
  const showLiveBadge = status === 'generating' && isOwnSession;

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
        </div>
      </div>
    </header>
  );
}
