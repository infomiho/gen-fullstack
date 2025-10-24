/**
 * Placeholder Animation Logic
 *
 * Handles the typing/erasing animation logic for placeholder text.
 * Separated for easier testing without React component overhead.
 */

export const PLACEHOLDER_PREFIX = "Let's build ";

export const PLACEHOLDER_PROMPTS = [
  'a real-time chat application with rooms and user authentication...',
  'a task management app with drag-and-drop and team collaboration...',
  'an e-commerce store with product search and shopping cart...',
  'a blog platform with markdown support and comments...',
  'a recipe sharing app with ratings and favorites...',
];

export interface AnimationState {
  placeholderText: string;
  currentPromptIndex: number;
  isTyping: boolean;
}

export interface AnimationAction {
  nextState: AnimationState;
  delay: number;
}

/**
 * Calculate the next animation state
 */
export function getNextAnimationState(state: AnimationState): AnimationAction {
  const { placeholderText, currentPromptIndex, isTyping } = state;
  const currentPrompt = PLACEHOLDER_PROMPTS[currentPromptIndex];
  const fullText = PLACEHOLDER_PREFIX + currentPrompt;

  if (isTyping) {
    // Typing animation
    if (placeholderText.length < fullText.length) {
      return {
        nextState: {
          placeholderText: fullText.slice(0, placeholderText.length + 1),
          currentPromptIndex,
          isTyping: true,
        },
        delay: 30, // Typing speed
      };
    }
    // Pause after typing completes
    return {
      nextState: {
        placeholderText,
        currentPromptIndex,
        isTyping: false,
      },
      delay: 2000, // Pause duration
    };
  }

  // Erasing animation - only erase until we reach the prefix
  if (placeholderText.length > PLACEHOLDER_PREFIX.length) {
    return {
      nextState: {
        placeholderText: placeholderText.slice(0, -1),
        currentPromptIndex,
        isTyping: false,
      },
      delay: 15, // Erasing speed (faster than typing)
    };
  }

  // Move to next prompt and start typing again
  return {
    nextState: {
      placeholderText,
      currentPromptIndex: (currentPromptIndex + 1) % PLACEHOLDER_PROMPTS.length,
      isTyping: true,
    },
    delay: 0, // Start immediately
  };
}
