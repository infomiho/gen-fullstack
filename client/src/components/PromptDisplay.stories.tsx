import type { Meta, StoryObj } from '@storybook/react-vite';
import { PromptDisplay } from './PromptDisplay';

/**
 * PromptDisplay component shows a prompt in a styled container with copy functionality.
 * Used consistently in session cards and session sidebar.
 */
const meta = {
  title: 'UI/Session/PromptDisplay',
  component: PromptDisplay,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  args: {
    prompt: 'Build a todo app with user authentication and real-time sync',
  },
} satisfies Meta<typeof PromptDisplay>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default prompt display
 */
export const Default: Story = {
  args: {},
};

/**
 * Short prompt
 */
export const ShortPrompt: Story = {
  args: {
    prompt: 'Build a blog',
  },
};

/**
 * Long prompt that wraps to multiple lines
 */
export const LongPrompt: Story = {
  args: {
    prompt:
      'Build a comprehensive e-commerce platform with product catalog, shopping cart, checkout flow, payment integration, order management, inventory tracking, user authentication, email notifications, and admin dashboard for managing products and orders.',
  },
};

/**
 * Multiline prompt with line breaks
 */
export const MultilinePrompt: Story = {
  args: {
    prompt: `Build a task management app with:
- User authentication
- Project organization
- Task assignments
- Due dates and reminders
- Real-time collaboration`,
  },
};

/**
 * In a card context (like session list)
 */
export const InCard: Story = {
  render: (args) => (
    <div className="w-96 p-4 border border-border rounded-lg bg-card">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">2h ago</span>
        </div>
        <PromptDisplay {...args} />
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 bg-blue-600 rounded" title="Planning" />
          <div className="w-4 h-4 bg-green-600 rounded" title="Compiler" />
        </div>
      </div>
    </div>
  ),
};

/**
 * In sidebar context
 */
export const InSidebar: Story = {
  render: (args) => (
    <div className="w-80 p-6 border border-border bg-card">
      <div className="space-y-6">
        <div>
          <h3 className="text-base font-medium text-foreground mb-3">Prompt</h3>
          <PromptDisplay {...args} />
        </div>
      </div>
    </div>
  ),
};

/**
 * Custom styling example
 */
export const WithCustomClass: Story = {
  args: {
    className: 'shadow-md',
  },
};
