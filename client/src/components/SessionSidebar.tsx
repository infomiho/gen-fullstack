import type { AppInfo } from '@gen-fullstack/shared';
import { Alert } from './Alert';
import { AppControls } from './AppControls';
import { ConfigBadge } from './ConfigBadge';
import { ConfigValue } from './ConfigValue';
import { padding, spacing, typography } from '../lib/design-tokens';

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
    <div className={`border-r ${padding.panel} overflow-y-auto`}>
      <div className={spacing.controls}>
        {/* Capability Configuration */}
        {capabilityConfig && (
          <div>
            <h3 className={`mb-3 ${typography.header}`}>Configuration</h3>
            <div className="space-y-2">
              <ConfigValue
                label="Input Mode"
                value={capabilityConfig.inputMode === 'template' ? 'Template' : 'Naive'}
              />
              <ConfigBadge enabled={capabilityConfig.planning || false} label="Planning" />
              <ConfigBadge
                enabled={capabilityConfig.compilerChecks || false}
                label="Compiler Checks"
              />
            </div>
          </div>
        )}

        <div>
          <h3 className={`mb-3 ${typography.header}`}>Prompt</h3>
          <div className="p-3 bg-gray-50 border rounded-md">
            <p className={`${typography.body} text-gray-700 whitespace-pre-wrap`}>
              {sessionData.session.prompt}
            </p>
          </div>
        </div>

        {sessionData.session.status === 'generating' && !isConnected && (
          <Alert variant="warning">
            This session is currently generating. You are disconnected - reconnect to see live
            updates, or refresh the page to see the latest persisted data.
          </Alert>
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
          <Alert variant="error">{sessionData.session.errorMessage}</Alert>
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
