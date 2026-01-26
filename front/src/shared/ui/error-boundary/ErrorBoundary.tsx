'use client';

import { Component, ReactNode, ErrorInfo } from 'react';

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, State> {
  constructor(props: ErrorBoundaryProps) {
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
      return this.props.fallback;
    }

    return this.props.children;
  }
}

export const AppErrorBoundary = ({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) => (
  <ErrorBoundary
    fallback={
      fallback || (
        <div className="p-8 text-center">앱에서 오류가 발생했습니다.</div>
      )
    }
  >
    {children}
  </ErrorBoundary>
);

export const PageErrorBoundary = ({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) => (
  <ErrorBoundary
    fallback={
      fallback || (
        <div className="p-4 text-center">
          페이지를 불러오는 중 오류가 발생했습니다.
        </div>
      )
    }
  >
    {children}
  </ErrorBoundary>
);

export const WidgetErrorBoundary = ({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) => (
  <ErrorBoundary
    fallback={
      fallback || (
        <div className="p-2 text-center text-sm">오류가 발생했습니다.</div>
      )
    }
  >
    {children}
  </ErrorBoundary>
);
