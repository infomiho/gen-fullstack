import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CapabilitiesList } from '../CapabilitiesList';

describe('CapabilitiesList', () => {
  it('renders all capabilities', () => {
    const capabilityConfig = {
      inputMode: 'prompt',
      planning: true,
      compilerChecks: true,
      buildingBlocks: true,
    };
    render(<CapabilitiesList capabilityConfig={capabilityConfig} />);
    expect(screen.getByText('Code Generation')).toBeInTheDocument();
    expect(screen.getByText('Smart Planning')).toBeInTheDocument();
    expect(screen.getByText('Template Base')).toBeInTheDocument();
    expect(screen.getByText('Auto Error-Fixing')).toBeInTheDocument();
    expect(screen.getByText('Building Blocks')).toBeInTheDocument();
  });

  it('shows Code Generation as always enabled', () => {
    const capabilityConfig = {
      inputMode: 'prompt',
      planning: false,
      compilerChecks: false,
      buildingBlocks: false,
    };
    render(<CapabilitiesList capabilityConfig={capabilityConfig} />);
    const codeGenElement = screen.getByText('Code Generation').closest('div');
    expect(codeGenElement).toHaveClass('text-foreground');
    expect(codeGenElement).not.toHaveClass('line-through');
  });

  it('shows planning as enabled when true', () => {
    const capabilityConfig = {
      inputMode: 'prompt',
      planning: true,
      compilerChecks: false,
      buildingBlocks: false,
    };
    render(<CapabilitiesList capabilityConfig={capabilityConfig} />);
    const planningElement = screen.getByText('Smart Planning').closest('div');
    expect(planningElement).toHaveClass('text-foreground');
    expect(planningElement).not.toHaveClass('line-through');
  });

  it('shows planning as disabled when false', () => {
    const capabilityConfig = {
      inputMode: 'prompt',
      planning: false,
      compilerChecks: false,
      buildingBlocks: false,
    };
    render(<CapabilitiesList capabilityConfig={capabilityConfig} />);
    const planningElement = screen.getByText('Smart Planning').closest('div');
    expect(planningElement).toHaveClass('text-muted-foreground');
    expect(planningElement).toHaveClass('line-through');
  });

  it('shows template as enabled when inputMode is template', () => {
    const capabilityConfig = {
      inputMode: 'template',
      planning: false,
      compilerChecks: false,
      buildingBlocks: false,
    };
    render(<CapabilitiesList capabilityConfig={capabilityConfig} />);
    const templateElement = screen.getByText('Template Base').closest('div');
    expect(templateElement).toHaveClass('text-foreground');
    expect(templateElement).not.toHaveClass('line-through');
  });

  it('shows template as disabled when inputMode is not template', () => {
    const capabilityConfig = {
      inputMode: 'prompt',
      planning: false,
      compilerChecks: false,
      buildingBlocks: false,
    };
    render(<CapabilitiesList capabilityConfig={capabilityConfig} />);
    const templateElement = screen.getByText('Template Base').closest('div');
    expect(templateElement).toHaveClass('text-muted-foreground');
    expect(templateElement).toHaveClass('line-through');
  });

  it('shows compiler checks as enabled when true', () => {
    const capabilityConfig = {
      inputMode: 'prompt',
      planning: false,
      compilerChecks: true,
      buildingBlocks: false,
    };
    render(<CapabilitiesList capabilityConfig={capabilityConfig} />);
    const compilerElement = screen.getByText('Auto Error-Fixing').closest('div');
    expect(compilerElement).toHaveClass('text-foreground');
    expect(compilerElement).not.toHaveClass('line-through');
  });

  it('shows compiler checks as disabled when false', () => {
    const capabilityConfig = {
      inputMode: 'prompt',
      planning: false,
      compilerChecks: false,
      buildingBlocks: false,
    };
    render(<CapabilitiesList capabilityConfig={capabilityConfig} />);
    const compilerElement = screen.getByText('Auto Error-Fixing').closest('div');
    expect(compilerElement).toHaveClass('text-muted-foreground');
    expect(compilerElement).toHaveClass('line-through');
  });

  it('shows building blocks as enabled when true', () => {
    const capabilityConfig = {
      inputMode: 'prompt',
      planning: false,
      compilerChecks: false,
      buildingBlocks: true,
    };
    render(<CapabilitiesList capabilityConfig={capabilityConfig} />);
    const blocksElement = screen.getByText('Building Blocks').closest('div');
    expect(blocksElement).toHaveClass('text-foreground');
    expect(blocksElement).not.toHaveClass('line-through');
  });

  it('shows building blocks as disabled when false', () => {
    const capabilityConfig = {
      inputMode: 'prompt',
      planning: false,
      compilerChecks: false,
      buildingBlocks: false,
    };
    render(<CapabilitiesList capabilityConfig={capabilityConfig} />);
    const blocksElement = screen.getByText('Building Blocks').closest('div');
    expect(blocksElement).toHaveClass('text-muted-foreground');
    expect(blocksElement).toHaveClass('line-through');
  });

  it('handles all capabilities enabled', () => {
    const capabilityConfig = {
      inputMode: 'template',
      planning: true,
      compilerChecks: true,
      buildingBlocks: true,
    };
    render(<CapabilitiesList capabilityConfig={capabilityConfig} />);
    const allCapabilities = [
      'Code Generation',
      'Smart Planning',
      'Template Base',
      'Auto Error-Fixing',
      'Building Blocks',
    ];
    for (const capability of allCapabilities) {
      const element = screen.getByText(capability).closest('div');
      expect(element).toHaveClass('text-foreground');
      expect(element).not.toHaveClass('line-through');
    }
  });
});
