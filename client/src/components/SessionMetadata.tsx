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
  status: 'generating' | 'completed' | 'failed';
  createdAt: string;
  durationMs?: number;
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
  const relativeTime = formatRelativeTime(createdAt);
  const duration = formatDuration(durationMs);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Active capability badges (includes Template Base when template mode is enabled) */}
      {activeCapabilities.map((capability) => (
        <CapabilityBadge key={capability} capability={capability} />
      ))}

      {/* Spacer to push timing/status to the right */}
      <div className="flex-1" />

      {/* Duration and time ago with dot separator */}
      {durationMs !== undefined && durationMs > 0 ? (
        <span className={typography.caption}>
          {duration} · {relativeTime}
        </span>
      ) : (
        <span className={typography.caption}>{relativeTime}</span>
      )}

      {/* Status badge */}
      <StatusBadge status={status} />
    </div>
  );
}
