import {
  data,
  isRouteErrorResponse,
  Link,
  type LoaderFunctionArgs,
  useLoaderData,
  useParams,
  useRouteError,
} from 'react-router';
import { SessionHeader } from '../components/SessionHeader';
import { SessionSidebar } from '../components/SessionSidebar';
import { SessionTabContent } from '../components/SessionTabContent';
import { SessionTabNavigation } from '../components/SessionTabNavigation';
import { useToast } from '../components/ToastProvider';
// Presentation Mode - Single import point (can be removed to disable presentation features)
import {
  PresentationMode,
  usePresentationMode,
  usePresentationPlayback,
  usePresentationStore,
} from '../components/presentation';
import { useAppExecutionHandlers } from '../hooks/useAppExecutionHandlers';
import { useReplayModeHandlers } from '../hooks/useReplayModeHandlers';
import { useSessionDataLayer } from '../hooks/useSessionDataLayer';
import { useSessionLifecycle } from '../hooks/useSessionLifecycle';
import { usePresentationQueue } from '../hooks/usePresentationQueue';
import { env } from '../lib/env';

/**
 * Session data structure from the API
 */
export interface SessionData {
  session: {
    id: string;
    prompt: string;
    model?: string; // Model used for generation (e.g., 'gpt-5-mini', 'claude-sonnet-4-5')
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
    const response = await fetch(`${env.VITE_API_URL}/api/sessions/${sessionId}`);

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
 * SessionPage - View persisted session
 *
 * Displays a view of a persisted session with its timeline and files.
 * If the session is still active (status === 'generating'), it connects to WebSocket
 * for real-time updates and merges them with the persisted data.
 *
 * Refactored to use focused hooks and components:
 * - useSessionDataLayer: WebSocket + persisted data + replay mode
 * - useSessionLifecycle: Store preparation, replay cleanup, revalidation
 * - useReplayModeHandlers: Enter/exit replay with validation
 * - useAppExecutionHandlers: Start/stop/navigate callbacks
 * - SessionTabNavigation: Tab bar component
 * - SessionTabContent: Content rendering component
 */
function SessionPage() {
  const { sessionId, tab } = useParams<{ sessionId: string; tab?: string }>();
  const sessionData = useLoaderData() as SessionData;
  const { showToast } = useToast();
  const activeTab = getActiveTab(tab);

  // Enable presentation mode keyboard shortcuts
  usePresentationMode();

  // Data layer: WebSocket, persisted data, replay mode
  const {
    messages,
    toolCalls,
    toolResults,
    pipelineStages,
    files,
    persistedData,
    socket,
    isConnected,
    isSubscribed,
    isActiveSession,
    isOwnSession,
    isReplayMode,
    appStatus,
    appLogs,
    startApp,
    stopApp,
    saveFile,
  } = useSessionDataLayer(sessionId, sessionData);

  // Session lifecycle management
  useSessionLifecycle(sessionId, socket, isSubscribed, isConnected, isActiveSession, showToast);

  // Replay mode handlers
  const { handleEnterReplayMode, handleExitReplayMode } = useReplayModeHandlers(
    sessionId,
    sessionData.session.status,
    showToast,
  );

  // App execution handlers
  const { handleStartApp, handleStopApp, handleStartClick } = useAppExecutionHandlers(
    sessionId,
    startApp,
    stopApp,
  );

  // Parse capability config for presentation mode
  const capabilityConfig = parseCapabilityConfig(sessionData.session.capabilityConfig);

  // Load presentation queue when entering presentation mode
  const isEnabled = usePresentationStore((state) => state.isEnabled);
  // IMPORTANT: Use persistedData directly for presentation mode (needs full session data)
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
          <SessionTabNavigation
            sessionId={sessionId}
            activeTab={activeTab}
            messages={messages}
            toolCalls={toolCalls}
            files={files}
            appStatus={appStatus}
            isGenerating={isActiveSession}
            isReplayMode={isReplayMode}
            onEnterReplayMode={handleEnterReplayMode}
            onExitReplayMode={handleExitReplayMode}
          />

          <SessionTabContent
            activeTab={activeTab}
            sessionId={sessionId}
            messages={messages}
            toolCalls={toolCalls}
            toolResults={toolResults}
            pipelineStages={pipelineStages}
            files={files}
            isGenerating={isActiveSession}
            isReplayMode={isReplayMode}
            appStatus={appStatus}
            appLogs={appLogs}
            onSaveFile={saveFile}
          />
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
