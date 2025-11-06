/**
 * Test Helper Functions
 *
 * Utilities for creating properly typed test data
 */

import type { TimelineItem, File as SessionFile } from '@gen-fullstack/shared';

/**
 * Create a properly typed timeline item with all required fields
 */
export function createMockTimelineItem(
  partial: Partial<TimelineItem> & Pick<TimelineItem, 'id' | 'sessionId' | 'type'>,
): TimelineItem {
  return {
    timestamp: new Date(),
    messageId: null,
    role: null,
    content: null,
    toolCallId: null,
    toolName: null,
    toolArgs: null,
    toolReason: null,
    toolResultId: null,
    toolResultFor: null,
    result: null,
    isError: null,
    stageId: null,
    stageType: null,
    stageStatus: null,
    stageData: null,
    ...partial,
  };
}

/**
 * Create a properly typed file mock
 */
export function createMockFile(partial: Partial<SessionFile>): SessionFile {
  return {
    id: 1,
    sessionId: 'test-session',
    path: '/test/file.ts',
    content: 'test content',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial,
  };
}
