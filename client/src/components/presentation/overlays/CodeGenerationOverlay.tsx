import { motion } from 'motion/react';
import { presentationTokens } from '../../../lib/presentation-tokens';

/**
 * CodeGenerationOverlay: Shows code generation phase in progress
 *
 * Displayed when the LLM starts generating code (code_generation stage)
 * Features animated code symbols and tech aesthetics
 *
 * Duration: 4 seconds
 */

export function CodeGenerationOverlay() {
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
      {/* Animated code symbols (< / >) */}
      <motion.div
        style={{
          fontSize: '8rem',
          marginBottom: '2rem',
          fontFamily: presentationTokens.fonts.monoFamily,
          color: presentationTokens.colors.neonCyan,
          textShadow: presentationTokens.colors.textShadowStrong,
          display: 'flex',
          alignItems: 'center',
          gap: '2rem',
        }}
      >
        <motion.span
          animate={{
            opacity: [0.3, 1, 0.3],
            x: [-10, 0, -10],
          }}
          transition={{
            duration: 2,
            repeat: Number.POSITIVE_INFINITY,
            ease: 'easeInOut',
          }}
        >
          &lt;
        </motion.span>
        <motion.span
          animate={{
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 1.5,
            repeat: Number.POSITIVE_INFINITY,
            ease: 'easeInOut',
          }}
        >
          /
        </motion.span>
        <motion.span
          animate={{
            opacity: [0.3, 1, 0.3],
            x: [10, 0, 10],
          }}
          transition={{
            duration: 2,
            repeat: Number.POSITIVE_INFINITY,
            ease: 'easeInOut',
          }}
        >
          &gt;
        </motion.span>
      </motion.div>

      {/* Title */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        style={{
          fontSize: presentationTokens.fonts.titleSize,
          fontFamily: presentationTokens.fonts.heroFamily,
          color: presentationTokens.colors.neonCyan,
          textShadow: presentationTokens.colors.textShadowStrong,
          letterSpacing: '0.2em',
        }}
      >
        GENERATING CODE
      </motion.div>

      {/* Animated progress dots */}
      <motion.div
        style={{
          fontSize: presentationTokens.fonts.bodySize,
          color: presentationTokens.colors.neonCyan,
          marginTop: '2rem',
          fontFamily: presentationTokens.fonts.monoFamily,
        }}
      >
        <motion.span
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.5, repeat: Number.POSITIVE_INFINITY }}
        >
          ...
        </motion.span>
      </motion.div>

      {/* Binary rain effect (decorative) */}
      <motion.div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          pointerEvents: 'none',
          overflow: 'hidden',
          opacity: 0.1,
        }}
      >
        {[...Array(10)].map((_, i) => (
          <motion.div
            // biome-ignore lint/suspicious/noArrayIndexKey: Static array for animation particles, index correlates with positioning
            key={`binary-stream-${i}`}
            animate={{
              y: ['0%', '100%'],
            }}
            transition={{
              duration: 3 + Math.random() * 2,
              repeat: Number.POSITIVE_INFINITY,
              ease: 'linear',
              delay: Math.random() * 2,
            }}
            style={{
              position: 'absolute',
              left: `${i * 10}%`,
              fontSize: presentationTokens.fonts.monoSize,
              fontFamily: presentationTokens.fonts.monoFamily,
              color: presentationTokens.colors.neonCyan,
            }}
          >
            {Math.random() > 0.5 ? '1' : '0'}
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  );
}
