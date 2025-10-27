import { Wrench } from 'lucide-react';
import {
  formatDuration,
  formatRelativeTime,
  formatTokens,
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
  stepCount?: number;
  totalTokens?: number;
}

/**
 * SessionMetadata component
 *
 * Displays comprehensive session metadata in a compact two-row layout:
 * - Row 1: Capability badges (Template Base, Smart Planning, etc.), timestamp, status badge, duration
 * - Row 2: Tool count, token count
 */
export function SessionMetadata({
  capabilityConfig,
  status,
  createdAt,
  durationMs,
  stepCount,
  totalTokens,
}: SessionMetadataProps) {
  const config = parseCapabilityConfig(capabilityConfig);
  const activeCapabilities = getActiveCapabilities(config);
  const relativeTime = formatRelativeTime(createdAt);
  const duration = formatDuration(durationMs);
  const tokens = formatTokens(totalTokens);

  return (
    <div className="space-y-1.5">
      {/* Row 1: Capability Badges + Time + Status + Duration */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Active capability badges (includes Template Base when template mode is enabled) */}
        {activeCapabilities.map((capability) => (
          <CapabilityBadge key={capability} capability={capability} />
        ))}

        {/* Spacer to push time/status/duration to the right */}
        <div className="flex-1" />

        {/* Timestamp */}
        <span className={typography.caption}>{relativeTime}</span>

        {/* Status badge */}
        <StatusBadge status={status} />

        {/* Duration */}
        {durationMs !== undefined && durationMs > 0 && (
          <span className={`${typography.caption} font-medium`}>{duration}</span>
        )}
      </div>

      {/* Row 2: Tool count + Token count */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        {stepCount !== undefined && stepCount > 0 && (
          <span className="flex items-center gap-1">
            <Wrench className="h-3 w-3" />
            {stepCount} tools
          </span>
        )}
        {totalTokens !== undefined && totalTokens > 0 && <span>📊 {tokens} tokens</span>}
      </div>
    </div>
  );
}
