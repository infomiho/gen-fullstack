import { focus, input } from '../lib/design-tokens';

interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  id?: string;
}

export function PromptInput({ value, onChange, disabled, id }: PromptInputProps) {
  return (
    <textarea
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Describe the app you want to build... (e.g., A todo list with authentication, A blog with comments, An expense tracker)"
      disabled={disabled}
      rows={5}
      className={`${input.textarea} ${focus.ring}`}
    />
  );
}
