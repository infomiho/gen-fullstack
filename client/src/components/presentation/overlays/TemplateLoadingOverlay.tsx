import { motion } from 'motion/react';
import { presentationTokens } from '../../../lib/presentation-tokens';

/**
 * TemplateLoadingOverlay: "🚀 LOADING TEMPLATE"
 *
 * Shows when template mode is being used
 * Displays: Pre-built components ready
 * Duration: 3 seconds
 */
export function TemplateLoadingOverlay() {
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
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', bounce: 0.5, duration: 0.8 }}
        style={{
          fontSize: '8rem',
          marginBottom: '2rem',
        }}
      >
        🚀
      </motion.div>

      {/* Title */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        style={{
          fontSize: presentationTokens.fonts.titleSize,
          fontFamily: presentationTokens.fonts.heroFamily,
          color: presentationTokens.colors.neonCyan,
          textShadow: presentationTokens.colors.textShadowStrong,
          letterSpacing: '0.2em',
          marginBottom: '2rem',
        }}
      >
        LOADING TEMPLATE
      </motion.div>

      {/* Features */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.5 }}
        style={{
          fontSize: presentationTokens.fonts.bodySize,
          fontFamily: presentationTokens.fonts.bodyFamily,
          color: presentationTokens.colors.gold,
          textAlign: 'center',
          lineHeight: 1.8,
        }}
      >
        <div>✓ React 19 + TypeScript</div>
        <div>✓ Tailwind CSS 4</div>
        <div>✓ Prisma ORM</div>
        <div>✓ Express 5 API</div>
      </motion.div>
    </motion.div>
  );
}
