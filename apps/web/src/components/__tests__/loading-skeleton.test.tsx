import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  Skeleton,
  EpisodeCardSkeleton,
  EpisodeListSkeleton,
  DetectionSkeleton,
  ExplanationSkeleton,
  DraftSkeleton,
  ChatMessageSkeleton,
  FileItemSkeleton,
  ProgressSkeleton,
  CaseDetailSkeleton,
} from '../ui/loading-skeleton';

describe('Skeleton', () => {
  it('renders base skeleton', () => {
    render(<Skeleton />);
    const skeleton = screen.getByRole('status');
    expect(skeleton).toBeInTheDocument();
  });

  it('has pulse animation', () => {
    render(<Skeleton />);
    const skeleton = screen.getByRole('status');
    expect(skeleton).toHaveClass('animate-pulse');
  });

  it('applies custom className', () => {
    render(<Skeleton className="h-10 w-full" />);
    const skeleton = screen.getByRole('status');
    expect(skeleton).toHaveClass('h-10');
    expect(skeleton).toHaveClass('w-full');
  });

  it('has default aria-label', () => {
    render(<Skeleton />);
    const skeleton = screen.getByRole('status');
    expect(skeleton).toHaveAttribute('aria-label', 'Loading');
  });
});

describe('EpisodeCardSkeleton', () => {
  it('renders episode card skeleton', () => {
    const { container } = render(<EpisodeCardSkeleton />);
    const skeletons = container.querySelectorAll('[role="status"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('has card structure with border', () => {
    const { container } = render(<EpisodeCardSkeleton />);
    const card = container.querySelector('.border-gray-200');
    expect(card).toBeInTheDocument();
  });
});

describe('EpisodeListSkeleton', () => {
  it('renders default 3 episode cards', () => {
    const { container } = render(<EpisodeListSkeleton />);
    const cards = container.querySelectorAll('.border-gray-200');
    expect(cards.length).toBe(3);
  });

  it('renders custom count of episode cards', () => {
    const { container } = render(<EpisodeListSkeleton count={5} />);
    const cards = container.querySelectorAll('.border-gray-200');
    expect(cards.length).toBe(5);
  });
});

describe('DetectionSkeleton', () => {
  it('renders detection skeleton with findings', () => {
    const { container } = render(<DetectionSkeleton />);
    const findings = container.querySelectorAll('.bg-gray-50');
    expect(findings.length).toBe(3);
  });
});

describe('ExplanationSkeleton', () => {
  it('renders explanation skeleton', () => {
    const { container } = render(<ExplanationSkeleton />);
    const skeletons = container.querySelectorAll('[role="status"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });
});

describe('DraftSkeleton', () => {
  it('renders draft skeleton with form fields', () => {
    const { container } = render(<DraftSkeleton />);
    const skeletons = container.querySelectorAll('[role="status"]');
    expect(skeletons.length).toBeGreaterThan(5);
  });

  it('has border separator', () => {
    const { container } = render(<DraftSkeleton />);
    const border = container.querySelector('.border-t.border-gray-200');
    expect(border).toBeInTheDocument();
  });
});

describe('ChatMessageSkeleton', () => {
  it('renders chat message skeleton', () => {
    const { container } = render(<ChatMessageSkeleton />);
    const avatar = container.querySelector('.rounded-full');
    expect(avatar).toBeInTheDocument();
  });
});

describe('FileItemSkeleton', () => {
  it('renders file item skeleton', () => {
    const { container } = render(<FileItemSkeleton />);
    const fileItem = container.querySelector('.bg-gray-50');
    expect(fileItem).toBeInTheDocument();
  });
});

describe('ProgressSkeleton', () => {
  it('renders progress skeleton', () => {
    const { container } = render(<ProgressSkeleton />);
    const progressBar = container.querySelector('.rounded-full');
    expect(progressBar).toBeInTheDocument();
  });
});

describe('CaseDetailSkeleton', () => {
  it('renders case detail skeleton', () => {
    const { container } = render(<CaseDetailSkeleton />);
    const skeletons = container.querySelectorAll('[role="status"]');
    expect(skeletons.length).toBeGreaterThan(10);
  });

  it('has grid layout', () => {
    const { container } = render(<CaseDetailSkeleton />);
    const grid = container.querySelector('.grid.grid-cols-2');
    expect(grid).toBeInTheDocument();
  });

  it('includes detection skeleton', () => {
    const { container } = render(<CaseDetailSkeleton />);
    const findings = container.querySelectorAll('.bg-gray-50');
    expect(findings.length).toBeGreaterThan(0);
  });
});
