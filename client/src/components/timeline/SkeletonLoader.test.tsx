import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SkeletonLoader } from './SkeletonLoader';

describe('SkeletonLoader', () => {
  it('should render skeleton loader', () => {
    render(<SkeletonLoader />);
    const skeleton = screen.getByTestId('skeleton-loader');
    expect(skeleton).toBeInTheDocument();
  });

  it('should display animated dots', () => {
    render(<SkeletonLoader />);
    const skeleton = screen.getByTestId('skeleton-loader');
    // Should contain SVG with three circles
    const svg = skeleton.querySelector('svg');
    expect(svg).toBeInTheDocument();
    const circles = skeleton.querySelectorAll('circle');
    expect(circles).toHaveLength(3);
  });

  it('should have card background with border', () => {
    render(<SkeletonLoader />);
    const skeleton = screen.getByTestId('skeleton-loader');

    // Should have card bg and semantic border
    expect(skeleton).toHaveClass('bg-card');
    expect(skeleton).toHaveClass('border-border');
  });

  it('should have proper card styling', () => {
    render(<SkeletonLoader />);
    const skeleton = screen.getByTestId('skeleton-loader');

    // Should have rounded corners and padding like other cards
    expect(skeleton).toHaveClass('rounded-lg');
    expect(skeleton).toHaveClass('p-4');
    expect(skeleton).toHaveClass('border');
  });

  it('should have centered flex layout', () => {
    render(<SkeletonLoader />);
    const skeleton = screen.getByTestId('skeleton-loader');

    // Should have centered flex layout for dots
    expect(skeleton).toHaveClass('flex');
    expect(skeleton).toHaveClass('items-center');
    expect(skeleton).toHaveClass('justify-center');
  });
});
