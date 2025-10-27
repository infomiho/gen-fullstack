import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Settings } from 'lucide-react';
import { CollapsibleSection } from './CollapsibleSection';

/**
 * CollapsibleSection stories demonstrating different states and use cases.
 */
const meta = {
  title: 'UI/Layout/CollapsibleSection',
  component: CollapsibleSection,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  argTypes: {
    title: {
      description: 'Section title',
      control: 'text',
    },
    isOpen: {
      description: 'Whether the section is currently open',
      control: 'boolean',
    },
    onToggle: {
      description: 'Callback when the section is toggled',
      action: 'toggled',
    },
    icon: {
      description: 'Optional icon to display before the title',
      control: false,
    },
    ariaLabel: {
      description: 'Optional aria-label for accessibility',
      control: 'text',
    },
  },
} satisfies Meta<typeof CollapsibleSection>;

export default meta;
type Story = StoryObj<typeof meta>;

// Wrapper component to manage state for interactive stories
function InteractiveWrapper({ initialOpen = true }: { initialOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(initialOpen);

  return (
    <div style={{ maxWidth: '400px' }}>
      <CollapsibleSection
        title="Example Section"
        isOpen={isOpen}
        onToggle={() => setIsOpen(!isOpen)}
      >
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            This is some example content inside a collapsible section.
          </p>
          <p className="text-sm text-muted-foreground">
            Click the chevron icon or the title to toggle the section.
          </p>
        </div>
      </CollapsibleSection>
    </div>
  );
}

export const Default: Story = {
  args: {
    title: '',
    isOpen: true,
    onToggle: () => {},
    children: null,
  },
  render: () => <InteractiveWrapper initialOpen={true} />,
};

export const InitiallyClosed: Story = {
  args: {
    title: '',
    isOpen: false,
    onToggle: () => {},
    children: null,
  },
  render: () => <InteractiveWrapper initialOpen={false} />,
};

export const WithIcon: Story = {
  args: {
    title: '',
    isOpen: true,
    onToggle: () => {},
    children: null,
  },
  render: () => {
    const [isOpen, setIsOpen] = useState(true);
    return (
      <div style={{ maxWidth: '400px' }}>
        <CollapsibleSection
          title="Settings"
          isOpen={isOpen}
          onToggle={() => setIsOpen(!isOpen)}
          icon={<Settings size={16} />}
        >
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Configuration options go here.</p>
          </div>
        </CollapsibleSection>
      </div>
    );
  },
};

export const LongContent: Story = {
  args: {
    title: '',
    isOpen: true,
    onToggle: () => {},
    children: null,
  },
  render: () => {
    const [isOpen, setIsOpen] = useState(true);
    return (
      <div style={{ maxWidth: '400px' }}>
        <CollapsibleSection
          title="Long Content"
          isOpen={isOpen}
          onToggle={() => setIsOpen(!isOpen)}
        >
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              This section contains a lot of content to demonstrate how the component handles longer
              text and multiple paragraphs.
            </p>
            <p className="text-sm text-muted-foreground">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor
              incididunt ut labore et dolore magna aliqua.
            </p>
            <p className="text-sm text-muted-foreground">
              Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex
              ea commodo consequat.
            </p>
          </div>
        </CollapsibleSection>
      </div>
    );
  },
};

export const MultipleSections: Story = {
  args: {
    title: '',
    isOpen: true,
    onToggle: () => {},
    children: null,
  },
  render: () => {
    const [sectionsOpen, setSectionsOpen] = useState({
      first: true,
      second: false,
      third: true,
    });

    return (
      <div style={{ maxWidth: '400px' }} className="space-y-4">
        <CollapsibleSection
          title="First Section"
          isOpen={sectionsOpen.first}
          onToggle={() =>
            setSectionsOpen((prev) => ({
              ...prev,
              first: !prev.first,
            }))
          }
        >
          <p className="text-sm text-muted-foreground">Content for the first section.</p>
        </CollapsibleSection>

        <CollapsibleSection
          title="Second Section"
          isOpen={sectionsOpen.second}
          onToggle={() =>
            setSectionsOpen((prev) => ({
              ...prev,
              second: !prev.second,
            }))
          }
        >
          <p className="text-sm text-muted-foreground">Content for the second section.</p>
        </CollapsibleSection>

        <CollapsibleSection
          title="Third Section"
          isOpen={sectionsOpen.third}
          onToggle={() =>
            setSectionsOpen((prev) => ({
              ...prev,
              third: !prev.third,
            }))
          }
        >
          <p className="text-sm text-muted-foreground">Content for the third section.</p>
        </CollapsibleSection>
      </div>
    );
  },
};
