import { useCallback, useEffect, useRef } from 'react';
import {
  data,
  isRouteErrorResponse,
  Link,
  type LoaderFunctionArgs,
  useLoaderData,
  useNavigate,
  useParams,
  useRouteError,
} from 'react-router';
import type { Socket } from 'socket.io-client';
import type { LLMMessage, PipelineStageEvent, ToolCall, ToolResult } from '@gen-fullstack/shared';
import { AppPreview } from '../components/AppPreview';
import { ErrorBoundary as ErrorBoundaryComponent } from '../components/ErrorBoundary';
import { FileWorkspace } from '../components/FileWorkspace';
import { LogViewer } from '../components/LogViewer';
import { ReplayControls } from '../components/ReplayControls';
import { SessionHeader } from '../components/SessionHeader';
import { SessionSidebar } from '../components/SessionSidebar';
import { Timeline } from '../components/Timeline';
import { TimelineScrubber } from '../components/TimelineScrubber';
import { useToast } from '../components/ToastProvider';
import { useSessionData } from '../hooks/useSessionData';
import { useSessionWebSocket } from '../hooks/useSessionWebSocket';
import { usePresentationQueue } from '../hooks/usePresentationQueue';
// Presentation Mode - Single import point (can be removed to disable presentation features)
import {
  PresentationMode,
  PresentationToggle,
  usePresentationMode,
  usePresentationPlayback,
  usePresentationStore,
} from '../components/presentation';
import { useSessionRevalidation } from '../hooks/useSessionRevalidation';
import { useWebSocket } from '../hooks/useWebSocket';
import { focus, padding, spacing, transitions, typography } from '../lib/design-tokens';
import { useAppStore, useGenerationStore } from '../stores';
import { useReplayStore } from '../stores/replay.store';
import { useReplayMode } from '../hooks/useReplayMode';

const SERVER_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Session data structure from the API
 */
interface SessionData {
  session: {
    id: string;
    prompt: string;
    strategy: string;
    capabilityConfig: string; // JSON string of CapabilityConfig
    status: 'generating' | 'completed' | 'failed';
    createdAt: Date;
    updatedAt?: Date;
    completedAt?: Date;
    errorMessage?: string;
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    cost?: string;
    durationMs?: number;
    stepCount?: number;
  };
  timeline: Array<{
    id: number;
    sessionId: string;
    timestamp: Date;
    type: 'message' | 'tool_call' | 'tool_result' | 'pipeline_stage';
    // Message fields
    messageId?: string;
    role?: 'user' | 'assistant' | 'system';
    content?: string;
    // Tool call fields
    toolCallId?: string;
    toolName?: string;
    toolArgs?: string;
    toolReason?: string;
    // Tool result fields
    toolResultId?: string;
    toolResultFor?: string;
    result?: string;
    isError?: boolean;
    // Pipeline stage fields
    stageId?: string;
    stageType?: 'planning' | 'validation' | 'template_loading' | 'completing';
    stageStatus?: 'started' | 'completed' | 'failed';
    stageData?: string; // JSON string
  }>;
  files: Array<{
    id: number;
    sessionId: string;
    path: string;
    content: string;
    createdAt: Date;
    updatedAt: Date;
  }>;
}

/**
 * Client-side loader for session data
 *
 * Fetches session, timeline, and files from the REST API
 */
export async function clientLoader({ params }: LoaderFunctionArgs) {
  const sessionId = params.sessionId as string;

  try {
    const response = await fetch(`${SERVER_URL}/api/sessions/${sessionId}`);

    if (!response.ok) {
      if (response.status === 404) {
        throw data('Session not found', { status: 404 });
      }
      throw data('Failed to load session', { status: response.status });
    }

    const sessionData: SessionData = await response.json();
    return sessionData;
  } catch (error) {
    // Handle network errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Unable to connect to the server. Please check your internet connection.');
    }
    // Re-throw data() errors
    throw error;
  }
}

/**
 * Helper: Determine active tab from URL parameter
 */
function getActiveTab(tab: string | undefined) {
  const validTabs = ['timeline', 'files', 'preview'] as const;
  type ValidTab = (typeof validTabs)[number];

  function isValidTab(value: string | undefined): value is ValidTab {
    return validTabs.includes(value as ValidTab);
  }

  return isValidTab(tab) ? tab : 'timeline';
}

/**
 * Helper: Show disconnection toast
 */
function useDisconnectionToast(
  isConnected: boolean,
  isActiveSession: boolean,
  showToast: ReturnType<typeof useToast>['showToast'],
) {
  const previouslyConnectedRef = useRef(false);

  useEffect(() => {
    if (previouslyConnectedRef.current && !isConnected && isActiveSession) {
      showToast('Connection lost', 'Attempting to reconnect...', 'warning');
    }
    previouslyConnectedRef.current = isConnected;
  }, [isConnected, isActiveSession, showToast]);
}

/**
 * Parse capability config from JSON string
 */
function parseCapabilityConfig(
  config: string | null,
): import('@gen-fullstack/shared').CapabilityConfig | undefined {
  if (!config) return undefined;

  try {
    return JSON.parse(config);
  } catch {
    return undefined;
  }
}

/**
 * Determine session connection and generation status
 */
function getSessionStatus(
  socket: Socket | null,
  isSubscribed: boolean,
  isGeneratingWebSocket: boolean,
  sessionStatus: 'generating' | 'completed' | 'failed',
) {
  const isActiveSession = socket ? isGeneratingWebSocket : sessionStatus === 'generating';
  const isConnectedToRoom = Boolean(socket?.connected && isSubscribed);
  const isOwnSession = socket !== null && isActiveSession;

  return { isActiveSession, isConnectedToRoom, isOwnSession };
}

/**
 * Select data source based on replay mode
 */
function selectDataSource<TFile>(
  isReplayMode: boolean,
  replayData: {
    messages: LLMMessage[];
    toolCalls: ToolCall[];
    toolResults: ToolResult[];
    pipelineStages: PipelineStageEvent[];
    files: TFile[];
  },
  persistedData: {
    messages: LLMMessage[];
    toolCalls: ToolCall[];
    toolResults: ToolResult[];
    pipelineStages: PipelineStageEvent[];
    files: TFile[];
  },
) {
  return {
    messages: isReplayMode ? replayData.messages : persistedData.messages,
    toolCalls: isReplayMode ? replayData.toolCalls : persistedData.toolCalls,
    toolResults: isReplayMode ? replayData.toolResults : persistedData.toolResults,
    pipelineStages: isReplayMode ? replayData.pipelineStages : persistedData.pipelineStages,
    files: isReplayMode ? replayData.files : persistedData.files,
  };
}

/**
 * SessionPage - View persisted session
 *
 * Displays a readonly view of a persisted session with its timeline and files.
 * If the session is still active (status === 'generating'), it connects to WebSocket
 * for real-time updates and merges them with the persisted data.
 *
 * NOTE: Complexity reduced from 27 to 17 through helper extraction. Remaining complexity
 * comes from React hooks orchestration (useEffect, useCallback) which cannot be further
 * simplified without breaking functionality or making code less readable.
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Page component orchestrates multiple React hooks and features (WebSocket, replay mode, data merging, presentation mode). Helper functions extracted for reusable logic; remaining complexity is inherent to component coordination.
function SessionPage() {
  const { sessionId, tab } = useParams<{ sessionId: string; tab?: string }>();
  const navigate = useNavigate();
  const sessionData = useLoaderData() as SessionData;
  const { showToast } = useToast();

  // Enable presentation mode keyboard shortcuts (Escape to close)
  usePresentationMode();

  const {
    socket,
    isConnected,
    isGenerating: isGeneratingWebSocket,
    messages: liveMessages,
    toolCalls: liveToolCalls,
    toolResults: liveToolResults,
    pipelineStages: livePipelineStages,
    files: liveFiles,
    appStatus,
    appLogs,
    startApp,
    stopApp,
    saveFile,
  } = useWebSocket();

  const { exitReplayMode, enterReplayMode: enterReplay } = useReplayStore();

  const previewContainerRef = useRef<HTMLDivElement>(null);

  const activeTab = getActiveTab(tab);

  // Handlers for replay mode
  const handleEnterReplayMode = useCallback(async () => {
    if (!sessionId) return;

    // Only allow replay for completed or failed sessions
    if (sessionData.session.status === 'generating') {
      showToast('Cannot replay', 'Cannot replay session that is still generating', 'error');
      return;
    }

    try {
      const response = await fetch(`${SERVER_URL}/api/sessions/${sessionId}/replay-data`);

      if (!response.ok) {
        throw new Error(`Failed to load replay data: ${response.statusText}`);
      }

      const data = await response.json();
      enterReplay(sessionId, data);
    } catch (_error) {
      showToast('Error', 'Failed to load replay data', 'error');
    }
  }, [sessionId, sessionData.session.status, enterReplay, showToast]);

  const handleExitReplayMode = useCallback(() => {
    exitReplayMode();
  }, [exitReplayMode]);

  // Use replay mode hook for playback logic and filtered data
  const { isReplayMode, replayData } = useReplayMode();

  // Scroll to top when switching to preview tab
  useEffect(() => {
    const container = previewContainerRef.current;
    if (activeTab === 'preview' && container) {
      container.scrollTop = 0;
    }
  }, [activeTab]);

  // Subscribe to session WebSocket events and get subscription status
  const isSubscribed = useSessionWebSocket(socket, sessionId);

  // Determine session connection and generation status
  const { isActiveSession, isConnectedToRoom, isOwnSession } = getSessionStatus(
    socket,
    isSubscribed,
    isGeneratingWebSocket,
    sessionData.session.status,
  );

  // Use custom hook to handle data merging (unless in replay mode)
  const persistedData = useSessionData({
    timeline: sessionData.timeline,
    persistedFiles: sessionData.files,
    liveMessages,
    liveToolCalls,
    liveToolResults,
    livePipelineStages,
    liveFiles,
    isActiveSession,
    isConnectedToRoom,
  });

  // Select data source based on replay mode
  const { messages, toolCalls, toolResults, pipelineStages, files } = selectDataSource(
    isReplayMode,
    replayData,
    persistedData,
  );

  // Parse capabilityConfig for presentation mode
  const capabilityConfig = parseCapabilityConfig(sessionData.session.capabilityConfig);

  // Load presentation queue when entering presentation mode
  const isEnabled = usePresentationStore((state) => state.isEnabled);
  // IMPORTANT: Use persistedData directly, not the derived messages/toolCalls/pipelineStages
  // The derived variables use replayData when in replay mode, but presentation mode
  // needs the FULL session data regardless of replay state
  usePresentationQueue(
    isEnabled,
    persistedData.messages,
    persistedData.toolCalls,
    persistedData.pipelineStages,
    capabilityConfig,
    sessionData.session.durationMs,
  );

  // Handle presentation playback (auto-advance through overlays)
  usePresentationPlayback();

  useDisconnectionToast(isConnected, isActiveSession, showToast);

  // Revalidate loader data when generation completes
  // Only for sessions we're actively subscribed to (not just viewing read-only)
  const isSubscribedSession = socket !== null && isSubscribed;
  useSessionRevalidation(socket, sessionId, isSubscribedSession);

  // Prepare stores for this session (cleanup if switching sessions)
  useEffect(() => {
    if (!sessionId) return;

    useGenerationStore.getState().prepareForSession(sessionId);
    useAppStore.getState().prepareForSession(sessionId);
  }, [sessionId]);

  // Exit replay mode if viewing a different session
  useEffect(() => {
    const replayState = useReplayStore.getState();
    const isDifferentSession = replayState.isReplayMode && replayState.sessionId !== sessionId;
    if (isDifferentSession) {
      exitReplayMode();
    }
  }, [sessionId, exitReplayMode]);

  // Memoized callbacks for SessionSidebar
  const handleStartApp = useCallback(() => {
    if (!sessionId) return;
    startApp(sessionId);
  }, [sessionId, startApp]);

  const handleStopApp = useCallback(() => {
    if (!sessionId) return;
    stopApp(sessionId);
  }, [sessionId, stopApp]);

  const handleStartClick = useCallback(() => {
    if (!sessionId) return;
    navigate(`/${sessionId}/preview`);
  }, [sessionId, navigate]);

  return (
    <div className="grid h-screen grid-rows-[auto_1fr] bg-background">
      <SessionHeader sessionId={sessionId} />

      {/* Main content */}
      <main className="grid grid-cols-[320px_1fr] overflow-hidden">
        <SessionSidebar
          sessionData={sessionData}
          sessionId={sessionId}
          appStatus={appStatus}
          isGenerating={isActiveSession}
          isConnected={isConnected}
          isOwnSession={isOwnSession}
          startApp={handleStartApp}
          stopApp={handleStopApp}
          onStartClick={handleStartClick}
        />

        {/* Right panel - Timeline & Files */}
        <div className="grid grid-rows-[auto_1fr] overflow-hidden">
          {/* Tabs */}
          <div className="border-b">
            <div className="flex items-center justify-between px-4">
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
                  {messages.length + toolCalls.length > 0 &&
                    `(${messages.length + toolCalls.length})`}
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
              </div>

              {/* Replay Mode & Presentation Mode Toggles */}
              <div className="flex items-center gap-2">
                {activeTab === 'timeline' &&
                  sessionData.session.status !== 'generating' &&
                  !isReplayMode && (
                    <button
                      type="button"
                      onClick={handleEnterReplayMode}
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
                      onClick={handleExitReplayMode}
                      className="rounded border border-border bg-card px-3 py-1 text-sm font-medium text-foreground hover:bg-muted"
                    >
                      Exit Replay
                    </button>
                  </>
                )}

                {/* Presentation Mode Toggle - Available on all tabs (hidden during generation) */}
                {sessionData.session.status !== 'generating' && <PresentationToggle />}
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="overflow-hidden">
            {activeTab === 'timeline' ? (
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
                      isGenerating={isActiveSession}
                    />
                  </ErrorBoundaryComponent>
                </div>
              </div>
            ) : activeTab === 'files' ? (
              <div className="h-full">
                <FileWorkspace
                  files={files}
                  onSaveFile={(path, content) => {
                    if (sessionId) {
                      saveFile(sessionId, path, content);
                    }
                  }}
                />
              </div>
            ) : activeTab === 'preview' ? (
              <div ref={previewContainerRef} className={`h-full overflow-y-auto ${padding.panel}`}>
                <AppPreview appStatus={appStatus} />
                <div className={spacing.componentGap}>
                  <LogViewer logs={appLogs} />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </main>

      {/* Presentation Mode Overlay */}
      <PresentationMode />
    </div>
  );
}

/**
 * ErrorBoundary for SessionPage
 *
 * Handles errors from the clientLoader (network errors, 404s, etc.)
 * and displays user-friendly error messages.
 */
export function ErrorBoundary() {
  const error = useRouteError();

  // Handle HTTP Response errors (404, 500, etc.)
  if (isRouteErrorResponse(error)) {
    return (
      <div className="flex h-screen items-center justify-center bg-muted">
        <div className="text-center">
          <h1 className="mb-4 text-4xl font-bold text-foreground">
            {error.status} {error.statusText}
          </h1>
          <p className="mb-8 text-muted-foreground">{error.data || 'An error occurred'}</p>
          <Link
            to="/"
            className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  // Handle JavaScript Error instances (network errors, etc.)
  if (error instanceof Error) {
    return (
      <div className="flex h-screen items-center justify-center bg-muted">
        <div className="max-w-2xl text-center">
          <h1 className="mb-4 text-4xl font-bold text-foreground">Oops! Something went wrong</h1>
          <p className="mb-2 text-lg text-foreground">{error.message}</p>
          <p className="mb-8 text-sm text-muted-foreground">
            {error.message.includes('fetch') || error.message.includes('Network')
              ? 'Unable to connect to the server. Please check your internet connection or try again later.'
              : 'An unexpected error occurred. Please try again.'}
          </p>
          <div className="flex justify-center gap-4">
            <Link
              to="/"
              className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Go Home
            </Link>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Handle unknown errors
  return (
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold text-gray-900">Unknown Error</h1>
        <p className="mb-8 text-gray-600">An unexpected error occurred</p>
        <Link
          to="/"
          className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}

export default SessionPage;
