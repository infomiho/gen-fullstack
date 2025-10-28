import { useCallback, useEffect, useRef, useState } from 'react';
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
// Presentation Mode - Single import point (can be removed to disable presentation features)
import {
  PresentationMode,
  PresentationToggle,
  usePresentationMode,
  usePresentationPlayback,
  buildPresentationQueue,
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
 * Helper: Subscribe to session WebSocket events
 * Returns whether the subscription is active (as state to trigger re-renders)
 */
function useSessionSubscription(
  socket: ReturnType<typeof useWebSocket>['socket'],
  sessionId: string | undefined,
): boolean {
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    if (!socket || !sessionId) {
      setIsSubscribed(false);
      return;
    }

    const subscribeToSession = () => {
      setIsSubscribed(true);
      socket.emit('subscribe_to_session', { sessionId });
      socket.emit('get_app_status', { sessionId });
    };

    if (socket.connected) {
      subscribeToSession();
    }

    const handleReconnect = () => {
      subscribeToSession();
    };

    const handleDisconnect = () => {
      setIsSubscribed(false);
    };

    socket.on('connect', handleReconnect);
    socket.on('disconnect', handleDisconnect);

    return () => {
      socket.off('connect', handleReconnect);
      socket.off('disconnect', handleDisconnect);
      setIsSubscribed(false);
    };
  }, [socket, sessionId]);

  return isSubscribed;
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
 * SessionPage - View persisted session
 *
 * Displays a readonly view of a persisted session with its timeline and files.
 * If the session is still active (status === 'generating'), it connects to WebSocket
 * for real-time updates and merges them with the persisted data.
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Main page component handles multiple concerns (routing, data loading, replay mode)
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

  // Handler to enter replay mode
  const handleEnterReplayMode = async () => {
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
      // Error already shown to user via toast
    }
  };

  // Handler to exit replay mode
  const handleExitReplayMode = () => {
    exitReplayMode();
  };

  // Use replay mode hook for playback logic and filtered data
  const { isReplayMode, replayData } = useReplayMode();

  // Scroll to top when switching to preview tab
  useEffect(() => {
    if (activeTab === 'preview' && previewContainerRef.current) {
      previewContainerRef.current.scrollTop = 0;
    }
  }, [activeTab]);

  // Subscribe to session WebSocket events and get subscription status
  const isSubscribed = useSessionSubscription(socket, sessionId);

  // Determine if session is actively generating
  const isActiveSession = socket
    ? isGeneratingWebSocket
    : sessionData.session.status === 'generating';

  const isConnectedToRoom = Boolean(socket?.connected && isSubscribed);
  const isOwnSession = socket !== null && isActiveSession;

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

  // Use replay data if in replay mode, otherwise use persisted/live data
  const messages = isReplayMode ? replayData.messages : persistedData.messages;
  const toolCalls = isReplayMode ? replayData.toolCalls : persistedData.toolCalls;
  const toolResults = isReplayMode ? replayData.toolResults : persistedData.toolResults;
  const pipelineStages = isReplayMode ? replayData.pipelineStages : persistedData.pipelineStages;
  const files = isReplayMode ? replayData.files : persistedData.files;

  // Parse capabilityConfig for presentation mode
  let capabilityConfig: import('@gen-fullstack/shared').CapabilityConfig | undefined;
  try {
    capabilityConfig = sessionData.session.capabilityConfig
      ? JSON.parse(sessionData.session.capabilityConfig)
      : undefined;
  } catch {
    // Ignore parse errors, capabilityConfig will remain undefined
  }

  // Load presentation queue when entering presentation mode
  const isEnabled = usePresentationStore((state) => state.isEnabled);
  const previouslyEnabledRef = useRef(false);

  useEffect(() => {
    // Only build queue when first entering presentation mode
    if (isEnabled && !previouslyEnabledRef.current) {
      // IMPORTANT: Use persistedData directly, not the derived messages/toolCalls/toolResults
      // The derived variables use replayData when in replay mode, but presentation mode
      // needs the FULL session data regardless of replay state
      const queue = buildPresentationQueue(
        persistedData.messages,
        persistedData.toolCalls,
        persistedData.toolResults,
        capabilityConfig,
        sessionData.session.durationMs,
      );

      // Set the capability config for overlays to use
      usePresentationStore.getState().setCurrentConfig(capabilityConfig || null);
      usePresentationStore.getState().loadPresentationQueue(queue);
    }
    previouslyEnabledRef.current = isEnabled;
  }, [isEnabled, persistedData, capabilityConfig, sessionData.session.durationMs]);

  // Handle presentation playback (auto-advance through overlays)
  usePresentationPlayback();

  useDisconnectionToast(isConnected, isActiveSession, showToast);

  // Revalidate loader data when generation completes
  // Only for sessions we're actively subscribed to (not just viewing read-only)
  const isSubscribedSession = socket !== null && isSubscribed;
  useSessionRevalidation(socket, sessionId, isSubscribedSession);

  // Prepare stores for this session (cleanup if switching sessions)
  // This prevents memory leaks by resetting stores when navigating between different sessions
  // while avoiding React Strict Mode issues by only resetting on actual session changes
  useEffect(() => {
    if (sessionId) {
      useGenerationStore.getState().prepareForSession(sessionId);
      useAppStore.getState().prepareForSession(sessionId);
    }
  }, [sessionId]);

  // Exit replay mode if viewing a different session
  useEffect(() => {
    const replayState = useReplayStore.getState();
    if (replayState.isReplayMode && replayState.sessionId !== sessionId) {
      exitReplayMode();
    }
  }, [sessionId, exitReplayMode]);

  // Memoized callbacks for SessionSidebar to prevent unnecessary re-renders
  const handleStartApp = useCallback(() => {
    if (sessionId) {
      startApp(sessionId);
    }
  }, [sessionId, startApp]);

  const handleStopApp = useCallback(() => {
    if (sessionId) {
      stopApp(sessionId);
    }
  }, [sessionId, stopApp]);

  const handleStartClick = useCallback(() => {
    if (sessionId) {
      navigate(`/${sessionId}/preview`);
    }
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
