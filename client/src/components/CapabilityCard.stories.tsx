import type { Meta, StoryObj } from '@storybook/react-vite';
import { BrainCircuit, FileCode, ScanSearch } from 'lucide-react';
import { useState, useId } from 'react';
import { CapabilityCard } from './CapabilityCard';
import { capabilityIcons } from '../lib/design-tokens';

const meta = {
  title: 'Components/CapabilityCard',
  component: CapabilityCard,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof CapabilityCard>;

export default meta;
type Story = StoryObj<typeof meta>;

// Wrapper component to manage state
function CardWrapper(props: Omit<React.ComponentProps<typeof CapabilityCard>, 'onCheckedChange'>) {
  const [checked, setChecked] = useState(props.checked);
  return <CapabilityCard {...props} checked={checked} onCheckedChange={setChecked} />;
}

export const Unchecked: Story = {
  args: {
    id: '',
    icon: BrainCircuit,
    iconColor: '',
    title: '',
    description: '',
    hoverInfo: '',
    checked: false,
    onCheckedChange: () => {},
  },
  render: function Render() {
    const id = useId();
    return (
      <div className="w-96">
        <CardWrapper
          id={id}
          icon={BrainCircuit}
          iconColor={capabilityIcons.planning}
          title="Smart Planning"
          description="Design architecture first before implementation"
          hoverInfo="Generates an architectural plan including database schema, API endpoints, and component structure before writing any code."
          checked={false}
        />
      </div>
    );
  },
};

export const Checked: Story = {
  args: {
    id: '',
    icon: BrainCircuit,
    iconColor: '',
    title: '',
    description: '',
    hoverInfo: '',
    checked: false,
    onCheckedChange: () => {},
  },
  render: function Render() {
    const id = useId();
    return (
      <div className="w-96">
        <CardWrapper
          id={id}
          icon={BrainCircuit}
          iconColor={capabilityIcons.planning}
          title="Smart Planning"
          description="Design architecture first before implementation"
          hoverInfo="Generates an architectural plan including database schema, API endpoints, and component structure before writing any code."
          checked={true}
        />
      </div>
    );
  },
};

export const Disabled: Story = {
  args: {
    id: '',
    icon: BrainCircuit,
    iconColor: '',
    title: '',
    description: '',
    hoverInfo: '',
    checked: false,
    onCheckedChange: () => {},
  },
  render: function Render() {
    const id = useId();
    return (
      <div className="w-96">
        <CardWrapper
          id={id}
          icon={BrainCircuit}
          iconColor={capabilityIcons.planning}
          title="Smart Planning"
          description="Design architecture first before implementation"
          hoverInfo="Generates an architectural plan including database schema, API endpoints, and component structure before writing any code."
          checked={false}
          mode="disabled"
        />
      </div>
    );
  },
};

export const WithNestedControls: Story = {
  args: {
    id: '',
    icon: BrainCircuit,
    iconColor: '',
    title: '',
    description: '',
    hoverInfo: '',
    checked: false,
    onCheckedChange: () => {},
  },
  render: function Render() {
    const id = useId();
    const iterationsId = useId();
    const [maxIterations, setMaxIterations] = useState(3);
    return (
      <div className="w-96">
        <CardWrapper
          id={id}
          icon={ScanSearch}
          iconColor={capabilityIcons.compiler}
          title="Auto Error-Fixing"
          description="Validate and fix TypeScript and Prisma errors"
          hoverInfo="Automatically runs compiler checks and attempts to fix any errors found in the generated code."
          checked={true}
        >
          <div className="space-y-2">
            <label htmlFor={iterationsId} className="text-xs font-medium text-gray-700">
              Max iterations: {maxIterations}
            </label>
            <input
              id={iterationsId}
              type="range"
              min="1"
              max="5"
              value={maxIterations}
              onChange={(e) => setMaxIterations(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-900"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>1</span>
              <span>5</span>
            </div>
          </div>
        </CardWrapper>
      </div>
    );
  },
};

export const AllCapabilities: Story = {
  args: {
    id: '',
    icon: BrainCircuit,
    iconColor: '',
    title: '',
    description: '',
    hoverInfo: '',
    checked: false,
    onCheckedChange: () => {},
  },
  render: function Render() {
    const id1 = useId();
    const id2 = useId();
    const id3 = useId();
    return (
      <div className="w-96 space-y-3">
        <CardWrapper
          id={id1}
          icon={BrainCircuit}
          iconColor={capabilityIcons.planning}
          title="Smart Planning"
          description="Design architecture first before implementation"
          hoverInfo="Generates an architectural plan including database schema, API endpoints, and component structure before writing any code."
          checked={true}
        />
        <CardWrapper
          id={id2}
          icon={FileCode}
          iconColor={capabilityIcons.template}
          title="Template Base"
          description="Start from working full-stack template"
          hoverInfo="Begin with a pre-built full-stack template and modify it according to your requirements. Faster than building from scratch."
          checked={false}
        />
        <CardWrapper
          id={id3}
          icon={ScanSearch}
          iconColor={capabilityIcons.compiler}
          title="Auto Error-Fixing"
          description="Validate and fix TypeScript and Prisma errors"
          hoverInfo="Automatically runs compiler checks and attempts to fix any errors found in the generated code."
          checked={true}
        />
      </div>
    );
  },
};
