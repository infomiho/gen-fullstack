import { motion } from 'motion/react';
import Particles from '@tsparticles/react';
import { useId } from 'react';
import { usePresentationStore } from '../../../stores/presentationStore';
import { presentationTokens } from '../../../lib/presentation-tokens';
import { ClickBlockLayer } from './ClickBlockLayer';

/**
 * ComboMilestoneOverlay: "5x COMBO!" / "10x COMBO!" / "MEGA COMBO!"
 *
 * Shows when file write combo hits milestones
 * Milestones: 5, 10, 20+ files
 * Duration: 1 second each
 */
export function ComboMilestoneOverlay() {
  const { overlayData } = usePresentationStore();
  const milestone = overlayData.comboMilestone || 0;
  const particlesId = useId();

  // Determine title and color based on milestone
  const getComboDisplay = () => {
    if (milestone >= 20) {
      return {
        title: 'MEGA COMBO!!!',
        color: presentationTokens.colors.gold,
        textShadow: presentationTokens.colors.textShadowGold,
      };
    }
    if (milestone >= 10) {
      return {
        title: `${milestone}x COMBO!!`,
        color: presentationTokens.colors.neonMagenta,
        textShadow: '0 0 20px rgba(255, 0, 255, 0.8), 0 0 40px rgba(255, 0, 255, 0.5)',
      };
    }
    return {
      title: `${milestone}x COMBO!`,
      color: presentationTokens.colors.neonCyan,
      textShadow: presentationTokens.colors.textShadowStrong,
    };
  };

  const display = getComboDisplay();

  return (
    <>
      {/* Confetti particles */}
      <Particles
        id={`combo-${particlesId}`}
        options={{
          fullScreen: {
            enable: true,
            zIndex: presentationTokens.zIndex.particles,
          },
          particles: {
            number: {
              value: 0,
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
              type: ['circle', 'square'],
            },
            opacity: {
              value: { min: 0.3, max: 1 },
              animation: {
                enable: true,
                speed: 3,
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
                acceleration: 12,
              },
              speed: { min: 15, max: 30 },
              decay: 0.05,
              direction: 'none',
              random: true,
              straight: false,
              outModes: {
                default: 'destroy',
              },
            },
          },
          emitters: {
            position: { x: 50, y: 40 },
            rate: {
              quantity: 30,
              delay: 0.05,
            },
          },
        }}
      />

      {/* Clickblock Layer */}
      <ClickBlockLayer />

      {/* Background Overlay */}
      <motion.div
        className="fixed inset-0"
        style={{
          background: presentationTokens.colors.overlayRadial,
          zIndex: presentationTokens.zIndex.overlay - 1,
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
      />

      {/* Combo text */}
      <motion.div
        className="fixed inset-0 flex items-center justify-center pointer-events-none"
        style={{
          zIndex: presentationTokens.zIndex.overlay,
        }}
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.5 }}
        transition={{ type: 'spring', bounce: 0.6, duration: 0.5 }}
      >
        <motion.div
          animate={{
            scale: [1, 1.1, 1],
            rotate: [0, -5, 5, 0],
          }}
          transition={{
            duration: 0.5,
            repeat: 1,
          }}
          style={{
            fontSize: presentationTokens.fonts.heroSize,
            fontFamily: presentationTokens.fonts.heroFamily,
            color: display.color,
            textShadow: display.textShadow,
            letterSpacing: '0.1em',
          }}
        >
          {display.title}
        </motion.div>
      </motion.div>
    </>
  );
}
