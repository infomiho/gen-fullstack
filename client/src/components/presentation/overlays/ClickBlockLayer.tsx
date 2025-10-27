import { presentationTokens } from '../../../lib/presentation-tokens';

/**
 * ClickBlockLayer: Invisible layer to block clicks during presentation
 *
 * Prevents user from clicking UI elements behind presentation overlays
 * Used by overlays that don't need full modal blocking
 */
export function ClickBlockLayer() {
  return (
    <div
      className="fixed inset-0"
      style={{
        zIndex: presentationTokens.zIndex.overlay - 1,
        pointerEvents: 'auto',
      }}
    />
  );
}
