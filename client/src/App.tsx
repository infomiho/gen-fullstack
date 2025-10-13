import { useState } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import { PromptInput } from './components/PromptInput';
import { StrategySelector } from './components/StrategySelector';
import { MessageList } from './components/MessageList';
import { ToolCallDisplay } from './components/ToolCallDisplay';
import { ErrorBoundary } from './components/ErrorBoundary';

function App() {
  const { isConnected, messages, startGeneration, isGenerating, toolCalls, toolResults } =
    useWebSocket();
  const [strategy, setStrategy] = useState('naive');
  const [activeTab, setActiveTab] = useState<'messages' | 'tools'>('messages');

  const handleGenerate = (prompt: string) => {
    startGeneration(prompt, strategy);
  };

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Gen Fullstack Demo</h1>
          <div className="flex items-center gap-2">
            <div
              className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}
            />
            <span className="text-sm text-gray-600">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex flex-1 overflow-hidden">
        {/* Left panel - Controls */}
        <div className="w-96 border-r bg-white p-6">
          <div className="space-y-6">
            <div>
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Configuration</h2>
              <StrategySelector value={strategy} onChange={setStrategy} disabled={isGenerating} />
            </div>

            <div>
              <h3 className="mb-2 text-sm font-medium text-gray-700">Generate App</h3>
              <PromptInput onSubmit={handleGenerate} disabled={isGenerating || !isConnected} />
            </div>

            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <h3 className="mb-2 text-sm font-semibold text-blue-900">Quick Start</h3>
              <ul className="space-y-1 text-sm text-blue-700">
                <li>1. Select a generation strategy</li>
                <li>2. Enter your app description</li>
                <li>3. Watch the LLM generate your app</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Right panel - Messages & Tools */}
        <div className="flex flex-1 flex-col">
          {/* Tabs */}
          <div className="border-b bg-white">
            <div className="flex px-6">
              <button
                className={`border-b-2 px-4 py-3 font-semibold transition-colors ${
                  activeTab === 'messages'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
                onClick={() => setActiveTab('messages')}
              >
                Messages ({messages.length})
              </button>
              <button
                className={`border-b-2 px-4 py-3 font-semibold transition-colors ${
                  activeTab === 'tools'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
                onClick={() => setActiveTab('tools')}
              >
                Tool Calls ({toolCalls.length})
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === 'messages' ? (
              <MessageList messages={messages} />
            ) : (
              <ErrorBoundary>
                <ToolCallDisplay toolCalls={toolCalls} toolResults={toolResults} />
              </ErrorBoundary>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
