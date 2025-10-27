import { motion, AnimatePresence } from 'motion/react';
import { useEffect } from 'react';
import { usePresentationStore } from '../../../stores/presentationStore';
import { presentationTokens } from '../../../lib/presentation-tokens';

/**
 * PlanningOverlay: Shows planning items with trailing fade-out effect
 *
 * Displays: Current item + 2 previous items fading out
 * Creates a "trace" of recent planning activity with smooth scrolling
 */
export function PlanningOverlay() {
  const { overlayData, planningHistory, addPlanningItem } = usePresentationStore();
  const item = overlayData.planItem;

  // Add current item to history when it changes
  useEffect(() => {
    if (item?.type && item?.name) {
      addPlanningItem(item.type, item.name);
    }
  }, [item?.type, item?.name, addPlanningItem]);

  if (!item) return null;

  // Get config for item type
  const getConfig = (type: 'model' | 'endpoint' | 'component') =>
    ({
      model: {
        label: 'DB MODEL',
        color: presentationTokens.colors.neonCyan,
        textShadow: presentationTokens.colors.textShadowStrong,
      },
      endpoint: {
        label: 'API ROUTE',
        color: presentationTokens.colors.neonMagenta,
        textShadow: '0 0 20px rgba(255, 0, 255, 0.8), 0 0 40px rgba(255, 0, 255, 0.5)',
      },
      component: {
        label: 'COMPONENT',
        color: presentationTokens.colors.successGreen,
        textShadow: '0 0 20px rgba(0, 255, 100, 0.8), 0 0 40px rgba(0, 255, 100, 0.5)',
      },
    })[type];

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
      transition={{ duration: 0.2 }}
    >
      {/* Main title */}
      <motion.div
        style={{
          fontSize: presentationTokens.fonts.titleSize,
          fontFamily: presentationTokens.fonts.heroFamily,
          color: presentationTokens.colors.neonYellow,
          textShadow: '0 0 20px rgba(255, 255, 0, 0.8), 0 0 40px rgba(255, 255, 0, 0.5)',
          letterSpacing: '0.2em',
          marginBottom: '4rem',
        }}
      >
        PLANNING ARCHITECTURE
      </motion.div>

      {/* Trailing list of items */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem',
          width: '800px',
          position: 'relative',
        }}
      >
        <AnimatePresence mode="popLayout">
          {planningHistory.map((historyItem, index) => {
            const config = getConfig(historyItem.type);
            const opacity = index === 0 ? 1 : index === 1 ? 0.5 : 0.25;
            const scale = index === 0 ? 1 : index === 1 ? 0.95 : 0.9;

            return (
              <motion.div
                key={`${historyItem.type}-${historyItem.name}-${historyItem.timestamp}`}
                layout
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity, y: 0, scale }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{
                  layout: { duration: 0.3, ease: 'easeOut' },
                  opacity: { duration: 0.2 },
                  scale: { duration: 0.2 },
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2rem',
                  padding: '1.5rem 2rem',
                  border: `2px solid ${config.color}`,
                  borderRadius: '8px',
                  backgroundColor: `rgba(0, 0, 0, ${0.7 - index * 0.2})`,
                }}
              >
                {/* Type label */}
                <div
                  style={{
                    fontSize: presentationTokens.fonts.subtitleSize,
                    fontFamily: presentationTokens.fonts.heroFamily,
                    color: config.color,
                    textShadow: config.textShadow,
                    minWidth: '200px',
                    textAlign: 'right',
                  }}
                >
                  {config.label}
                </div>

                {/* Item name */}
                <div
                  style={{
                    fontSize: index === 0 ? presentationTokens.fonts.bodySize : '1.5rem',
                    fontFamily: presentationTokens.fonts.monoFamily,
                    color: presentationTokens.colors.gold,
                    flex: 1,
                  }}
                >
                  {historyItem.name}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
