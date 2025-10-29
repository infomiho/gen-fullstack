import type { CapabilityConfig } from '@gen-fullstack/shared';
import { Send } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { CapabilitySection } from '../components/CapabilitySection';
import { PromptDisplay } from '../components/PromptDisplay';
import { PromptInput } from '../components/PromptInput';
import { SessionFilters, type SessionFiltersState } from '../components/SessionFilters';
import { SessionMetadata } from '../components/SessionMetadata';
import { ThemeToggle } from '../components/ThemeToggle';
import { useWebSocket } from '../hooks/useWebSocket';
import { card, focus, spacing, transitions, typography } from '../lib/design-tokens';
import { env } from '../lib/env';
import { parseCapabilityConfig } from '../lib/format-utils';
import { useGenerationConfigStore } from '../stores/generation-config.store';

/**
 * Session list item from the API
 */
interface SessionListItem {
  id: string;
  prompt: string;
  capabilityConfig: string; // JSON string of CapabilityConfig
  status: 'generating' | 'completed' | 'failed';
  createdAt: string;
  updatedAt?: string;
  completedAt?: string;
  // Generation metrics
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  durationMs?: number;
  stepCount?: number;
}

/**
 * Session with pre-parsed capability config for performance
 * Parsing is done once when sessions are loaded to avoid repeated JSON parsing during filtering
 */
interface SessionWithParsedConfig extends SessionListItem {
  parsedConfig: CapabilityConfig | null;
}

/**
 * Check if a session matches the current filter criteria
 */
function matchesFilters(session: SessionWithParsedConfig, filters: SessionFiltersState): boolean {
  // Search filter (trim to handle spaces-only input)
  const trimmedSearch = filters.search.trim().toLowerCase();
  if (trimmedSearch && !session.prompt.toLowerCase().includes(trimmedSearch)) {
    return false;
  }

  // Status filter
  if (filters.status !== 'all' && session.status !== filters.status) {
    return false;
  }

  // Use pre-parsed capability config (performance optimization)
  const config = session.parsedConfig;
  if (!config) return true; // If parsing failed, include the session

  // Capability filters (must have all selected capabilities)
  if (filters.capabilities.template && config.inputMode !== 'template') {
    return false;
  }
  if (filters.capabilities.planning && !config.planning) {
    return false;
  }
  if (filters.capabilities.compilerChecks && !config.compilerChecks) {
    return false;
  }
  if (filters.capabilities.buildingBlocks && !config.buildingBlocks) {
    return false;
  }

  return true;
}

/**
 * HomePage - Start new generation or view previous sessions
 *
 * Centered layout inspired by Bolt but using our design language.
 * Features:
 * - Prominent prompt input area
 * - Strategy selector
 * - List of previous sessions
 */
function HomePage() {
  const navigate = useNavigate();
  const { isConnected, startGeneration } = useWebSocket(navigate);

  // Local submission state (not persisted) - tracks form submission for THIS HomePage instance
  // Resets to false when: (1) component unmounts on navigation, (2) timeout after 2s
  // This prevents the bug where visiting an in-progress session leaves global isGenerating=true
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Generation config state (persisted to localStorage via Zustand)
  const promptDraft = useGenerationConfigStore((state) => state.promptDraft);
  const setPromptDraft = useGenerationConfigStore((state) => state.setPromptDraft);
  const clearPromptDraft = useGenerationConfigStore((state) => state.clearPromptDraft);
  const capabilityConfig = useGenerationConfigStore((state) => state.capabilityConfig);
  const setCapabilityConfig = useGenerationConfigStore((state) => state.setCapabilityConfig);

  const [sessions, setSessions] = useState<SessionWithParsedConfig[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);

  // Filter state
  const [filters, setFilters] = useState<SessionFiltersState>({
    search: '',
    status: 'all',
    capabilities: {
      template: false,
      planning: false,
      compilerChecks: false,
      buildingBlocks: false,
    },
  });

  // Filtered sessions using useMemo for performance
  const filteredSessions = useMemo(() => {
    return sessions.filter((session) => matchesFilters(session, filters));
  }, [sessions, filters]);

  // Fetch previous sessions and pre-parse capability configs for performance
  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const response = await fetch(`${env.VITE_API_URL}/api/sessions`);
        if (response.ok) {
          const data = await response.json();
          // Parse capability configs once to avoid repeated parsing during filtering
          const sessionsWithParsedConfig: SessionWithParsedConfig[] = (data.sessions || []).map(
            (session: SessionListItem) => ({
              ...session,
              parsedConfig: parseCapabilityConfig(session.capabilityConfig),
            }),
          );
          setSessions(sessionsWithParsedConfig);
        }
      } catch (error) {
        // biome-ignore lint/suspicious/noConsole: Useful for debugging session fetch failures
        console.error('Failed to fetch sessions:', error);
      } finally {
        setLoadingSessions(false);
      }
    };

    fetchSessions();
  }, []);

  const handleGenerate = () => {
    if (promptDraft.trim()) {
      setIsSubmitting(true);
      startGeneration(promptDraft, capabilityConfig, 'gpt-5-mini');
      clearPromptDraft();

      // Safety timeout: Reset if navigation doesn't happen (error case)
      // Normal flow: session_started event triggers navigation → component unmounts → state resets
      // This timeout handles failures where navigation never occurs
      setTimeout(() => {
        setIsSubmitting(false);
      }, 2000);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Theme toggle - Top right */}
      <div className="absolute top-4 right-6">
        <ThemeToggle />
      </div>

      {/* Main content - Centered */}
      <main className="max-w-5xl mx-auto px-6 py-32">
        {/* Title */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-foreground">
            Gen{' '}
            <span className="bg-gradient-to-b from-[#1488FC] to-[#03305D] dark:from-white dark:to-[#1488FC] bg-clip-text text-transparent">
              Fullstack
            </span>
          </h1>
        </div>

        {/* Generation form */}
        <div className="mb-32">
          <div className={`${spacing.sections}`}>
            {/* Prompt input */}
            <div>
              <PromptInput
                value={promptDraft}
                onChange={setPromptDraft}
                disabled={isSubmitting || !isConnected}
              />
            </div>

            {/* Capability Section */}
            <CapabilitySection
              config={capabilityConfig}
              onConfigChange={setCapabilityConfig}
              disabled={isSubmitting}
            />

            {/* Generate button */}
            <div>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={isSubmitting || !isConnected || !promptDraft.trim()}
                className={`w-full flex items-center justify-center gap-2 rounded border border-primary bg-primary px-4 py-3 text-base font-medium text-primary-foreground ${transitions.colors} hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-muted disabled:border-muted disabled:text-muted-foreground ${focus.ring}`}
              >
                <Send size={16} />
                Generate
              </button>
            </div>
          </div>
        </div>

        {/* Previous sessions */}
        <div>
          <h3 className={`mb-4 ${typography.sectionHeader}`}>Previous Sessions</h3>

          {loadingSessions ? (
            <div className="text-center py-12">
              <p className={`${typography.bodySecondary}`}>Loading sessions...</p>
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-border rounded-lg">
              <p className={`${typography.bodySecondary} mb-2`}>No previous sessions yet</p>
              <p className={`${typography.caption}`}>
                Start by creating your first application above
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Filters */}
              <SessionFilters
                filters={filters}
                onFiltersChange={setFilters}
                sessionCount={filteredSessions.length}
                totalCount={sessions.length}
              />

              {/* Session list */}
              {filteredSessions.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-border rounded-lg">
                  <p className={`${typography.bodySecondary} mb-2`}>
                    No sessions match your filters
                  </p>
                  <p className={`${typography.caption}`}>
                    Try adjusting your search or filter criteria
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredSessions.map((session) => {
                    return (
                      <Link key={session.id} to={`/${session.id}`} className={card.link}>
                        <div className="space-y-3">
                          {/* Prompt with copy button */}
                          <PromptDisplay prompt={session.prompt} />

                          {/* Session metadata */}
                          <SessionMetadata
                            capabilityConfig={session.capabilityConfig}
                            status={session.status}
                            createdAt={session.createdAt}
                            durationMs={session.durationMs}
                          />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default HomePage;
