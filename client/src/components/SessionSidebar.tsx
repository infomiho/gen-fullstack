import type { AppInfo } from '@gen-fullstack/shared';
import { Alert } from './Alert';
import { AppControls } from './AppControls';
import { typography } from '../lib/design-tokens';
import { CAPABILITY_METADATA } from '../lib/capability-metadata';

interface SessionData {
  session: {
    prompt: string;
    strategy: string;
    capabilityConfig: string; // JSON string of CapabilityConfig
    status: 'generating' | 'completed' | 'failed';
    totalTokens?: number;
    cost?: string;
    durationMs?: number;
    stepCount?: number;
    errorMessage?: string;
  };
}

interface SessionSidebarProps {
  sessionData: SessionData;
  sessionId: string | undefined;
  appStatus: AppInfo | null;
  isGenerating: boolean;
  isConnected: boolean;
  startApp: () => void;
  stopApp: () => void;
  onStartClick?: () => void;
}

/**
 * SessionSidebar component
 *
 * Displays the left sidebar for a session page with:
 * - Configuration display with color indicators
 * - Prompt display
 * - Disconnection warning (for active sessions)
 * - Completion metrics (tokens, cost, duration, steps)
 * - Error message (if any)
 * - App execution controls
 */
export function SessionSidebar({
  sessionData,
  sessionId,
  appStatus,
  isGenerating,
  isConnected,
  startApp,
  stopApp,
  onStartClick,
}: SessionSidebarProps) {
  // Parse capability config
  let capabilityConfig: {
    inputMode?: string;
    planning?: boolean;
    compilerChecks?: boolean;
    maxIterations?: number;
  } | null = null;
  try {
    capabilityConfig = JSON.parse(sessionData.session.capabilityConfig);
  } catch {
    // Ignore parse errors for legacy sessions
  }

  return (
    <div className="border-r border-gray-200 bg-white p-6 overflow-y-auto">
      <div className="space-y-6">
        {/* Capability Configuration */}
        {capabilityConfig && (
          <div>
            <h3 className={`${typography.sectionHeader} mb-3`}>Capabilities</h3>
            <div className="space-y-2">
              {/* Code Generation - always present */}
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <CAPABILITY_METADATA.codeGeneration.icon
                  className={`w-4 h-4 ${CAPABILITY_METADATA.codeGeneration.iconColor} flex-shrink-0`}
                />
                <span>{CAPABILITY_METADATA.codeGeneration.label}</span>
              </div>

              {capabilityConfig.planning && (
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <CAPABILITY_METADATA.planning.icon
                    className={`w-4 h-4 ${CAPABILITY_METADATA.planning.iconColor} flex-shrink-0`}
                  />
                  <span>{CAPABILITY_METADATA.planning.label}</span>
                </div>
              )}

              {capabilityConfig.inputMode === 'template' && (
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <CAPABILITY_METADATA.template.icon
                    className={`w-4 h-4 ${CAPABILITY_METADATA.template.iconColor} flex-shrink-0`}
                  />
                  <span>{CAPABILITY_METADATA.template.label}</span>
                </div>
              )}

              {capabilityConfig.compilerChecks && (
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <CAPABILITY_METADATA.compiler.icon
                    className={`w-4 h-4 ${CAPABILITY_METADATA.compiler.iconColor} flex-shrink-0`}
                  />
                  <span>{CAPABILITY_METADATA.compiler.label}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Prompt */}
        <div>
          <h3 className={`${typography.sectionHeader} mb-3`}>Prompt</h3>
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
              {sessionData.session.prompt}
            </p>
          </div>
        </div>

        {/* Warning for disconnected active sessions */}
        {sessionData.session.status === 'generating' && !isConnected && (
          <Alert variant="warning">
            This session is currently generating. You are disconnected - reconnect to see live
            updates, or refresh the page to see the latest persisted data.
          </Alert>
        )}

        {/* Metrics for completed sessions */}
        {sessionData.session.status === 'completed' && sessionData.session.totalTokens && (
          <div>
            <h3 className={`${typography.sectionHeader} mb-3`}>Metrics</h3>
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Tokens</span>
                <span className="font-mono text-gray-900 font-medium">
                  {sessionData.session.totalTokens.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Cost</span>
                <span className="font-mono text-gray-900 font-medium">
                  ${Number.parseFloat(sessionData.session.cost || '0').toFixed(4)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Duration</span>
                <span className="font-mono text-gray-900 font-medium">
                  {((sessionData.session.durationMs || 0) / 1000).toFixed(1)}s
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Steps</span>
                <span className="font-mono text-gray-900 font-medium">
                  {sessionData.session.stepCount}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Error message */}
        {sessionData.session.errorMessage && (
          <Alert variant="error">{sessionData.session.errorMessage}</Alert>
        )}

        {/* App execution controls */}
        <div className="pt-6 border-t border-gray-200">
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
