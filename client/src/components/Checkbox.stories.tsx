import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState, useId } from 'react';
import { Checkbox } from './Checkbox';

const meta = {
  title: 'Components/Checkbox',
  component: Checkbox,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

// Wrapper component to manage state
function CheckboxWrapper({
  checked: initialChecked,
  ...props
}: Omit<React.ComponentProps<typeof Checkbox>, 'onCheckedChange'>) {
  const [checked, setChecked] = useState(initialChecked);
  return <Checkbox {...props} checked={checked} onCheckedChange={setChecked} />;
}

export const Unchecked: Story = {
  args: { id: '', checked: false, onCheckedChange: () => {} },
  render: function Render() {
    const id = useId();
    return <CheckboxWrapper id={id} checked={false} />;
  },
};

export const Checked: Story = {
  args: { id: '', checked: false, onCheckedChange: () => {} },
  render: function Render() {
    const id = useId();
    return <CheckboxWrapper id={id} checked={true} />;
  },
};

export const Disabled: Story = {
  args: { id: '', checked: false, onCheckedChange: () => {} },
  render: function Render() {
    const id = useId();
    return <CheckboxWrapper id={id} checked={false} mode="disabled" />;
  },
};

export const CheckedDisabled: Story = {
  args: { id: '', checked: false, onCheckedChange: () => {} },
  render: function Render() {
    const id = useId();
    return <CheckboxWrapper id={id} checked={true} mode="disabled" />;
  },
};

export const ReadOnly: Story = {
  args: { id: '', checked: false, onCheckedChange: () => {} },
  render: function Render() {
    const id = useId();
    return <CheckboxWrapper id={id} checked={true} mode="readonly" />;
  },
};

export const WithLabel: Story = {
  args: { id: '', checked: false, onCheckedChange: () => {} },
  render: function Render() {
    const id = useId();
    return (
      <div className="flex items-center gap-2">
        <CheckboxWrapper id={id} checked={false} />
        <label htmlFor={id} className="text-sm text-gray-700 cursor-pointer">
          Accept terms and conditions
        </label>
      </div>
    );
  },
};
