import type { Meta, StoryObj } from '@storybook/react-vite';
import { Alert } from './Alert';

const meta = {
  title: 'Primitives/Alert',
  component: Alert,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      description: 'Alert variant (determines color scheme)',
      control: 'select',
      options: ['error', 'warning', 'info', 'success'],
    },
    children: {
      description: 'Alert message content',
      control: 'text',
    },
    className: {
      description: 'Optional additional CSS classes',
      control: 'text',
    },
  },
} satisfies Meta<typeof Alert>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ErrorAlert: Story = {
  name: 'Error',
  args: {
    variant: 'error',
    children: 'Failed to start application: Docker not available',
  },
};

export const Warning: Story = {
  args: {
    variant: 'warning',
    children:
      'This session is currently generating. You are disconnected - reconnect to see live updates.',
  },
};

export const Info: Story = {
  args: {
    variant: 'info',
    children: 'Container is being created. This may take a few moments.',
  },
};

export const Success: Story = {
  args: {
    variant: 'success',
    children: 'Application started successfully and is now running.',
  },
};

export const LongMessage: Story = {
  args: {
    variant: 'warning',
    children:
      'This is a longer alert message to demonstrate how the component handles multi-line content. The alert will wrap text appropriately and maintain proper padding and spacing throughout the message.',
  },
};

export const WithJSXContent: Story = {
  args: {
    variant: 'error',
    children: (
      <>
        <strong>Error:</strong> Something went wrong while processing your request. Please try again
        or contact support.
      </>
    ),
  },
};

export const AllVariants: Story = {
  args: {
    variant: 'info',
    children: '',
  },
  render: () => (
    <div className="space-y-4 max-w-2xl">
      <Alert variant="error">Error: Failed to connect to database</Alert>
      <Alert variant="warning">Warning: Session will expire in 5 minutes</Alert>
      <Alert variant="info">Info: New version available</Alert>
      <Alert variant="success">Success: Changes saved successfully</Alert>
    </div>
  ),
};

// Real-world usage patterns
export const SessionDisconnected: Story = {
  name: 'Session Disconnected (SessionSidebar)',
  args: {
    variant: 'warning',
    children:
      'This session is currently generating. You are disconnected - reconnect to see live updates, or refresh the page to see the latest persisted data.',
  },
};

export const AppError: Story = {
  name: 'App Error (AppControls)',
  args: {
    variant: 'error',
    children: 'Failed to start application: Port 3000 is already in use',
  },
};

export const GenerationError: Story = {
  name: 'Generation Error (SessionSidebar)',
  args: {
    variant: 'error',
    children: 'Generation failed: API rate limit exceeded. Please try again in a few minutes.',
  },
};
