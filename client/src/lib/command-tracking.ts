import type { AppLog } from '@gen-fullstack/shared';

export interface ActiveCommand {
  index: number;
  startTime: number;
  running: boolean;
  endTime?: number;
}

/**
 * Check if command state contains data from before the current log set
 */
function hasStaleCommands(
  commandState: Map<number, ActiveCommand>,
  firstLogTimestamp: number | undefined,
): boolean {
  if (!firstLogTimestamp) return false;
  return Array.from(commandState.values()).some((cmd) => cmd.startTime < firstLogTimestamp);
}

/**
 * Find the most recent running command before a given index
 */
function findClosestRunningCommand(
  logs: AppLog[],
  commandState: Map<number, ActiveCommand>,
  completionTimestamp: number,
  beforeIndex: number,
): number {
  let closestCmdIndex = -1;
  let closestTimeDiff = Infinity;

  for (let i = beforeIndex - 1; i >= 0; i--) {
    const cmd = commandState.get(i);
    if (cmd?.running && logs[i].level === 'command') {
      const timeDiff = completionTimestamp - cmd.startTime;
      if (timeDiff > 0 && timeDiff < closestTimeDiff) {
        closestCmdIndex = i;
        closestTimeDiff = timeDiff;
      }
    }
  }

  return closestCmdIndex;
}

/**
 * Mark a command as complete in the state map
 */
function completeCommand(
  commandState: Map<number, ActiveCommand>,
  commandIndex: number,
  endTime: number,
): void {
  const cmd = commandState.get(commandIndex);
  if (cmd) {
    commandState.set(commandIndex, {
      ...cmd,
      running: false,
      endTime,
    });
  }
}

/**
 * Process a completion signal (system or command log) and mark the appropriate command as complete
 */
function processCompletionSignal(
  logs: AppLog[],
  commandState: Map<number, ActiveCommand>,
  logIndex: number,
  logTimestamp: number,
): void {
  const closestCmdIndex = findClosestRunningCommand(logs, commandState, logTimestamp, logIndex);
  if (closestCmdIndex >= 0) {
    completeCommand(commandState, closestCmdIndex, logTimestamp);
  }
}

/**
 * Update command state based on new logs
 *
 * Tracks command execution by:
 * 1. Detecting new command logs and marking them as running
 * 2. Detecting completion signals (system/command logs) and marking commands complete
 * 3. Resetting state when logs are cleared or replaced (container restart)
 *
 * @param logs - Current log array
 * @param prevState - Previous command state map
 * @returns Updated command state map
 */
export function updateCommandState(
  logs: AppLog[],
  prevState: Map<number, ActiveCommand>,
): Map<number, ActiveCommand> {
  // Reset if empty
  if (logs.length === 0) {
    return new Map();
  }

  // Reset if stale data detected (container restart)
  const firstLogTimestamp = logs[0]?.timestamp;
  if (hasStaleCommands(prevState, firstLogTimestamp)) {
    return new Map();
  }

  const updated = new Map(prevState);

  // Process each log entry
  for (let index = 0; index < logs.length; index++) {
    const log = logs[index];

    // Start tracking new commands
    if (log.level === 'command' && !updated.has(index)) {
      updated.set(index, {
        index,
        startTime: log.timestamp,
        running: true,
      });
      continue;
    }

    // Mark previous running command as complete
    if ((log.level === 'system' || log.level === 'command') && index > 0) {
      processCompletionSignal(logs, updated, index, log.timestamp);
    }
  }

  return updated;
}
