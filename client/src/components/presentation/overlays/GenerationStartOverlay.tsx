import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { presentationTokens } from '../../../lib/presentation-tokens';
import { usePresentationStore } from '../../../stores/presentationStore';

/**
 * GenerationStartOverlay: Simulation Loading and Power-Up Selection
 *
 * Retro game-style generation start sequence:
 * 1. "LOADING THE SIMULATION..." with progress bar (2s)
 * 2. Power-ups display with selection indicators (3s)
 * 3. "READY..." appears (0.5s)
 * 4. "VIBE CODE" appears with screen shake (0.5s)
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Complex multi-phase animation sequence that is easier to understand as a single function
export function GenerationStartOverlay() {
  const { currentConfig } = usePresentationStore();
  const [phase, setPhase] = useState<'loading' | 'ready' | 'fight' | 'config'>('loading');
  const [loadingProgress, setLoadingProgress] = useState(0);

  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];

    // Animate loading progress bar
    const progressInterval = setInterval(() => {
      setLoadingProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 5; // Increment by 5% every 100ms = 2 seconds total
      });
    }, 100);

    // Phase 1: Loading simulation (2000ms)
    timers.push(
      setTimeout(() => {
        clearInterval(progressInterval);
        setPhase('config');
      }, 2000),
    );

    // Phase 2: Config/Power-ups (3000ms)
    timers.push(
      setTimeout(() => {
        setPhase('ready');
      }, 2000 + 3000),
    );

    // Phase 3: READY (500ms)
    timers.push(
      setTimeout(
        () => {
          setPhase('fight');
        },
        2000 + 3000 + presentationTokens.timing.readyDuration,
      ),
    );

    // Phase 4: FIGHT! (500ms) - ends after this

    // Note: Final transition to next overlay handled by presentation playback system

    return () => {
      timers.forEach(clearTimeout);
      clearInterval(progressInterval);
    };
  }, []);

  return (
    <motion.div
      className="fixed inset-0 flex items-center justify-center"
      style={{
        background: presentationTokens.colors.overlayRadial,
        zIndex: presentationTokens.zIndex.overlay,
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {phase === 'loading' && (
        <div className="flex flex-col items-center">
          {/* Loading Text */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            style={{
              fontSize: presentationTokens.fonts.titleSize,
              fontFamily: presentationTokens.fonts.heroFamily,
              color: presentationTokens.colors.neonCyan,
              textShadow: presentationTokens.colors.textShadowStrong,
              letterSpacing: '0.2em',
              marginBottom: '4rem',
            }}
          >
            LOADING THE SIMULATION...
          </motion.div>

          {/* Retro Progress Bar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            style={{
              width: '600px',
              height: '60px',
              border: `4px solid ${presentationTokens.colors.neonCyan}`,
              borderRadius: '8px',
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              padding: '8px',
              boxShadow: `0 0 20px ${presentationTokens.colors.neonCyan}, inset 0 0 10px rgba(0, 255, 255, 0.2)`,
            }}
          >
            <motion.div
              style={{
                height: '100%',
                width: `${loadingProgress}%`,
                backgroundColor: presentationTokens.colors.neonCyan,
                borderRadius: '4px',
                boxShadow: `0 0 20px ${presentationTokens.colors.neonCyan}`,
                transition: 'width 0.1s linear',
              }}
            />
          </motion.div>

          {/* Progress Percentage */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.3 }}
            style={{
              fontSize: presentationTokens.fonts.subtitleSize,
              fontFamily: presentationTokens.fonts.monoFamily,
              color: presentationTokens.colors.neonCyan,
              marginTop: '2rem',
            }}
          >
            {Math.round(loadingProgress)}%
          </motion.div>
        </div>
      )}

      {phase === 'ready' && (
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 1.2, opacity: 0 }}
          transition={presentationTokens.animations.heroEnter}
          style={{
            fontSize: presentationTokens.fonts.heroSize,
            fontFamily: presentationTokens.fonts.heroFamily,
            color: presentationTokens.colors.neonCyan,
            textShadow: presentationTokens.colors.textShadowStrong,
            letterSpacing: '0.2em',
          }}
        >
          READY...
        </motion.div>
      )}

      {phase === 'fight' && (
        <motion.div
          initial={{ scale: 0.5, opacity: 0, rotate: -10 }}
          animate={{
            scale: [0.5, 1.3, 1],
            opacity: [0, 1, 1],
            rotate: [10, -5, 0],
            x: [0, -10, 10, -5, 5, 0],
            y: [0, -10, 10, -5, 5, 0],
          }}
          transition={{
            duration: 0.5,
            times: [0, 0.3, 1],
          }}
          style={{
            fontSize: presentationTokens.fonts.heroSize,
            fontFamily: presentationTokens.fonts.heroFamily,
            color: presentationTokens.colors.neonYellow,
            textShadow: presentationTokens.colors.textShadowStrong,
            letterSpacing: '0.2em',
          }}
        >
          VIBE CODE
        </motion.div>
      )}

      {phase === 'config' && (
        <div className="relative w-full h-full flex flex-col items-center justify-center">
          {/* Title */}
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            style={{
              fontSize: '5rem',
              fontFamily: presentationTokens.fonts.heroFamily,
              color: presentationTokens.colors.gold,
              textShadow: presentationTokens.colors.textShadowGold,
              letterSpacing: '0.2em',
              textAlign: 'center',
              marginBottom: '4rem',
            }}
          >
            POWER-UPS
          </motion.div>

          {/* Three columns layout */}
          <div
            style={{
              display: 'flex',
              gap: '4rem',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* Column 1: Input Mode */}
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{
                opacity: 1,
                y: 0,
                scale: currentConfig?.inputMode === 'template' ? 1.05 : 0.95,
              }}
              transition={{
                y: { delay: 0.5, duration: 0.4 },
                opacity: { delay: 0.5, duration: 0.4 },
                scale: { delay: 1.2, duration: 0.3, ease: 'easeOut' },
              }}
              style={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '2rem',
                border: '4px solid',
                borderColor:
                  currentConfig?.inputMode === 'template'
                    ? 'rgba(0, 255, 255, 0.8)'
                    : 'rgba(0, 255, 255, 0.3)',
                borderRadius: '12px',
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                width: '250px',
                height: '350px',
                boxShadow:
                  currentConfig?.inputMode === 'template'
                    ? '0 0 40px rgba(0, 255, 255, 0.6), inset 0 0 20px rgba(0, 255, 255, 0.1)'
                    : '0 0 10px rgba(0, 255, 255, 0.2)',
                willChange: 'transform, opacity',
              }}
            >
              <div
                style={{
                  fontSize: '8rem',
                  marginBottom: '1rem',
                  color: presentationTokens.colors.neonCyan,
                }}
              >
                {/* Placeholder for character sprite */}□
              </div>
              <div
                style={{
                  fontSize: '1.5rem',
                  fontFamily: presentationTokens.fonts.heroFamily,
                  color: presentationTokens.colors.neonCyan,
                  textAlign: 'center',
                }}
              >
                TEMPLATE
              </div>

              {/* X or Checkmark Overlay */}
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 1.2, duration: 0.25, ease: 'easeOut' }}
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  fontSize: '10rem',
                  fontFamily: presentationTokens.fonts.heroFamily,
                  color:
                    currentConfig?.inputMode === 'template'
                      ? presentationTokens.colors.successGreen
                      : presentationTokens.colors.errorRed,
                  textShadow:
                    currentConfig?.inputMode === 'template'
                      ? '0 0 20px rgba(0, 255, 100, 0.6)'
                      : '0 0 20px rgba(255, 0, 0, 0.6)',
                  zIndex: 10,
                  willChange: 'transform, opacity',
                }}
              >
                {currentConfig?.inputMode === 'template' ? '✓' : '✗'}
              </motion.div>
            </motion.div>

            {/* Column 2: Planning */}
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{
                opacity: 1,
                y: 0,
                scale: currentConfig?.planning ? 1.05 : 0.95,
              }}
              transition={{
                y: { delay: 0.5, duration: 0.4 },
                opacity: { delay: 0.5, duration: 0.4 },
                scale: { delay: 1.7, duration: 0.3, ease: 'easeOut' },
              }}
              style={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '2rem',
                border: '4px solid',
                borderColor: currentConfig?.planning
                  ? 'rgba(0, 255, 100, 0.8)'
                  : 'rgba(0, 255, 100, 0.3)',
                borderRadius: '12px',
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                width: '250px',
                height: '350px',
                boxShadow: currentConfig?.planning
                  ? '0 0 40px rgba(0, 255, 100, 0.6), inset 0 0 20px rgba(0, 255, 100, 0.1)'
                  : '0 0 10px rgba(0, 255, 100, 0.2)',
                willChange: 'transform, opacity',
              }}
            >
              <div
                style={{
                  fontSize: '8rem',
                  marginBottom: '1rem',
                  color: presentationTokens.colors.successGreen,
                }}
              >
                {/* Placeholder for character sprite */}△
              </div>
              <div
                style={{
                  fontSize: '1.5rem',
                  fontFamily: presentationTokens.fonts.heroFamily,
                  color: presentationTokens.colors.successGreen,
                  textAlign: 'center',
                }}
              >
                PLANNING
              </div>

              {/* X or Checkmark Overlay */}
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 1.7, duration: 0.25, ease: 'easeOut' }}
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  fontSize: '10rem',
                  fontFamily: presentationTokens.fonts.heroFamily,
                  color: currentConfig?.planning
                    ? presentationTokens.colors.successGreen
                    : presentationTokens.colors.errorRed,
                  textShadow: currentConfig?.planning
                    ? '0 0 20px rgba(0, 255, 100, 0.6)'
                    : '0 0 20px rgba(255, 0, 0, 0.6)',
                  zIndex: 10,
                  willChange: 'transform, opacity',
                }}
              >
                {currentConfig?.planning ? '✓' : '✗'}
              </motion.div>
            </motion.div>

            {/* Column 3: Compiler Checks */}
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{
                opacity: 1,
                y: 0,
                scale: currentConfig?.compilerChecks ? 1.05 : 0.95,
              }}
              transition={{
                y: { delay: 0.5, duration: 0.4 },
                opacity: { delay: 0.5, duration: 0.4 },
                scale: { delay: 2.2, duration: 0.3, ease: 'easeOut' },
              }}
              style={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '2rem',
                border: '4px solid',
                borderColor: currentConfig?.compilerChecks
                  ? 'rgba(255, 255, 0, 0.8)'
                  : 'rgba(255, 255, 0, 0.3)',
                borderRadius: '12px',
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                width: '250px',
                height: '350px',
                boxShadow: currentConfig?.compilerChecks
                  ? '0 0 40px rgba(255, 255, 0, 0.6), inset 0 0 20px rgba(255, 255, 0, 0.1)'
                  : '0 0 10px rgba(255, 255, 0, 0.2)',
                willChange: 'transform, opacity',
              }}
            >
              <div
                style={{
                  fontSize: '8rem',
                  marginBottom: '1rem',
                  color: presentationTokens.colors.neonYellow,
                }}
              >
                {/* Placeholder for character sprite */}○
              </div>
              <div
                style={{
                  fontSize: '1.5rem',
                  fontFamily: presentationTokens.fonts.heroFamily,
                  color: presentationTokens.colors.neonYellow,
                  textAlign: 'center',
                }}
              >
                COMPILER
              </div>

              {/* X or Checkmark Overlay */}
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 2.2, duration: 0.25, ease: 'easeOut' }}
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  fontSize: '10rem',
                  fontFamily: presentationTokens.fonts.heroFamily,
                  color: currentConfig?.compilerChecks
                    ? presentationTokens.colors.successGreen
                    : presentationTokens.colors.errorRed,
                  textShadow: currentConfig?.compilerChecks
                    ? '0 0 20px rgba(0, 255, 100, 0.6)'
                    : '0 0 20px rgba(255, 0, 0, 0.6)',
                  zIndex: 10,
                  willChange: 'transform, opacity',
                }}
              >
                {currentConfig?.compilerChecks ? '✓' : '✗'}
              </motion.div>
            </motion.div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
