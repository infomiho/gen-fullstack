import { Link } from 'react-router';
import { padding, transitions, typography } from '../lib/design-tokens';

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
          <div
            className={`px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1.5 ${
              status === 'completed'
                ? 'bg-gray-100 text-gray-700'
                : status === 'generating'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-red-100 text-red-700'
            }`}
          >
            {showLiveBadge && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
              </span>
            )}
            {showLiveBadge ? 'Live' : status}
          </div>
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
