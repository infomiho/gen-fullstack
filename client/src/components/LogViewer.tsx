import type { AppLog } from '@gen-fullstack/shared';
import { Check, Loader2, PackageOpen } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { radius, spacing, typography } from '../lib/design-tokens';
import { getLevelColor, getLevelLabel } from '../lib/log-utils';
import { EmptyState } from './EmptyState';
import { FilterButton } from './FilterButton';

interface LogViewerProps {
  logs: AppLog[];
}

interface LogWithIndex extends AppLog {
  originalIndex: number;
}

interface ActiveCommand {
  index: number;
  startTime: number;
  running: boolean;
  endTime?: number; // Captured when command completes
}

interface CommandProgressProps {
  startTime: number;
  running: boolean;
  endTime?: number;
}

function CommandProgress({ startTime, running, endTime }: CommandProgressProps) {
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    // Calculate initial elapsed time
    const updateElapsed = () => {
      // If command is complete, use the frozen endTime
      const elapsed = endTime ? endTime - startTime : Date.now() - startTime;
      setElapsedTime(elapsed);
    };

    updateElapsed();

    // Only update every 100ms if the command is still running (for smooth 0.1s precision)
    if (running) {
      const interval = setInterval(updateElapsed, 100);
      return () => clearInterval(interval);
    }
  }, [startTime, running, endTime]);

  // Format elapsed time (e.g., "2.5s", "15.3s", "1m 25s", "1h 5m")
  const formatElapsed = (ms: number) => {
    const totalSeconds = ms / 1000;
    if (totalSeconds < 60) {
      return `${totalSeconds.toFixed(1)}s`;
    }
    const minutes = Math.floor(totalSeconds / 60);
    const remainingSeconds = Math.floor(totalSeconds % 60);
    if (minutes < 60) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  return (
    // biome-ignore lint/a11y/useSemanticElements: <output> is for form results, not status indicators
    <span
      className="inline-flex items-center gap-1.5 ml-2 text-muted-foreground"
      role="status"
      aria-live="polite"
      aria-label={
        running
          ? `Command running for ${formatElapsed(elapsedTime)}`
          : `Command completed in ${formatElapsed(elapsedTime)}`
      }
    >
      {running ? (
        <>
          <Loader2 size={12} className="animate-spin text-blue-500" aria-hidden="true" />
          <span className="text-blue-500">{formatElapsed(elapsedTime)}</span>
        </>
      ) : (
        <>
          <Check size={12} className="text-green-500" aria-hidden="true" />
          <span className="text-green-500">{formatElapsed(elapsedTime)}</span>
        </>
      )}
    </span>
  );
}

export function LogViewer({ logs }: LogViewerProps) {
  const [autoScroll, setAutoScroll] = useState(true);
  const [filter, setFilter] = useState<'all' | 'command' | 'system' | 'info' | 'warn' | 'error'>(
    'all',
  );
  const [activeCommands, setActiveCommands] = useState<Map<number, ActiveCommand>>(new Map());
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Pre-compute logs with original indices to avoid expensive findIndex in render
  const logsWithIndices = useMemo<LogWithIndex[]>(
    () => logs.map((log, index) => ({ ...log, originalIndex: index })),
    [logs],
  );

  // Filter logs by level
  const filteredLogs = logsWithIndices.filter((log) => filter === 'all' || log.level === filter);

  // Track active commands and detect completion
  useEffect(() => {
    setActiveCommands((prev) => {
      // Reset state if logs array is empty
      if (logs.length === 0) {
        return new Map();
      }

      // Check if this is a completely new log set (e.g., container restarted)
      const firstLogTimestamp = logs[0]?.timestamp;
      const hasOldData = Array.from(prev.values()).some(
        (cmd) => cmd.startTime < (firstLogTimestamp || 0),
      );

      // If we have commands from before the current log set, reset
      const updated = hasOldData ? new Map() : new Map(prev);

      // Helper: Find the running command closest in time to a completion signal
      const findClosestRunningCommand = (
        completionTimestamp: number,
        beforeIndex: number,
      ): number => {
        let closestCmdIndex = -1;
        let closestTimeDiff = Infinity;

        for (let i = beforeIndex - 1; i >= 0; i--) {
          const cmd = updated.get(i);
          if (cmd?.running && logs[i].level === 'command') {
            const timeDiff = completionTimestamp - cmd.startTime;
            if (timeDiff > 0 && timeDiff < closestTimeDiff) {
              closestCmdIndex = i;
              closestTimeDiff = timeDiff;
            }
          }
        }

        return closestCmdIndex;
      };

      // Process each log entry for command tracking
      for (let index = 0; index < logs.length; index++) {
        const log = logs[index];

        // Start tracking new command logs
        if (log.level === 'command' && !updated.has(index)) {
          updated.set(index, {
            index,
            startTime: log.timestamp,
            running: true,
          });
          continue;
        }

        // Mark previous running command as complete when we see a new system/command log
        if ((log.level === 'system' || log.level === 'command') && index > 0) {
          const closestCmdIndex = findClosestRunningCommand(log.timestamp, index);

          if (closestCmdIndex >= 0) {
            const cmd = updated.get(closestCmdIndex);
            if (cmd) {
              updated.set(closestCmdIndex, {
                ...cmd,
                running: false,
                endTime: log.timestamp,
              });
            }
          }
        }
      }

      return updated;
    });
  }, [logs]);

  // Auto-scroll to bottom when new logs arrive
  // biome-ignore lint/correctness/useExhaustiveDependencies: filteredLogs.length is intentionally included to trigger scroll when logs change
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [autoScroll, filteredLogs.length]);

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
        <h3 className={typography.label}>Container Logs</h3>
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
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
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
        className={`overflow-y-auto border border-border bg-muted ${radius.md} font-mono text-xs`}
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
            {filteredLogs.map((log, index) => {
              const commandState = activeCommands.get(log.originalIndex);

              return (
                <div
                  key={`${log.timestamp}-${index}`}
                  className="flex gap-3 items-start font-mono text-xs"
                >
                  <span className="text-muted-foreground flex-shrink-0">
                    {formatTime(log.timestamp)}
                  </span>
                  <span
                    className={`flex-shrink-0 uppercase font-semibold ${getLevelColor(log.level)}`}
                  >
                    {getLevelLabel(log.level)}
                  </span>
                  <span className="text-foreground break-all flex items-center">
                    {log.message}
                    {log.level === 'command' && commandState && (
                      <CommandProgress
                        startTime={commandState.startTime}
                        running={commandState.running}
                        endTime={commandState.endTime}
                      />
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Log Count */}
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>
          Showing {filteredLogs.length} of {logs.length} logs
        </span>
        {logs.length >= 500 && <span className="text-amber-600">⚠️ Log limit reached (500)</span>}
      </div>
    </div>
  );
}
