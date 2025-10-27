import { motion } from 'motion/react';
import { useEffect, useId } from 'react';
import Particles from '@tsparticles/react';
import { presentationTokens } from '../../../lib/presentation-tokens';
import { usePresentationStore } from '../../../stores/presentationStore';

interface FileCreatedOverlayProps {
  fileName?: string;
}

/**
 * FileCreatedOverlay: Achievement Toast with Confetti
 *
 * Displays when a file is successfully created:
 * - Brief flash of "FILE CREATED!" message
 * - File name display
 * - Confetti particle explosion
 * - Auto-dismisses after 2 seconds
 */
export function FileCreatedOverlay({ fileName }: FileCreatedOverlayProps) {
  const { setOverlay } = usePresentationStore();
  const particlesId = useId();

  useEffect(() => {
    // Auto-dismiss and return to HUD after toast duration
    const timer = setTimeout(() => {
      setOverlay('tool-hud');
    }, presentationTokens.timing.toastDuration);

    return () => clearTimeout(timer);
  }, [setOverlay]);

  return (
    <>
      {/* Confetti Particles */}
      <Particles
        id={`confetti-${particlesId}`}
        options={{
          fullScreen: {
            enable: true,
            zIndex: presentationTokens.zIndex.particles,
          },
          particles: {
            number: {
              value: presentationTokens.animations.confetti.particleCount,
            },
            color: {
              value: [
                presentationTokens.colors.neonCyan,
                presentationTokens.colors.neonMagenta,
                presentationTokens.colors.neonYellow,
                presentationTokens.colors.gold,
              ],
            },
            shape: {
              type: ['circle', 'square', 'triangle'],
            },
            opacity: {
              value: { min: 0, max: 1 },
              animation: {
                enable: true,
                speed: 2,
                startValue: 'max',
                destroy: 'min',
              },
            },
            size: {
              value: { min: 3, max: 8 },
            },
            life: {
              duration: {
                sync: true,
                value: 2,
              },
              count: 1,
            },
            move: {
              enable: true,
              gravity: {
                enable: true,
                acceleration: 20,
              },
              speed: { min: 10, max: 30 },
              decay: 0.05,
              direction: 'none',
              random: true,
              straight: false,
              outModes: {
                default: 'destroy',
                top: 'none',
              },
            },
          },
          emitters: {
            position: {
              x: 50,
              y: presentationTokens.animations.confetti.origin.y * 100,
            },
            rate: {
              quantity: presentationTokens.animations.confetti.particleCount,
              delay: 0,
            },
            size: {
              width: 0,
              height: 0,
            },
            life: {
              count: 1,
              duration: 0.1,
            },
          },
        }}
      />

      {/* Achievement Message */}
      <motion.div
        className="fixed inset-0 flex flex-col items-center justify-center"
        style={{
          zIndex: presentationTokens.zIndex.overlay,
          pointerEvents: 'none',
        }}
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.5 }}
        transition={{ type: 'spring', bounce: 0.5, duration: 0.5 }}
      >
        <motion.div
          animate={{
            scale: [1, 1.1, 1],
            rotate: [0, 5, -5, 0],
          }}
          transition={{
            duration: 0.5,
            repeat: Infinity,
            repeatType: 'reverse',
          }}
          style={{
            fontSize: presentationTokens.fonts.titleSize,
            fontFamily: presentationTokens.fonts.heroFamily,
            color: presentationTokens.colors.successGreen,
            textShadow: presentationTokens.colors.textShadowStrong,
            letterSpacing: '0.2em',
            textAlign: 'center',
          }}
        >
          ✨ FILE CREATED! ✨
        </motion.div>

        {fileName && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            style={{
              fontSize: presentationTokens.fonts.bodySize,
              fontFamily: presentationTokens.fonts.monoFamily,
              color: presentationTokens.colors.neonCyan,
              marginTop: '2rem',
              padding: '1rem 2rem',
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              border: `2px solid ${presentationTokens.colors.neonCyan}`,
              borderRadius: '8px',
              boxShadow: `0 0 30px ${presentationTokens.colors.neonCyan}`,
            }}
          >
            {fileName}
          </motion.div>
        )}
      </motion.div>
    </>
  );
}
