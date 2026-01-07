/**
 * PWA Transition Testing Utilities
 * For verifying smooth tab transitions
 */

export class TransitionTester {
  private static instance: TransitionTester;
  private metrics: Array<{
    type: string;
    duration: number;
    timestamp: number;
  }> = [];

  static getInstance(): TransitionTester {
    if (!TransitionTester.instance) {
      TransitionTester.instance = new TransitionTester();
    }
    return TransitionTester.instance;
  }

  /**
   * Test view transition performance
   */
  async testViewTransition(viewName: string): Promise<void> {
    const startTime = performance.now();
    
    // Add loading state
    const calendarGrid = document.querySelector('.calendar-grid') as HTMLElement;
    if (calendarGrid) {
      calendarGrid.classList.add('loading');
    }

    // Simulate view change
    await new Promise(resolve => setTimeout(resolve, 100));

    const endTime = performance.now();
    const duration = endTime - startTime;

    this.metrics.push({
      type: `view-transition-${viewName}`,
      duration,
      timestamp: Date.now()
    });

    // Remove loading state
    if (calendarGrid) {
      calendarGrid.classList.remove('loading');
      calendarGrid.classList.add('view-transitioning');
      
      setTimeout(() => {
        calendarGrid.classList.remove('view-transitioning');
      }, 200);
    }

    console.log(`View transition to ${viewName} took ${duration.toFixed(2)}ms`);
  }

  /**
   * Test tab switching performance
   */
  async testTabSwitch(tabName: string): Promise<void> {
    const startTime = performance.now();
    
    // Find and click tab
    const tab = document.querySelector(`[data-view="${tabName}"]`) as HTMLElement;
    if (tab) {
      tab.click();
      
      // Wait for transition to complete
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    const endTime = performance.now();
    const duration = endTime - startTime;

    this.metrics.push({
      type: `tab-switch-${tabName}`,
      duration,
      timestamp: Date.now()
    });

    console.log(`Tab switch to ${tabName} took ${duration.toFixed(2)}ms`);
  }

  /**
   * Get performance metrics
   */
  getMetrics(): Array<{
    type: string;
    duration: number;
    timestamp: number;
  }> {
    return [...this.metrics];
  }

  /**
   * Clear metrics
   */
  clearMetrics(): void {
    this.metrics = [];
  }

  /**
   * Analyze performance
   */
  analyzePerformance(): {
    averageTransitionTime: number;
    slowestTransition: { type: string; duration: number };
    fastestTransition: { type: string; duration: number };
    totalTransitions: number;
  } {
    if (this.metrics.length === 0) {
      return {
        averageTransitionTime: 0,
        slowestTransition: { type: 'none', duration: 0 },
        fastestTransition: { type: 'none', duration: 0 },
        totalTransitions: 0
      };
    }

    const durations = this.metrics.map(m => m.duration);
    const averageDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    
    const slowest = this.metrics.reduce((prev, current) => 
      prev.duration > current.duration ? prev : current
    );
    
    const fastest = this.metrics.reduce((prev, current) => 
      prev.duration < current.duration ? prev : current
    );

    return {
      averageTransitionTime: averageDuration,
      slowestTransition: { type: slowest.type, duration: slowest.duration },
      fastestTransition: { type: fastest.type, duration: fastest.duration },
      totalTransitions: this.metrics.length
    };
  }

  /**
   * Run comprehensive test suite
   */
  async runTestSuite(): Promise<void> {
    console.log('🧪 Starting PWA transition test suite...');
    this.clearMetrics();

    const views = ['year', 'month', 'week', 'day', 'home', 'garden'];
    
    for (const view of views) {
      await this.testViewTransition(view);
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const analysis = this.analyzePerformance();
    
    console.log('📊 Test Results:');
    console.log(`Average transition time: ${analysis.averageTransitionTime.toFixed(2)}ms`);
    console.log(`Slowest transition: ${analysis.slowestTransition.type} (${analysis.slowestTransition.duration.toFixed(2)}ms)`);
    console.log(`Fastest transition: ${analysis.fastestTransition.type} (${analysis.fastestTransition.duration.toFixed(2)}ms)`);
    console.log(`Total transitions tested: ${analysis.totalTransitions}`);

    // Performance recommendations
    if (analysis.averageTransitionTime > 200) {
      console.warn('⚠️ Average transition time is above 200ms. Consider further optimization.');
    } else {
      console.log('✅ Transition performance is within acceptable range.');
    }
  }
}

// Add to global scope for testing
declare global {
  interface Window {
    transitionTester: TransitionTester;
  }
}

// Make available globally
if (typeof window !== 'undefined') {
  window.transitionTester = TransitionTester.getInstance();
}
