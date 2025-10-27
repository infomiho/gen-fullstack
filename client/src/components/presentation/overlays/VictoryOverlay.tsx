import { motion } from 'motion/react';
import { useId, useState, useEffect } from 'react';
import Particles from '@tsparticles/react';
import { presentationTokens } from '../../../lib/presentation-tokens';
import { usePresentationStore } from '../../../stores/presentationStore';
import { ClickBlockLayer } from './ClickBlockLayer';
import { useCountUp } from '../../../hooks/useCountUp';

/**
 * VictoryOverlay: "COMPLETED" and Stats Screen
 *
 * Two-phase victory sequence:
 * Phase 1: Just "COMPLETED" text (2s)
 * Phase 2: Animated stats scattered around the screen
 *
 * - Animated stat counters (duration, tool calls, files, combos)
 * - Continuous fireworks in background
 * - Stays visible until dismissed
 */
export function VictoryOverlay() {
  const { stats } = usePresentationStore();
  const particlesId = useId();
  const [phase, setPhase] = useState<'completed' | 'stats'>('completed');
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    // Transition to stats phase after 2 seconds
    const timer = setTimeout(() => {
      setPhase('stats');
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  const durationCount = useCountUp(Math.round(stats.duration * 10), 1500);
  const toolCallsCount = useCountUp(stats.toolCalls, 1500);
  const filesCount = useCountUp(stats.filesCreated, 1500);
  const combosCount = useCountUp(stats.combos, 1500);

  return (
    <>
      {/* Fireworks Particles */}
      <Particles
        id={`fireworks-${particlesId}`}
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
                presentationTokens.colors.gold,
                presentationTokens.colors.neonYellow,
                presentationTokens.colors.neonMagenta,
                presentationTokens.colors.neonCyan,
              ],
            },
            shape: {
              type: 'circle',
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
              value: 4,
            },
            life: {
              duration: {
                sync: true,
                value: 3,
              },
              count: 1,
            },
            move: {
              enable: true,
              gravity: {
                enable: true,
                acceleration: 15,
              },
              speed: { min: 10, max: 40 },
              decay: 0.05,
              direction: 'none',
              random: true,
              straight: false,
              outModes: {
                default: 'destroy',
              },
            },
          },
          emitters: [
            {
              position: { x: 25, y: 70 },
              rate: {
                quantity: 5,
                delay: 0.3,
              },
            },
            {
              position: { x: 50, y: 70 },
              rate: {
                quantity: 5,
                delay: 0.3,
              },
            },
            {
              position: { x: 75, y: 70 },
              rate: {
                quantity: 5,
                delay: 0.3,
              },
            },
          ],
        }}
      />

      {/* Clickblock Layer */}
      <ClickBlockLayer />

      {/* Victory Screen */}
      <motion.div
        className="fixed inset-0 flex flex-col items-center justify-center"
        style={{
          background: presentationTokens.colors.overlayRadial,
          zIndex: presentationTokens.zIndex.overlay,
          pointerEvents: 'none',
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
      >
        {phase === 'completed' && (
          <>
            {/* Stars Border */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', bounce: 0.4 }}
              style={{
                fontSize: '1.5rem',
                color: presentationTokens.colors.gold,
                marginBottom: '1rem',
              }}
            >
              ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★
            </motion.div>

            {/* "COMPLETED" Title */}
            <motion.div
              initial={{ scale: 0.5, opacity: 0, rotateY: -90 }}
              animate={{
                scale: 1,
                opacity: 1,
                rotateY: 0,
                rotateZ: [0, -3, 3, 0],
              }}
              transition={{
                scale: { type: 'spring', bounce: 0.5, duration: 1 },
                opacity: { duration: 0.5 },
                rotateY: { duration: 1, ease: 'easeOut' },
                rotateZ: { duration: 2, repeat: Infinity, repeatType: 'reverse' },
              }}
              style={{
                fontSize: presentationTokens.fonts.heroSize,
                fontFamily: presentationTokens.fonts.heroFamily,
                color: presentationTokens.colors.gold,
                textShadow: presentationTokens.colors.textShadowGold,
                letterSpacing: '0.3em',
                perspective: '1000px',
              }}
            >
              COMPLETED
            </motion.div>

            {/* Stars Border Bottom */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', bounce: 0.4 }}
              style={{
                fontSize: '1.5rem',
                color: presentationTokens.colors.gold,
                marginTop: '1rem',
              }}
            >
              ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★
            </motion.div>
          </>
        )}

        {phase === 'stats' && (
          <>
            {/* Borat Gif */}
            {!imageError && (
              <motion.div
                initial={{ opacity: 0, scale: 0.5, y: -50 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ delay: 0.3, type: 'spring', bounce: 0.5, duration: 0.8 }}
                style={{
                  marginBottom: '2rem',
                }}
              >
                <img
                  src={presentationTokens.assets.victoryGif}
                  alt="Borat Very Nice"
                  onError={() => setImageError(true)}
                  loading="lazy"
                  style={{
                    width: '500px',
                    height: 'auto',
                    borderRadius: '12px',
                    boxShadow: `0 0 40px ${presentationTokens.colors.gold}`,
                  }}
                />
              </motion.div>
            )}

            {/* Scattered Stats - Organic placement */}
            {/* Top Left - Duration */}
            <motion.div
              initial={{ opacity: 0, x: -100, rotate: -15 }}
              animate={{ opacity: 1, x: 0, rotate: -8 }}
              transition={{ delay: 0.5, type: 'spring' }}
              style={{
                position: 'absolute',
                top: '15%',
                left: '10%',
                fontSize: presentationTokens.fonts.subtitleSize,
                fontFamily: presentationTokens.fonts.monoFamily,
                color: presentationTokens.colors.neonCyan,
                textShadow: presentationTokens.colors.textShadowStrong,
              }}
            >
              <div style={{ fontSize: '4rem' }}>{(durationCount / 10).toFixed(1)}s</div>
              <div style={{ fontSize: '1.5rem', opacity: 0.8 }}>DURATION</div>
            </motion.div>

            {/* Top Right - Tool Calls */}
            <motion.div
              initial={{ opacity: 0, x: 100, rotate: 15 }}
              animate={{ opacity: 1, x: 0, rotate: 8 }}
              transition={{ delay: 0.6, type: 'spring' }}
              style={{
                position: 'absolute',
                top: '15%',
                right: '10%',
                fontSize: presentationTokens.fonts.subtitleSize,
                fontFamily: presentationTokens.fonts.monoFamily,
                color: presentationTokens.colors.neonMagenta,
                textShadow: '0 0 20px rgba(255, 0, 255, 0.8)',
              }}
            >
              <div style={{ fontSize: '4rem' }}>{toolCallsCount}</div>
              <div style={{ fontSize: '1.5rem', opacity: 0.8 }}>TOOL CALLS</div>
            </motion.div>

            {/* Bottom Left - Files */}
            <motion.div
              initial={{ opacity: 0, y: 100, rotate: -10 }}
              animate={{ opacity: 1, y: 0, rotate: -5 }}
              transition={{ delay: 0.7, type: 'spring' }}
              style={{
                position: 'absolute',
                bottom: '20%',
                left: '15%',
                fontSize: presentationTokens.fonts.subtitleSize,
                fontFamily: presentationTokens.fonts.monoFamily,
                color: presentationTokens.colors.neonYellow,
                textShadow: '0 0 20px rgba(255, 255, 0, 0.8)',
              }}
            >
              <div style={{ fontSize: '4rem' }}>{filesCount}</div>
              <div style={{ fontSize: '1.5rem', opacity: 0.8 }}>FILES</div>
            </motion.div>

            {/* Bottom Right - Great Success */}
            <motion.div
              initial={{ opacity: 0, y: 100, rotate: 10 }}
              animate={{ opacity: 1, y: 0, rotate: 5 }}
              transition={{ delay: 0.8, type: 'spring' }}
              style={{
                position: 'absolute',
                bottom: '20%',
                right: '15%',
                fontSize: presentationTokens.fonts.subtitleSize,
                fontFamily: presentationTokens.fonts.monoFamily,
                color: presentationTokens.colors.successGreen,
                textShadow: '0 0 20px rgba(0, 255, 100, 0.8)',
              }}
            >
              <div style={{ fontSize: '4rem', fontStyle: 'italic' }}>Great</div>
              <div style={{ fontSize: '1.5rem', opacity: 0.8, fontStyle: 'italic' }}>success!</div>
            </motion.div>

            {/* Center Bottom - Max Combo */}
            <motion.div
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.9, type: 'spring', bounce: 0.6 }}
              style={{
                position: 'absolute',
                bottom: '8%',
                left: '50%',
                transform: 'translateX(-50%)',
                fontSize: presentationTokens.fonts.subtitleSize,
                fontFamily: presentationTokens.fonts.monoFamily,
                color: presentationTokens.colors.gold,
                textShadow: presentationTokens.colors.textShadowGold,
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '5rem' }}>{combosCount}x</div>
              <div style={{ fontSize: '1.5rem', opacity: 0.8 }}>MAX COMBO</div>
            </motion.div>
          </>
        )}
      </motion.div>
    </>
  );
}
