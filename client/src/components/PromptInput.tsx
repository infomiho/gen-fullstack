import { useEffect, useRef, useState } from 'react';
import { focus, input } from '../lib/design-tokens';
import { getNextAnimationState, type AnimationState } from '../lib/placeholder-animation';

interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  id?: string;
}

export function PromptInput({ value, onChange, disabled, id }: PromptInputProps) {
  const [placeholderText, setPlaceholderText] = useState('');

  // Use ref to store animation state - avoids triggering re-renders
  const animationStateRef = useRef<AnimationState>({
    placeholderText: '',
    currentPromptIndex: 0,
    isTyping: true,
  });

  useEffect(() => {
    // Don't animate if user has typed something
    if (value) {
      setPlaceholderText('');
      animationStateRef.current = {
        placeholderText: '',
        currentPromptIndex: 0,
        isTyping: true,
      };
      return;
    }

    let cancelled = false; // Cancellation flag to prevent updates after unmount

    // Animation loop using refs
    const animate = (): NodeJS.Timeout => {
      if (cancelled) return setTimeout(() => {}, 0); // Return dummy timeout if cancelled

      const { nextState, delay } = getNextAnimationState(animationStateRef.current);

      const timeoutId = setTimeout(() => {
        if (cancelled) return; // Double-check before updating state
        animationStateRef.current = nextState;
        setPlaceholderText(nextState.placeholderText);
        animate(); // Recursively schedule next animation step
      }, delay);

      return timeoutId;
    };

    const timeoutId = animate();

    return () => {
      cancelled = true; // Set flag on cleanup
      clearTimeout(timeoutId);
    };
  }, [value]); // Only depend on 'value' prop

  return (
    <textarea
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholderText}
      disabled={disabled}
      rows={5}
      className={`${input.textarea} ${focus.ring} text-xl placeholder:text-gray-400`}
    />
  );
}
