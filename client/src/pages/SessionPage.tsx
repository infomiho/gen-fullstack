import { useEffect, useRef } from 'react';
import { Link, type LoaderFunctionArgs, useLoaderData, useNavigate, useParams } from 'react-router';
import { AppControls } from '../components/AppControls';
import { AppPreview } from '../components/AppPreview';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { FileWorkspace } from '../components/FileWorkspace';
import { LogViewer } from '../components/LogViewer';
import { StrategySelector } from '../components/StrategySelector';
import { Timeline } from '../components/Timeline';
import { useSessionData } from '../hooks/useSessionData';
import { useWebSocket } from '../hooks/useWebSocket';
import { focus, padding, spacing, transitions, typography } from '../lib/design-tokens';

const SERVER_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Session data structure from the API
 */
interface SessionData {
  session: {
    id: string;
    prompt: string;
    strategy: string;
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
  const response = await fetch(`${SERVER_URL}/api/sessions/${sessionId}`);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Session not found');
    }
    throw new Error('Failed to load session');
  }

  const data: SessionData = await response.json();
  return data;
}

/**
 * Helper: SessionHeader component
 */
function SessionHeader({
  sessionId,
  status,
  isConnected,
  isOwnSession,
}: {
  sessionId: string | undefined;
  status: 'generating' | 'completed' | 'failed';
  isConnected: boolean;
  isOwnSession: boolean;
}) {
  const showLiveBadge = status === 'generating' && isConnected && isOwnSession;

  return (
    <header className={`border-b ${padding.page}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className={`${typography.label} text-lg text-gray-900 hover:text-gray-700 ${transitions.colors}`}
          >
            Gen Fullstack
          </Link>
          <span className={typography.caption}>Session: {sessionId}</span>
        </div>
        <div className="flex items-center gap-3">
          <div
            className={`px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1.5 ${
              status === 'completed'
                ? 'bg-gray-100 text-gray-700'
                : status === 'generating'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-red-100 text-red-700'
            }`}
          >
            {showLiveBadge && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
              </span>
            )}
            {showLiveBadge ? 'Live' : status}
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className={`h-1.5 w-1.5 rounded-full ${isConnected ? 'bg-gray-900' : 'bg-gray-300'}`}
            />
            <span className={typography.caption}>{isConnected ? 'connected' : 'disconnected'}</span>
          </div>
        </div>
      </div>
    </header>
  );
}

/**
 * Helper: SessionSidebar component
 */
function SessionSidebar({
  sessionData,
  sessionId,
  appStatus,
  isGenerating,
  isConnected,
  startApp,
  stopApp,
  onStartClick,
}: {
  sessionData: SessionData;
  sessionId: string | undefined;
  appStatus: ReturnType<typeof useWebSocket>['appStatus'];
  isGenerating: boolean;
  isConnected: boolean;
  startApp: () => void;
  stopApp: () => void;
  onStartClick?: () => void;
}) {
  return (
    <div className={`border-r ${padding.panel} overflow-y-auto`}>
      <div className={spacing.controls}>
        <div>
          <h2 className={`mb-3 ${typography.header}`}>Strategy</h2>
          <StrategySelector
            value={sessionData.session.strategy}
            onChange={() => {}}
            disabled={true}
          />
        </div>

        <div>
          <h3 className={`mb-3 ${typography.header}`}>Prompt</h3>
          <div className="p-3 bg-gray-50 border rounded-md">
            <p className={`${typography.body} text-gray-700 whitespace-pre-wrap`}>
              {sessionData.session.prompt}
            </p>
          </div>
        </div>

        {sessionData.session.status === 'generating' && !isConnected && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
            <p className={`${typography.caption} text-amber-700`}>
              This session is currently generating. You are disconnected - reconnect to see live
              updates, or refresh the page to see the latest persisted data.
            </p>
          </div>
        )}

        {sessionData.session.status === 'completed' && sessionData.session.totalTokens && (
          <div>
            <h3 className={`mb-2 ${typography.header}`}>Metrics</h3>
            <div className={`${typography.caption} space-y-1`}>
              <div className="flex justify-between">
                <span>Tokens:</span>
                <span className="font-mono">{sessionData.session.totalTokens}</span>
              </div>
              <div className="flex justify-between">
                <span>Cost:</span>
                <span className="font-mono">
                  ${Number.parseFloat(sessionData.session.cost || '0').toFixed(4)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Duration:</span>
                <span className="font-mono">
                  {((sessionData.session.durationMs || 0) / 1000).toFixed(1)}s
                </span>
              </div>
              <div className="flex justify-between">
                <span>Steps:</span>
                <span className="font-mono">{sessionData.session.stepCount}</span>
              </div>
            </div>
          </div>
        )}

        {sessionData.session.errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className={`${typography.caption} text-red-700`}>
              {sessionData.session.errorMessage}
            </p>
          </div>
        )}

        <div className="pt-4 border-t">
          <AppControls
            currentSessionId={sessionId || null}
            appStatus={appStatus}
            isGenerating={isGenerating}
            onStart={startApp}
            onStop={stopApp}
            onStartClick={onStartClick}
          />
        </div>
      </div>
    </div>
  );
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
  const {
    socket,
    isConnected,
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

  const isActiveSession = sessionData.session.status === 'generating';
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

  // Subscribe to session room and request app status when page loads
  useEffect(() => {
    if (socket && sessionId) {
      // Subscribe to this session's room for real-time updates
      socket.emit('subscribe_to_session', { sessionId });
      // Request current app status
      socket.emit('get_app_status', { sessionId });
    }
  }, [socket, sessionId]);

  return (
    <div className="grid h-screen grid-rows-[auto_1fr] bg-white">
      <SessionHeader
        sessionId={sessionId}
        status={sessionData.session.status}
        isConnected={isConnected}
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
                App Execution{' '}
                {appStatus?.status && appStatus.status !== 'idle' && (
                  <span className="ml-1 text-xs">({appStatus.status})</span>
                )}
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="overflow-hidden">
            {activeTab === 'timeline' ? (
              <div className={`h-full overflow-y-auto ${padding.panel}`}>
                <ErrorBoundary>
                  <Timeline messages={messages} toolCalls={toolCalls} toolResults={toolResults} />
                </ErrorBoundary>
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

export default SessionPage;
