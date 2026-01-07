// ===================================
// iOS Safari PWA Fixes - ADHD Enhancement System
// ===================================

/**
 * iOS Safari PWA Optimization for ADHD Features
 * Addresses common iOS PWA issues and limitations
 */

export class IOSPWAFixes {
  private static isIOS: boolean;
  private static isStandalone: boolean;
  private static isSafari: boolean;

  // Initialize iOS detection
  static initialize(): void {
    this.detectEnvironment();
    this.applyIOSFixes();
    this.setupPWABehaviors();
    this.optimizeForADHD();
  }

  // Detect iOS environment
  private static detectEnvironment(): void {
    this.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    this.isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    this.isSafari = /^((?!chrome|android).)*safari\/[\d.]+$/.test(navigator.userAgent);
  }

  // Apply iOS-specific fixes
  private static applyIOSFixes(): void {
    if (!this.isIOS) return;

    // Fix for iOS viewport height issues
    this.fixViewportHeight();
    
    // Fix for iOS scroll behavior
    this.fixScrollBehavior();
    
    // Fix for iOS input issues
    this.fixInputBehavior();
    
    // Fix for iOS audio context
    this.fixAudioContext();
    
    // Fix for iOS file handling
    this.fixFileHandling();
    
    // Fix for iOS notification permissions
    this.fixNotificationPermissions();
  }

  // Fix viewport height issues on iOS
  private static fixViewportHeight(): void {
    const setViewportHeight = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
      document.documentElement.style.setProperty('--height', `${window.innerHeight}px`);
    };

    setViewportHeight();
    window.addEventListener('resize', setViewportHeight);
    window.addEventListener('orientationchange', setViewportHeight);
  }

  // Fix scroll behavior for smooth ADHD interactions
  private static fixScrollBehavior(): void {
    // Disable elastic scrolling for better ADHD focus
    document.body.style.overflow = 'auto';
    (document.body.style as any).webkitOverflowScrolling = 'touch';
    
    // Add momentum scrolling for natural feel
    (document.body.style as any).webkitOverflowScrolling = 'touch';
    
    // Prevent overscroll bounce for better focus
    document.body.style.overscrollBehavior = 'none';
  }

  // Fix input behavior for touch interactions
  private static fixInputBehavior(): void {
    // Prevent zoom on input focus
    const inputs = document.querySelectorAll('input, textarea, select');
    inputs.forEach(input => {
      input.addEventListener('focus', () => {
        (input as HTMLElement).style.fontSize = '16px'; // Prevent zoom
      });
      
      input.addEventListener('blur', () => {
        (input as HTMLElement).style.fontSize = ''; // Restore
      });
    });

    // Add touch feedback for all interactive elements
    const interactiveElements = document.querySelectorAll('button, a, .clickable, .swipeable');
    interactiveElements.forEach(element => {
      element.addEventListener('touchstart', this.addTouchFeedback as EventListener);
      element.addEventListener('touchend', this.removeTouchFeedback as EventListener);
    });
  }

  // Add touch feedback for ADHD users
  private static addTouchFeedback(event: TouchEvent): void {
    const element = event.target as HTMLElement;
    element.style.transform = 'scale(0.98)';
    element.style.transition = 'transform 0.1s ease';
  }

  // Remove touch feedback
  private static removeTouchFeedback(event: TouchEvent): void {
    const element = event.target as HTMLElement;
    element.style.transform = 'scale(1)';
  }

  // Fix audio context for haptic feedback
  private static fixAudioContext(): void {
    // Create audio context on first user interaction
    const initAudio = () => {
      if (!window.AudioContext && !(window as any).webkitAudioContext) {
        console.warn('Audio context not supported');
        return;
      }

      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContext();
      
      // Resume audio context if suspended
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }

      // Store for haptic feedback
      (window as any).audioContext = audioContext;
    };

    // Initialize on first user interaction
    document.addEventListener('touchstart', initAudio, { once: true });
    document.addEventListener('click', initAudio, { once: true });
  }

  // Fix file handling for iOS
  private static fixFileHandling(): void {
    // iOS doesn't support file input in PWA mode
    const fileInputs = document.querySelectorAll('input[type="file"]');
    fileInputs.forEach(input => {
      input.addEventListener('click', (e) => {
        // Show alternative method for file input
        this.showFileInputAlternative();
        e.preventDefault();
      });
    });
  }

  // Show alternative file input method
  private static showFileInputAlternative(): void {
    const message = document.createElement('div');
    message.className = 'ios-file-alternative';
    message.innerHTML = `
      <div class="ios-file-message">
        <h3>📱 File Upload</h3>
        <p>Due to iOS limitations, please use the share sheet to upload files:</p>
        <ol>
          <li>Tap the Share button</li>
          <li>Select "Files"</li>
          <li>Choose your file</li>
        </ol>
        <button class="close-btn">✓</button>
      </div>
    `;
    
    message.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      padding: 20px;
      border-radius: 12px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.2);
      z-index: 10000;
      max-width: 300px;
      text-align: center;
    `;
    
    document.body.appendChild(message);
    
    message.querySelector('.close-btn')?.addEventListener('click', () => {
      document.body.removeChild(message);
    });
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (document.body.contains(message)) {
        document.body.removeChild(message);
      }
    }, 5000);
  }

  // Fix notification permissions for iOS
  private static fixNotificationPermissions(): void {
    // iOS requires user gesture for notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      const requestNotificationPermission = () => {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            console.log('Notifications enabled for iOS PWA');
          }
        });
      };

      // Request permission on first user interaction
      document.addEventListener('click', requestNotificationPermission, { once: true });
      document.addEventListener('touchstart', requestNotificationPermission, { once: true });
    }
  }

  // Setup PWA-specific behaviors
  private static setupPWABehaviors(): void {
    // Prevent default iOS behaviors
    this.preventDefaultIOSBehaviors();
    
    // Setup safe area handling
    this.setupSafeAreaHandling();
    
    // Setup status bar handling
    this.setupStatusBarHandling();
    
    // Setup home screen prompts
    this.setupHomeScreenPrompt();
  }

  // Prevent default iOS behaviors
  private static preventDefaultIOSBehaviors(): void {
    // Prevent pull-to-refresh
    let isPullToRefresh = false;
    let startY = 0;
    
    document.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        startY = e.touches[0].clientY;
        isPullToRefresh = window.scrollY === 0;
      }
    });

    document.addEventListener('touchmove', (e) => {
      if (isPullToRefresh && e.touches.length === 1) {
        const currentY = e.touches[0].clientY;
        const diff = currentY - startY;
        
        if (diff > 100) {
          // Show pull-to-refresh indicator
          this.showPullToRefreshIndicator();
        }
      }
    });

    document.addEventListener('touchend', () => {
      isPullToRefresh = false;
      this.hidePullToRefreshIndicator();
    });
  }

  // Show pull-to-refresh indicator
  private static showPullToRefreshIndicator(): void {
    let indicator = document.querySelector('.pull-to-refresh-indicator');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.className = 'pull-to-refresh-indicator';
      indicator.innerHTML = '↓ Pull to Refresh';
      (indicator as HTMLElement).style.cssText = `
        position: fixed;
        top: -50px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(16, 185, 129, 0.9);
        color: white;
        padding: 10px 20px;
        border-radius: 20px;
        font-weight: 600;
        z-index: 9999;
        transition: top 0.3s ease;
      `;
      document.body.appendChild(indicator);
    }
    
    (indicator as HTMLElement).style.top = '20px';
  }

  // Hide pull-to-refresh indicator
  private static hidePullToRefreshIndicator(): void {
    const indicator = document.querySelector('.pull-to-refresh-indicator');
    if (indicator) {
      (indicator as HTMLElement).style.top = '-50px';
      setTimeout(() => {
        if (document.body.contains(indicator)) {
          document.body.removeChild(indicator);
        }
      }, 300);
    }
  }

  // Setup safe area handling for iPhone X and newer
  private static setupSafeAreaHandling(): void {
    const setSafeAreaInsets = () => {
      const root = document.documentElement;
      
      // Get safe area insets from CSS env variables
      const safeAreaTop = getComputedStyle(root).getPropertyValue('safe-area-inset-top');
      const safeAreaBottom = getComputedStyle(root).getPropertyValue('safe-area-inset-bottom');
      const safeAreaLeft = getComputedStyle(root).getPropertyValue('safe-area-inset-left');
      const safeAreaRight = getComputedStyle(root).getPropertyValue('safe-area-inset-right');
      
      // Apply safe area insets
      root.style.setProperty('--safe-area-top', safeAreaTop || '0px');
      root.style.setProperty('--safe-area-bottom', safeAreaBottom || '0px');
      root.style.setProperty('--safe-area-left', safeAreaLeft || '0px');
      root.style.setProperty('--safe-area-right', safeAreaRight || '0px');
    };

    setSafeAreaInsets();
    window.addEventListener('resize', setSafeAreaInsets);
    window.addEventListener('orientationchange', setSafeAreaInsets);
  }

  // Setup status bar handling
  private static setupStatusBarHandling(): void {
    // Hide status bar in standalone mode for better focus
    if (this.isStandalone) {
      document.documentElement.style.setProperty('--status-bar-height', '0px');
    }
    
    // Handle status bar appearance
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      (metaThemeColor as HTMLMetaElement).setAttribute('content', '#1a1a1a');
    }
    
    // Add meta tag for status bar style
    const metaStatusBarStyle = document.createElement('meta');
    metaStatusBarStyle.name = 'apple-mobile-web-app-status-bar-style';
    metaStatusBarStyle.setAttribute('content', 'black-translucent');
    document.head.appendChild(metaStatusBarStyle);
  }

  // Setup home screen prompt
  private static setupHomeScreenPrompt(): void {
    // Only show prompt in standalone mode
    if (!this.isStandalone) return;
    
    // Check if already installed
    const isInstalled = (window.navigator as any).standalone;
    if (isInstalled) return;
    
    // Show install prompt after delay
    setTimeout(() => {
      this.showInstallPrompt();
    }, 5000);
  }

  // Show install prompt
  private static showInstallPrompt(): void {
    const prompt = document.createElement('div');
    prompt.className = 'ios-install-prompt';
    prompt.innerHTML = `
      <div class="install-content">
        <div class="install-icon">📱</div>
        <div class="install-text">
          <h3>Add to Home Screen</h3>
          <p>For quick access and offline use</p>
          <div class="install-steps">
            <div class="step">1. Tap Share</div>
            <div class="step">2. Add to Home Screen</div>
          </div>
        </div>
        <button class="close-btn">✓</button>
      </div>
    `;
    
    prompt.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: linear-gradient(135deg, #10b981, #059669);
      color: white;
      padding: 20px;
      border-radius: 16px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.3);
      z-index: 10000;
      max-width: 320px;
      text-align: center;
      animation: slideUp 0.3s ease;
    `;
    
    document.body.appendChild(prompt);
    
    prompt.querySelector('.close-btn')?.addEventListener('click', () => {
      document.body.removeChild(prompt);
    });
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (document.body.contains(prompt)) {
        document.body.removeChild(prompt);
      }
    }, 10000);
  }

  // Optimize for ADHD users on iOS
  private static optimizeForADHD(): void {
    // Reduce motion for better focus
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.documentElement.style.setProperty('--animation-speed-multiplier', '0');
      document.documentElement.style.setProperty('--transition-speed-multiplier', '0');
    }
    
    // Increase touch targets for better accessibility
    const touchTargets = document.querySelectorAll('button, a, .clickable, .swipeable');
    touchTargets.forEach(target => {
      const computed = window.getComputedStyle(target);
      const currentMinSize = parseInt(computed.minWidth) || 0;
      const currentMinHeight = parseInt(computed.minHeight) || 0;
      
      if (currentMinSize < 44) {
        (target as HTMLElement).style.minWidth = '44px';
      }
      if (currentMinHeight < 44) {
        (target as HTMLElement).style.minHeight = '44px';
      }
    });
    
    // Add haptic feedback for all ADHD features
    this.setupHapticFeedback();
    
    // Optimize animations for iOS
    this.optimizeAnimations();
    
    // Setup gesture recognition
    this.setupGestureRecognition();
  }

  // Setup haptic feedback for ADHD features
  private static setupHapticFeedback(): void {
    // Enhanced haptic patterns for ADHD engagement
    const hapticPatterns = {
      taskComplete: [10, 50, 10],
      achievement: [20, 100, 20, 100, 20],
      modeActivate: [20, 100, 20, 100, 20],
      gentleReminder: [5, 30, 5],
      error: [100, 50, 100],
      success: [10, 30, 10]
    };
    
    // Store haptic patterns for ADHD components
    (window as any).hapticPatterns = hapticPatterns;
  }

  // Optimize animations for iOS performance
  private static optimizeAnimations(): void {
    // Use GPU acceleration for smooth animations
    const animatedElements = document.querySelectorAll('.animated, .transitioning, .dopamine-feedback');
    animatedElements.forEach(element => {
      (element as HTMLElement).style.willChange = 'transform';
      (element as HTMLElement).style.transform = 'translateZ(0)';
    });
    
    // Reduce animation complexity for better performance
    document.documentElement.style.setProperty('--animation-speed-multiplier', '0.8');
    document.documentElement.style.setProperty('--transition-speed-multiplier', '0.8');
  }

  // Setup gesture recognition for ADHD interactions
  private static setupGestureRecognition(): void {
    // Enhanced swipe detection for task management
    let touchStartX = 0;
    let touchStartY = 0;
    let touchEndX = 0;
    let touchEndY = 0;
    let isSwiping = false;
    
    document.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        isSwiping = false;
      }
    });

    document.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1) {
        touchEndX = e.touches[0].clientX;
        touchEndY = e.touches[0].clientY;
        
        const deltaX = touchEndX - touchStartX;
        const deltaY = touchEndY - touchStartY;
        const absDeltaX = Math.abs(deltaX);
        const absDeltaY = Math.abs(deltaY);
        
        if (absDeltaX > absDeltaY && absDeltaX > 30) {
          isSwiping = true;
          e.preventDefault();
        }
      }
    });

    document.addEventListener('touchend', (e) => {
      if (isSwiping && e.changedTouches.length === 1) {
        const deltaX = e.changedTouches[0].clientX - touchStartX;
        
        // Trigger swipe event for ADHD components
        const swipeEvent = new CustomEvent('swipe', {
          detail: {
            direction: deltaX > 0 ? 'right' : 'left',
            velocity: deltaX,
            target: e.target
          }
        });
        document.dispatchEvent(swipeEvent);
        
        isSwiping = false;
      }
    });
  }

  // Get iOS-specific information
  static getIOSInfo(): {
    isIOS: boolean;
    isStandalone: boolean;
    isSafari: boolean;
    version: string;
    device: string;
    safeArea: { top: string; bottom: string; left: string; right: string };
  } {
    return {
      isIOS: this.isIOS,
      isStandalone: this.isStandalone,
      isSafari: this.isSafari,
      version: this.getIOSVersion(),
      device: this.getDeviceType(),
      safeArea: this.getSafeAreaInsets()
    };
  }

  // Get iOS version
  private static getIOSVersion(): string {
    const match = navigator.userAgent.match(/OS (\d+_\d+)/);
    return match ? match[1].replace(/_/g, '.') : 'Unknown';
  }

  // Get device type
  private static getDeviceType(): string {
    if (/iPad/.test(navigator.userAgent)) return 'iPad';
    if (/iPhone/.test(navigator.userAgent)) return 'iPhone';
    if (/iPod/.test(navigator.userAgent)) return 'iPod';
    return 'Unknown';
  }

  // Get safe area insets
  private static getSafeAreaInsets(): { top: string; bottom: string; left: string; right: string } {
    const root = document.documentElement;
    const computed = getComputedStyle(root);
    
    return {
      top: computed.getPropertyValue('--safe-area-top') || '0px',
      bottom: computed.getPropertyValue('--safe-area-bottom') || '0px',
      left: computed.getPropertyValue('--safe-area-left') || '0px',
      right: computed.getPropertyValue('--safe-area-right') || '0px'
    };
  }

  // Check if PWA features are available
  static checkPWASupport(): {
    serviceWorker: boolean;
    webAppManifest: boolean;
    standalone: boolean;
    notifications: boolean;
    hapticFeedback: boolean;
    audioContext: boolean;
    fileInput: boolean;
    geolocation: boolean;
    camera: boolean;
    shareAPI: boolean;
  } {
    return {
      serviceWorker: 'serviceWorker' in navigator,
      webAppManifest: document.querySelector('link[rel="manifest"]') !== null,
      standalone: this.isStandalone,
      notifications: 'Notification' in window,
      hapticFeedback: 'vibrate' in navigator,
      audioContext: 'AudioContext' in window || 'webkitAudioContext' in window,
      fileInput: 'FileReader' in window && 'File' in window,
      geolocation: 'geolocation' in navigator,
      camera: 'mediaDevices' in navigator,
      shareAPI: 'share' in navigator
    };
  }

  // Enable/disable features based on iOS capabilities
  static enableADHDFeatures(): void {
    const support = this.checkPWASupport();
    
    // Enable haptic feedback if supported
    if (support.hapticFeedback) {
      document.body.classList.add('haptic-enabled');
    }
    
    // Enable audio feedback if supported
    if (support.audioContext) {
      document.body.classList.add('audio-enabled');
    }
    
    // Enable notifications if supported
    if (support.notifications && Notification.permission === 'granted') {
      document.body.classList.add('notifications-enabled');
    }
    
    // Enable file handling if supported
    if (support.fileInput) {
      document.body.classList.add('file-handling-enabled');
    }
    
    // Enable geolocation if supported
    if (support.geolocation) {
      document.body.classList.add('geolocation-enabled');
    }
    
    // Enable share API if supported
    if (support.shareAPI) {
      document.body.classList.add('share-enabled');
    }
  }

  // Add iOS-specific CSS classes
  static addIOSClasses(): void {
    const body = document.body;
    
    if (this.isIOS) {
      body.classList.add('ios');
    }
    
    if (this.isStandalone) {
      body.classList.add('standalone');
    }
    
    if (this.isSafari) {
      body.classList.add('safari');
    }
    
    // Add device-specific classes
    const deviceType = this.getDeviceType();
    body.classList.add(deviceType.toLowerCase());
    
    // Add version-specific classes
    const version = this.getIOSVersion();
    body.classList.add(`ios-${version.replace(/\./g, '-')}`);
  }

  // Monitor iOS PWA performance
  static monitorPerformance(): void {
    if (!this.isIOS) return;
    
    // Monitor memory usage
    if ('memory' in performance) {
      setInterval(() => {
        const memory = (performance as any).memory;
        console.log('Memory usage:', {
          used: memory.usedJSHeapSize,
          total: memory.totalJSHeapSize,
          limit: memory.jsHeapSizeLimit
        });
      }, 30000);
    }
    
    // Monitor connection speed
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      connection.addEventListener('change', () => {
        console.log('Connection changed:', {
          effectiveType: connection.effectiveType,
          downlink: connection.downlink,
          rtt: connection.rtt,
          saveData: connection.saveData
        });
      });
    }
    
    // Monitor battery level if available
    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        console.log('Battery status:', {
          level: battery.level,
          charging: battery.charging,
          chargingTime: battery.chargingTime,
          dischargingTime: battery.dischargingTime
        });
      });
    }
  }
}

// Auto-initialize on load
if (typeof window !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    IOSPWAFixes.initialize();
  });
}
