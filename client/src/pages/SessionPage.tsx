import { useEffect, useRef } from 'react';
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
import { SessionHeader } from '../components/SessionHeader';
import { SessionSidebar } from '../components/SessionSidebar';
import { Timeline } from '../components/Timeline';
import { useToast } from '../components/ToastProvider';
import { useSessionData } from '../hooks/useSessionData';
import { useWebSocket } from '../hooks/useWebSocket';
import { focus, padding, spacing, transitions, typography } from '../lib/design-tokens';
import { useAppStore, useGenerationStore } from '../stores';

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
    type: 'message' | 'tool_call' | 'tool_result';
    // Message fields
    messageId?: string;
    role?: 'user' | 'assistant' | 'system';
    content?: string;
    // Tool call fields
    toolCallId?: string;
    toolName?: string;
    toolArgs?: string;
    // Tool result fields
    toolResultId?: string;
    toolResultFor?: string;
    result?: string;
    isError?: boolean;
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
 * SessionPage - View persisted session
 *
 * Displays a readonly view of a persisted session with its timeline and files.
 * If the session is still active (status === 'generating'), it connects to WebSocket
 * for real-time updates and merges them with the persisted data.
 */
function SessionPage() {
  const { sessionId, tab } = useParams<{ sessionId: string; tab?: string }>();
  const navigate = useNavigate();
  const sessionData = useLoaderData() as SessionData;
  const { showToast } = useToast();
  const {
    socket,
    isConnected,
    isGenerating: isGeneratingWebSocket,
    messages: liveMessages,
    toolCalls: liveToolCalls,
    toolResults: liveToolResults,
    files: liveFiles,
    appStatus,
    appLogs,
    startApp,
    stopApp,
    saveFile,
  } = useWebSocket();

  const previewContainerRef = useRef<HTMLDivElement>(null);
  const hasSubscribedRef = useRef(false);
  const previouslyConnectedRef = useRef(false);

  // Derive active tab from URL, default to 'timeline'
  const validTabs = ['timeline', 'files', 'preview'] as const;
  type ValidTab = (typeof validTabs)[number];

  function isValidTab(value: string | undefined): value is ValidTab {
    return validTabs.includes(value as ValidTab);
  }

  const activeTab: ValidTab = isValidTab(tab) ? tab : 'timeline';

  // Scroll to top when switching to preview tab
  useEffect(() => {
    if (activeTab === 'preview' && previewContainerRef.current) {
      previewContainerRef.current.scrollTop = 0;
    }
  }, [activeTab]);

  // Determine if session is actively generating:
  // - If socket is connected: use real-time WebSocket state (isGeneratingWebSocket)
  // - If socket is disconnected: fall back to database status from loader
  // This ensures the "Generating..." indicator updates immediately when generation completes
  const isActiveSession = socket
    ? isGeneratingWebSocket
    : sessionData.session.status === 'generating';
  // With room-based architecture, any connected client can receive live updates
  // isOwnSession is true if connected and viewing an active session
  const isOwnSession = socket !== null && isActiveSession;

  // Use custom hook to handle data merging
  const { messages, toolCalls, toolResults, files } = useSessionData({
    timeline: sessionData.timeline,
    persistedFiles: sessionData.files,
    liveMessages,
    liveToolCalls,
    liveToolResults,
    liveFiles,
    isActiveSession,
    isOwnSession,
  });

  // Subscribe to session room and request app status when page loads or socket reconnects
  // Use ref to prevent duplicate subscriptions in React Strict Mode (development)
  useEffect(() => {
    if (!socket || !sessionId) return;

    const subscribeToSession = () => {
      if (!hasSubscribedRef.current) {
        hasSubscribedRef.current = true;
        // Subscribe to this session's room for real-time updates
        socket.emit('subscribe_to_session', { sessionId });
        // Request current app status
        socket.emit('get_app_status', { sessionId });
      }
    };

    // Subscribe on mount if socket is already connected
    if (socket.connected) {
      subscribeToSession();
    }

    // Resubscribe on reconnection
    const handleReconnect = () => {
      hasSubscribedRef.current = false; // Reset flag to allow resubscription
      subscribeToSession();
    };

    // Handle disconnection (reset ref so we can resubscribe on reconnect)
    const handleDisconnect = () => {
      hasSubscribedRef.current = false;
    };

    socket.on('connect', handleReconnect);
    socket.on('disconnect', handleDisconnect);

    // Reset subscription flag when sessionId changes or component unmounts
    return () => {
      socket.off('connect', handleReconnect);
      socket.off('disconnect', handleDisconnect);
      hasSubscribedRef.current = false;
    };
  }, [socket, sessionId]);

  // Show toast notification when connection is lost during an active session
  useEffect(() => {
    // Track connection state and show toast only when transitioning from connected to disconnected
    if (previouslyConnectedRef.current && !isConnected && isActiveSession) {
      showToast('Connection lost', 'Attempting to reconnect...', 'warning');
    }
    previouslyConnectedRef.current = isConnected;
  }, [isConnected, isActiveSession, showToast]);

  // Cleanup stores when sessionId changes to prevent memory leaks
  // This ensures each session has fresh state without accumulating data from previous sessions
  // biome-ignore lint/correctness/useExhaustiveDependencies: sessionId is intentionally included to reset stores when navigating between sessions
  useEffect(() => {
    return () => {
      // Reset generation store to clear messages, tool calls, files
      useGenerationStore.getState().reset();
      // Reset app store to clear logs and build events
      useAppStore.getState().reset();
    };
  }, [sessionId]); // Reset when session changes

  return (
    <div className="grid h-screen grid-rows-[auto_1fr] bg-white">
      <SessionHeader
        sessionId={sessionId}
        status={sessionData.session.status}
        isOwnSession={isOwnSession}
      />

      {/* Main content */}
      <main className="grid grid-cols-[320px_1fr] overflow-hidden">
        <SessionSidebar
          sessionData={sessionData}
          sessionId={sessionId}
          appStatus={appStatus}
          isGenerating={isActiveSession}
          isConnected={isConnected}
          startApp={() => startApp(sessionId || '')}
          stopApp={() => stopApp(sessionId || '')}
          onStartClick={() => navigate(`/${sessionId}/preview`)}
        />

        {/* Right panel - Timeline & Files */}
        <div className="grid grid-rows-[auto_1fr] overflow-hidden">
          {/* Tabs */}
          <div className="border-b">
            <div className="flex px-4">
              <button
                type="button"
                className={`border-b-2 px-3 py-2 ${typography.label} ${transitions.colors} ${focus.ring} ${
                  activeTab === 'timeline'
                    ? 'border-gray-900 text-gray-900'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
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
                    ? 'border-gray-900 text-gray-900'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => navigate(`/${sessionId}/files`)}
              >
                Files {files.length > 0 && `(${files.length})`}
              </button>
              <button
                type="button"
                className={`border-b-2 px-3 py-2 ${typography.label} ${transitions.colors} ${focus.ring} ${
                  activeTab === 'preview'
                    ? 'border-gray-900 text-gray-900'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => navigate(`/${sessionId}/preview`)}
              >
                Preview{' '}
                {appStatus?.status && appStatus.status !== 'stopped' && (
                  <span className="ml-1 text-xs">({appStatus.status})</span>
                )}
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="overflow-hidden">
            {activeTab === 'timeline' ? (
              <div className={`h-full overflow-y-auto ${padding.panel}`}>
                <ErrorBoundaryComponent>
                  <Timeline
                    messages={messages}
                    toolCalls={toolCalls}
                    toolResults={toolResults}
                    isGenerating={isActiveSession}
                  />
                </ErrorBoundaryComponent>
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
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="mb-4 text-4xl font-bold text-gray-900">
            {error.status} {error.statusText}
          </h1>
          <p className="mb-8 text-gray-600">{error.data || 'An error occurred'}</p>
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

  // Handle JavaScript Error instances (network errors, etc.)
  if (error instanceof Error) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="max-w-2xl text-center">
          <h1 className="mb-4 text-4xl font-bold text-gray-900">Oops! Something went wrong</h1>
          <p className="mb-2 text-lg text-gray-700">{error.message}</p>
          <p className="mb-8 text-sm text-gray-500">
            {error.message.includes('fetch') || error.message.includes('Network')
              ? 'Unable to connect to the server. Please check your internet connection or try again later.'
              : 'An unexpected error occurred. Please try again.'}
          </p>
          <div className="flex justify-center gap-4">
            <Link
              to="/"
              className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
            >
              Go Home
            </Link>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
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
