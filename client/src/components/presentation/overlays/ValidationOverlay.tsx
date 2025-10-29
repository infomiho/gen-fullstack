import { motion } from 'motion/react';
import { usePresentationStore } from '../../../stores/presentationStore';
import { presentationTokens } from '../../../lib/presentation-tokens';

/**
 * ValidationOverlay: Shows validation in progress and results
 *
 * Two variants:
 * 1. validation-prisma / validation-typescript: Loading state
 * 2. validation-result: Success/failure result
 *
 * Duration: 3 seconds loading, 2-3 seconds result
 */

interface ValidationLoadingProps {
  title: string;
}

function ValidationLoading({ title }: ValidationLoadingProps) {
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
      {/* Loading spinner */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: 'linear' }}
        style={{
          fontSize: '8rem',
          marginBottom: '2rem',
          fontFamily: presentationTokens.fonts.monoFamily,
          color: presentationTokens.colors.neonYellow,
          textShadow: '0 0 20px rgba(255, 255, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '8rem',
          height: '8rem',
        }}
      >
        ⟳
      </motion.div>

      {/* Title */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        style={{
          fontSize: presentationTokens.fonts.titleSize,
          fontFamily: presentationTokens.fonts.heroFamily,
          color: presentationTokens.colors.neonYellow,
          textShadow: '0 0 20px rgba(255, 255, 0, 0.8), 0 0 40px rgba(255, 255, 0, 0.5)',
          letterSpacing: '0.2em',
        }}
      >
        {title}
      </motion.div>

      {/* Loading dots */}
      <motion.div
        style={{
          fontSize: presentationTokens.fonts.bodySize,
          color: presentationTokens.colors.neonCyan,
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
    </motion.div>
  );
}

interface ValidationResultProps {
  passed: boolean;
  errorCount?: number;
  iteration?: number;
}

function ValidationResult({ passed, errorCount, iteration }: ValidationResultProps) {
  const icon = passed ? '✓' : '✗';
  const title = passed ? 'VALIDATION PASSED' : 'VALIDATION FAILED';
  const color = passed
    ? presentationTokens.colors.successGreen
    : presentationTokens.colors.errorRed;
  const textShadow = passed
    ? '0 0 20px rgba(0, 255, 100, 0.8), 0 0 40px rgba(0, 255, 100, 0.5)'
    : presentationTokens.colors.textShadowError;

  return (
    <motion.div
      className="fixed inset-0 flex flex-col items-center justify-center"
      style={{
        background: presentationTokens.colors.overlayRadial,
        zIndex: presentationTokens.zIndex.overlay,
      }}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ type: 'spring', bounce: 0.4, duration: 0.5 }}
    >
      {/* Icon */}
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', bounce: 0.6, duration: 0.8 }}
        style={{
          fontSize: '10rem',
          color,
          textShadow,
          marginBottom: '2rem',
        }}
      >
        {icon}
      </motion.div>

      {/* Title */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        style={{
          fontSize: presentationTokens.fonts.titleSize,
          fontFamily: presentationTokens.fonts.heroFamily,
          color,
          textShadow,
          letterSpacing: '0.2em',
          marginBottom: '2rem',
        }}
      >
        {title}
      </motion.div>

      {/* Error count or iteration info */}
      {!passed && errorCount !== undefined && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          style={{
            fontSize: presentationTokens.fonts.bodySize,
            fontFamily: presentationTokens.fonts.monoFamily,
            color: presentationTokens.colors.gold,
          }}
        >
          {errorCount} {errorCount === 1 ? 'error' : 'errors'}
          {iteration && ` (iteration ${iteration})`}
        </motion.div>
      )}
    </motion.div>
  );
}

export function ValidationOverlay() {
  const { currentOverlay, overlayData } = usePresentationStore();

  // Loading state (generic title works for both Prisma and TypeScript validation)
  if (currentOverlay === 'validation-prisma' || currentOverlay === 'validation-typescript') {
    return <ValidationLoading title="VALIDATING..." />;
  }

  // Result state
  if (currentOverlay === 'validation-result' && overlayData.validationResult) {
    return <ValidationResult {...overlayData.validationResult} />;
  }

  return null;
}
