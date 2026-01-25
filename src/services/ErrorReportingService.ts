/**
 * ErrorReportingService - Production error monitoring with Sentry
 *
 * Provides centralized error reporting for production monitoring.
 * Integrates with Sentry to capture errors with context, breadcrumbs,
 * and user information for debugging production issues.
 */

import * as Sentry from '@sentry/browser';
import type { AppError, ErrorSeverity } from '../core/ErrorHandling';

export interface ErrorReportingConfig {
  dsn: string;
  environment: string;
  release?: string;
  sampleRate?: number;
  enabled?: boolean;
}

interface UserContext {
  id?: string;
  email?: string;
  username?: string;
}

class ErrorReportingService {
  private initialized = false;
  private enabled = false;

  /**
   * Initialize Sentry with configuration
   * Should be called once at app startup
   */
  init(config: ErrorReportingConfig): void {
    if (this.initialized) {
      console.warn('[ErrorReporting] Already initialized');
      return;
    }

    // Skip initialization if disabled or no DSN
    if (config.enabled === false || !config.dsn) {
      console.info('[ErrorReporting] Disabled - no DSN provided or explicitly disabled');
      this.enabled = false;
      this.initialized = true;
      return;
    }

    try {
      Sentry.init({
        dsn: config.dsn,
        environment: config.environment,
        release: config.release,
        sampleRate: config.sampleRate ?? 1.0,

        // Only send errors in production-like environments
        enabled: config.environment !== 'development',

        // Capture unhandled promise rejections
        integrations: [
          Sentry.browserTracingIntegration(),
          Sentry.replayIntegration({
            // Mask all text and block all media for privacy
            maskAllText: true,
            blockAllMedia: true,
          }),
        ],

        // Performance monitoring - sample 10% of transactions
        tracesSampleRate: 0.1,

        // Session replay - sample 10% of sessions, 100% on error
        replaysSessionSampleRate: 0.1,
        replaysOnErrorSampleRate: 1.0,

        // Don't send PII
        sendDefaultPii: false,

        // Filter out noisy errors
        beforeSend(event, hint) {
          const error = hint.originalException;

          // Ignore network errors (user offline)
          if (error instanceof Error) {
            if (error.message.includes('NetworkError') || error.message.includes('Failed to fetch')) {
              return null;
            }
            // Ignore user-aborted requests
            if (error.name === 'AbortError') {
              return null;
            }
          }

          return event;
        },
      });

      this.enabled = true;
      this.initialized = true;
      console.info('[ErrorReporting] Initialized successfully');
    } catch (error) {
      console.error('[ErrorReporting] Failed to initialize:', error);
      this.enabled = false;
      this.initialized = true;
    }
  }

  /**
   * Check if error reporting is enabled and initialized
   */
  isEnabled(): boolean {
    return this.initialized && this.enabled;
  }

  /**
   * Set user context for error reports
   */
  setUser(user: UserContext | null): void {
    if (!this.isEnabled()) return;

    if (user) {
      Sentry.setUser({
        id: user.id,
        email: user.email,
        username: user.username,
      });
    } else {
      Sentry.setUser(null);
    }
  }

  /**
   * Add a breadcrumb for context
   */
  addBreadcrumb(message: string, category: string, data?: Record<string, unknown>): void {
    if (!this.isEnabled()) return;

    Sentry.addBreadcrumb({
      message,
      category,
      data,
      level: 'info',
    });
  }

  /**
   * Set custom tags for filtering
   */
  setTag(key: string, value: string): void {
    if (!this.isEnabled()) return;
    Sentry.setTag(key, value);
  }

  /**
   * Set extra context data
   */
  setExtra(key: string, value: unknown): void {
    if (!this.isEnabled()) return;
    Sentry.setExtra(key, value);
  }

  /**
   * Report an AppError to Sentry
   */
  reportAppError(appError: AppError): void {
    if (!this.isEnabled()) {
      console.log('[ErrorReporting] Would report (disabled):', appError.code, appError.message);
      return;
    }

    const level = this.mapSeverityToSentryLevel(appError.severity);

    Sentry.withScope((scope) => {
      // Set error context
      scope.setLevel(level);
      scope.setTag('error_type', appError.type);
      scope.setTag('error_code', appError.code);
      scope.setTag('recoverable', String(appError.recoverable));

      // Add context data
      if (appError.context) {
        scope.setExtras(appError.context);
      }

      // Create an Error object for better stack traces
      const error = new Error(appError.message);
      error.name = `${appError.type}Error`;
      if (appError.stack) {
        error.stack = appError.stack;
      }

      Sentry.captureException(error);
    });
  }

  /**
   * Report a generic error
   */
  reportError(error: Error, context?: Record<string, unknown>): void {
    if (!this.isEnabled()) {
      console.log('[ErrorReporting] Would report (disabled):', error.message);
      return;
    }

    Sentry.withScope((scope) => {
      if (context) {
        scope.setExtras(context);
      }
      Sentry.captureException(error);
    });
  }

  /**
   * Report a message (non-error event)
   */
  reportMessage(message: string, level: 'info' | 'warning' | 'error' = 'info'): void {
    if (!this.isEnabled()) {
      console.log('[ErrorReporting] Would report message (disabled):', message);
      return;
    }

    Sentry.captureMessage(message, level);
  }

  /**
   * Start a performance transaction
   */
  startTransaction(name: string, op: string): Sentry.Span | undefined {
    if (!this.isEnabled()) return undefined;

    return Sentry.startInactiveSpan({
      name,
      op,
      forceTransaction: true,
    });
  }

  /**
   * Flush pending events (useful before page unload)
   */
  async flush(timeout = 2000): Promise<boolean> {
    if (!this.isEnabled()) return true;
    return Sentry.flush(timeout);
  }

  /**
   * Map AppError severity to Sentry severity level
   */
  private mapSeverityToSentryLevel(severity: ErrorSeverity): Sentry.SeverityLevel {
    switch (severity) {
      case 'low':
        return 'info';
      case 'medium':
        return 'warning';
      case 'high':
        return 'error';
      case 'critical':
        return 'fatal';
      default:
        return 'error';
    }
  }
}

// Export singleton instance
export const errorReportingService = new ErrorReportingService();

/**
 * Initialize error reporting with environment configuration
 * Call this once at app startup
 * @param dsn Optional Sentry DSN (if not provided, will try to read from env)
 * @param environment Optional environment name (defaults to 'development')
 * @param release Optional release version
 */
export function initErrorReporting(
  dsn?: string,
  environment?: string,
  release?: string
): void {
  // Use provided values, or initialize with empty config for test environment
  errorReportingService.init({
    dsn: dsn || '',
    environment: environment || 'development',
    release,
    enabled: !!dsn,
  });
}

export default errorReportingService;
