import { motion } from 'motion/react';
import React, { useId } from 'react';
import Particles from '@tsparticles/react';
import { presentationTokens } from '../../../lib/presentation-tokens';
import { usePresentationStore } from '../../../stores/presentationStore';

/**
 * VictoryOverlay: "PERFECT!" Final Stats Screen
 *
 * Displays when generation completes successfully:
 * - Large "PERFECT!!!" text in gold
 * - Animated stat counters (duration, tool calls, files, combos)
 * - Progress bars with count-up animations
 * - Continuous fireworks in background
 * - Stays visible until dismissed
 */
export function VictoryOverlay() {
  const { stats } = usePresentationStore();
  const particlesId = useId();

  // Animated counter hook
  const useCountUp = (end: number, duration: number = 1000) => {
    const [count, setCount] = React.useState(0);

    React.useEffect(() => {
      let startTime: number;
      let animationFrame: number;

      const animate = (currentTime: number) => {
        if (!startTime) startTime = currentTime;
        const progress = Math.min((currentTime - startTime) / duration, 1);
        setCount(Math.floor(progress * end));

        if (progress < 1) {
          animationFrame = requestAnimationFrame(animate);
        }
      };

      animationFrame = requestAnimationFrame(animate);
      return () => cancelAnimationFrame(animationFrame);
    }, [end, duration]);

    return count;
  };

  const durationCount = useCountUp(Math.round(stats.duration * 10), 1500);
  const toolCallsCount = useCountUp(stats.toolCalls, 1500);
  const filesCount = useCountUp(stats.filesCreated, 1500);
  const successRateCount = useCountUp(stats.successRate, 1500);
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

      {/* Victory Screen */}
      <motion.div
        className="fixed inset-0 flex flex-col items-center justify-center"
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.95)',
          zIndex: presentationTokens.zIndex.overlay,
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Stars Border */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', bounce: 0.4 }}
          style={{
            fontSize: presentationTokens.fonts.bodySize,
            color: presentationTokens.colors.gold,
            marginBottom: '2rem',
          }}
        >
          ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★
        </motion.div>

        {/* "PERFECT!" Title */}
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
            marginBottom: '3rem',
            perspective: '1000px',
          }}
        >
          PERFECT!!!
        </motion.div>

        {/* Stats Panel */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="border-4 p-8 max-h-[80vh] overflow-y-auto"
          style={{
            borderColor: presentationTokens.colors.gold,
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            minWidth: '600px',
            maxWidth: '800px',
            boxShadow: `0 0 50px ${presentationTokens.colors.gold}`,
          }}
        >
          <div
            className="mb-8 pb-4 border-b-2"
            style={{
              fontSize: presentationTokens.fonts.titleSize,
              fontFamily: presentationTokens.fonts.heroFamily,
              color: presentationTokens.colors.gold,
              textAlign: 'center',
              letterSpacing: '0.1em',
              borderColor: presentationTokens.colors.gold,
            }}
          >
            📊 FINAL STATS
          </div>

          <div className="space-y-4">
            <StatRow
              icon="⏱️"
              label="Duration"
              value={`${(durationCount / 10).toFixed(1)}s`}
              percentage={100}
            />
            <StatRow
              icon="🔧"
              label="Tool Calls"
              value={toolCallsCount.toString()}
              percentage={100}
            />
            <StatRow
              icon="📁"
              label="Files Created"
              value={filesCount.toString()}
              percentage={100}
            />
            <StatRow
              icon="💯"
              label="Success Rate"
              value={`${successRateCount}%`}
              percentage={successRateCount}
            />
            <StatRow
              icon="🎯"
              label="Max Combo"
              value={`${combosCount}x`}
              percentage={Math.min((combosCount / 10) * 100, 100)}
            />
          </div>
        </motion.div>
      </motion.div>
    </>
  );
}

interface StatRowProps {
  icon: string;
  label: string;
  value: string;
  percentage: number;
}

function StatRow({ icon, label, value, percentage }: StatRowProps) {
  return (
    <div>
      <div
        className="flex items-center justify-between mb-2"
        style={{
          fontSize: presentationTokens.fonts.bodySize,
          fontFamily: presentationTokens.fonts.bodyFamily,
          color: presentationTokens.colors.neonCyan,
        }}
      >
        <div className="flex items-center gap-4">
          <span>{icon}</span>
          <span>{label}:</span>
        </div>
        <span
          style={{
            fontFamily: presentationTokens.fonts.monoFamily,
            color: presentationTokens.colors.gold,
          }}
        >
          {value}
        </span>
      </div>

      {/* Progress Bar */}
      <div
        className="relative h-4 border-2"
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          borderColor: presentationTokens.colors.neonCyan,
        }}
      >
        <motion.div
          className="absolute inset-0"
          style={{
            backgroundColor: presentationTokens.colors.gold,
            boxShadow: `0 0 20px ${presentationTokens.colors.gold}`,
          }}
          initial={{ width: '0%' }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}
