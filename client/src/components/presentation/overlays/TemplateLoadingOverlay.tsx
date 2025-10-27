import { motion } from 'motion/react';
import { presentationTokens } from '../../../lib/presentation-tokens';

/**
 * TemplateLoadingOverlay: "🚀 LOADING TEMPLATE"
 *
 * Shows when template mode is being used
 * Displays scattered tech stack features organically
 * Duration: 3 seconds
 */
export function TemplateLoadingOverlay() {
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

      {/* Template Loading Screen */}
      <motion.div
        className="fixed inset-0"
        style={{
          background: presentationTokens.colors.overlayRadial,
          zIndex: presentationTokens.zIndex.overlay,
          pointerEvents: 'none',
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Centered Content Container */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '2rem',
          }}
        >
          {/* Central Icon */}
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', bounce: 0.5, duration: 0.8 }}
            style={{
              fontSize: '8rem',
              fontFamily: presentationTokens.fonts.heroFamily,
              color: presentationTokens.colors.neonCyan,
              textShadow: presentationTokens.colors.textShadowStrong,
            }}
          >
            ▲
          </motion.div>

          {/* "LOADING TEMPLATE" Title */}
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, type: 'spring', bounce: 0.4, duration: 0.8 }}
            style={{
              fontSize: presentationTokens.fonts.titleSize,
              fontFamily: presentationTokens.fonts.heroFamily,
              color: presentationTokens.colors.neonCyan,
              textShadow: presentationTokens.colors.textShadowStrong,
              letterSpacing: '0.2em',
            }}
          >
            LOADING TEMPLATE
          </motion.div>
        </div>

        {/* Top Left - React 19 */}
        <motion.div
          initial={{ opacity: 0, x: -100, rotate: -15 }}
          animate={{ opacity: 1, x: 0, rotate: -8 }}
          transition={{ delay: 0.4, type: 'spring', bounce: 0.4 }}
          style={{
            position: 'absolute',
            top: '35%',
            left: '8%',
            fontSize: '2rem',
            fontFamily: presentationTokens.fonts.monoFamily,
            color: presentationTokens.colors.neonCyan,
            textShadow: presentationTokens.colors.textShadowStrong,
          }}
        >
          <div style={{ fontSize: '1rem', opacity: 0.7 }}>FRONTEND</div>
          <div style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>React 19</div>
        </motion.div>

        {/* Top Right - Tailwind CSS 4 */}
        <motion.div
          initial={{ opacity: 0, x: 100, rotate: 15 }}
          animate={{ opacity: 1, x: 0, rotate: 8 }}
          transition={{ delay: 0.5, type: 'spring', bounce: 0.4 }}
          style={{
            position: 'absolute',
            top: '35%',
            right: '8%',
            fontSize: '2rem',
            fontFamily: presentationTokens.fonts.monoFamily,
            color: presentationTokens.colors.neonMagenta,
            textShadow: '0 0 20px rgba(255, 0, 255, 0.8)',
          }}
        >
          <div style={{ fontSize: '1rem', opacity: 0.7 }}>STYLING</div>
          <div style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>Tailwind 4</div>
        </motion.div>

        {/* Bottom Left - Prisma ORM */}
        <motion.div
          initial={{ opacity: 0, y: 100, rotate: -10 }}
          animate={{ opacity: 1, y: 0, rotate: -5 }}
          transition={{ delay: 0.6, type: 'spring', bounce: 0.4 }}
          style={{
            position: 'absolute',
            bottom: '20%',
            left: '12%',
            fontSize: '2rem',
            fontFamily: presentationTokens.fonts.monoFamily,
            color: presentationTokens.colors.neonYellow,
            textShadow: '0 0 20px rgba(255, 255, 0, 0.8)',
          }}
        >
          <div style={{ fontSize: '1rem', opacity: 0.7 }}>DATABASE</div>
          <div style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>Prisma ORM</div>
        </motion.div>

        {/* Bottom Right - Express 5 */}
        <motion.div
          initial={{ opacity: 0, y: 100, rotate: 10 }}
          animate={{ opacity: 1, y: 0, rotate: 5 }}
          transition={{ delay: 0.7, type: 'spring', bounce: 0.4 }}
          style={{
            position: 'absolute',
            bottom: '20%',
            right: '12%',
            fontSize: '2rem',
            fontFamily: presentationTokens.fonts.monoFamily,
            color: presentationTokens.colors.successGreen,
            textShadow: '0 0 20px rgba(0, 255, 100, 0.8)',
          }}
        >
          <div style={{ fontSize: '1rem', opacity: 0.7 }}>BACKEND</div>
          <div style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>Express 5</div>
        </motion.div>
      </motion.div>
    </>
  );
}
