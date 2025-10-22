import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SessionSidebar } from '../SessionSidebar';
import type { AppInfo } from '@gen-fullstack/shared';

describe('SessionSidebar', () => {
  const mockSessionData = {
    session: {
      prompt: 'Build a todo app',
      strategy: 'naive',
      capabilityConfig: JSON.stringify({
        inputMode: 'prompt',
        planning: true,
        compilerChecks: true,
        buildingBlocks: false,
      }),
      status: 'completed' as const,
      totalTokens: 5000,
      cost: '0.0123',
      durationMs: 12345,
      stepCount: 25,
    },
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
    const generatingSessionData = {
      session: {
        ...mockSessionData.session,
        status: 'generating' as const,
      },
    };
    render(<SessionSidebar {...defaultProps} sessionData={generatingSessionData} />);
    expect(screen.queryByText('Metrics')).not.toBeInTheDocument();
  });

  it('renders disconnection warning for active sessions', () => {
    const generatingSessionData = {
      session: {
        ...mockSessionData.session,
        status: 'generating' as const,
      },
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
    const errorSessionData = {
      session: {
        ...mockSessionData.session,
        status: 'failed' as const,
        errorMessage: 'Something went wrong',
      },
    };
    render(<SessionSidebar {...defaultProps} sessionData={errorSessionData} />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('renders app controls', () => {
    render(<SessionSidebar {...defaultProps} />);
    // AppControls should be rendered (checking for its presence)
    // The exact text depends on AppControls implementation
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('handles missing capability config gracefully', () => {
    const noCapsSessionData = {
      session: {
        ...mockSessionData.session,
        capabilityConfig: 'invalid json',
      },
    };
    render(<SessionSidebar {...defaultProps} sessionData={noCapsSessionData} />);
    expect(screen.queryByText('Capabilities')).not.toBeInTheDocument();
  });

  it('passes app status to AppControls', () => {
    render(<SessionSidebar {...defaultProps} appStatus={mockAppStatus} />);
    // Verify component renders without crashing when app status is provided
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('formats cost with 4 decimal places', () => {
    const costSessionData = {
      session: {
        ...mockSessionData.session,
        cost: '1.23',
      },
    };
    render(<SessionSidebar {...defaultProps} sessionData={costSessionData} />);
    expect(screen.getByText('$1.2300')).toBeInTheDocument();
  });

  it('handles missing optional metrics fields', () => {
    const minimalSessionData = {
      session: {
        ...mockSessionData.session,
        totalTokens: 1000,
        cost: undefined,
        durationMs: undefined,
        stepCount: undefined,
      },
    };
    render(<SessionSidebar {...defaultProps} sessionData={minimalSessionData} />);
    expect(screen.getByText('$0.0000')).toBeInTheDocument();
    expect(screen.getByText('0.0s')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
  });
});
