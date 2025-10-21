import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
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
  render: () => <CheckboxWrapper id="unchecked" checked={false} />,
};

export const Checked: Story = {
  args: { id: '', checked: false, onCheckedChange: () => {} },
  render: () => <CheckboxWrapper id="checked" checked={true} />,
};

export const Disabled: Story = {
  args: { id: '', checked: false, onCheckedChange: () => {} },
  render: () => <CheckboxWrapper id="disabled" checked={false} mode="disabled" />,
};

export const CheckedDisabled: Story = {
  args: { id: '', checked: false, onCheckedChange: () => {} },
  render: () => <CheckboxWrapper id="checked-disabled" checked={true} mode="disabled" />,
};

export const ReadOnly: Story = {
  args: { id: '', checked: false, onCheckedChange: () => {} },
  render: () => <CheckboxWrapper id="readonly" checked={true} mode="readonly" />,
};

export const WithLabel: Story = {
  args: { id: '', checked: false, onCheckedChange: () => {} },
  render: () => (
    <div className="flex items-center gap-2">
      <CheckboxWrapper id="with-label" checked={false} />
      <label htmlFor="with-label" className="text-sm text-gray-700 cursor-pointer">
        Accept terms and conditions
      </label>
    </div>
  ),
};
