import type { Meta, StoryObj } from '@storybook/react-vite';
import { StageIcon } from './StageIcon';

const meta = {
  title: 'Pipeline/StageIcon',
  component: StageIcon,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof StageIcon>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Planning: Story = {
  args: {
    type: 'planning',
  },
};

export const CodeGeneration: Story = {
  args: {
    type: 'code_generation',
  },
};

export const Validation: Story = {
  args: {
    type: 'validation',
  },
};

export const TemplateLoading: Story = {
  args: {
    type: 'template_loading',
  },
};

export const Completing: Story = {
  args: {
    type: 'completing',
  },
};

export const Large: Story = {
  args: {
    type: 'code_generation',
    size: 48,
  },
};

export const AllStages: Story = {
  args: {
    type: 'planning',
  },
  render: () => (
    <div className="flex gap-4 items-center">
      <div className="flex flex-col items-center gap-2">
        <StageIcon type="planning" />
        <span className="text-xs">Planning</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <StageIcon type="code_generation" />
        <span className="text-xs">Code Gen</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <StageIcon type="validation" />
        <span className="text-xs">Validation</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <StageIcon type="template_loading" />
        <span className="text-xs">Template</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <StageIcon type="completing" />
        <span className="text-xs">Completing</span>
      </div>
    </div>
  ),
};
