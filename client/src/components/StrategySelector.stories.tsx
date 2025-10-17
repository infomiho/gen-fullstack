import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from '@storybook/test';
import { StrategySelector } from './StrategySelector';

/**
 * StrategySelector allows users to choose different code generation strategies.
 * Strategies include:
 * - Naive: Direct prompt-to-code generation
 * - Plan First: Generate plan before implementation
 * - With Template: Start from pre-built template
 * - Compiler Checks: Self-correct with TypeScript errors
 * - Building Blocks: Use higher-level components
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
      options: ['naive', 'plan-first', 'template', 'compiler-check', 'building-blocks'],
      description: 'Currently selected strategy',
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
 * All strategies for comparison
 */
export const AllStrategies: Story = {
  render: () => (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold mb-2">Naive</h3>
        <StrategySelector value="naive" onChange={() => {}} />
      </div>
      <div>
        <h3 className="font-semibold mb-2">Plan First</h3>
        <StrategySelector value="plan-first" onChange={() => {}} />
      </div>
      <div>
        <h3 className="font-semibold mb-2">With Template</h3>
        <StrategySelector value="template" onChange={() => {}} />
      </div>
      <div>
        <h3 className="font-semibold mb-2">Compiler Checks</h3>
        <StrategySelector value="compiler-check" onChange={() => {}} />
      </div>
      <div>
        <h3 className="font-semibold mb-2">Building Blocks</h3>
        <StrategySelector value="building-blocks" onChange={() => {}} />
      </div>
    </div>
  ),
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
