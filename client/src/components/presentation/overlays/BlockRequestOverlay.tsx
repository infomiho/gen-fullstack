import { motion } from 'motion/react';
import { usePresentationStore } from '../../../stores/presentationStore';
import { presentationTokens } from '../../../lib/presentation-tokens';

/**
 * BlockRequestOverlay: Block falling from sky with impact
 *
 * Shows when requestBlock tool is called
 * Animation: Block falls from top and hits ground with impact
 * Duration: 3 seconds
 */
export function BlockRequestOverlay() {
  const { overlayData } = usePresentationStore();
  const blockName = overlayData.blockName || 'Building Block';

  return (
    <>
      {/* Clickblock Layer */}
      <div
        className="fixed inset-0"
        style={{
          zIndex: presentationTokens.zIndex.overlay - 1,
          pointerEvents: 'auto',
        }}
      />

      {/* Background with screen shake on impact */}
      <motion.div
        className="fixed inset-0"
        style={{
          background: presentationTokens.colors.overlayRadial,
          zIndex: presentationTokens.zIndex.overlay - 1,
        }}
        initial={{ opacity: 0 }}
        animate={{
          opacity: 1,
          x: [0, 0, 0, -10, 10, -5, 5, 0],
          y: [0, 0, 0, -10, 10, -5, 5, 0],
        }}
        transition={{
          opacity: { duration: 0.2 },
          x: { duration: 0.5, times: [0, 0.4, 0.45, 0.5, 0.6, 0.7, 0.8, 1] },
          y: { duration: 0.5, times: [0, 0.4, 0.45, 0.5, 0.6, 0.7, 0.8, 1] },
        }}
      />

      <motion.div
        className="fixed inset-0 flex flex-col items-center justify-center"
        style={{
          zIndex: presentationTokens.zIndex.overlay,
          pointerEvents: 'none',
        }}
      >
        {/* Falling Block Icon */}
        <motion.div
          initial={{ y: '-150vh', rotate: 0 }}
          animate={{
            y: ['-150vh', '0vh', '-20px', '0vh'],
            rotate: [0, 360, 360, 360],
          }}
          transition={{
            duration: 0.9,
            times: [0, 0.6, 0.8, 1],
            ease: 'easeOut',
          }}
          style={{
            fontSize: '8rem',
            marginBottom: '2rem',
            fontFamily: presentationTokens.fonts.heroFamily,
            color: presentationTokens.colors.neonMagenta,
            textShadow: '0 0 20px rgba(255, 0, 255, 0.8)',
          }}
        >
          ▣
        </motion.div>

        {/* Block Name - Appears after impact */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.7, duration: 0.3, ease: 'easeOut' }}
          style={{
            fontSize: presentationTokens.fonts.heroSize,
            fontFamily: presentationTokens.fonts.heroFamily,
            color: presentationTokens.colors.neonMagenta,
            textShadow: '0 0 20px rgba(255, 0, 255, 0.8), 0 0 40px rgba(255, 0, 255, 0.5)',
            letterSpacing: '0.15em',
            textAlign: 'center',
            textTransform: 'uppercase',
          }}
        >
          {blockName}
        </motion.div>

        {/* "ACTIVATED!" subtitle */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1.0, duration: 0.3, ease: 'easeOut' }}
          style={{
            fontSize: '2.5rem',
            fontFamily: presentationTokens.fonts.heroFamily,
            color: presentationTokens.colors.successGreen,
            textShadow: '0 0 20px rgba(0, 255, 100, 0.8)',
            letterSpacing: '0.2em',
            marginTop: '1rem',
          }}
        >
          ACTIVATED!
        </motion.div>
      </motion.div>
    </>
  );
}
