import type { AppInfo } from '@gen-fullstack/shared';
import { typography } from '../lib/design-tokens';
import { Alert } from './Alert';
import { CapabilitiesList } from './CapabilitiesList';
import { MetricsDisplay } from './MetricsDisplay';
import { PromptDisplay } from './PromptDisplay';
import { UnifiedStatusSection } from './UnifiedStatusSection';

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
  isOwnSession: boolean;
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
  isOwnSession,
  startApp,
  stopApp,
  onStartClick,
}: SessionSidebarProps) {
  // Parse capability config
  let capabilityConfig: {
    inputMode?: string;
    planning?: boolean;
    compilerChecks?: boolean;
    buildingBlocks?: boolean;
    maxIterations?: number;
  } | null = null;
  try {
    capabilityConfig = JSON.parse(sessionData.session.capabilityConfig);
  } catch {
    // Ignore parse errors for legacy sessions
  }

  return (
    <div className="border-r border-border bg-card p-6 overflow-y-auto">
      <div className="space-y-6">
        {/* Capability Configuration */}
        {capabilityConfig && (
          <div>
            <h3 className={`${typography.sectionHeader} mb-3`}>Capabilities</h3>
            <CapabilitiesList capabilityConfig={capabilityConfig} />
          </div>
        )}

        {/* Prompt */}
        <div>
          <h3 className={`${typography.sectionHeader} mb-3`}>Prompt</h3>
          <PromptDisplay prompt={sessionData.session.prompt} />
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
            <MetricsDisplay
              totalTokens={sessionData.session.totalTokens}
              cost={sessionData.session.cost || '0'}
              durationMs={sessionData.session.durationMs || 0}
              stepCount={sessionData.session.stepCount || 0}
            />
          </div>
        )}

        {/* Error message */}
        {sessionData.session.errorMessage && (
          <Alert variant="error">{sessionData.session.errorMessage}</Alert>
        )}

        {/* Unified status section */}
        <div className="pt-6 border-t border-border">
          <UnifiedStatusSection
            sessionStatus={sessionData.session.status}
            isOwnSession={isOwnSession}
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
