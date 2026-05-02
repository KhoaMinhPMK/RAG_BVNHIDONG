import React from 'react';

export type SpinnerSize = 'sm' | 'md' | 'lg';

interface LoadingSpinnerProps {
  size?: SpinnerSize;
  className?: string;
  label?: string;
}

const sizeClasses: Record<SpinnerSize, string> = {
  sm: 'w-4 h-4 border-2',
  md: 'w-8 h-8 border-2',
  lg: 'w-12 h-12 border-3',
};

export function LoadingSpinner({
  size = 'md',
  className = '',
  label
}: LoadingSpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2">
      <div
        className={`
          ${sizeClasses[size]}
          border-gray-200
          border-t-blue-600
          rounded-full
          animate-spin
          ${className}
        `}
        role="status"
        aria-label={label || 'Loading'}
      />
      {label && (
        <span className="text-sm text-gray-600">{label}</span>
      )}
    </div>
  );
}

// Inline spinner (no label, inline with text)
export function InlineSpinner({ size = 'sm' }: { size?: SpinnerSize }) {
  return (
    <div
      className={`
        ${sizeClasses[size]}
        border-gray-200
        border-t-blue-600
        rounded-full
        animate-spin
        inline-block
      `}
      role="status"
      aria-label="Loading"
    />
  );
}

// Full page spinner with overlay
export function FullPageSpinner({ label }: { label?: string }) {
  return (
    <div className="fixed inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50">
      <LoadingSpinner size="lg" label={label} />
    </div>
  );
}
