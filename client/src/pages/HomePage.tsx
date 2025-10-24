import type { CapabilityConfig } from '@gen-fullstack/shared';
import { Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { CapabilitySection } from '../components/CapabilitySection';
import { PromptDisplay } from '../components/PromptDisplay';
import { PromptInput } from '../components/PromptInput';
import { StatusBadge } from '../components/StatusBadge';
import { useWebSocket } from '../hooks/useWebSocket';
import { card, focus, spacing, transitions, typography } from '../lib/design-tokens';

const SERVER_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Session list item from the API
 */
interface SessionListItem {
  id: string;
  prompt: string;
  strategy: string;
  capabilityConfig: string; // JSON string of CapabilityConfig
  status: 'generating' | 'completed' | 'failed';
  createdAt: string;
  updatedAt?: string;
  completedAt?: string;
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
  const { isConnected, startGeneration, isGenerating } = useWebSocket(navigate);

  // Prompt state
  const [prompt, setPrompt] = useState('');

  // Capability mode state
  const [capabilityConfig, setCapabilityConfig] = useState<CapabilityConfig>({
    inputMode: 'naive',
    planning: false,
    compilerChecks: false,
    buildingBlocks: false,
    maxIterations: 3,
  });

  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);

  // Fetch previous sessions
  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const response = await fetch(`${SERVER_URL}/api/sessions`);
        if (response.ok) {
          const data = await response.json();
          setSessions(data.sessions || []);
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
    if (prompt.trim()) {
      startGeneration(prompt, capabilityConfig, 'gpt-5-mini');
      setPrompt('');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Main content - Centered */}
      <main className="max-w-5xl mx-auto px-6 py-16">
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
        <div className="mb-16">
          <div className={`${spacing.sections}`}>
            {/* Prompt input */}
            <div>
              <PromptInput
                value={prompt}
                onChange={setPrompt}
                disabled={isGenerating || !isConnected}
              />
            </div>

            {/* Capability Section */}
            <CapabilitySection
              config={capabilityConfig}
              onConfigChange={setCapabilityConfig}
              disabled={isGenerating}
            />

            {/* Generate button */}
            <div>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating || !isConnected || !prompt.trim()}
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
          <h3 className={`mb-4 ${typography.sectionHeader}`}>
            Previous Sessions
            {sessions.length > 0 && (
              <span className="ml-2 text-sm text-muted-foreground font-normal">
                ({sessions.length})
              </span>
            )}
          </h3>

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
            <div className="space-y-3">
              {sessions.map((session) => {
                return (
                  <Link key={session.id} to={`/${session.id}`} className={card.link}>
                    <div className="space-y-3">
                      {/* Prompt with copy button */}
                      <PromptDisplay prompt={session.prompt} />

                      {/* Bottom row: timestamp (left) and status (right) */}
                      <div className="flex items-center justify-between gap-4">
                        <span className={`${typography.caption}`}>
                          {formatDate(session.createdAt)}
                        </span>
                        <StatusBadge status={session.status} />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default HomePage;
