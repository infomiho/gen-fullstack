import { useRef, useEffect } from 'react';
import type {
  LLMMessage,
  ToolCall,
  ToolResult,
  PipelineStageEvent,
  AppInfo,
  AppLog,
  FileUpdate,
} from '@gen-fullstack/shared';
import { Timeline } from './Timeline';
import { ErrorBoundary as ErrorBoundaryComponent } from './ErrorBoundary';
import { FileWorkspace } from './FileWorkspace';
import { AppPreview } from './AppPreview';
import { LogViewer } from './LogViewer';
import { ReplayControls } from './ReplayControls';
import { TimelineScrubber } from './TimelineScrubber';
import { padding, spacing } from '../lib/design-tokens';

export interface SessionTabContentProps {
  activeTab: 'timeline' | 'files' | 'preview';
  sessionId: string | undefined;
  messages: LLMMessage[];
  toolCalls: ToolCall[];
  toolResults: ToolResult[];
  pipelineStages: PipelineStageEvent[];
  files: FileUpdate[];
  isGenerating: boolean;
  isReplayMode: boolean;
  appStatus: AppInfo | null;
  appLogs: AppLog[];
  onSaveFile: (sessionId: string, path: string, content: string) => void;
}

/**
 * SessionTabContent - Content area for session tabs
 *
 * Extracted from SessionPage to reduce complexity.
 * Handles rendering different tab content with scroll management.
 */
export function SessionTabContent({
  activeTab,
  sessionId,
  messages,
  toolCalls,
  toolResults,
  pipelineStages,
  files,
  isGenerating,
  isReplayMode,
  appStatus,
  appLogs,
  onSaveFile,
}: SessionTabContentProps) {
  const previewContainerRef = useRef<HTMLDivElement>(null);

  // Scroll to top when switching to preview tab
  useEffect(() => {
    const container = previewContainerRef.current;
    if (activeTab === 'preview' && container) {
      container.scrollTop = 0;
    }
  }, [activeTab]);

  if (activeTab === 'timeline') {
    return (
      <div className="grid h-full grid-rows-[auto_auto_1fr] overflow-hidden">
        {/* Replay Controls */}
        {isReplayMode && (
          <>
            <ReplayControls />
            <TimelineScrubber />
          </>
        )}

        {/* Timeline Content */}
        <div className={`overflow-y-auto ${padding.panel}`}>
          <ErrorBoundaryComponent>
            <Timeline
              messages={messages}
              toolCalls={toolCalls}
              toolResults={toolResults}
              pipelineStages={pipelineStages}
              isGenerating={isGenerating}
            />
          </ErrorBoundaryComponent>
        </div>
      </div>
    );
  }

  if (activeTab === 'files') {
    return (
      <div className="h-full overflow-hidden">
        <FileWorkspace
          files={files}
          onSaveFile={(path, content) => {
            if (sessionId) {
              onSaveFile(sessionId, path, content);
            }
          }}
        />
      </div>
    );
  }

  if (activeTab === 'preview') {
    return (
      <div ref={previewContainerRef} className={`h-full overflow-y-auto ${padding.panel}`}>
        <AppPreview appStatus={appStatus} />
        <div className={spacing.componentGap}>
          <LogViewer logs={appLogs} />
        </div>
      </div>
    );
  }

  return null;
}
