import { useState } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FileTree } from './components/FileTree';
import { FileViewer } from './components/FileViewer';
import { PromptInput } from './components/PromptInput';
import { StrategySelector } from './components/StrategySelector';
import { Timeline } from './components/Timeline';
import { useWebSocket } from './hooks/useWebSocket';

function App() {
  const { isConnected, messages, startGeneration, isGenerating, toolCalls, toolResults, files } =
    useWebSocket();
  const [strategy, setStrategy] = useState('naive');
  const [activeTab, setActiveTab] = useState<'timeline' | 'files'>('timeline');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  const handleGenerate = (prompt: string) => {
    startGeneration(prompt, strategy);
  };

  return (
    <div className="grid h-screen grid-rows-[auto_1fr] bg-white">
      {/* Header */}
      <header className="border-b px-6 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-medium text-gray-900">Gen Fullstack</h1>
          <div className="flex items-center gap-1.5">
            <div
              className={`h-1.5 w-1.5 rounded-full ${isConnected ? 'bg-gray-900' : 'bg-gray-300'}`}
            />
            <span className="text-xs text-gray-500">
              {isConnected ? 'connected' : 'disconnected'}
            </span>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="grid grid-cols-[320px_1fr] overflow-hidden">
        {/* Left panel - Controls */}
        <div className="border-r p-4 overflow-y-auto">
          <div className="space-y-4">
            <div>
              <h2 className="mb-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                Strategy
              </h2>
              <StrategySelector value={strategy} onChange={setStrategy} disabled={isGenerating} />
            </div>

            <div>
              <h3 className="mb-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                Prompt
              </h3>
              <PromptInput onSubmit={handleGenerate} disabled={isGenerating || !isConnected} />
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
                className={`border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
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
                className={`border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
                  activeTab === 'files'
                    ? 'border-gray-900 text-gray-900'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setActiveTab('files')}
              >
                Files {files.length > 0 && `(${files.length})`}
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="overflow-hidden">
            {activeTab === 'timeline' ? (
              <div className="h-full overflow-y-auto p-4">
                <ErrorBoundary>
                  <Timeline messages={messages} toolCalls={toolCalls} toolResults={toolResults} />
                </ErrorBoundary>
              </div>
            ) : (
              <div className="h-full flex gap-4 p-4">
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
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
