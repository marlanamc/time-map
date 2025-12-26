/**
 * Performance Monitor - Monitors and adjusts garden effects based on performance
 */

export class PerformanceMonitor {
  private fps: number = 60;
  private frameCount: number = 0;
  private lastTime: number = performance.now();
  private fpsHistory: number[] = [];
  private checkInterval?: number;
  private onQualityChange?: (quality: 'low' | 'medium' | 'high') => void;

  /**
   * Start monitoring performance
   */
  public start(onQualityChange?: (quality: 'low' | 'medium' | 'high') => void): void {
    this.onQualityChange = onQualityChange;

    // Check FPS every 2 seconds
    this.checkInterval = window.setInterval(() => {
      this.checkFPS();
      this.autoAdjustQuality();
    }, 2000);

    // Start frame counting
    this.measureFPS();
  }

  /**
   * Stop monitoring
   */
  public stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }

  /**
   * Measure FPS
   */
  private measureFPS = (): void => {
    const now = performance.now();
    const delta = now - this.lastTime;

    this.frameCount++;

    if (delta >= 1000) {
      // Calculate FPS
      this.fps = Math.round((this.frameCount * 1000) / delta);
      this.fpsHistory.push(this.fps);

      // Keep only last 10 measurements
      if (this.fpsHistory.length > 10) {
        this.fpsHistory.shift();
      }

      // Reset
      this.frameCount = 0;
      this.lastTime = now;
    }

    requestAnimationFrame(this.measureFPS);
  };

  /**
   * Check current FPS
   */
  private checkFPS(): void {
    // Average FPS over last measurements
    const avgFPS = this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length;

    console.log(`🌱 Garden FPS: ${avgFPS.toFixed(1)}`);
  }

  /**
   * Auto-adjust quality based on performance
   */
  private autoAdjustQuality(): void {
    if (!this.onQualityChange) return;
    if (this.fpsHistory.length < 3) return; // Need some data first

    const avgFPS = this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length;

    // Determine quality level
    let quality: 'low' | 'medium' | 'high';

    if (avgFPS < 25) {
      quality = 'low';
      console.warn('🌱 Low FPS detected, reducing garden quality to low');
    } else if (avgFPS < 45) {
      quality = 'medium';
      console.log('🌱 Medium FPS, setting garden quality to medium');
    } else {
      quality = 'high';
    }

    this.onQualityChange(quality);
  }

  /**
   * Get current FPS
   */
  public getFPS(): number {
    return this.fps;
  }

  /**
   * Get average FPS
   */
  public getAverageFPS(): number {
    if (this.fpsHistory.length === 0) return 60;
    return this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length;
  }
}

/**
 * Device capabilities detector
 */
export class DeviceCapabilities {
  /**
   * Detect if device is mobile
   */
  public static isMobile(): boolean {
    return window.innerWidth <= 600 || /Mobi|Android/i.test(navigator.userAgent);
  }

  /**
   * Detect if device is tablet
   */
  public static isTablet(): boolean {
    return window.innerWidth > 600 && window.innerWidth <= 900;
  }

  /**
   * Estimate device performance tier
   */
  public static getPerformanceTier(): 'low' | 'medium' | 'high' {
    const isMobile = this.isMobile();
    const cores = navigator.hardwareConcurrency || 2;
    const memory = (navigator as any).deviceMemory || 4; // GB

    // Low-end devices
    if (isMobile && (cores <= 4 || memory <= 2)) {
      return 'low';
    }

    // Mid-range devices
    if (isMobile || cores <= 6 || memory <= 4) {
      return 'medium';
    }

    // High-end devices
    return 'high';
  }

  /**
   * Check if device supports advanced features
   */
  public static supportsAdvancedFeatures(): boolean {
    return !this.isMobile() && this.getPerformanceTier() !== 'low';
  }

  /**
   * Get recommended quality settings
   */
  public static getRecommendedQuality(): {
    maxParticles: number;
    maxButterflies: number;
    enableParallax: boolean;
    enableShadows: boolean;
  } {
    const tier = this.getPerformanceTier();

    const settings = {
      low: {
        maxParticles: 10,
        maxButterflies: 2,
        enableParallax: false,
        enableShadows: false
      },
      medium: {
        maxParticles: 30,
        maxButterflies: 3,
        enableParallax: !this.isMobile(),
        enableShadows: true
      },
      high: {
        maxParticles: 50,
        maxButterflies: 5,
        enableParallax: true,
        enableShadows: true
      }
    };

    return settings[tier];
  }
}
