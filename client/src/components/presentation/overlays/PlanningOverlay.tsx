import { motion } from 'motion/react';
import { usePresentationStore } from '../../../stores/presentationStore';
import { presentationTokens } from '../../../lib/presentation-tokens';

/**
 * PlanningOverlay: "🏗️ PLANNING ARCHITECTURE"
 *
 * Shows when planArchitecture tool is called
 * Displays: Database models, API endpoints, components planned
 * Duration: 5 seconds (important moment!)
 */
export function PlanningOverlay() {
  const { overlayData } = usePresentationStore();
  const plan = overlayData.planSummary;

  return (
    <motion.div
      className="fixed inset-0 flex flex-col items-center justify-center"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.95)',
        zIndex: presentationTokens.zIndex.overlay,
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Icon */}
      <motion.div
        initial={{ scale: 0, y: -50 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', bounce: 0.4, duration: 0.8 }}
        style={{
          fontSize: '8rem',
          marginBottom: '2rem',
        }}
      >
        🏗️
      </motion.div>

      {/* Title */}
      <motion.div
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        style={{
          fontSize: presentationTokens.fonts.titleSize,
          fontFamily: presentationTokens.fonts.heroFamily,
          color: presentationTokens.colors.neonYellow,
          textShadow: '0 0 20px rgba(255, 255, 0, 0.8), 0 0 40px rgba(255, 255, 0, 0.5)',
          letterSpacing: '0.2em',
          marginBottom: '3rem',
        }}
      >
        PLANNING ARCHITECTURE
      </motion.div>

      {/* Plan Stats */}
      {plan && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="flex gap-12"
        >
          <div
            style={{
              textAlign: 'center',
              fontSize: presentationTokens.fonts.bodySize,
              fontFamily: presentationTokens.fonts.bodyFamily,
            }}
          >
            <div
              style={{
                fontSize: '4rem',
                fontFamily: presentationTokens.fonts.heroFamily,
                color: presentationTokens.colors.neonCyan,
                textShadow: presentationTokens.colors.textShadowStrong,
              }}
            >
              {plan.models}
            </div>
            <div
              style={{
                color: presentationTokens.colors.gold,
                marginTop: '0.5rem',
              }}
            >
              DB MODELS
            </div>
          </div>

          <div
            style={{
              textAlign: 'center',
              fontSize: presentationTokens.fonts.bodySize,
              fontFamily: presentationTokens.fonts.bodyFamily,
            }}
          >
            <div
              style={{
                fontSize: '4rem',
                fontFamily: presentationTokens.fonts.heroFamily,
                color: presentationTokens.colors.neonMagenta,
                textShadow: '0 0 20px rgba(255, 0, 255, 0.8), 0 0 40px rgba(255, 0, 255, 0.5)',
              }}
            >
              {plan.endpoints}
            </div>
            <div
              style={{
                color: presentationTokens.colors.gold,
                marginTop: '0.5rem',
              }}
            >
              API CALLS
            </div>
          </div>

          <div
            style={{
              textAlign: 'center',
              fontSize: presentationTokens.fonts.bodySize,
              fontFamily: presentationTokens.fonts.bodyFamily,
            }}
          >
            <div
              style={{
                fontSize: '4rem',
                fontFamily: presentationTokens.fonts.heroFamily,
                color: presentationTokens.colors.successGreen,
                textShadow: '0 0 20px rgba(0, 255, 100, 0.8), 0 0 40px rgba(0, 255, 100, 0.5)',
              }}
            >
              {plan.components}
            </div>
            <div
              style={{
                color: presentationTokens.colors.gold,
                marginTop: '0.5rem',
              }}
            >
              COMPONENTS
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
