import type { Meta, StoryObj } from '@storybook/react-vite';
import { BrainCircuit, FileCode, ScanSearch } from 'lucide-react';
import { useId, useState } from 'react';
import { capabilityIcons } from '../lib/design-tokens';
import { CapabilityCard } from './CapabilityCard';

const meta = {
  title: 'Capabilities/CapabilityCard',
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
    hoverInfo: '',
    checked: false,
    onCheckedChange: () => {},
  },
  render: function Render() {
    const id = useId();
    return (
      <div className="w-64">
        <CardWrapper
          id={id}
          icon={BrainCircuit}
          iconColor={capabilityIcons.planning}
          title="Smart Planning"
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
    hoverInfo: '',
    checked: false,
    onCheckedChange: () => {},
  },
  render: function Render() {
    const id = useId();
    return (
      <div className="w-64">
        <CardWrapper
          id={id}
          icon={BrainCircuit}
          iconColor={capabilityIcons.planning}
          title="Smart Planning"
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
    hoverInfo: '',
    checked: false,
    onCheckedChange: () => {},
  },
  render: function Render() {
    const id = useId();
    return (
      <div className="w-64">
        <CardWrapper
          id={id}
          icon={BrainCircuit}
          iconColor={capabilityIcons.planning}
          title="Smart Planning"
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
    hoverInfo: '',
    checked: false,
    onCheckedChange: () => {},
  },
  render: function Render() {
    const id = useId();
    return (
      <div className="w-64">
        <CardWrapper
          id={id}
          icon={ScanSearch}
          iconColor={capabilityIcons.compiler}
          title="Auto Error-Fixing"
          hoverInfo="Automatically runs compiler checks and attempts to fix any errors found in the generated code."
          checked={true}
        >
          <div className="text-xs text-gray-600 leading-relaxed">
            This demonstrates how nested controls can be added to capability cards if needed in the
            future.
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
    hoverInfo: '',
    checked: false,
    onCheckedChange: () => {},
  },
  render: function Render() {
    const id1 = useId();
    const id2 = useId();
    const id3 = useId();
    return (
      <div className="w-64 space-y-3">
        <CardWrapper
          id={id1}
          icon={BrainCircuit}
          iconColor={capabilityIcons.planning}
          title="Smart Planning"
          hoverInfo="Generates an architectural plan including database schema, API endpoints, and component structure before writing any code."
          checked={true}
        />
        <CardWrapper
          id={id2}
          icon={FileCode}
          iconColor={capabilityIcons.template}
          title="Template Base"
          hoverInfo="Begin with a pre-built full-stack template and modify it according to your requirements. Faster than building from scratch."
          checked={false}
        />
        <CardWrapper
          id={id3}
          icon={ScanSearch}
          iconColor={capabilityIcons.compiler}
          title="Auto Error-Fixing"
          hoverInfo="Automatically runs compiler checks and attempts to fix any errors found in the generated code."
          checked={true}
        />
      </div>
    );
  },
};
