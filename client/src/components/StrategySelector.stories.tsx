import type { Meta, StoryObj } from '@storybook/react-vite';
import { STRATEGIES } from '@gen-fullstack/shared';
import { expect, fn, userEvent, within } from '@storybook/test';
import { StrategySelector } from './StrategySelector';

/**
 * StrategySelector allows users to choose different code generation strategies.
 * Implemented strategies:
 * - Naive: Direct prompt-to-code generation ✅
 * - Plan First: Generate plan before implementation ✅
 * - With Template: Start from pre-built template ✅
 *
 * Coming soon:
 * - Compiler Checks: Self-correct with TypeScript errors 🚧
 * - Building Blocks: Use higher-level components 🚧
 */
const meta: Meta<typeof StrategySelector> = {
  title: 'Components/StrategySelector',
  component: StrategySelector,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  argTypes: {
    value: {
      control: 'select',
      options: ['naive', 'plan-first', 'template'],
      description: 'Currently selected strategy (only implemented strategies)',
    },
    disabled: {
      control: 'boolean',
      description: 'Whether the selector is disabled',
    },
  },
};

export default meta;
type Story = StoryObj<typeof StrategySelector>;

/**
 * Default state with Naive strategy selected
 */
export const Default: Story = {
  args: {
    value: 'naive',
    onChange: (_value: string) => {},
    disabled: false,
  },
};

/**
 * Plan First strategy selected
 */
export const PlanFirst: Story = {
  args: {
    value: 'plan-first',
    onChange: (_value: string) => {},
    disabled: false,
  },
};

/**
 * Disabled state - user cannot change strategy during generation
 */
export const Disabled: Story = {
  args: {
    value: 'naive',
    onChange: (_value: string) => {},
    disabled: true,
  },
};

/**
 * All implemented strategies for comparison
 */
export const AllStrategies: Story = {
  render: () => {
    const implementedStrategies = STRATEGIES.filter((s) => s.implemented);
    return (
      <div className="space-y-4">
        {implementedStrategies.map((strategy) => (
          <div key={strategy.value}>
            <h3 className="font-semibold mb-2">{strategy.label}</h3>
            <StrategySelector value={strategy.value} onChange={() => {}} />
          </div>
        ))}
      </div>
    );
  },
};

/**
 * Shows disabled (unimplemented) strategies - they appear grayed out and cannot be selected
 */
export const WithDisabledStrategies: Story = {
  args: {
    value: 'naive',
    onChange: fn(),
  },
  parameters: {
    docs: {
      description: {
        story:
          'Unimplemented strategies (Compiler Checks, Building Blocks) appear with "(Coming Soon)" and are disabled.',
      },
    },
  },
};

/**
 * Test: User can select different strategies
 */
export const UserCanSelectStrategy: Story = {
  args: {
    value: 'naive',
    onChange: fn(),
    disabled: false,
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Find the select element
    const select = canvas.getByRole('combobox');

    // Verify initial value
    await expect(select).toHaveValue('naive');

    // Change to plan-first
    await userEvent.selectOptions(select, 'plan-first');

    // Verify onChange was called with new value
    await expect(args.onChange).toHaveBeenCalledWith('plan-first');
  },
};

/**
 * Test: Cannot change strategy when disabled
 */
export const CannotChangeWhenDisabled: Story = {
  args: {
    value: 'naive',
    onChange: fn(),
    disabled: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const select = canvas.getByRole('combobox');

    // Verify select is disabled
    await expect(select).toBeDisabled();
  },
};
