import { motion, AnimatePresence } from 'motion/react';
import { usePresentationStore } from '../../../stores/presentationStore';
import { presentationTokens } from '../../../lib/presentation-tokens';

/**
 * ToolCallHUD: Live Tool Call Display
 *
 * Displays real-time tool call activity with:
 * - Current tool call (slides in from right)
 * - Combo counter for consecutive calls
 * - Tool call budget progress
 * - Recent activity history (scrolling)
 */
export function ToolCallHUD() {
  const { stats, combo, recentToolCalls } = usePresentationStore();

  // Calculate tool budget (assume 40 max based on compiler checks capability)
  const maxToolCalls = 40;
  const budgetPercentage = Math.min((stats.toolCalls / maxToolCalls) * 100, 100);

  return (
    <motion.div
      className="fixed top-0 right-0 m-8"
      style={{
        zIndex: presentationTokens.zIndex.hud,
        width: '500px',
        fontFamily: presentationTokens.fonts.bodyFamily,
      }}
      initial={{ x: 100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 100, opacity: 0 }}
      transition={presentationTokens.animations.slideIn}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between p-6 border-2"
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          borderColor: presentationTokens.colors.neonCyan,
          fontSize: presentationTokens.fonts.bodySize,
          color: presentationTokens.colors.neonCyan,
          textShadow: presentationTokens.colors.textShadowStrong,
        }}
      >
        <div
          style={{
            fontFamily: presentationTokens.fonts.heroFamily,
            letterSpacing: '0.1em',
          }}
        >
          GEN ARENA
        </div>
        <div
          style={{
            fontSize: presentationTokens.fonts.monoSize,
            fontFamily: presentationTokens.fonts.monoFamily,
          }}
        >
          [{stats.toolCalls} / {maxToolCalls}]
        </div>
      </div>

      {/* Tool Budget Bar */}
      <div
        className="relative h-3 border-x-2 border-b-2"
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          borderColor: presentationTokens.colors.neonCyan,
        }}
      >
        <motion.div
          className="absolute inset-0"
          style={{
            backgroundColor: presentationTokens.colors.neonCyan,
            boxShadow: `0 0 20px ${presentationTokens.colors.neonCyan}`,
          }}
          initial={{ width: '0%' }}
          animate={{ width: `${budgetPercentage}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Current Activity */}
      <div
        className="p-6 border-x-2 border-b-2"
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          borderColor: presentationTokens.colors.neonCyan,
          minHeight: '200px',
        }}
      >
        {/* Combo Counter */}
        <AnimatePresence>
          {combo.count > 1 && (
            <motion.div
              className="mb-6 text-center"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: 'spring', bounce: 0.5 }}
            >
              <div
                style={{
                  fontSize: presentationTokens.fonts.titleSize,
                  fontFamily: presentationTokens.fonts.heroFamily,
                  color: presentationTokens.colors.neonYellow,
                  textShadow: presentationTokens.colors.textShadowStrong,
                  letterSpacing: '0.2em',
                }}
              >
                🔥 COMBO: {combo.count}x
              </div>
              <div
                style={{
                  fontSize: presentationTokens.fonts.bodySize,
                  color: presentationTokens.colors.neonYellow,
                  marginTop: '0.5rem',
                }}
              >
                {combo.count >= 5 && '⚡ LIGHTNING SPEED!'}
                {combo.count >= 10 && ' 💥 UNSTOPPABLE!!!'}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Recent Tool Calls */}
        <div
          style={{
            fontSize: presentationTokens.fonts.bodySize,
            color: presentationTokens.colors.neonCyan,
            marginBottom: '1rem',
            opacity: 0.7,
          }}
        >
          RECENT HITS:
        </div>

        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {recentToolCalls.map((toolCall) => (
              <motion.div
                key={toolCall.timestamp}
                initial={{ x: 100, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={presentationTokens.animations.slideIn}
                className="flex items-center gap-3"
                style={{
                  fontSize: presentationTokens.fonts.monoSize,
                  fontFamily: presentationTokens.fonts.monoFamily,
                  color: presentationTokens.colors.successGreen,
                }}
              >
                <span>✓</span>
                <div className="flex-1 truncate">
                  <span className="opacity-90">{toolCall.name}</span>
                  {toolCall.file && (
                    <>
                      <span className="opacity-50"> — </span>
                      <span className="opacity-70">{toolCall.file}</span>
                    </>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {recentToolCalls.length === 0 && (
            <div
              style={{
                fontSize: presentationTokens.fonts.monoSize,
                fontFamily: presentationTokens.fonts.monoFamily,
                color: presentationTokens.colors.neonCyan,
                opacity: 0.5,
              }}
            >
              Waiting for action...
            </div>
          )}
        </div>
      </div>

      {/* Stats Footer */}
      <div
        className="flex items-center justify-between p-4 border-x-2 border-b-2"
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          borderColor: presentationTokens.colors.neonCyan,
          fontSize: '1.75rem',
          fontFamily: presentationTokens.fonts.monoFamily,
          color: presentationTokens.colors.neonCyan,
          fontWeight: 'bold',
        }}
      >
        <div>📁 FILES: {stats.filesCreated}</div>
        <div>⏱️ {stats.duration.toFixed(1)}s</div>
      </div>
    </motion.div>
  );
}
