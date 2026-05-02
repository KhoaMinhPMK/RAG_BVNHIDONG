'use client';

import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.props.onError?.(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="flex flex-col items-center justify-center p-8 border border-semantic-error/30 rounded-sm bg-semantic-error/5">
            <AlertTriangle className="w-8 h-8 text-semantic-error mb-3" />
            <p className="text-xs font-semibold text-text-primary mb-1">Có lỗi xảy ra</p>
            <p className="text-[10px] text-text-tertiary mb-3 text-center max-w-xs">
              {this.state.error?.message || 'Không thể tải thành phần này'}
            </p>
            <button
              onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-primary text-white text-xs font-medium rounded-sm hover:opacity-90"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Tải lại trang
            </button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}

// Simple error display component for inline use
export function ErrorDisplay({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center p-6 border border-semantic-error/30 rounded-sm bg-semantic-error/5">
      <AlertTriangle className="w-6 h-6 text-semantic-error mb-2" />
      <p className="text-xs text-text-secondary mb-1">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-primary text-white text-xs font-medium rounded-sm hover:opacity-90 mt-2"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Thử lại
        </button>
      )}
    </div>
  );
}

// Network error with retry
export function NetworkError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center p-6 border border-semantic-warning/30 rounded-sm bg-semantic-warning/5">
      <AlertTriangle className="w-6 h-6 text-semantic-warning mb-2" />
      <p className="text-xs text-text-secondary mb-1">Không thể kết nối đến máy chủ</p>
      <p className="text-[10px] text-text-tertiary mb-3">Kiểm tra kết nối mạng và thử lại</p>
      <button
        onClick={onRetry}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-primary text-white text-xs font-medium rounded-sm hover:opacity-90"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        Thử lại
      </button>
    </div>
  );
}
