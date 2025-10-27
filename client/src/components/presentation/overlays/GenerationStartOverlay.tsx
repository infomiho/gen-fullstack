import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { presentationTokens } from '../../../lib/presentation-tokens';
import { usePresentationStore } from '../../../stores/presentationStore';

/**
 * GenerationStartOverlay: "READY... FIGHT!" Sequence
 *
 * Fighting game-style generation start sequence:
 * 1. "READY..." appears (0.5s)
 * 2. "FIGHT!!!" appears with screen shake (0.5s)
 * 3. Fade to config display showing input mode and capabilities
 */
export function GenerationStartOverlay() {
  const { setOverlay, currentConfig } = usePresentationStore();
  const [phase, setPhase] = useState<'ready' | 'fight' | 'config'>('ready');

  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];

    // Phase 1: READY (500ms)
    timers.push(
      setTimeout(() => {
        setPhase('fight');
      }, presentationTokens.timing.readyDuration),
    );

    // Phase 2: FIGHT! (500ms)
    timers.push(
      setTimeout(() => {
        setPhase('config');
      }, presentationTokens.timing.readyDuration + presentationTokens.timing.fightDuration),
    );

    // Phase 3: Config display (1000ms) then transition to HUD
    timers.push(
      setTimeout(
        () => {
          setOverlay('tool-hud');
        },
        presentationTokens.timing.readyDuration + presentationTokens.timing.fightDuration + 1000,
      ),
    );

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [setOverlay]);

  return (
    <motion.div
      className="fixed inset-0 flex items-center justify-center"
      style={{
        backgroundColor: presentationTokens.colors.overlayDark,
        zIndex: presentationTokens.zIndex.overlay,
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
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
          FIGHT!!!
        </motion.div>
      )}

      {phase === 'config' && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-center"
          style={{
            fontSize: presentationTokens.fonts.bodySize,
            fontFamily: presentationTokens.fonts.bodyFamily,
            color: presentationTokens.colors.neonCyan,
          }}
        >
          <div
            className="mb-8"
            style={{
              fontSize: presentationTokens.fonts.titleSize,
              fontFamily: presentationTokens.fonts.heroFamily,
              letterSpacing: '0.1em',
              textShadow: presentationTokens.colors.textShadowStrong,
            }}
          >
            GEN ARENA
          </div>

          <div
            className="border-2 p-8 inline-block"
            style={{
              borderColor: presentationTokens.colors.neonCyan,
              backgroundColor: 'rgba(0, 255, 255, 0.1)',
              boxShadow: `0 0 30px ${presentationTokens.colors.neonCyan}`,
            }}
          >
            <div className="mb-4">
              <span className="opacity-70">INPUT MODE: </span>
              <span className="font-bold uppercase">{currentConfig?.inputMode || 'NAIVE'}</span>
            </div>
            <div className="mb-4">
              <span className="opacity-70">PLANNING: </span>
              <span className="font-bold">{currentConfig?.planning ? 'ON' : 'OFF'}</span>
            </div>
            <div>
              <span className="opacity-70">COMPILER CHECKS: </span>
              <span className="font-bold">{currentConfig?.compilerChecks ? 'ON' : 'OFF'}</span>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
