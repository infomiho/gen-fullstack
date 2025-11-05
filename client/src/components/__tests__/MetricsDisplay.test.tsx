import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MetricsDisplay } from '../MetricsDisplay';

describe('MetricsDisplay', () => {
  it('renders all metric labels', () => {
    render(<MetricsDisplay totalTokens={5000} cost="0.0123" durationMs={12345} stepCount={25} />);
    expect(screen.getByText('Tokens')).toBeInTheDocument();
    expect(screen.getByText('Cost')).toBeInTheDocument();
    expect(screen.getByText('Duration')).toBeInTheDocument();
    expect(screen.getByText('Steps')).toBeInTheDocument();
  });

  it('formats tokens with locale string', () => {
    render(<MetricsDisplay totalTokens={123456} cost="0.0123" durationMs={12345} stepCount={25} />);
    expect(screen.getByText('123,456')).toBeInTheDocument();
  });

  it('formats cost with 4 decimal places', () => {
    render(<MetricsDisplay totalTokens={5000} cost="0.0123" durationMs={12345} stepCount={25} />);
    expect(screen.getByText('$0.0123')).toBeInTheDocument();
  });

  it('formats cost with 4 decimal places for whole numbers', () => {
    render(<MetricsDisplay totalTokens={5000} cost="1" durationMs={12345} stepCount={25} />);
    expect(screen.getByText('$1.0000')).toBeInTheDocument();
  });

  it('handles zero cost', () => {
    render(<MetricsDisplay totalTokens={5000} cost="0" durationMs={12345} stepCount={25} />);
    expect(screen.getByText('$0.0000')).toBeInTheDocument();
  });

  it('formats duration in seconds with 1 decimal place', () => {
    render(<MetricsDisplay totalTokens={5000} cost="0.0123" durationMs={12345} stepCount={25} />);
    expect(screen.getByText('12.3s')).toBeInTheDocument();
  });

  it('formats duration for milliseconds', () => {
    render(<MetricsDisplay totalTokens={5000} cost="0.0123" durationMs={500} stepCount={25} />);
    expect(screen.getByText('0.5s')).toBeInTheDocument();
  });

  it('formats duration for zero', () => {
    render(<MetricsDisplay totalTokens={5000} cost="0.0123" durationMs={0} stepCount={25} />);
    expect(screen.getByText('0.0s')).toBeInTheDocument();
  });

  it('renders step count as is', () => {
    render(<MetricsDisplay totalTokens={5000} cost="0.0123" durationMs={12345} stepCount={42} />);
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('handles zero step count', () => {
    render(<MetricsDisplay totalTokens={5000} cost="0.0123" durationMs={12345} stepCount={0} />);
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('renders large numbers correctly', () => {
    render(
      <MetricsDisplay totalTokens={9999999} cost="99.9999" durationMs={999999} stepCount={999} />,
    );
    expect(screen.getByText('9,999,999')).toBeInTheDocument();
    expect(screen.getByText('$99.9999')).toBeInTheDocument();
    expect(screen.getByText('1000.0s')).toBeInTheDocument();
    expect(screen.getByText('999')).toBeInTheDocument();
  });

  it('uses monospace font for values', () => {
    const { container } = render(
      <MetricsDisplay totalTokens={5000} cost="0.0123" durationMs={12345} stepCount={25} />,
    );
    const monoElements = container.querySelectorAll('.font-mono');
    expect(monoElements).toHaveLength(4);
  });

  describe('Model display', () => {
    it('does not render model row when model is not provided', () => {
      render(<MetricsDisplay totalTokens={5000} cost="0.0123" durationMs={12345} stepCount={25} />);
      expect(screen.queryByText('Model')).not.toBeInTheDocument();
    });

    it('renders model row when model is provided', () => {
      render(
        <MetricsDisplay
          model="gpt-5-mini"
          totalTokens={5000}
          cost="0.0123"
          durationMs={12345}
          stepCount={25}
        />,
      );
      expect(screen.getByText('Model')).toBeInTheDocument();
    });

    it('displays GPT-5 Mini correctly', () => {
      render(
        <MetricsDisplay
          model="gpt-5-mini"
          totalTokens={5000}
          cost="0.0123"
          durationMs={12345}
          stepCount={25}
        />,
      );
      expect(screen.getByText('GPT-5 Mini')).toBeInTheDocument();
    });

    it('displays GPT-5 correctly', () => {
      render(
        <MetricsDisplay
          model="gpt-5"
          totalTokens={5000}
          cost="0.0123"
          durationMs={12345}
          stepCount={25}
        />,
      );
      expect(screen.getByText('GPT-5')).toBeInTheDocument();
    });

    it('displays Claude Sonnet 4.5 correctly', () => {
      render(
        <MetricsDisplay
          model="claude-sonnet-4-5"
          totalTokens={5000}
          cost="0.0123"
          durationMs={12345}
          stepCount={25}
        />,
      );
      expect(screen.getByText('Claude Sonnet 4.5')).toBeInTheDocument();
    });

    it('displays Claude Haiku 4.5 correctly', () => {
      render(
        <MetricsDisplay
          model="claude-haiku-4-5"
          totalTokens={5000}
          cost="0.0123"
          durationMs={12345}
          stepCount={25}
        />,
      );
      expect(screen.getByText('Claude Haiku 4.5')).toBeInTheDocument();
    });

    it('handles unknown model with fallback formatting', () => {
      render(
        <MetricsDisplay
          model="unknown-model-123"
          totalTokens={5000}
          cost="0.0123"
          durationMs={12345}
          stepCount={25}
        />,
      );
      // Fallback capitalizes each word
      expect(screen.getByText('Unknown Model 123')).toBeInTheDocument();
    });

    it('uses monospace font for model value', () => {
      const { container } = render(
        <MetricsDisplay
          model="gpt-5-mini"
          totalTokens={5000}
          cost="0.0123"
          durationMs={12345}
          stepCount={25}
        />,
      );
      const monoElements = container.querySelectorAll('.font-mono');
      // Should now have 5 monospace elements (model + 4 metrics)
      expect(monoElements).toHaveLength(5);
    });
  });
});
