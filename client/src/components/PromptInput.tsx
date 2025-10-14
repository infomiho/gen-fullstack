import { Send } from 'lucide-react';
import { useState } from 'react';
import { focus, input, spacing, transitions } from '../lib/design-tokens';

interface PromptInputProps {
  onSubmit: (prompt: string) => void;
  disabled?: boolean;
}

export function PromptInput({ onSubmit, disabled }: PromptInputProps) {
  const [prompt, setPrompt] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim()) {
      onSubmit(prompt);
      setPrompt('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className={spacing.form}>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Describe your app..."
        disabled={disabled}
        rows={4}
        className={`${input.textarea} ${focus.ring}`}
      />
      <button
        type="submit"
        disabled={disabled || !prompt.trim()}
        className={`w-full flex items-center justify-center gap-2 rounded border border-gray-900 bg-gray-900 px-4 py-2 text-sm font-medium text-white ${transitions.colors} hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:border-gray-300 ${focus.ring}`}
      >
        <Send size={14} />
        Generate
      </button>
    </form>
  );
}
