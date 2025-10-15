import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { AppControls } from '../components/AppControls';
import { AppPreview } from '../components/AppPreview';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { FileTree } from '../components/FileTree';
import { FileViewer } from '../components/FileViewer';
import { LogViewer } from '../components/LogViewer';
import { PromptInput } from '../components/PromptInput';
import { StrategySelector } from '../components/StrategySelector';
import { Timeline } from '../components/Timeline';
import { useWebSocket } from '../hooks/useWebSocket';
import { focus, padding, spacing, transitions, typography } from '../lib/design-tokens';

/**
 * HomePage - Start new generation
 *
 * This page allows users to start a new generation. When a session is created,
 * it automatically navigates to the SessionPage (/:sessionId) to view the persisted session.
 */
function HomePage() {
  const navigate = useNavigate();
  const {
    isConnected,
    messages,
    startGeneration,
    isGenerating,
    toolCalls,
    toolResults,
    files,
    currentSessionId,
    appStatus,
    appLogs,
    startApp,
    stopApp,
    restartApp,
  } = useWebSocket();
  const [strategy, setStrategy] = useState('naive');
  const [activeTab, setActiveTab] = useState<'timeline' | 'files' | 'app'>('timeline');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  // Navigate to session page when a session is created
  useEffect(() => {
    if (currentSessionId) {
      navigate(`/${currentSessionId}`);
    }
  }, [currentSessionId, navigate]);

  const handleGenerate = (prompt: string) => {
    startGeneration(prompt, strategy);
  };

  return (
    <div className="grid h-screen grid-rows-[auto_1fr] bg-white">
      {/* Header */}
      <header className={`border-b ${padding.page}`}>
        <div className="flex items-center justify-between">
          <h1 className={`${typography.label} text-lg text-gray-900`}>Gen Fullstack</h1>
          <div className="flex items-center gap-1.5">
            <div
              className={`h-1.5 w-1.5 rounded-full ${isConnected ? 'bg-gray-900' : 'bg-gray-300'}`}
            />
            <span className={typography.caption}>{isConnected ? 'connected' : 'disconnected'}</span>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="grid grid-cols-[320px_1fr] overflow-hidden">
        {/* Left panel - Controls */}
        <div className={`border-r ${padding.panel} overflow-y-auto`}>
          <div className={spacing.controls}>
            <div>
              <h2 className={`mb-3 ${typography.header}`}>Strategy</h2>
              <StrategySelector value={strategy} onChange={setStrategy} disabled={isGenerating} />
            </div>

            <div>
              <h3 className={`mb-3 ${typography.header}`}>Prompt</h3>
              <PromptInput onSubmit={handleGenerate} disabled={isGenerating || !isConnected} />
            </div>

            <div className="pt-4 border-t">
              <AppControls
                currentSessionId={currentSessionId}
                appStatus={appStatus}
                isGenerating={isGenerating}
                onStart={startApp}
                onStop={stopApp}
                onRestart={restartApp}
              />
            </div>
          </div>
        </div>

        {/* Right panel - Messages & Tools */}
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

export default HomePage;
