/**
 * Performance Monitor - Core Web Vitals and Performance Metrics
 * Tracks user experience metrics and provides insights
 */

export interface PerformanceMetrics {
  // Core Web Vitals
  lcp: number; // Largest Contentful Paint
  fid: number; // First Input Delay
  cls: number; // Cumulative Layout Shift
  fcp: number; // First Contentful Paint
  ttfb: number; // Time to First Byte

  // Custom metrics
  appInitTime: number;
  firstInteraction: number;
  bundleLoadTime: number;

  // Navigation timing
  domContentLoaded: number;
  loadComplete: number;

  // Memory usage
  memoryUsed: number;
  memoryTotal: number;
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Partial<PerformanceMetrics> = {};
  private observers: PerformanceObserver[] = [];
  private isSupported = false;

  private constructor() {
    this.isSupported = this.checkSupport();
    if (this.isSupported) {
      this.setupObservers();
    }
  }

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  private checkSupport(): boolean {
    return (
      "PerformanceObserver" in window &&
      "performance" in window &&
      "PerformanceNavigationTiming" in window
    );
  }

  private setupObservers(): void {
    try {
      // Core Web Vitals - LCP
      this.observeLCP();

      // Core Web Vitals - FID
      this.observeFID();

      // Core Web Vitals - CLS
      this.observeCLS();

      // Navigation timing
      this.observeNavigation();

      // Memory usage
      this.observeMemory();

      // Resource timing
      this.observeResources();
    } catch (error) {
      console.warn("Performance monitoring setup failed:", error);
    }
  }

  private observeLCP(): void {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1] as PerformanceEntry;

        this.metrics.lcp = lastEntry.startTime;
        console.log(`📊 LCP: ${Math.round(this.metrics.lcp)}ms`);
        this.sendMetric("lcp", this.metrics.lcp);
      });

      observer.observe({ entryTypes: ["largest-contentful-paint"] });
      this.observers.push(observer);
    } catch (error) {
      console.warn("LCP observer setup failed:", error);
    }
  }

  private observeFID(): void {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        for (const entry of entries) {
          const fidEntry = entry as PerformanceEventTiming;
          if (fidEntry.processingStart) {
            this.metrics.fid = fidEntry.processingStart - fidEntry.startTime;
            console.log(`📊 FID: ${Math.round(this.metrics.fid)}ms`);
            this.sendMetric("fid", this.metrics.fid);
          }
        }
      });

      observer.observe({ entryTypes: ["first-input"] });
      this.observers.push(observer);
    } catch (error) {
      console.warn("FID observer setup failed:", error);
    }
  }

  private observeCLS(): void {
    try {
      let clsValue = 0;

      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const clsEntry = entry as any;
          if (!clsEntry.hadRecentInput) {
            clsValue += clsEntry.value;
            this.metrics.cls = clsValue;
            console.log(`📊 CLS: ${clsValue.toFixed(3)}`);
            this.sendMetric("cls", clsValue);
          }
        }
      });

      observer.observe({ entryTypes: ["layout-shift"] });
      this.observers.push(observer);
    } catch (error) {
      console.warn("CLS observer setup failed:", error);
    }
  }

  private observeNavigation(): void {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        for (const entry of entries) {
          const navEntry = entry as PerformanceNavigationTiming;

          this.metrics.fcp = navEntry.responseStart - navEntry.fetchStart;
          this.metrics.ttfb = navEntry.responseStart - navEntry.requestStart;
          this.metrics.domContentLoaded =
            navEntry.domContentLoadedEventEnd - navEntry.fetchStart;
          this.metrics.loadComplete =
            navEntry.loadEventEnd - navEntry.fetchStart;

          console.log(`📊 Navigation metrics:`, {
            fcp: `${Math.round(this.metrics.fcp)}ms`,
            ttfb: `${Math.round(this.metrics.ttfb)}ms`,
            domContentLoaded: `${Math.round(this.metrics.domContentLoaded)}ms`,
            loadComplete: `${Math.round(this.metrics.loadComplete)}ms`,
          });

          this.sendMetric("navigation", this.metrics);
        }
      });

      observer.observe({ entryTypes: ["navigation"] });
      this.observers.push(observer);
    } catch (error) {
      console.warn("Navigation observer setup failed:", error);
    }
  }

  private observeMemory(): void {
    try {
      if ("memory" in performance) {
        const checkMemory = () => {
          const memory = (performance as any).memory;
          this.metrics.memoryUsed = memory.usedJSHeapSize;
          this.metrics.memoryTotal = memory.totalJSHeapSize;

          console.log(
            `📊 Memory: ${Math.round(
              this.metrics.memoryUsed / 1024 / 1024
            )}MB / ${Math.round(this.metrics.memoryTotal / 1024 / 1024)}MB`
          );
          this.sendMetric("memory", this.metrics);
        };

        setInterval(checkMemory, 5000);
        checkMemory();
      }
    } catch (error) {
      console.warn("Memory observer setup failed:", error);
    }
  }

  private observeResources(): void {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const resourceEntries = entries.filter(
          (entry) => entry.entryType === "resource"
        );

        const bundleEntries = resourceEntries.filter(
          (entry) =>
            (entry as any).name.includes("main-") ||
            (entry as any).name.includes("features-") ||
            (entry as any).name.includes("day-view-")
        );

        if (bundleEntries.length > 0) {
          const totalBundleTime = bundleEntries.reduce((sum, entry) => {
            return (
              sum +
              (entry as PerformanceResourceTiming).responseEnd -
              entry.startTime
            );
          }, 0);

          this.metrics.bundleLoadTime = totalBundleTime;
          console.log(`📊 Bundle load time: ${Math.round(totalBundleTime)}ms`);
          this.sendMetric("bundleLoad", totalBundleTime);
        }
      });

      observer.observe({ entryTypes: ["resource"] });
      this.observers.push(observer);
    } catch (error) {
      console.warn("Resource observer setup failed:", error);
    }
  }

  markAppInitStart(): void {
    if (this.isSupported) {
      performance.mark("app-init-start");
    }
  }

  markAppInitEnd(): void {
    if (this.isSupported) {
      performance.mark("app-init-end");
      performance.measure("app-init", "app-init-start", "app-init-end");

      const measure = performance.getEntriesByName("app-init")[0];
      this.metrics.appInitTime = measure.duration;
      console.log(
        `📊 App init time: ${Math.round(this.metrics.appInitTime)}ms`
      );
      this.sendMetric("appInit", this.metrics.appInitTime);
    }
  }

  markFirstInteraction(): void {
    if (this.isSupported && !this.metrics.firstInteraction) {
      performance.mark("first-interaction");
      performance.measure(
        "time-to-interaction",
        "fetchStart",
        "first-interaction"
      );

      const measure = performance.getEntriesByName("time-to-interaction")[0];
      if (measure) {
        this.metrics.firstInteraction = measure.duration;
        console.log(
          `📊 First interaction: ${Math.round(this.metrics.firstInteraction)}ms`
        );
        this.sendMetric("firstInteraction", this.metrics.firstInteraction);
      }
    }
  }

  getMetrics(): PerformanceMetrics {
    return {
      lcp: this.metrics.lcp || 0,
      fid: this.metrics.fid || 0,
      cls: this.metrics.cls || 0,
      fcp: this.metrics.fcp || 0,
      ttfb: this.metrics.ttfb || 0,
      appInitTime: this.metrics.appInitTime || 0,
      firstInteraction: this.metrics.firstInteraction || 0,
      bundleLoadTime: this.metrics.bundleLoadTime || 0,
      domContentLoaded: this.metrics.domContentLoaded || 0,
      loadComplete: this.metrics.loadComplete || 0,
      memoryUsed: this.metrics.memoryUsed || 0,
      memoryTotal: this.metrics.memoryTotal || 0,
    };
  }

  getPerformanceRating(): "excellent" | "good" | "needs-improvement" | "poor" {
    const metrics = this.getMetrics();

    const lcpRating =
      metrics.lcp <= 2500
        ? "excellent"
        : metrics.lcp <= 4000
        ? "good"
        : "needs-improvement";
    const fidRating =
      metrics.fid <= 100
        ? "excellent"
        : metrics.fid <= 300
        ? "good"
        : "needs-improvement";
    const clsRating =
      metrics.cls <= 0.1
        ? "excellent"
        : metrics.cls <= 0.25
        ? "good"
        : "needs-improvement";

    const ratings = [lcpRating, fidRating, clsRating];
    if (ratings.every((r) => r === "excellent")) return "excellent";
    if (ratings.every((r) => r === "excellent" || r === "good")) return "good";
    if (ratings.some((r) => r === "needs-improvement"))
      return "needs-improvement";
    return "poor";
  }

  public sendMetric(name: string, value: number | object): void {
    if (typeof (window as any).gtag !== "undefined") {
      (window as any).gtag("event", "performance_metric", {
        metric_name: name,
        metric_value: typeof value === "number" ? value : JSON.stringify(value),
        custom_parameter: "visionboard_app",
      });
    }

    this.sendToCustomAnalytics(name, value);
  }

  private sendToCustomAnalytics(name: string, value: number | object): void {
    try {
      // Placeholder for custom analytics
      console.log("📊 Analytics:", { name, value, timestamp: Date.now() });
    } catch (_error) {
      // Fail silently
    }
  }

  disconnect(): void {
    this.observers.forEach((observer) => observer.disconnect());
    this.observers = [];
  }

  generateReport(): string {
    const metrics = this.getMetrics();
    const rating = this.getPerformanceRating();

    return `
📊 Performance Report - ${new Date().toLocaleDateString()}
Rating: ${rating.toUpperCase()}

Core Web Vitals:
• LCP: ${Math.round(metrics.lcp)}ms
• FID: ${Math.round(metrics.fid)}ms  
• CLS: ${metrics.cls.toFixed(3)}
• FCP: ${Math.round(metrics.fcp)}ms

App Metrics:
• App Init Time: ${Math.round(metrics.appInitTime)}ms
• First Interaction: ${Math.round(metrics.firstInteraction)}ms
• Bundle Load Time: ${Math.round(metrics.bundleLoadTime)}ms

Navigation:
• Time to First Byte: ${Math.round(metrics.ttfb)}ms
• DOM Content Loaded: ${Math.round(metrics.domContentLoaded)}ms
• Load Complete: ${Math.round(metrics.loadComplete)}ms

Memory Usage:
• Used: ${Math.round(metrics.memoryUsed / 1024 / 1024)}MB
• Total: ${Math.round(metrics.memoryTotal / 1024 / 1024)}MB
    `.trim();
  }
}

export const performanceMonitor = PerformanceMonitor.getInstance();
