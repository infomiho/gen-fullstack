/**
 * Design tokens for Presentation Mode (Fighting Game Arena style)
 * Inspired by Tekken, Street Fighter, and conference presentations
 */

export const presentationTokens = {
  colors: {
    // Neon palette for fighting game aesthetics
    neonCyan: 'rgb(0, 255, 255)',
    neonMagenta: 'rgb(255, 0, 255)',
    neonYellow: 'rgb(255, 255, 0)',
    gold: 'rgb(255, 215, 0)',
    errorRed: 'rgb(255, 50, 50)',
    successGreen: 'rgb(0, 255, 100)',

    // Background overlays - radial gradient for spotlight effect
    overlayDark: 'rgba(0, 0, 0, 0.9)',
    overlayGlow: 'rgba(0, 255, 255, 0.2)',
    overlayRadial:
      'radial-gradient(circle at center, rgba(0, 0, 0, 0.5) 0%, rgba(0, 0, 0, 0.7) 70%, rgba(0, 0, 0, 0.85) 100%)',

    // Text shadows for stage visibility
    textShadowStrong: '0 0 20px rgba(0, 255, 255, 0.8), 0 0 40px rgba(0, 255, 255, 0.5)',
    textShadowError: '0 0 20px rgba(255, 50, 50, 0.8), 0 0 40px rgba(255, 50, 50, 0.5)',
    textShadowGold: '0 0 20px rgba(255, 215, 0, 0.8), 0 0 40px rgba(255, 215, 0, 0.5)',
  },

  fonts: {
    // Stage-visible font sizes (readable from 20+ feet)
    heroSize: '8rem', // "GENERATING", "FIGHT!"
    titleSize: '4rem', // Section headers, "K.O."
    subtitleSize: '3rem', // Sub-headers
    bodySize: '2rem', // Body text (stage-visible)
    monoSize: '1.5rem', // Code/stats
    captionSize: '1.25rem', // Small details

    // Font families
    heroFamily: '"Impact", "Arial Black", sans-serif',
    bodyFamily: '"Inter", sans-serif',
    monoFamily: '"JetBrains Mono", "Consolas", monospace',
  },

  animations: {
    // Hero entrance animations
    heroEnter: {
      duration: 1.2,
      type: 'spring' as const,
      bounce: 0.3,
    },

    // Slide in from side
    slideIn: {
      duration: 0.4,
      ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
    },

    // Glitch effect
    glitch: {
      duration: 0.2,
      repeat: 3,
    },

    // Shake effect
    shake: {
      duration: 0.5,
      intensity: 20,
    },

    // Particle effects
    confetti: {
      particleCount: 200,
      spread: 90,
      origin: { y: 0.6 },
    },

    fireworks: {
      particleCount: 300,
      spread: 120,
      startVelocity: 45,
    },
  },

  spacing: {
    // Full-screen overlay padding
    overlayPadding: '4rem',
    hudMargin: '2rem',

    // Component spacing
    sectionGap: '3rem',
    itemGap: '1.5rem',
    tightGap: '0.75rem',
  },

  zIndex: {
    // Layering for overlays
    presentationBase: 10000,
    overlay: 10100,
    hud: 10200,
    modal: 10300,
    particles: 10400,
  },

  timing: {
    // Display durations
    readyDuration: 500, // "READY" display time
    fightDuration: 500, // "FIGHT!" display time
    toastDuration: 2000, // File created toast
    koDuration: 3000, // Error K.O. screen
    victoryDuration: 5000, // Final victory screen

    // Combo timing
    comboWindow: 1000, // Time to maintain combo

    // File creation animation timing
    fileCreatedFirstDelay: 350, // First file (more visible)
    fileCreatedDelay: 150, // Subsequent files (faster pace)
  },

  assets: {
    // Victory overlay assets
    victoryGif: '/borat-very-nice.gif',
  },
} as const;

export type PresentationTokens = typeof presentationTokens;
