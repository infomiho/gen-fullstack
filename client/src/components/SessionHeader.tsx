import { Link } from 'react-router';
import { padding, transitions, typography } from '../lib/design-tokens';
import { CopyButton } from './CopyButton';

interface SessionHeaderProps {
  sessionId: string | undefined;
}

/**
 * SessionHeader component
 *
 * Displays the header for a session page with:
 * - App title and home link (left)
 * - Session ID with copy button (right)
 *
 * Note: Status badge has been moved to UnifiedStatusSection in the sidebar
 */
export function SessionHeader({ sessionId }: SessionHeaderProps) {
  return (
    <header className={`border-b ${padding.page}`}>
      <div className="flex items-center justify-between">
        <Link
          to="/"
          className={`${typography.label} text-lg hover:opacity-80 ${transitions.colors}`}
        >
          <span className="text-foreground">Gen </span>
          <span className="bg-gradient-to-b from-[#1488FC] to-[#03305D] dark:from-white dark:to-[#1488FC] bg-clip-text text-transparent">
            Fullstack
          </span>
        </Link>
        <div className="flex items-center gap-1.5">
          <span className={typography.caption}>Session: {sessionId}</span>
          {sessionId && <CopyButton text={sessionId} title="Copy session ID" iconSize={14} />}
        </div>
      </div>
    </header>
  );
}
