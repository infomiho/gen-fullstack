import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionSidebar } from '../SessionSidebar';
import { useUIStore } from '../../stores/ui.store';
import type { AppInfo, GetSessionOutput } from '@gen-fullstack/shared';

describe('SessionSidebar', () => {
  // Reset UI store before each test
  beforeEach(() => {
    localStorage.clear();
    act(() => {
      useUIStore.getState().resetSidebarCollapse();
    });
  });

  const mockSessionData: GetSessionOutput = {
    session: {
      id: 'test-session-id',
      prompt: 'Build a todo app',
      model: null,
      systemPrompt: null,
      fullUserPrompt: null,
      capabilityConfig: JSON.stringify({
        inputMode: 'prompt',
        planning: true,
        compilerChecks: true,
        buildingBlocks: false,
      }),
      status: 'completed' as const,
      createdAt: new Date(),
      updatedAt: null,
      completedAt: null,
      errorMessage: null,
      inputTokens: null,
      outputTokens: null,
      totalTokens: 5000,
      cost: '0.0123',
      durationMs: 12345,
      stepCount: 25,
    },
    timeline: [],
    files: [],
  };

  const mockAppStatus: AppInfo = {
    sessionId: 'test-session',
    status: 'running',
    clientPort: 5001,
    clientUrl: 'http://localhost:5001',
    serverPort: 5101,
    serverUrl: 'http://localhost:5101',
  };

  const defaultProps = {
    sessionData: mockSessionData,
    sessionId: 'test-session',
    appStatus: null,
    isGenerating: false,
    isConnected: true,
    isOwnSession: false,
    startApp: vi.fn(),
    stopApp: vi.fn(),
  };

  it('renders capabilities section', () => {
    render(<SessionSidebar {...defaultProps} />);
    expect(screen.getByText('Capabilities')).toBeInTheDocument();
    expect(screen.getByText('Code Generation')).toBeInTheDocument();
    expect(screen.getByText('Smart Planning')).toBeInTheDocument();
    expect(screen.getByText('Template Base')).toBeInTheDocument();
    expect(screen.getByText('Auto Error-Fixing')).toBeInTheDocument();
    expect(screen.getByText('Building Blocks')).toBeInTheDocument();
  });

  it('renders prompt section', () => {
    render(<SessionSidebar {...defaultProps} />);
    expect(screen.getByText('Prompt')).toBeInTheDocument();
    expect(screen.getByText('Build a todo app')).toBeInTheDocument();
  });

  it('renders metrics section for completed sessions', () => {
    render(<SessionSidebar {...defaultProps} />);
    expect(screen.getByText('Metrics')).toBeInTheDocument();
    expect(screen.getByText('5,000')).toBeInTheDocument(); // tokens with formatting
    expect(screen.getByText('$0.0123')).toBeInTheDocument(); // cost
    expect(screen.getByText('12.3s')).toBeInTheDocument(); // duration
    expect(screen.getByText('25')).toBeInTheDocument(); // steps
  });

  it('does not render metrics for generating sessions', () => {
    const generatingSessionData: GetSessionOutput = {
      session: {
        ...mockSessionData.session,
        status: 'generating' as const,
      },
      timeline: [],
      files: [],
    };
    render(<SessionSidebar {...defaultProps} sessionData={generatingSessionData} />);
    expect(screen.queryByText('Metrics')).not.toBeInTheDocument();
  });

  it('renders disconnection warning for active sessions', () => {
    const generatingSessionData: GetSessionOutput = {
      session: {
        ...mockSessionData.session,
        status: 'generating' as const,
      },
      timeline: [],
      files: [],
    };
    render(
      <SessionSidebar {...defaultProps} sessionData={generatingSessionData} isConnected={false} />,
    );
    expect(screen.getByText(/This session is currently generating/i)).toBeInTheDocument();
  });

  it('does not render disconnection warning for completed sessions', () => {
    render(<SessionSidebar {...defaultProps} isConnected={false} />);
    expect(screen.queryByText(/This session is currently generating/i)).not.toBeInTheDocument();
  });

  it('renders error message when present', () => {
    const errorSessionData: GetSessionOutput = {
      session: {
        ...mockSessionData.session,
        status: 'failed' as const,
        errorMessage: 'Something went wrong',
      },
      timeline: [],
      files: [],
    };
    render(<SessionSidebar {...defaultProps} sessionData={errorSessionData} />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('renders app controls', () => {
    render(<SessionSidebar {...defaultProps} />);
    // AppControls should be rendered (checking for its presence)
    // The exact text depends on AppControls implementation
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('handles missing capability config gracefully', () => {
    const noCapsSessionData: GetSessionOutput = {
      session: {
        ...mockSessionData.session,
        capabilityConfig: 'invalid json',
      },
      timeline: [],
      files: [],
    };
    render(<SessionSidebar {...defaultProps} sessionData={noCapsSessionData} />);
    expect(screen.queryByText('Capabilities')).not.toBeInTheDocument();
  });

  it('passes app status to AppControls', () => {
    render(<SessionSidebar {...defaultProps} appStatus={mockAppStatus} />);
    // Verify component renders without crashing when app status is provided
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('formats cost with 4 decimal places', () => {
    const costSessionData: GetSessionOutput = {
      session: {
        ...mockSessionData.session,
        cost: '1.23',
      },
      timeline: [],
      files: [],
    };
    render(<SessionSidebar {...defaultProps} sessionData={costSessionData} />);
    expect(screen.getByText('$1.2300')).toBeInTheDocument();
  });

  it('handles missing optional metrics fields', () => {
    const minimalSessionData: GetSessionOutput = {
      session: {
        ...mockSessionData.session,
        totalTokens: 1000,
        cost: null,
        durationMs: null,
        stepCount: null,
      },
      timeline: [],
      files: [],
    };
    render(<SessionSidebar {...defaultProps} sessionData={minimalSessionData} />);
    expect(screen.getByText('$0.0000')).toBeInTheDocument();
    expect(screen.getByText('0.0s')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  describe('Collapsible Sections', () => {
    it('renders capabilities section as collapsible', () => {
      render(<SessionSidebar {...defaultProps} />);
      const trigger = screen.getByRole('button', { name: /toggle capabilities/i });
      expect(trigger).toBeInTheDocument();
    });

    it('renders prompt section as collapsible', () => {
      render(<SessionSidebar {...defaultProps} />);
      const trigger = screen.getByRole('button', { name: /toggle prompt/i });
      expect(trigger).toBeInTheDocument();
    });

    it('renders metrics section as collapsible', () => {
      render(<SessionSidebar {...defaultProps} />);
      const trigger = screen.getByRole('button', { name: /toggle metrics/i });
      expect(trigger).toBeInTheDocument();
    });

    it('can collapse capabilities section', async () => {
      const user = userEvent.setup();
      render(<SessionSidebar {...defaultProps} />);

      const trigger = screen.getByRole('button', { name: /toggle capabilities/i });

      // Initially visible
      expect(screen.getByText('Code Generation')).toBeInTheDocument();

      // Click to collapse
      await user.click(trigger);

      // Content should be hidden
      expect(screen.queryByText('Code Generation')).not.toBeInTheDocument();
    });

    it('can collapse prompt section', async () => {
      const user = userEvent.setup();
      render(<SessionSidebar {...defaultProps} />);

      const trigger = screen.getByRole('button', { name: /toggle prompt/i });

      // Initially visible
      expect(screen.getByText('Build a todo app')).toBeInTheDocument();

      // Click to collapse
      await user.click(trigger);

      // Content should be hidden
      expect(screen.queryByText('Build a todo app')).not.toBeInTheDocument();
    });

    it('can collapse metrics section', async () => {
      const user = userEvent.setup();
      render(<SessionSidebar {...defaultProps} />);

      const trigger = screen.getByRole('button', { name: /toggle metrics/i });

      // Initially visible
      expect(screen.getByText('5,000')).toBeInTheDocument();

      // Click to collapse
      await user.click(trigger);

      // Content should be hidden
      expect(screen.queryByText('5,000')).not.toBeInTheDocument();
    });

    it('can expand collapsed section', async () => {
      const user = userEvent.setup();
      render(<SessionSidebar {...defaultProps} />);

      const trigger = screen.getByRole('button', { name: /toggle capabilities/i });

      // Collapse
      await user.click(trigger);
      expect(screen.queryByText('Code Generation')).not.toBeInTheDocument();

      // Expand
      await user.click(trigger);
      expect(screen.getByText('Code Generation')).toBeInTheDocument();
    });

    it('persists collapse state in UI store', async () => {
      const user = userEvent.setup();
      render(<SessionSidebar {...defaultProps} />);

      const trigger = screen.getByRole('button', { name: /toggle capabilities/i });

      // Initially not collapsed
      expect(useUIStore.getState().sidebarCollapsed.capabilities).toBe(false);

      // Click to collapse
      await user.click(trigger);

      // Store should be updated
      expect(useUIStore.getState().sidebarCollapsed.capabilities).toBe(true);
    });

    it('can collapse multiple sections independently', async () => {
      const user = userEvent.setup();
      render(<SessionSidebar {...defaultProps} />);

      const capsTrigger = screen.getByRole('button', { name: /toggle capabilities/i });
      const promptTrigger = screen.getByRole('button', { name: /toggle prompt/i });

      // Collapse capabilities
      await user.click(capsTrigger);
      expect(screen.queryByText('Code Generation')).not.toBeInTheDocument();
      expect(screen.getByText('Build a todo app')).toBeInTheDocument();

      // Collapse prompt
      await user.click(promptTrigger);
      expect(screen.queryByText('Code Generation')).not.toBeInTheDocument();
      expect(screen.queryByText('Build a todo app')).not.toBeInTheDocument();
    });

    it('restores collapse state from localStorage', () => {
      // Set initial collapsed state
      act(() => {
        useUIStore.getState().setSection('capabilities', true);
        useUIStore.getState().setSection('prompt', true);
      });

      render(<SessionSidebar {...defaultProps} />);

      // Sections should be collapsed
      expect(screen.queryByText('Code Generation')).not.toBeInTheDocument();
      expect(screen.queryByText('Build a todo app')).not.toBeInTheDocument();
      expect(screen.getByText('5,000')).toBeInTheDocument(); // metrics still visible
    });
  });
});
