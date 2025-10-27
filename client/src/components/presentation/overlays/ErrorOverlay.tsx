import { motion } from 'motion/react';
import { useEffect } from 'react';
import { presentationTokens } from '../../../lib/presentation-tokens';
import { usePresentationStore } from '../../../stores/presentationStore';

interface ErrorOverlayProps {
  errorMessage?: string;
  retryCount?: number;
  maxRetries?: number;
}

/**
 * ErrorOverlay: "K.O." Screen
 *
 * Displays when an error occurs during generation:
 * - Large "K.O.!!!" text with screen shake
 * - Error message display
 * - Retry counter (if applicable)
 * - Red glitch effect
 * - Auto-dismisses after 3 seconds
 */
export function ErrorOverlay({
  errorMessage = 'Generation failed',
  retryCount = 0,
  maxRetries = 3,
}: ErrorOverlayProps) {
  const { setOverlay } = usePresentationStore();

  useEffect(() => {
    // Auto-dismiss and return to HUD after K.O. duration
    const timer = setTimeout(() => {
      setOverlay('tool-hud');
    }, presentationTokens.timing.koDuration);

    return () => clearTimeout(timer);
  }, [setOverlay]);

  return (
    <motion.div
      className="fixed inset-0 flex flex-col items-center justify-center"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.95)',
        zIndex: presentationTokens.zIndex.overlay,
      }}
      initial={{ opacity: 0 }}
      animate={{
        opacity: 1,
        x: [0, -20, 20, -15, 15, -10, 10, -5, 5, 0],
        y: [0, -15, 15, -10, 10, -5, 5, 0],
      }}
      exit={{ opacity: 0 }}
      transition={{
        opacity: { duration: 0.2 },
        x: { duration: 0.5, times: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 1] },
        y: { duration: 0.5, times: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 1] },
      }}
    >
      {/* Red Flash Overlay */}
      <motion.div
        className="absolute inset-0"
        style={{
          backgroundColor: presentationTokens.colors.errorRed,
          mixBlendMode: 'multiply',
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.3, 0] }}
        transition={{ duration: 0.5, times: [0, 0.1, 1], repeat: 3 }}
      />

      {/* K.O. Text */}
      <motion.div
        style={{
          fontSize: presentationTokens.fonts.heroSize,
          fontFamily: presentationTokens.fonts.heroFamily,
          color: presentationTokens.colors.errorRed,
          textShadow: presentationTokens.colors.textShadowError,
          letterSpacing: '0.3em',
          border: '8px solid',
          borderColor: presentationTokens.colors.errorRed,
          padding: '2rem 4rem',
          position: 'relative',
          zIndex: 1,
        }}
        animate={{
          scale: [1, 1.05, 1],
          rotate: [0, 2, -2, 0],
        }}
        transition={{
          duration: 0.3,
          repeat: Infinity,
          repeatType: 'reverse',
        }}
      >
        K.O.!!!
      </motion.div>

      {/* Error Message */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        style={{
          fontSize: presentationTokens.fonts.bodySize,
          fontFamily: presentationTokens.fonts.bodyFamily,
          color: presentationTokens.colors.errorRed,
          marginTop: '3rem',
          textAlign: 'center',
          maxWidth: '800px',
          padding: '0 2rem',
          position: 'relative',
          zIndex: 1,
        }}
      >
        ⚠️ {errorMessage}
      </motion.div>

      {/* Retry Counter */}
      {maxRetries > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          style={{
            fontSize: presentationTokens.fonts.subtitleSize,
            fontFamily: presentationTokens.fonts.monoFamily,
            color: presentationTokens.colors.neonYellow,
            marginTop: '2rem',
            padding: '1rem 2rem',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            border: `2px solid ${presentationTokens.colors.neonYellow}`,
            borderRadius: '8px',
            position: 'relative',
            zIndex: 1,
          }}
        >
          RETRY: {retryCount} / {maxRetries}
        </motion.div>
      )}

      {/* Glitch Lines Effect */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: `repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            ${presentationTokens.colors.errorRed} 2px,
            ${presentationTokens.colors.errorRed} 4px
          )`,
          opacity: 0.1,
          pointerEvents: 'none',
        }}
        animate={{
          y: [0, 100],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'linear',
        }}
      />
    </motion.div>
  );
}
