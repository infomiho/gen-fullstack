import type { AppInfo } from '@gen-fullstack/shared';
import { AppControls } from './AppControls';
import { padding, radius, spacing, typography } from '../lib/design-tokens';

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
 * ConfigBadge component - displays enabled/disabled status with color
 *
 * @param enabled - Whether the feature is enabled
 * @param label - The label to display (e.g., "Planning", "Compiler Checks")
 */
function ConfigBadge({ enabled, label }: { enabled: boolean; label: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className={typography.bodySecondary}>{label}:</span>
      <span
        className={`inline-flex items-center px-2 py-0.5 ${radius.sm} text-xs font-medium ${
          enabled
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            : 'bg-gray-100 text-gray-700 border border-gray-200'
        }`}
      >
        {enabled ? 'Enabled' : 'Disabled'}
      </span>
    </div>
  );
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
              <div className="flex items-center justify-between">
                <span className={typography.bodySecondary}>Input Mode:</span>
                <span
                  className={`inline-flex items-center px-2 py-0.5 ${radius.sm} text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200`}
                >
                  {capabilityConfig.inputMode === 'template' ? 'Template' : 'Naive'}
                </span>
              </div>
              <ConfigBadge enabled={capabilityConfig.planning || false} label="Planning" />
              <ConfigBadge
                enabled={capabilityConfig.compilerChecks || false}
                label="Compiler Checks"
              />
              {capabilityConfig.maxIterations !== undefined && (
                <div className="flex items-center justify-between">
                  <span className={typography.bodySecondary}>Max Iterations:</span>
                  <span className={`${typography.body} font-mono`}>
                    {capabilityConfig.maxIterations}
                  </span>
                </div>
              )}
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
