import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import type { CapabilityConfig } from '@gen-fullstack/shared';
import { CapabilitySection } from '../components/CapabilitySection';
import { PromptInput } from '../components/PromptInput';
import { StatusBadge } from '../components/StatusBadge';
import { useWebSocket } from '../hooks/useWebSocket';
import { card, spacing, typography } from '../lib/design-tokens';

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

  // Capability mode state
  const [capabilityConfig, setCapabilityConfig] = useState<CapabilityConfig>({
    inputMode: 'naive',
    planning: false,
    compilerChecks: false,
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

  const handleGenerate = (prompt: string) => {
    startGeneration(prompt, capabilityConfig, 'gpt-5-mini');
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
    <div className="min-h-screen bg-white">
      {/* Main content - Centered */}
      <main className="max-w-4xl mx-auto px-6 py-16">
        {/* Title */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-16">Gen Fullstack</h1>
        </div>

        {/* Generation form */}
        <div className="mb-16">
          <div className={`${spacing.sections}`}>
            {/* Prompt input */}
            <div>
              <label htmlFor="prompt-textarea" className={`block mb-3 ${typography.sectionHeader}`}>
                What do you want to build?
              </label>
              {/* biome-ignore lint/correctness/useUniqueElementIds: Static ID is intentional for label accessibility - HomePage renders once per page */}
              <PromptInput
                id="prompt-textarea"
                onSubmit={handleGenerate}
                disabled={isGenerating || !isConnected}
              />
            </div>

            {/* Capability Section */}
            <CapabilitySection
              config={capabilityConfig}
              onConfigChange={setCapabilityConfig}
              disabled={isGenerating}
            />
          </div>
        </div>

        {/* Previous sessions */}
        <div>
          <h3 className={`mb-4 ${typography.sectionHeader}`}>
            Previous Sessions
            {sessions.length > 0 && (
              <span className="ml-2 text-sm text-gray-500 font-normal">({sessions.length})</span>
            )}
          </h3>

          {loadingSessions ? (
            <div className="text-center py-12">
              <p className={`${typography.body} text-gray-500`}>Loading sessions...</p>
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-gray-200 rounded-lg">
              <p className={`${typography.body} text-gray-500 mb-2`}>No previous sessions yet</p>
              <p className={`${typography.caption} text-gray-400`}>
                Start by creating your first application above
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map((session) => (
                <Link key={session.id} to={`/${session.id}`} className={card.link}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className={`${typography.body} text-gray-900 truncate mb-1`}>
                        {session.prompt}
                      </p>
                      <div className="flex items-center gap-3">
                        <span className={`${typography.caption} text-gray-500`}>
                          {formatDate(session.createdAt)}
                        </span>
                      </div>
                    </div>
                    <div>
                      <StatusBadge status={session.status} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default HomePage;
