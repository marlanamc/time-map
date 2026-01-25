// ===================================
// Error Handling System
// ===================================

import { errorReportingService } from '../services/ErrorReportingService';

export enum ErrorType {
  NETWORK = 'network',
  AUTHENTICATION = 'authentication',
  VALIDATION = 'validation',
  STORAGE = 'storage',
  SYNC = 'sync',
  UI = 'ui',
  UNKNOWN = 'unknown'
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface AppError {
  type: ErrorType;
  severity: ErrorSeverity;
  code: string;
  message: string;
  userMessage: string;
  recoverable: boolean;
  timestamp: Date;
  context?: Record<string, any>;
  stack?: string;
}

export class ErrorHandler {
  private static instance: ErrorHandler;
  private errorListeners: Set<(error: AppError) => void> = new Set();
  private errorLog: AppError[] = [];
  private maxLogSize = 100;

  private constructor() {
    this.setupGlobalErrorHandlers();
  }

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * Setup global error handlers
   */
  private setupGlobalErrorHandlers(): void {
    // Handle uncaught JavaScript errors
    window.addEventListener('error', (event) => {
      this.handleError({
        type: ErrorType.UNKNOWN,
        severity: ErrorSeverity.HIGH,
        code: 'UNCAUGHT_ERROR',
        message: event.message || 'Unknown error',
        userMessage: 'Something went wrong. Try refreshing the page.',
        recoverable: false,
        timestamp: new Date(),
        context: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        },
        stack: event.error?.stack
      });
    });

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError({
        type: ErrorType.UNKNOWN,
        severity: ErrorSeverity.HIGH,
        code: 'UNHANDLED_PROMISE_REJECTION',
        message: event.reason?.message || String(event.reason) || 'Unhandled promise rejection',
        userMessage: 'Something went wrong. Try refreshing the page.',
        recoverable: false,
        timestamp: new Date(),
        context: { reason: event.reason },
        stack: event.reason?.stack
      });
    });
  }

  /**
   * Handle an error
   */
  handleError(error: Partial<AppError> & { message: string }): void {
    const appError: AppError = {
      type: error.type || ErrorType.UNKNOWN,
      severity: error.severity || ErrorSeverity.MEDIUM,
      code: error.code || 'UNKNOWN_ERROR',
      message: error.message,
      userMessage: error.userMessage || this.getDefaultUserMessage(error.type || ErrorType.UNKNOWN),
      recoverable: error.recoverable ?? true,
      timestamp: new Date(),
      context: error.context,
      stack: error.stack
    };

    // Log to console with appropriate level
    this.logToConsole(appError);

    // Add to error log
    this.addToErrorLog(appError);

    // Notify listeners
    this.notifyListeners(appError);

    // Send to external service for high/critical errors
    if (appError.severity === ErrorSeverity.HIGH || appError.severity === ErrorSeverity.CRITICAL) {
      void this.reportError(appError);
    }
  }

  /**
   * Create a network error
   */
  createNetworkError(message: string, context?: Record<string, any>): AppError {
    return {
      type: ErrorType.NETWORK,
      severity: ErrorSeverity.MEDIUM,
      code: 'NETWORK_ERROR',
      message,
      userMessage: 'Connection problem. Check your internet connection.',
      recoverable: true,
      timestamp: new Date(),
      context
    };
  }

  /**
   * Create an authentication error
   */
  createAuthError(message: string, context?: Record<string, any>): AppError {
    return {
      type: ErrorType.AUTHENTICATION,
      severity: ErrorSeverity.HIGH,
      code: 'AUTH_ERROR',
      message,
      userMessage: 'Authentication problem. Please sign in again.',
      recoverable: true,
      timestamp: new Date(),
      context
    };
  }

  /**
   * Create a validation error
   */
  createValidationError(message: string, context?: Record<string, any>): AppError {
    return {
      type: ErrorType.VALIDATION,
      severity: ErrorSeverity.LOW,
      code: 'VALIDATION_ERROR',
      message,
      userMessage: 'Please check your input and try again.',
      recoverable: true,
      timestamp: new Date(),
      context
    };
  }

  /**
   * Create a storage error
   */
  createStorageError(message: string, context?: Record<string, any>): AppError {
    return {
      type: ErrorType.STORAGE,
      severity: ErrorSeverity.MEDIUM,
      code: 'STORAGE_ERROR',
      message,
      userMessage: 'Storage problem. Your data may not be saved properly.',
      recoverable: true,
      timestamp: new Date(),
      context
    };
  }

  /**
   * Create a sync error
   */
  createSyncError(message: string, context?: Record<string, any>): AppError {
    return {
      type: ErrorType.SYNC,
      severity: ErrorSeverity.MEDIUM,
      code: 'SYNC_ERROR',
      message,
      userMessage: 'Sync problem. Your changes will be saved locally.',
      recoverable: true,
      timestamp: new Date(),
      context
    };
  }

  /**
   * Create a UI error
   */
  createUIError(message: string, context?: Record<string, any>): AppError {
    return {
      type: ErrorType.UI,
      severity: ErrorSeverity.LOW,
      code: 'UI_ERROR',
      message,
      userMessage: 'Display problem. Try refreshing the page.',
      recoverable: true,
      timestamp: new Date(),
      context
    };
  }

  /**
   * Wrap async function with error handling
   */
  async withErrorHandling<T>(
    fn: () => Promise<T>,
    errorType: ErrorType = ErrorType.UNKNOWN,
    context?: Record<string, any>
  ): Promise<T | null> {
    try {
      return await fn();
    } catch (error) {
      this.handleError({
        type: errorType,
        severity: ErrorSeverity.MEDIUM,
        code: 'ASYNC_ERROR',
        message: error instanceof Error ? error.message : String(error),
        userMessage: this.getDefaultUserMessage(errorType),
        recoverable: true,
        timestamp: new Date(),
        context,
        stack: error instanceof Error ? error.stack : undefined
      });
      return null;
    }
  }

  /**
   * Subscribe to error events
   */
  onError(listener: (error: AppError) => void): () => void {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }

  /**
   * Get error log
   */
  getErrorLog(): AppError[] {
    return [...this.errorLog];
  }

  /**
   * Clear error log
   */
  clearErrorLog(): void {
    this.errorLog = [];
  }

  /**
   * Get default user message for error type
   */
  private getDefaultUserMessage(type: ErrorType): string {
    switch (type) {
      case ErrorType.NETWORK:
        return 'Connection problem. Please check your internet connection.';
      case ErrorType.AUTHENTICATION:
        return 'Authentication problem. Please sign in again.';
      case ErrorType.VALIDATION:
        return 'Please check your input and try again.';
      case ErrorType.STORAGE:
        return 'Storage problem. Your data may not be saved properly.';
      case ErrorType.SYNC:
        return 'Sync problem. Your changes will be saved locally.';
      case ErrorType.UI:
        return 'Display problem. Try refreshing the page.';
      default:
        return 'Something went wrong. Try refreshing the page.';
    }
  }

  /**
   * Log error to console
   */
  private logToConsole(error: AppError): void {
    const logMessage = `[${error.severity.toUpperCase()}] ${error.type}: ${error.message}`;
    
    switch (error.severity) {
      case ErrorSeverity.LOW:
        console.info(logMessage, error);
        break;
      case ErrorSeverity.MEDIUM:
        console.warn(logMessage, error);
        break;
      case ErrorSeverity.HIGH:
      case ErrorSeverity.CRITICAL:
        console.error(logMessage, error);
        break;
    }
  }

  /**
   * Add error to log
   */
  private addToErrorLog(error: AppError): void {
    this.errorLog.push(error);
    
    // Keep log size manageable
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog = this.errorLog.slice(-this.maxLogSize);
    }
  }

  /**
   * Notify error listeners
   */
  private notifyListeners(error: AppError): void {
    this.errorListeners.forEach(listener => {
      try {
        listener(error);
      } catch (listenerError) {
        console.error('Error in error listener:', listenerError);
      }
    });
  }

  /**
   * Report critical errors to external service (Sentry)
   */
  private async reportError(error: AppError): Promise<void> {
    // Report to Sentry if configured
    errorReportingService.reportAppError(error);
  }

  /**
   * Create error boundary fallback UI
   */
  createErrorBoundaryUI(error: AppError): HTMLElement {
    const container = document.createElement('div');
    container.className = 'error-boundary';
    container.innerHTML = `
      <div class="error-content">
        <h2>Something went wrong</h2>
        <p>${error.userMessage}</p>
        ${error.recoverable ? `
          <button onclick="location.reload()">Refresh Page</button>
          <button onclick="this.parentElement.parentElement.remove()">Dismiss</button>
        ` : `
          <button onclick="location.reload()">Refresh Page</button>
        `}
        <details>
          <summary>Technical Details</summary>
          <pre>${JSON.stringify(error, null, 2)}</pre>
        </details>
      </div>
    `;
    
    // Add basic styling
    container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
    `;
    
    const content = container.querySelector('.error-content') as HTMLElement;
    content.style.cssText = `
      background: white;
      padding: 2rem;
      border-radius: 8px;
      max-width: 500px;
      max-height: 80vh;
      overflow-y: auto;
    `;
    
    return container;
  }
}

// Export singleton instance
export const errorHandler = ErrorHandler.getInstance();

// Export convenience functions
export const handleError = (error: Partial<AppError> & { message: string }) => {
  errorHandler.handleError(error);
};

export const withErrorHandling = <T>(
  fn: () => Promise<T>,
  errorType: ErrorType = ErrorType.UNKNOWN,
  context?: Record<string, any>
): Promise<T | null> => {
  return errorHandler.withErrorHandling(fn, errorType, context);
};
