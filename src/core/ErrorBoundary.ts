/**
 * Error Boundary - Catches and handles JavaScript errors gracefully
 * Provides fallback UI and error reporting
 */

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: string | null;
  retryCount: number;
}

export interface ErrorBoundaryProps {
  children: HTMLElement | HTMLElement[];
  fallback?: HTMLElement;
  onError?: (error: Error, errorInfo: string) => void;
  maxRetries?: number;
  component?: string;
}

export class ErrorBoundary {
  private state: ErrorBoundaryState;
  private props: ErrorBoundaryProps;
  private container: HTMLElement;
  private originalContent: HTMLElement[];

  constructor(container: HTMLElement, props: ErrorBoundaryProps) {
    this.container = container;
    this.props = { maxRetries: 3, component: "Unknown", ...props };
    this.originalContent = Array.from(container.children) as HTMLElement[];
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
    };

    this.setup();
  }

  private setup(): void {
    // Store original content
    this.originalContent = Array.from(this.container.children) as HTMLElement[];

    // Set up global error handlers for this component
    this.setupErrorHandlers();
  }

  private setupErrorHandlers(): void {
    // Override event handlers for elements in this boundary
    this.originalContent.forEach((element) => {
      const originalHandlers = new Map<string, EventListener>();

      // Store original event handlers
      const events = ["click", "change", "submit", "error", "load"];
      events.forEach((eventType) => {
        const handler = (element as any)[`on${eventType}`];
        if (handler) {
          originalHandlers.set(eventType, handler);
        }
      });

      // Wrap event handlers with error catching
      events.forEach((eventType) => {
        element.addEventListener(eventType, (event) => {
          try {
            const originalHandler = originalHandlers.get(eventType);
            if (originalHandler) {
              originalHandler.call(element, event);
            }
          } catch (error) {
            this.handleError(
              error as Error,
              `${this.props.component} ${eventType} handler`
            );
          }
        });
      });
    });
  }

  public handleError(error: Error, errorInfo: string): void {
    // Update state
    this.state = {
      hasError: true,
      error,
      errorInfo,
      retryCount: this.state.retryCount,
    };

    // Log error
    console.error(`Error in ${this.props.component}:`, error);
    console.error("Error info:", errorInfo);

    // Call error callback
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Send to analytics
    this.sendErrorToAnalytics(error, errorInfo);

    // Show fallback UI
    this.showFallbackUI();
  }

  private sendErrorToAnalytics(error: Error, errorInfo: string): void {
    try {
      // Send to analytics service
      if (typeof (window as any).gtag !== "undefined") {
        (window as any).gtag("event", "error", {
          error_message: error.message,
          error_stack: error.stack,
          error_info: errorInfo,
          component: this.props.component,
          retry_count: this.state.retryCount,
        });
      }

      // Send to custom analytics
      console.log("🚨 Error Analytics:", {
        message: error.message,
        stack: error.stack,
        info: errorInfo,
        component: this.props.component,
        retryCount: this.state.retryCount,
        timestamp: Date.now(),
      });
    } catch (_analyticsError) {
      // Fail silently
    }
  }

  private showFallbackUI(): void {
    // Clear container
    this.container.innerHTML = "";

    // Create fallback UI
    const fallbackUI = this.props.fallback || this.createDefaultFallback();
    this.container.appendChild(fallbackUI);
  }

  private createDefaultFallback(): HTMLElement {
    const fallbackDiv = document.createElement("div");
    fallbackDiv.className = "error-boundary-fallback";
    fallbackDiv.style.cssText = `
      padding: 2rem;
      text-align: center;
      background: var(--bg-surface);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-lg);
      margin: 1rem;
      color: var(--text-primary);
    `;

    fallbackDiv.innerHTML = `
      <div style="font-size: 2rem; margin-bottom: 1rem;">🚨</div>
      <h3 style="margin-bottom: 1rem; color: var(--text-primary);">Something went wrong</h3>
      <p style="margin-bottom: 1.5rem; color: var(--text-secondary);">
        An error occurred in ${this.props.component}. Please try again.
      </p>
      <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
        <button id="retry-btn" class="btn btn-primary">Retry</button>
        <button id="report-btn" class="btn btn-secondary">Report Issue</button>
        <button id="dismiss-btn" class="btn btn-ghost">Dismiss</button>
      </div>
      <details style="margin-top: 1rem; text-align: left;">
        <summary style="cursor: pointer; color: var(--text-secondary);">Error Details</summary>
        <pre style="background: var(--bg-elevated); padding: 1rem; border-radius: var(--radius-md); overflow: auto; font-size: 0.875rem; color: var(--text-tertiary);">
${this.state.error?.stack || "No stack trace available"}
        </pre>
      </details>
    `;

    // Add event listeners
    const retryBtn = fallbackDiv.querySelector(
      "#retry-btn"
    ) as HTMLButtonElement;
    const reportBtn = fallbackDiv.querySelector(
      "#report-btn"
    ) as HTMLButtonElement;
    const dismissBtn = fallbackDiv.querySelector(
      "#dismiss-btn"
    ) as HTMLButtonElement;

    retryBtn?.addEventListener("click", () => this.retry());
    reportBtn?.addEventListener("click", () => this.reportIssue());
    dismissBtn?.addEventListener("click", () => this.dismiss());

    return fallbackDiv;
  }

  public retry(): void {
    if (this.state.retryCount >= (this.props.maxRetries || 3)) {
      console.warn("Max retries reached for", this.props.component);
      return;
    }

    this.state.retryCount++;
    this.state.hasError = false;
    this.state.error = null;
    this.state.errorInfo = null;

    // Restore original content
    this.container.innerHTML = "";
    this.originalContent.forEach((child) => {
      this.container.appendChild(child.cloneNode(true));
    });

    // Re-setup error handlers
    this.setupErrorHandlers();

    console.log(
      `Retrying ${this.props.component} (attempt ${this.state.retryCount})`
    );
  }

  public reportIssue(): void {
    const errorData = {
      message: this.state.error?.message || "Unknown error",
      stack: this.state.error?.stack || "No stack trace",
      info: this.state.errorInfo,
      component: this.props.component,
      retryCount: this.state.retryCount,
      userAgent: navigator.userAgent,
      url: window.location.href,
      timestamp: new Date().toISOString(),
    };

    // Create issue report
    const issueBody = `
## Error Report
**Component:** ${errorData.component}
**Message:** ${errorData.message}
**URL:** ${errorData.url}
**Timestamp:** ${errorData.timestamp}
**Retry Count:** ${errorData.retryCount}

### Error Details
\`\`\`
${errorData.stack}
\`\`\`

### Additional Info
${errorData.info}

### User Agent
${errorData.userAgent}
    `.trim();

    // Copy to clipboard
    navigator.clipboard
      .writeText(issueBody)
      .then(() => {
        // Show success message
        const successDiv = document.createElement("div");
        successDiv.textContent =
          "Error report copied to clipboard! You can paste this in GitHub Issues.";
        successDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: var(--accent);
        color: var(--text-on-accent);
        padding: 1rem;
        border-radius: var(--radius-md);
        z-index: 10000;
        max-width: 300px;
      `;
        document.body.appendChild(successDiv);

        setTimeout(() => {
          successDiv.remove();
        }, 3000);
      })
      .catch(() => {
        console.error("Failed to copy error report");
      });

    // Open GitHub issues
    window.open(
      "https://github.com/your-repo/visionboard/issues/new",
      "_blank"
    );
  }

  public dismiss(): void {
    // Hide the error boundary
    this.container.style.display = "none";

    // Try to show minimal content
    const minimalContent = document.createElement("div");
    minimalContent.innerHTML = `
      <div style="padding: 1rem; text-align: center; color: var(--text-secondary);">
        <p>Component temporarily unavailable. <a href="#" onclick="location.reload()">Refresh page</a> to try again.</p>
      </div>
    `;
    this.container.appendChild(minimalContent);
  }

  public reset(): void {
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
    };
    this.container.innerHTML = "";
    this.originalContent.forEach((child) => {
      this.container.appendChild(child.cloneNode(true));
    });
    this.setupErrorHandlers();
  }

  public getState(): ErrorBoundaryState {
    return { ...this.state };
  }

  public destroy(): void {
    // Clean up
    this.container.innerHTML = "";
    this.originalContent = [];
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
    };
  }
}

// Global error boundary manager
export class ErrorBoundaryManager {
  private static boundaries = new Map<HTMLElement, ErrorBoundary>();
  private static globalHandler: ((error: ErrorEvent) => void) | null = null;

  static createBoundary(
    container: HTMLElement,
    props: ErrorBoundaryProps
  ): ErrorBoundary {
    const boundary = new ErrorBoundary(container, props);
    this.boundaries.set(container, boundary);
    return boundary;
  }

  static getBoundary(container: HTMLElement): ErrorBoundary | undefined {
    return this.boundaries.get(container);
  }

  static removeBoundary(container: HTMLElement): void {
    const boundary = this.boundaries.get(container);
    if (boundary) {
      boundary.destroy();
      this.boundaries.delete(container);
    }
  }

  static setupGlobalHandler(): void {
    if (this.globalHandler) return;

    this.globalHandler = (event: ErrorEvent) => {
      // Find the boundary that contains the error target
      let target = event.target as HTMLElement;
      let boundary: ErrorBoundary | undefined;

      while (target && target !== document.body) {
        boundary = this.boundaries.get(target);
        if (boundary) break;
        target = target.parentElement as HTMLElement;
      }

      if (boundary) {
        boundary.handleError(event.error, `Global error: ${event.message}`);
      } else {
        // No boundary found, use default error handling
        console.error("Unhandled error:", event.error);
      }
    };

    window.addEventListener("error", this.globalHandler);
  }

  static cleanup(): void {
    if (this.globalHandler) {
      window.removeEventListener("error", this.globalHandler);
      this.globalHandler = null;
    }

    this.boundaries.forEach((boundary) => boundary.destroy());
    this.boundaries.clear();
  }
}

// Auto-setup global handler
ErrorBoundaryManager.setupGlobalHandler();
