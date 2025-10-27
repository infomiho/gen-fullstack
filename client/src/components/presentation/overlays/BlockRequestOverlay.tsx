import { motion } from 'motion/react';
import { usePresentationStore } from '../../../stores/presentationStore';
import { presentationTokens } from '../../../lib/presentation-tokens';

/**
 * BlockRequestOverlay: "📦 REQUESTING BLOCK"
 *
 * Shows when requestBlock tool is called
 * Displays: Block name being requested
 * Duration: 3 seconds
 */
export function BlockRequestOverlay() {
  const { overlayData } = usePresentationStore();
  const blockName = overlayData.blockName || 'Building Block';

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
        initial={{ scale: 0, rotateY: -180 }}
        animate={{ scale: 1, rotateY: 0 }}
        transition={{ type: 'spring', bounce: 0.5, duration: 0.8 }}
        style={{
          fontSize: '8rem',
          marginBottom: '2rem',
        }}
      >
        📦
      </motion.div>

      {/* Title */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        style={{
          fontSize: presentationTokens.fonts.titleSize,
          fontFamily: presentationTokens.fonts.heroFamily,
          color: presentationTokens.colors.neonMagenta,
          textShadow: '0 0 20px rgba(255, 0, 255, 0.8), 0 0 40px rgba(255, 0, 255, 0.5)',
          letterSpacing: '0.2em',
          marginBottom: '2rem',
        }}
      >
        REQUESTING BLOCK
      </motion.div>

      {/* Block name */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.5, duration: 0.5 }}
        style={{
          fontSize: presentationTokens.fonts.bodySize,
          fontFamily: presentationTokens.fonts.monoFamily,
          color: presentationTokens.colors.gold,
          padding: '1rem 2rem',
          border: `2px solid ${presentationTokens.colors.neonMagenta}`,
          borderRadius: '8px',
          backgroundColor: 'rgba(255, 0, 255, 0.1)',
        }}
      >
        {blockName}
      </motion.div>
    </motion.div>
  );
}
