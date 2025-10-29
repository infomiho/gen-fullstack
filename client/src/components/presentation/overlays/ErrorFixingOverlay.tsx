import { motion } from 'motion/react';
import { usePresentationStore } from '../../../stores/presentationStore';
import { presentationTokens } from '../../../lib/presentation-tokens';

/**
 * ErrorFixingOverlay: Shows error fixing phase in progress
 *
 * Displayed when the LLM is fixing validation errors (error_fixing stage)
 * Features animated wrench icon and repair aesthetics
 *
 * Duration: 3 seconds
 */

export function ErrorFixingOverlay() {
  const { overlayData } = usePresentationStore();
  const { iteration, errorCount } = overlayData || {};

  return (
    <motion.div
      className="fixed inset-0 flex flex-col items-center justify-center"
      style={{
        background: presentationTokens.colors.overlayRadial,
        zIndex: presentationTokens.zIndex.overlay,
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Animated wrench icon */}
      <motion.div
        animate={{
          rotate: [0, 360],
        }}
        transition={{
          duration: 2,
          repeat: Number.POSITIVE_INFINITY,
          ease: 'linear',
        }}
        style={{
          fontSize: '8rem',
          marginBottom: '2rem',
          fontFamily: presentationTokens.fonts.monoFamily,
          color: presentationTokens.colors.neonYellow,
          textShadow: '0 0 20px rgba(255, 255, 0, 0.8), 0 0 40px rgba(255, 255, 0, 0.5)',
        }}
      >
        ⟳
      </motion.div>

      {/* Title */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        style={{
          fontSize: presentationTokens.fonts.titleSize,
          fontFamily: presentationTokens.fonts.heroFamily,
          color: presentationTokens.colors.neonYellow,
          textShadow: '0 0 20px rgba(255, 255, 0, 0.8), 0 0 40px rgba(255, 255, 0, 0.5)',
          letterSpacing: '0.2em',
        }}
      >
        FIXING ERRORS
      </motion.div>

      {/* Error details */}
      {(errorCount !== undefined || iteration !== undefined) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          style={{
            fontSize: presentationTokens.fonts.bodySize,
            fontFamily: presentationTokens.fonts.monoFamily,
            color: presentationTokens.colors.gold,
            marginTop: '2rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem',
          }}
        >
          {errorCount !== undefined && (
            <div>
              {errorCount} {errorCount === 1 ? 'error' : 'errors'} found
            </div>
          )}
          {iteration !== undefined && <div>Iteration {iteration}</div>}
        </motion.div>
      )}

      {/* Animated progress dots */}
      <motion.div
        style={{
          fontSize: presentationTokens.fonts.bodySize,
          color: presentationTokens.colors.neonYellow,
          marginTop: '2rem',
        }}
      >
        <motion.span
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.5, repeat: Number.POSITIVE_INFINITY }}
        >
          ...
        </motion.span>
      </motion.div>

      {/* Sparks effect (decorative) */}
      <motion.div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
          overflow: 'hidden',
        }}
      >
        {[...Array(8)].map((_, i) => (
          <motion.div
            // biome-ignore lint/suspicious/noArrayIndexKey: Static array for animation particles, index used for circular positioning
            key={`error-particle-${i}`}
            animate={{
              x: [0, Math.cos((i * Math.PI * 2) / 8) * 200],
              y: [0, Math.sin((i * Math.PI * 2) / 8) * 200],
              opacity: [0.8, 0],
              scale: [1, 0],
            }}
            transition={{
              duration: 1,
              repeat: Number.POSITIVE_INFINITY,
              delay: Math.random() * 0.5,
              ease: 'easeOut',
            }}
            style={{
              position: 'absolute',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: presentationTokens.colors.neonYellow,
              boxShadow: '0 0 10px rgba(255, 255, 0, 0.8)',
            }}
          />
        ))}
      </motion.div>
    </motion.div>
  );
}
