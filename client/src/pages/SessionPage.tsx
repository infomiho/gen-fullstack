import type { FileUpdate, LLMMessage, ToolCall, ToolResult } from '@gen-fullstack/shared';
import { useEffect, useState } from 'react';
import { useLoaderData, useParams } from 'react-router';
import { AppControls } from '../components/AppControls';
import { AppPreview } from '../components/AppPreview';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { FileTree } from '../components/FileTree';
import { FileViewer } from '../components/FileViewer';
import { LogViewer } from '../components/LogViewer';
import { StrategySelector } from '../components/StrategySelector';
import { Timeline } from '../components/Timeline';
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
export async function clientLoader({ params }: any) {
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
 * SessionPage - View persisted session
 *
 * Displays a readonly view of a persisted session with its timeline and files.
 * If the session is still active (status === 'generating'), it connects to WebSocket
 * for real-time updates and merges them with the persisted data.
 */
function SessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const sessionData = useLoaderData() as SessionData;
  const {
    isConnected,
    messages: liveMessages,
    toolCalls: liveToolCalls,
    toolResults: liveToolResults,
    files: liveFiles,
    appStatus,
    appLogs,
    startApp,
    stopApp,
    restartApp,
  } = useWebSocket();

  const [activeTab, setActiveTab] = useState<'timeline' | 'files' | 'app'>('timeline');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  const isActiveSession = sessionData.session.status === 'generating';

  // Convert persisted timeline items to client types
  const persistedMessages: LLMMessage[] = sessionData.timeline
    .filter((item) => item.type === 'message')
    .map((item) => ({
      id: `persisted-${item.id}`,
      role: item.role!,
      content: item.content || '',
      timestamp: new Date(item.timestamp).getTime(),
    }));

  const persistedToolCalls: ToolCall[] = sessionData.timeline
    .filter((item) => item.type === 'tool_call')
    .map((item) => ({
      id: item.toolCallId!,
      name: item.toolName!,
      args: item.toolArgs ? JSON.parse(item.toolArgs) : {},
      timestamp: new Date(item.timestamp).getTime(),
    }));

  const persistedToolResults: ToolResult[] = sessionData.timeline
    .filter((item) => item.type === 'tool_result')
    .map((item) => ({
      id: item.toolResultId!,
      toolName: item.toolName || '',
      result: item.result || '',
      timestamp: new Date(item.timestamp).getTime(),
    }));

  const persistedFiles: FileUpdate[] = sessionData.files.map((file) => ({
    path: file.path,
    content: file.content,
  }));

  // Merge persisted and live data with deduplication
  // For active sessions: concatenate and deduplicate by ID, sorted by timestamp
  // For completed sessions: use only persisted data
  const messages = isActiveSession
    ? Array.from(
        new Map([...persistedMessages, ...liveMessages].map((msg) => [msg.id, msg])).values(),
      ).sort((a, b) => a.timestamp - b.timestamp)
    : persistedMessages;

  const toolCalls = isActiveSession
    ? Array.from(
        new Map([...persistedToolCalls, ...liveToolCalls].map((call) => [call.id, call])).values(),
      ).sort((a, b) => a.timestamp - b.timestamp)
    : persistedToolCalls;

  const toolResults = isActiveSession
    ? Array.from(
        new Map(
          [...persistedToolResults, ...liveToolResults].map((result) => [result.id, result]),
        ).values(),
      ).sort((a, b) => a.timestamp - b.timestamp)
    : persistedToolResults;

  const files = isActiveSession
    ? Array.from(
        new Map([...persistedFiles, ...liveFiles].map((file) => [file.path, file])).values(),
      )
    : persistedFiles;

  // Show readonly prompt in input box
  useEffect(() => {
    // This is a readonly view, so we don't need to do anything special
    // The PromptInput component will be replaced with a readonly display
  }, []);

  return (
    <div className="grid h-screen grid-rows-[auto_1fr] bg-white">
      {/* Header */}
      <header className={`border-b ${padding.page}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className={`${typography.label} text-lg text-gray-900`}>Gen Fullstack</h1>
            <span className={typography.caption}>Session: {sessionId}</span>
          </div>
          <div className="flex items-center gap-3">
            <div
              className={`px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1.5 ${
                sessionData.session.status === 'completed'
                  ? 'bg-gray-100 text-gray-700'
                  : sessionData.session.status === 'generating'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-red-100 text-red-700'
              }`}
            >
              {sessionData.session.status === 'generating' && isConnected && (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
                </span>
              )}
              {sessionData.session.status === 'generating' && isConnected
                ? 'Live'
                : sessionData.session.status}
            </div>
            <div className="flex items-center gap-1.5">
              <div
                className={`h-1.5 w-1.5 rounded-full ${isConnected ? 'bg-gray-900' : 'bg-gray-300'}`}
              />
              <span className={typography.caption}>
                {isConnected ? 'connected' : 'disconnected'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="grid grid-cols-[320px_1fr] overflow-hidden">
        {/* Left panel - Session Info (readonly) */}
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
              <h3 className={`mb-3 ${typography.header}`}>Prompt (readonly)</h3>
              <div className="p-3 bg-gray-50 border rounded-md">
                <p className={`${typography.body} text-gray-700 whitespace-pre-wrap`}>
                  {sessionData.session.prompt}
                </p>
              </div>
            </div>

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
                isGenerating={false}
                onStart={startApp}
                onStop={stopApp}
                onRestart={restartApp}
              />
            </div>
          </div>
        </div>

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
                onClick={() => setActiveTab('timeline')}
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
                onClick={() => setActiveTab('files')}
              >
                Files {files.length > 0 && `(${files.length})`}
              </button>
              <button
                type="button"
                className={`border-b-2 px-3 py-2 ${typography.label} ${transitions.colors} ${focus.ring} ${
                  activeTab === 'app'
                    ? 'border-gray-900 text-gray-900'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setActiveTab('app')}
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
              <div className={`h-full flex gap-4 ${padding.panel}`}>
                <div className="w-64 border-r pr-4 overflow-y-auto">
                  <FileTree
                    files={files}
                    selectedFile={selectedFile}
                    onSelectFile={setSelectedFile}
                  />
                </div>
                <div className="flex-1 overflow-hidden">
                  <FileViewer file={files.find((f) => f.path === selectedFile) || null} />
                </div>
              </div>
            ) : (
              <div className={`h-full overflow-y-auto ${padding.panel}`}>
                <div className={spacing.sections}>
                  <AppPreview appStatus={appStatus} />
                  <LogViewer logs={appLogs} />
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default SessionPage;
