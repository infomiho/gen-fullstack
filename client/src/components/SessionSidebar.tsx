import type { AppInfo, ImplementedStrategyType } from '@gen-fullstack/shared';
import { IMPLEMENTED_STRATEGIES } from '@gen-fullstack/shared';
import { AppControls } from './AppControls';
import { StrategySelector } from './StrategySelector';
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
 * Type guard to check if a strategy is implemented
 */
function isImplementedStrategy(strategy: string): strategy is ImplementedStrategyType {
  return IMPLEMENTED_STRATEGIES.some((s) => s.value === strategy);
}

/**
 * SessionSidebar component
 *
 * Displays the left sidebar for a session page with:
 * - Strategy selector (readonly)
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
  // Ensure strategy is a valid implemented strategy, fallback to 'naive' for legacy sessions
  const strategy: ImplementedStrategyType = isImplementedStrategy(sessionData.session.strategy)
    ? sessionData.session.strategy
    : 'naive';

  // Parse capability config
  let capabilityConfig: {
    inputMode?: string;
    planning?: boolean;
    compilerChecks?: boolean;
  } | null = null;
  try {
    capabilityConfig = JSON.parse(sessionData.session.capabilityConfig);
  } catch {
    // Ignore parse errors for legacy sessions
  }

  return (
    <div className={`border-r ${padding.panel} overflow-y-auto`}>
      <div className={spacing.controls}>
        <div>
          <h2 className={`mb-3 ${typography.header}`}>Strategy</h2>
          <StrategySelector value={strategy} onChange={() => {}} disabled={true} />
        </div>

        {/* Capability Configuration */}
        {capabilityConfig && (
          <div>
            <h3 className={`mb-3 ${typography.header}`}>Configuration</h3>
            <div className={`${typography.caption} space-y-1`}>
              <div className="flex justify-between">
                <span>Input Mode:</span>
                <span className="font-medium">
                  {capabilityConfig.inputMode === 'template' ? 'Template' : 'Naive'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Planning:</span>
                <span className="font-medium">
                  {capabilityConfig.planning ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Compiler Checks:</span>
                <span className="font-medium">
                  {capabilityConfig.compilerChecks ? 'Enabled' : 'Disabled'}
                </span>
              </div>
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
