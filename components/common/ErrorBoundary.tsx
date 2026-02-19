'use client'

import React, { Component, type ErrorInfo, type ReactNode } from 'react'
import { HiExclamationTriangle, HiArrowPath, HiHome } from 'react-icons/hi2'
import { Button } from '@/components/ui/Button'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  onReset?: () => void
  showHomeButton?: boolean
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

/**
 * Error Boundary component that catches JavaScript errors in child components
 * and displays a fallback UI.
 *
 * @example
 * ```tsx
 * <ErrorBoundary>
 *   <MyComponent />
 * </ErrorBoundary>
 * ```
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error }
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error details
    console.error('ErrorBoundary caught an error:', error, errorInfo)

    // Update state with error info
    this.setState({ errorInfo })

    // Call optional error handler
    this.props.onError?.(error, errorInfo)
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    })
    this.props.onReset?.()
  }

  handleGoHome = (): void => {
    window.location.href = '/admin'
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      // Render custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default fallback UI
      return (
        <div className="min-h-[400px] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-800 p-8">
            <div className="flex flex-col items-center text-center">
              {/* Error Icon */}
              <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
                <HiExclamationTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
              </div>

              {/* Error Title */}
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Terjadi Kesalahan
              </h2>

              {/* Error Description */}
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Maaf, terjadi kesalahan yang tidak terduga. Silakan coba lagi atau hubungi tim support.
              </p>

              {/* Error Details (Development Only) */}
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <div className="w-full mb-6 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-left overflow-auto">
                  <p className="text-sm font-mono text-red-600 dark:text-red-400 wrap-break-word">
                    {this.state.error.message}
                  </p>
                  {this.state.errorInfo?.componentStack && (
                    <pre className="mt-2 text-xs font-mono text-gray-500 dark:text-gray-400 whitespace-pre-wrap max-h-32 overflow-y-auto">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 w-full">
                <Button onClick={this.handleReset}
                  className="flex-1"
                >
                  <HiArrowPath className="w-5 h-5" />
                  Coba Lagi
                </Button>

                {this.props.showHomeButton !== false && (
                  <Button
                    onClick={this.handleGoHome}
                    variant="secondary"
                    className="flex-1"
                  >
                    <HiHome className="w-5 h-5" />
                    Kembali ke Dashboard
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * Wrapper component for using ErrorBoundary with hooks
 * Provides a way to reset the error boundary from child components
 */
export function ErrorBoundaryWrapper({
  children,
  ...props
}: ErrorBoundaryProps): React.ReactElement {
  return <ErrorBoundary {...props}>{children}</ErrorBoundary>
}

export default ErrorBoundary
