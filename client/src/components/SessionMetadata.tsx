import {
  formatDuration,
  formatRelativeTime,
  getActiveCapabilities,
  parseCapabilityConfig,
} from '../lib/format-utils';
import { typography } from '../lib/design-tokens';
import { StatusBadge } from './StatusBadge';
import { CapabilityBadge } from './CapabilityBadge';

interface SessionMetadataProps {
  capabilityConfig: string; // JSON string
  status: 'pending' | 'generating' | 'completed' | 'failed' | 'cancelled';
  createdAt: string | Date;
  durationMs?: number | null;
}

/**
 * SessionMetadata component
 *
 * Displays session metadata in a single-row layout:
 * - Capability badges + duration · time ago + status badge
 */
export function SessionMetadata({
  capabilityConfig,
  status,
  createdAt,
  durationMs,
}: SessionMetadataProps) {
  const config = parseCapabilityConfig(capabilityConfig);
  const activeCapabilities = getActiveCapabilities(config);
  const createdAtString = createdAt instanceof Date ? createdAt.toISOString() : createdAt;
  const relativeTime = formatRelativeTime(createdAtString);
  const duration = formatDuration(durationMs ?? undefined);

  // Map all possible session statuses to badge statuses
  const badgeStatus = status === 'pending' || status === 'cancelled' ? 'generating' : status;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Active capability badges (includes Template Base when template mode is enabled) */}
      {activeCapabilities.map((capability) => (
        <CapabilityBadge key={capability} capability={capability} />
      ))}

      {/* Spacer to push timing/status to the right */}
      <div className="flex-1" />

      {/* Duration and time ago with dot separator */}
      {durationMs != null && durationMs > 0 ? (
        <span className={typography.caption}>
          {duration} · {relativeTime}
        </span>
      ) : (
        <span className={typography.caption}>{relativeTime}</span>
      )}

      {/* Status badge */}
      <StatusBadge status={badgeStatus} />
    </div>
  );
}
