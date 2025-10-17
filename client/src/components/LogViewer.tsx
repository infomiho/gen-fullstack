import type { AppLog } from '@gen-fullstack/shared';
import { PackageOpen } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { radius, spacing, typography } from '../lib/design-tokens';
import { getLevelColor, getLevelLabel } from '../lib/log-utils';
import { EmptyState } from './EmptyState';
import { FilterButton } from './FilterButton';

interface LogViewerProps {
  logs: AppLog[];
}

export function LogViewer({ logs }: LogViewerProps) {
  const [autoScroll, setAutoScroll] = useState(true);
  const [filter, setFilter] = useState<'all' | 'command' | 'system' | 'info' | 'warn' | 'error'>(
    'all',
  );
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [autoScroll]);

  // Filter logs by level
  const filteredLogs = logs.filter((log) => filter === 'all' || log.level === filter);

  // Format timestamp
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className={spacing.controls}>
      <div className="flex items-center justify-between">
        <h3 className={typography.header}>Container Logs</h3>
        <div className="flex items-center gap-2">
          {/* Filter Buttons */}
          <div className="flex gap-1">
            <FilterButton
              label="All"
              isActive={filter === 'all'}
              onClick={() => setFilter('all')}
            />
            <FilterButton
              label="Commands"
              isActive={filter === 'command'}
              onClick={() => setFilter('command')}
              variant="purple"
            />
            <FilterButton
              label="System"
              isActive={filter === 'system'}
              onClick={() => setFilter('system')}
              variant="yellow"
            />
            <FilterButton
              label="Info"
              isActive={filter === 'info'}
              onClick={() => setFilter('info')}
              variant="blue"
            />
            <FilterButton
              label="Warn"
              isActive={filter === 'warn'}
              onClick={() => setFilter('warn')}
              variant="amber"
            />
            <FilterButton
              label="Error"
              isActive={filter === 'error'}
              onClick={() => setFilter('error')}
              variant="red"
            />
          </div>

          {/* Auto-scroll Toggle */}
          <label className="flex items-center gap-2 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="rounded"
            />
            Auto-scroll
          </label>
        </div>
      </div>

      {/* Log Container */}
      <div
        ref={logContainerRef}
        className={`overflow-y-auto border border-gray-200 bg-gray-900 ${radius.md} font-mono text-xs`}
        style={{ height: '400px' }}
      >
        {filteredLogs.length === 0 ? (
          <EmptyState
            icon={logs.length === 0 ? <PackageOpen size={48} /> : undefined}
            title={logs.length === 0 ? 'No logs yet' : 'No logs match the selected filter'}
            description={
              logs.length === 0 ? 'Container logs will appear here when the app starts' : undefined
            }
          />
        ) : (
          <div className="p-3 space-y-1">
            {filteredLogs.map((log, index) => (
              <div
                key={`${log.timestamp}-${index}`}
                className="flex gap-3 items-start font-mono text-xs"
              >
                <span className="text-gray-500 flex-shrink-0">{formatTime(log.timestamp)}</span>
                <span
                  className={`flex-shrink-0 uppercase font-semibold ${getLevelColor(log.level)}`}
                >
                  {getLevelLabel(log.level)}
                </span>
                <span className="text-gray-300 break-all">{log.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Log Count */}
      <div className="flex justify-between text-xs text-gray-500">
        <span>
          Showing {filteredLogs.length} of {logs.length} logs
        </span>
        {logs.length >= 500 && <span className="text-amber-600">⚠️ Log limit reached (500)</span>}
      </div>
    </div>
  );
}
