import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { FilterButton } from './FilterButton';

const meta = {
  title: 'Components/FilterButton',
  component: FilterButton,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    label: {
      description: 'Button label text',
      control: 'text',
    },
    isActive: {
      description: 'Whether this filter is currently active',
      control: 'boolean',
    },
    variant: {
      description: 'Button color variant',
      control: 'select',
      options: ['gray', 'purple', 'yellow', 'blue', 'amber', 'red'],
    },
  },
} satisfies Meta<typeof FilterButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Gray: Story = {
  args: {
    label: 'All',
    isActive: true,
    variant: 'gray',
    onClick: () => {},
  },
};

export const Purple: Story = {
  args: {
    label: 'Commands',
    isActive: true,
    variant: 'purple',
    onClick: () => {},
  },
};

export const Yellow: Story = {
  args: {
    label: 'System',
    isActive: true,
    variant: 'yellow',
    onClick: () => {},
  },
};

export const Blue: Story = {
  args: {
    label: 'Info',
    isActive: true,
    variant: 'blue',
    onClick: () => {},
  },
};

export const Amber: Story = {
  args: {
    label: 'Warn',
    isActive: true,
    variant: 'amber',
    onClick: () => {},
  },
};

export const Red: Story = {
  args: {
    label: 'Error',
    isActive: true,
    variant: 'red',
    onClick: () => {},
  },
};

export const Inactive: Story = {
  args: {
    label: 'Inactive',
    isActive: false,
    variant: 'gray',
    onClick: () => {},
  },
};

/**
 * Interactive example with filter group
 */
export const FilterGroup = () => {
  const [activeFilter, setActiveFilter] = useState<string>('all');

  const filters = [
    { value: 'all', label: 'All', variant: 'gray' as const },
    { value: 'command', label: 'Commands', variant: 'purple' as const },
    { value: 'system', label: 'System', variant: 'yellow' as const },
    { value: 'info', label: 'Info', variant: 'blue' as const },
    { value: 'warn', label: 'Warn', variant: 'amber' as const },
    { value: 'error', label: 'Error', variant: 'red' as const },
  ];

  return (
    <div className="flex gap-1">
      {filters.map((filter) => (
        <FilterButton
          key={filter.value}
          label={filter.label}
          isActive={activeFilter === filter.value}
          onClick={() => setActiveFilter(filter.value)}
          variant={filter.variant}
        />
      ))}
    </div>
  );
};
