import type { Meta, StoryObj } from '@storybook/react-vite';
import { SessionSidebar } from './SessionSidebar';
import type { AppInfo } from '@gen-fullstack/shared';

/**
 * SessionSidebar stories demonstrating different session states.
 *
 * Note: The Capabilities, Prompt, and Metrics sections are collapsible.
 * Click on the section headers to collapse/expand them. Collapse state
 * is persisted to localStorage via the UI store.
 */
const meta = {
  title: 'Session/SessionSidebar',
  component: SessionSidebar,
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <div style={{ height: '100vh', display: 'flex' }}>
        <div style={{ width: '320px' }}>
          <Story />
        </div>
      </div>
    ),
  ],
} satisfies Meta<typeof SessionSidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

const mockAppStatusRunning: AppInfo = {
  sessionId: 'test-session',
  status: 'running',
  clientPort: 5001,
  clientUrl: 'http://localhost:5001',
  serverPort: 5101,
  serverUrl: 'http://localhost:5101',
};

export const Generating: Story = {
  args: {
    sessionData: {
      session: {
        prompt: 'Build a todo app with React and Express',
        strategy: 'naive',
        capabilityConfig: JSON.stringify({
          inputMode: 'prompt',
          planning: true,
          compilerChecks: true,
          buildingBlocks: false,
        }),
        status: 'generating',
      },
    },
    sessionId: 'test-session',
    appStatus: null,
    isGenerating: true,
    isConnected: true,
    isOwnSession: true,
    startApp: () => {},
    stopApp: () => {},
  },
};

export const CompletedWithMetrics: Story = {
  args: {
    sessionData: {
      session: {
        prompt: 'Build a blog platform with user authentication and markdown support',
        strategy: 'naive',
        capabilityConfig: JSON.stringify({
          inputMode: 'prompt',
          planning: true,
          compilerChecks: true,
          buildingBlocks: true,
        }),
        status: 'completed',
        totalTokens: 12345,
        cost: '0.0456',
        durationMs: 45678,
        stepCount: 42,
      },
    },
    sessionId: 'test-session',
    appStatus: null,
    isGenerating: false,
    isConnected: true,
    isOwnSession: false,
    startApp: () => {},
    stopApp: () => {},
  },
};

export const CompletedWithAppRunning: Story = {
  args: {
    sessionData: {
      session: {
        prompt: 'Create an e-commerce store with product catalog and shopping cart',
        strategy: 'plan-first',
        capabilityConfig: JSON.stringify({
          inputMode: 'prompt',
          planning: true,
          compilerChecks: true,
          buildingBlocks: false,
        }),
        status: 'completed',
        totalTokens: 23456,
        cost: '0.0789',
        durationMs: 67890,
        stepCount: 58,
      },
    },
    sessionId: 'test-session',
    appStatus: mockAppStatusRunning,
    isGenerating: false,
    isConnected: true,
    isOwnSession: false,
    startApp: () => {},
    stopApp: () => {},
  },
};

export const FailedWithError: Story = {
  args: {
    sessionData: {
      session: {
        prompt: 'Build a real-time chat application',
        strategy: 'naive',
        capabilityConfig: JSON.stringify({
          inputMode: 'prompt',
          planning: false,
          compilerChecks: true,
          buildingBlocks: false,
        }),
        status: 'failed',
        errorMessage: 'Failed to generate application: OpenAI API rate limit exceeded',
      },
    },
    sessionId: 'test-session',
    appStatus: null,
    isGenerating: false,
    isConnected: true,
    isOwnSession: false,
    startApp: () => {},
    stopApp: () => {},
  },
};

export const GeneratingDisconnected: Story = {
  args: {
    sessionData: {
      session: {
        prompt: 'Build a weather dashboard with real-time updates',
        strategy: 'template',
        capabilityConfig: JSON.stringify({
          inputMode: 'template',
          planning: true,
          compilerChecks: true,
          buildingBlocks: true,
        }),
        status: 'generating',
      },
    },
    sessionId: 'test-session',
    appStatus: null,
    isGenerating: true,
    isConnected: false,
    isOwnSession: true,
    startApp: () => {},
    stopApp: () => {},
  },
};

export const WithTemplateMode: Story = {
  args: {
    sessionData: {
      session: {
        prompt: 'Create a project management tool',
        strategy: 'template',
        capabilityConfig: JSON.stringify({
          inputMode: 'template',
          planning: false,
          compilerChecks: false,
          buildingBlocks: false,
        }),
        status: 'completed',
        totalTokens: 8900,
        cost: '0.0234',
        durationMs: 34567,
        stepCount: 28,
      },
    },
    sessionId: 'test-session',
    appStatus: null,
    isGenerating: false,
    isConnected: true,
    isOwnSession: false,
    startApp: () => {},
    stopApp: () => {},
  },
};

export const MinimalCapabilities: Story = {
  args: {
    sessionData: {
      session: {
        prompt: 'Simple landing page',
        strategy: 'naive',
        capabilityConfig: JSON.stringify({
          inputMode: 'prompt',
          planning: false,
          compilerChecks: false,
          buildingBlocks: false,
        }),
        status: 'completed',
        totalTokens: 2500,
        cost: '0.0089',
        durationMs: 12340,
        stepCount: 15,
      },
    },
    sessionId: 'test-session',
    appStatus: null,
    isGenerating: false,
    isConnected: true,
    isOwnSession: false,
    startApp: () => {},
    stopApp: () => {},
  },
};

export const LongPrompt: Story = {
  args: {
    sessionData: {
      session: {
        prompt: `Build a comprehensive social media platform with the following features:
- User authentication and authorization with JWT
- User profiles with customizable avatars and bios
- Post creation with rich text editor and image upload
- Commenting and liking system
- Real-time notifications
- Follow/unfollow functionality
- Direct messaging between users
- Trending topics and hashtags
- Search functionality for users and posts
- Admin dashboard for content moderation
- Analytics and insights for user engagement`,
        strategy: 'plan-first',
        capabilityConfig: JSON.stringify({
          inputMode: 'prompt',
          planning: true,
          compilerChecks: true,
          buildingBlocks: true,
        }),
        status: 'completed',
        totalTokens: 45678,
        cost: '0.1234',
        durationMs: 123456,
        stepCount: 95,
      },
    },
    sessionId: 'test-session',
    appStatus: null,
    isGenerating: false,
    isConnected: true,
    isOwnSession: false,
    startApp: () => {},
    stopApp: () => {},
  },
};
