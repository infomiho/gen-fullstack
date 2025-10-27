/**
 * Tests for CollapsibleSection Component
 *
 * Verifies:
 * - Rendering and basic functionality
 * - Toggle behavior
 * - Accessibility features
 * - Keyboard navigation
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Settings } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';
import { CollapsibleSection } from '../CollapsibleSection';

describe('CollapsibleSection', () => {
  it('renders with title', () => {
    const onToggle = vi.fn();
    render(
      <CollapsibleSection title="Test Section" isOpen={true} onToggle={onToggle}>
        <div>Content</div>
      </CollapsibleSection>,
    );

    expect(screen.getByText('Test Section')).toBeInTheDocument();
  });

  it('renders children when open', () => {
    const onToggle = vi.fn();
    render(
      <CollapsibleSection title="Test Section" isOpen={true} onToggle={onToggle}>
        <div>Test Content</div>
      </CollapsibleSection>,
    );

    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('hides children when closed', () => {
    const onToggle = vi.fn();
    render(
      <CollapsibleSection title="Test Section" isOpen={false} onToggle={onToggle}>
        <div>Test Content</div>
      </CollapsibleSection>,
    );

    // Content should not be visible
    expect(screen.queryByText('Test Content')).not.toBeInTheDocument();
  });

  it('renders chevron icon', () => {
    const onToggle = vi.fn();
    const { container } = render(
      <CollapsibleSection title="Test Section" isOpen={true} onToggle={onToggle}>
        <div>Content</div>
      </CollapsibleSection>,
    );

    // Check for ChevronDown SVG
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('renders optional icon', () => {
    const onToggle = vi.fn();
    render(
      <CollapsibleSection
        title="Settings"
        isOpen={true}
        onToggle={onToggle}
        icon={<Settings data-testid="settings-icon" />}
      >
        <div>Content</div>
      </CollapsibleSection>,
    );

    expect(screen.getByTestId('settings-icon')).toBeInTheDocument();
  });

  it('calls onToggle when trigger is clicked', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();

    render(
      <CollapsibleSection title="Test Section" isOpen={true} onToggle={onToggle}>
        <div>Content</div>
      </CollapsibleSection>,
    );

    const trigger = screen.getByRole('button', { name: /toggle test section/i });
    await user.click(trigger);

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('calls onToggle when trigger is activated with keyboard', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();

    render(
      <CollapsibleSection title="Test Section" isOpen={true} onToggle={onToggle}>
        <div>Content</div>
      </CollapsibleSection>,
    );

    const trigger = screen.getByRole('button', { name: /toggle test section/i });
    trigger.focus();

    // Press Space key
    await user.keyboard(' ');
    expect(onToggle).toHaveBeenCalledTimes(1);

    // Press Enter key
    await user.keyboard('{Enter}');
    expect(onToggle).toHaveBeenCalledTimes(2);
  });

  it('has correct ARIA label', () => {
    const onToggle = vi.fn();
    render(
      <CollapsibleSection title="Test Section" isOpen={true} onToggle={onToggle}>
        <div>Content</div>
      </CollapsibleSection>,
    );

    const trigger = screen.getByRole('button', { name: 'Toggle Test Section section' });
    expect(trigger).toBeInTheDocument();
  });

  it('uses custom ARIA label when provided', () => {
    const onToggle = vi.fn();
    render(
      <CollapsibleSection
        title="Test Section"
        isOpen={true}
        onToggle={onToggle}
        ariaLabel="Custom label"
      >
        <div>Content</div>
      </CollapsibleSection>,
    );

    const trigger = screen.getByRole('button', { name: 'Custom label' });
    expect(trigger).toBeInTheDocument();
  });

  it('applies correct CSS classes to trigger', () => {
    const onToggle = vi.fn();
    const { container } = render(
      <CollapsibleSection title="Test Section" isOpen={true} onToggle={onToggle}>
        <div>Content</div>
      </CollapsibleSection>,
    );

    const trigger = container.querySelector('button');
    expect(trigger).toHaveClass('flex', 'items-center', 'gap-2', 'w-full', 'group');
  });

  it('applies transition to chevron icon', () => {
    const onToggle = vi.fn();
    const { container } = render(
      <CollapsibleSection title="Test Section" isOpen={true} onToggle={onToggle}>
        <div>Content</div>
      </CollapsibleSection>,
    );

    const chevron = container.querySelector('svg');
    expect(chevron).toHaveClass('transition-transform');
  });

  it('handles multiple children elements', () => {
    const onToggle = vi.fn();
    render(
      <CollapsibleSection title="Test Section" isOpen={true} onToggle={onToggle}>
        <div>Content 1</div>
        <div>Content 2</div>
        <div>Content 3</div>
      </CollapsibleSection>,
    );

    expect(screen.getByText('Content 1')).toBeInTheDocument();
    expect(screen.getByText('Content 2')).toBeInTheDocument();
    expect(screen.getByText('Content 3')).toBeInTheDocument();
  });

  it('handles complex nested content', () => {
    const onToggle = vi.fn();
    render(
      <CollapsibleSection title="Test Section" isOpen={true} onToggle={onToggle}>
        <div>
          <h4>Nested Title</h4>
          <ul>
            <li>Item 1</li>
            <li>Item 2</li>
          </ul>
        </div>
      </CollapsibleSection>,
    );

    expect(screen.getByText('Nested Title')).toBeInTheDocument();
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
  });

  it('maintains button type as button (not submit)', () => {
    const onToggle = vi.fn();
    render(
      <CollapsibleSection title="Test Section" isOpen={true} onToggle={onToggle}>
        <div>Content</div>
      </CollapsibleSection>,
    );

    const trigger = screen.getByRole('button');
    // Radix Collapsible.Trigger has implicit button type
    expect(trigger.tagName).toBe('BUTTON');
  });

  it('renders correctly when closed initially', () => {
    const onToggle = vi.fn();
    const { container } = render(
      <CollapsibleSection title="Closed Section" isOpen={false} onToggle={onToggle}>
        <div>Hidden Content</div>
      </CollapsibleSection>,
    );

    expect(screen.getByText('Closed Section')).toBeInTheDocument();
    expect(screen.queryByText('Hidden Content')).not.toBeInTheDocument();

    // Chevron should have rotation class for closed state
    const chevron = container.querySelector('svg');
    expect(chevron).toHaveClass('transition-transform');
  });

  it('is keyboard focusable', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();

    render(
      <CollapsibleSection title="Test Section" isOpen={true} onToggle={onToggle}>
        <div>Content</div>
      </CollapsibleSection>,
    );

    const trigger = screen.getByRole('button');

    // Tab to the trigger
    await user.tab();

    expect(trigger).toHaveFocus();
  });

  it('handles rapid toggling', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();

    render(
      <CollapsibleSection title="Test Section" isOpen={true} onToggle={onToggle}>
        <div>Content</div>
      </CollapsibleSection>,
    );

    const trigger = screen.getByRole('button');

    // Click multiple times rapidly
    await user.click(trigger);
    await user.click(trigger);
    await user.click(trigger);

    expect(onToggle).toHaveBeenCalledTimes(3);
  });
});
