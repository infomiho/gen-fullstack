import { describe, expect, it } from 'vitest';
import {
  getNextAnimationState,
  PLACEHOLDER_PREFIX,
  PLACEHOLDER_PROMPTS,
  type AnimationState,
} from './placeholder-animation';

describe('Placeholder Animation Logic', () => {
  describe('Constants', () => {
    it('should have correct prefix', () => {
      expect(PLACEHOLDER_PREFIX).toBe("Let's build ");
    });

    it('should have 5 placeholder prompts', () => {
      expect(PLACEHOLDER_PROMPTS).toHaveLength(5);
    });

    it('should have valid prompt content', () => {
      for (const prompt of PLACEHOLDER_PROMPTS) {
        expect(prompt.length).toBeGreaterThan(0);
        expect(prompt).toMatch(/^[a-z]/); // Starts with lowercase (after prefix)
      }
    });
  });

  describe('Typing Animation', () => {
    it('should type one character at a time', () => {
      const state: AnimationState = {
        placeholderText: '',
        currentPromptIndex: 0,
        isTyping: true,
      };

      const { nextState, delay } = getNextAnimationState(state);

      expect(nextState.placeholderText).toBe('L');
      expect(nextState.isTyping).toBe(true);
      expect(delay).toBe(30);
    });

    it('should continue typing progressively', () => {
      const state: AnimationState = {
        placeholderText: 'L',
        currentPromptIndex: 0,
        isTyping: true,
      };

      const result1 = getNextAnimationState(state);
      expect(result1.nextState.placeholderText).toBe('Le');

      const result2 = getNextAnimationState(result1.nextState);
      expect(result2.nextState.placeholderText).toBe('Let');

      const result3 = getNextAnimationState(result2.nextState);
      expect(result3.nextState.placeholderText).toBe("Let'");
    });

    it('should type the full text including prefix', () => {
      const fullText = PLACEHOLDER_PREFIX + PLACEHOLDER_PROMPTS[0];
      let state: AnimationState = {
        placeholderText: '',
        currentPromptIndex: 0,
        isTyping: true,
      };

      // Type all characters
      for (let i = 0; i < fullText.length; i++) {
        const { nextState, delay } = getNextAnimationState(state);
        expect(delay).toBe(30); // Typing speed
        state = nextState;
      }

      expect(state.placeholderText).toBe(fullText);
    });

    it('should switch to pausing after completing typing', () => {
      const fullText = PLACEHOLDER_PREFIX + PLACEHOLDER_PROMPTS[0];
      const state: AnimationState = {
        placeholderText: fullText,
        currentPromptIndex: 0,
        isTyping: true,
      };

      const { nextState, delay } = getNextAnimationState(state);

      expect(nextState.placeholderText).toBe(fullText); // Same text
      expect(nextState.isTyping).toBe(false); // Switch to erasing mode
      expect(delay).toBe(2000); // Pause duration
    });
  });

  describe('Erasing Animation', () => {
    it('should erase one character at a time', () => {
      const fullText = PLACEHOLDER_PREFIX + PLACEHOLDER_PROMPTS[0];
      const state: AnimationState = {
        placeholderText: fullText,
        currentPromptIndex: 0,
        isTyping: false,
      };

      const { nextState, delay } = getNextAnimationState(state);

      expect(nextState.placeholderText).toBe(fullText.slice(0, -1));
      expect(nextState.isTyping).toBe(false);
      expect(delay).toBe(15); // Erasing speed
    });

    it('should erase progressively', () => {
      const state: AnimationState = {
        placeholderText: "Let's build abc",
        currentPromptIndex: 0,
        isTyping: false,
      };

      const result1 = getNextAnimationState(state);
      expect(result1.nextState.placeholderText).toBe("Let's build ab");

      const result2 = getNextAnimationState(result1.nextState);
      expect(result2.nextState.placeholderText).toBe("Let's build a");

      const result3 = getNextAnimationState(result2.nextState);
      expect(result3.nextState.placeholderText).toBe("Let's build ");
    });

    it('should stop erasing at the prefix', () => {
      const state: AnimationState = {
        placeholderText: PLACEHOLDER_PREFIX,
        currentPromptIndex: 0,
        isTyping: false,
      };

      const { nextState, delay } = getNextAnimationState(state);

      expect(nextState.placeholderText).toBe(PLACEHOLDER_PREFIX); // Same text
      expect(nextState.currentPromptIndex).toBe(1); // Move to next prompt
      expect(nextState.isTyping).toBe(true); // Switch to typing mode
      expect(delay).toBe(0); // Start immediately
    });

    it('should erase only the dynamic part, not the prefix', () => {
      const fullText = PLACEHOLDER_PREFIX + PLACEHOLDER_PROMPTS[0];
      const promptLength = PLACEHOLDER_PROMPTS[0].length;

      let state: AnimationState = {
        placeholderText: fullText,
        currentPromptIndex: 0,
        isTyping: false,
      };

      // Erase all prompt characters
      for (let i = 0; i < promptLength; i++) {
        const { nextState } = getNextAnimationState(state);
        state = nextState;
      }

      expect(state.placeholderText).toBe(PLACEHOLDER_PREFIX);
    });
  });

  describe('Cycling Through Prompts', () => {
    it('should move to the next prompt after erasing', () => {
      const state: AnimationState = {
        placeholderText: PLACEHOLDER_PREFIX,
        currentPromptIndex: 0,
        isTyping: false,
      };

      const { nextState } = getNextAnimationState(state);

      expect(nextState.currentPromptIndex).toBe(1);
      expect(nextState.isTyping).toBe(true);
    });

    it('should cycle through all prompts', () => {
      let currentIndex = 0;

      for (let i = 0; i < PLACEHOLDER_PROMPTS.length; i++) {
        const state: AnimationState = {
          placeholderText: PLACEHOLDER_PREFIX,
          currentPromptIndex: currentIndex,
          isTyping: false,
        };

        const { nextState } = getNextAnimationState(state);
        currentIndex = nextState.currentPromptIndex;

        expect(currentIndex).toBe((i + 1) % PLACEHOLDER_PROMPTS.length);
      }
    });

    it('should loop back to the first prompt after the last', () => {
      const state: AnimationState = {
        placeholderText: PLACEHOLDER_PREFIX,
        currentPromptIndex: PLACEHOLDER_PROMPTS.length - 1,
        isTyping: false,
      };

      const { nextState } = getNextAnimationState(state);

      expect(nextState.currentPromptIndex).toBe(0); // Back to first
    });
  });

  describe('Full Animation Cycle', () => {
    it('should complete a full typing and erasing cycle', () => {
      const fullText = PLACEHOLDER_PREFIX + PLACEHOLDER_PROMPTS[0];
      let state: AnimationState = {
        placeholderText: '',
        currentPromptIndex: 0,
        isTyping: true,
      };

      // Type all characters
      for (let i = 0; i < fullText.length; i++) {
        const { nextState } = getNextAnimationState(state);
        state = nextState;
      }
      expect(state.placeholderText).toBe(fullText);
      expect(state.isTyping).toBe(true);

      // Pause
      const pauseResult = getNextAnimationState(state);
      expect(pauseResult.delay).toBe(2000);
      expect(pauseResult.nextState.isTyping).toBe(false);
      state = pauseResult.nextState;

      // Erase back to prefix
      const charsToErase = PLACEHOLDER_PROMPTS[0].length;
      for (let i = 0; i < charsToErase; i++) {
        const { nextState } = getNextAnimationState(state);
        state = nextState;
      }
      expect(state.placeholderText).toBe(PLACEHOLDER_PREFIX);
      expect(state.isTyping).toBe(false);

      // Move to next prompt
      const nextPromptResult = getNextAnimationState(state);
      expect(nextPromptResult.nextState.currentPromptIndex).toBe(1);
      expect(nextPromptResult.nextState.isTyping).toBe(true);
    });
  });
});
