import { useNavigate } from 'react-router';
import type { LLMMessage, ToolCall, AppInfo, FileUpdate } from '@gen-fullstack/shared';
import { PresentationToggle } from './presentation';
import { focus, transitions, typography } from '../lib/design-tokens';

export interface SessionTabNavigationProps {
  sessionId: string | undefined;
  activeTab: 'timeline' | 'files' | 'preview' | 'pipeline';
  messages: LLMMessage[];
  toolCalls: ToolCall[];
  files: FileUpdate[];
  appStatus: AppInfo | null;
  isGenerating: boolean;
  isReplayMode: boolean;
  onEnterReplayMode: () => void;
  onExitReplayMode: () => void;
}

/**
 * SessionTabNavigation - Tab bar with replay and presentation mode controls
 *
 * Extracted from SessionPage to reduce complexity.
 * Handles tab navigation and mode toggles.
 */
export function SessionTabNavigation({
  sessionId,
  activeTab,
  messages,
  toolCalls,
  files,
  appStatus,
  isGenerating,
  isReplayMode,
  onEnterReplayMode,
  onExitReplayMode,
}: SessionTabNavigationProps) {
  const navigate = useNavigate();

  return (
    <div className="border-b">
      <div className="flex items-center justify-between px-4">
        {/* Tabs */}
        <div className="flex">
          <button
            type="button"
            className={`border-b-2 px-3 py-2 ${typography.label} ${transitions.colors} ${focus.ring} ${
              activeTab === 'timeline'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => navigate(`/${sessionId}`)}
          >
            Timeline{' '}
            {messages.length + toolCalls.length > 0 && `(${messages.length + toolCalls.length})`}
          </button>
          <button
            type="button"
            className={`border-b-2 px-3 py-2 ${typography.label} ${transitions.colors} ${focus.ring} ${
              activeTab === 'files'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => navigate(`/${sessionId}/files`)}
          >
            Files {files.length > 0 && `(${files.length})`}
          </button>
          <button
            type="button"
            className={`border-b-2 px-3 py-2 ${typography.label} ${transitions.colors} ${focus.ring} ${
              activeTab === 'preview'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => navigate(`/${sessionId}/preview`)}
          >
            Preview{' '}
            {appStatus?.status && appStatus.status !== 'stopped' && (
              <span className="ml-1 text-xs">({appStatus.status})</span>
            )}
          </button>
          <button
            type="button"
            className={`border-b-2 px-3 py-2 ${typography.label} ${transitions.colors} ${focus.ring} ${
              activeTab === 'pipeline'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => navigate(`/${sessionId}/pipeline`)}
          >
            Pipeline
          </button>
        </div>

        {/* Replay Mode & Presentation Mode Toggles */}
        <div className="flex items-center gap-2">
          {activeTab === 'timeline' && !isGenerating && !isReplayMode && (
            <button
              type="button"
              onClick={onEnterReplayMode}
              className="rounded border border-border bg-card px-3 py-1 text-sm font-medium text-foreground hover:bg-muted"
            >
              Replay Mode
            </button>
          )}

          {isReplayMode && (
            <>
              <span className="rounded bg-purple-100 px-2 py-1 text-xs font-medium text-purple-800">
                REPLAY MODE
              </span>
              <button
                type="button"
                onClick={onExitReplayMode}
                className="rounded border border-border bg-card px-3 py-1 text-sm font-medium text-foreground hover:bg-muted"
              >
                Exit Replay
              </button>
            </>
          )}

          {/* Presentation Mode Toggle - Available on all tabs (hidden during generation) */}
          {!isGenerating && <PresentationToggle />}
        </div>
      </div>
    </div>
  );
}
