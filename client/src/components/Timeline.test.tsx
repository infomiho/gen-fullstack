/**
 * Timeline Component Tests
 *
 * Tests the Timeline component's handling of messages, tool calls, and tool results.
 * Includes test for modal persistence during live updates.
 */

import type { LLMMessage, ToolCall, ToolResult } from '@gen-fullstack/shared';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Timeline } from './Timeline';

describe('Timeline', () => {
  it('should render empty state when no messages or tool calls', () => {
    render(<Timeline messages={[]} toolCalls={[]} toolResults={[]} />);
    expect(screen.getByText('No activity yet')).toBeInTheDocument();
  });

  it('should render skeleton loader when generating', () => {
    render(<Timeline messages={[]} toolCalls={[]} toolResults={[]} isGenerating={true} />);
    expect(screen.getByTestId('skeleton-loader')).toBeInTheDocument();
  });

  it('should not render skeleton loader when not generating', () => {
    render(
      <Timeline
        messages={[
          {
            id: '1',
            role: 'assistant',
            content: 'Hello',
            timestamp: Date.now(),
          },
        ]}
        toolCalls={[]}
        toolResults={[]}
        isGenerating={false}
      />,
    );
    expect(screen.queryByTestId('skeleton-loader')).not.toBeInTheDocument();
  });

  it('should render skeleton loader with messages when generating', () => {
    render(
      <Timeline
        messages={[
          {
            id: '1',
            role: 'assistant',
            content: 'Test message',
            timestamp: Date.now(),
          },
        ]}
        toolCalls={[]}
        toolResults={[]}
        isGenerating={true}
      />,
    );

    // Both skeleton and message should be present
    expect(screen.getByTestId('skeleton-loader')).toBeInTheDocument();
    expect(screen.getByText('Test message')).toBeInTheDocument();
  });

  it('should default isGenerating to false', () => {
    render(
      <Timeline
        messages={[
          {
            id: '1',
            role: 'assistant',
            content: 'Test',
            timestamp: Date.now(),
          },
        ]}
        toolCalls={[]}
        toolResults={[]}
      />,
    );
    expect(screen.queryByTestId('skeleton-loader')).not.toBeInTheDocument();
  });

  it('should keep tool dialog open when new messages arrive', async () => {
    const user = userEvent.setup();

    // Initial data with one tool call
    const initialToolCalls: ToolCall[] = [
      {
        id: 'tool-1',
        name: 'writeFile',
        args: { path: '/test.txt', content: 'hello' },
        timestamp: Date.now(),
      },
    ];

    const initialMessages: LLMMessage[] = [];
    const initialResults: ToolResult[] = [];

    // Render Timeline with initial data
    const { rerender } = render(
      <Timeline
        messages={initialMessages}
        toolCalls={initialToolCalls}
        toolResults={initialResults}
      />,
    );

    // Open the tool dialog by clicking on the tool call
    const toolButton = screen.getByRole('button', { name: /writeFile/i });
    await user.click(toolButton);

    // Verify dialog is open
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // Simulate new message arriving via WebSocket
    const newMessages: LLMMessage[] = [
      {
        id: 'msg-1',
        role: 'assistant',
        content: 'Creating file...',
        timestamp: Date.now(),
      },
    ];

    // Re-render with new data (simulating WebSocket update)
    rerender(
      <Timeline messages={newMessages} toolCalls={initialToolCalls} toolResults={initialResults} />,
    );

    // Dialog should STILL be open after re-render
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('should keep tool dialog open when tool result arrives', async () => {
    const user = userEvent.setup();

    // Initial data with one tool call
    const initialToolCalls: ToolCall[] = [
      {
        id: 'tool-1',
        name: 'writeFile',
        args: { path: '/test.txt', content: 'hello' },
        timestamp: Date.now(),
      },
    ];

    const initialMessages: LLMMessage[] = [];
    const initialResults: ToolResult[] = [];

    // Render Timeline
    const { rerender } = render(
      <Timeline
        messages={initialMessages}
        toolCalls={initialToolCalls}
        toolResults={initialResults}
      />,
    );

    // Open the tool dialog
    const toolButton = screen.getByRole('button', { name: /writeFile/i });
    await user.click(toolButton);

    // Verify dialog is open and shows "Running"
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Running')).toBeInTheDocument();
    });

    // Simulate tool result arriving via WebSocket
    const newResults: ToolResult[] = [
      {
        id: 'result-tool-1',
        toolName: 'writeFile',
        result: 'File written successfully',
        timestamp: Date.now(),
      },
    ];

    // Re-render with result
    rerender(
      <Timeline messages={initialMessages} toolCalls={initialToolCalls} toolResults={newResults} />,
    );

    // Dialog should STILL be open and now show "Complete"
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Complete')).toBeInTheDocument();
    expect(screen.getByText('File written successfully')).toBeInTheDocument();
  });
});
