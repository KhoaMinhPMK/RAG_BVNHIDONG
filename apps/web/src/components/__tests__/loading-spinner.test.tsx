import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LoadingSpinner, InlineSpinner, FullPageSpinner } from '../ui/loading-spinner';

describe('LoadingSpinner', () => {
  it('renders loading spinner', () => {
    render(<LoadingSpinner />);
    const spinner = screen.getByRole('status');
    expect(spinner).toBeInTheDocument();
  });

  it('renders with default medium size', () => {
    render(<LoadingSpinner />);
    const spinner = screen.getByRole('status');
    expect(spinner).toHaveClass('w-8');
    expect(spinner).toHaveClass('h-8');
  });

  it('renders with small size', () => {
    render(<LoadingSpinner size="sm" />);
    const spinner = screen.getByRole('status');
    expect(spinner).toHaveClass('w-4');
    expect(spinner).toHaveClass('h-4');
  });

  it('renders with large size', () => {
    render(<LoadingSpinner size="lg" />);
    const spinner = screen.getByRole('status');
    expect(spinner).toHaveClass('w-12');
    expect(spinner).toHaveClass('h-12');
  });

  it('has spinning animation', () => {
    render(<LoadingSpinner />);
    const spinner = screen.getByRole('status');
    expect(spinner).toHaveClass('animate-spin');
  });

  it('renders with custom label', () => {
    render(<LoadingSpinner label="Loading data..." />);
    expect(screen.getByText('Loading data...')).toBeInTheDocument();
  });

  it('has default aria-label when no label provided', () => {
    render(<LoadingSpinner />);
    const spinner = screen.getByRole('status');
    expect(spinner).toHaveAttribute('aria-label', 'Loading');
  });
});

describe('InlineSpinner', () => {
  it('renders inline spinner', () => {
    render(<InlineSpinner />);
    const spinner = screen.getByRole('status');
    expect(spinner).toBeInTheDocument();
  });

  it('has inline-block class', () => {
    render(<InlineSpinner />);
    const spinner = screen.getByRole('status');
    expect(spinner).toHaveClass('inline-block');
  });

  it('renders with small size by default', () => {
    render(<InlineSpinner />);
    const spinner = screen.getByRole('status');
    expect(spinner).toHaveClass('w-4');
    expect(spinner).toHaveClass('h-4');
  });
});

describe('FullPageSpinner', () => {
  it('renders full page spinner with overlay', () => {
    const { container } = render(<FullPageSpinner />);
    const overlay = container.querySelector('.fixed.inset-0');
    expect(overlay).toBeInTheDocument();
  });

  it('renders with custom label', () => {
    render(<FullPageSpinner label="Processing..." />);
    expect(screen.getByText('Processing...')).toBeInTheDocument();
  });

  it('has backdrop blur effect', () => {
    const { container } = render(<FullPageSpinner />);
    const overlay = container.querySelector('.backdrop-blur-sm');
    expect(overlay).toBeInTheDocument();
  });
});

