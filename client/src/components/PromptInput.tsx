import { Send } from 'lucide-react';
import { useState } from 'react';

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
    <form onSubmit={handleSubmit} className="space-y-2">
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Describe your app..."
        disabled={disabled}
        rows={4}
        className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none disabled:bg-gray-50 resize-none font-mono"
      />
      <button
        type="submit"
        disabled={disabled || !prompt.trim()}
        className="w-full flex items-center justify-center gap-2 rounded border border-gray-900 bg-gray-900 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:border-gray-300"
      >
        <Send size={14} />
        Generate
      </button>
    </form>
  );
}
