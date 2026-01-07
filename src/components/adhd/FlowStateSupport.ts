// ===================================
// Flow State Support - ADHD Micro-Interactions & Sensory Optimization
// ===================================

export interface HapticPattern {
  id: string;
  name: string;
  pattern: number[];
  description: string;
  trigger: string;
}

export interface GestureConfig {
  type: "swipe" | "drag" | "pinch" | "tap" | "long-press";
  direction?: "left" | "right" | "up" | "down";
  action: string;
  haptic?: HapticPattern;
}

export interface FocusMode {
  id: string;
  name: string;
  description: string;
  icon: string;
  settings: {
    hideUI: boolean;
    blockNotifications: boolean;
    showTimer: boolean;
    showProgress: boolean;
    backgroundColor: string;
    textColor: string;
    fontSize: "small" | "medium" | "large";
  };
}

export interface VoiceCommand {
  phrase: string;
  action: () => void;
  confidence: number;
  category: "task" | "time" | "mode" | "navigation";
}

export class FlowStateSupport {
  private static readonly HAPTIC_PATTERNS: HapticPattern[] = [
    {
      id: "task-complete",
      name: "Task Complete",
      pattern: [10, 50, 10],
      description: "Short pulse for task completion",
      trigger: "on-task-complete"
    },
    {
      id: "mode-activate",
      name: "Mode Activate",
      pattern: [20, 100, 20, 100, 20],
      description: "Double pulse for mode activation",
      trigger: "on-mode-activate"
    },
    {
      id: "reminder",
      name: "Gentle Reminder",
      pattern: [5, 30, 5],
      description: "Soft pulse for reminders",
      trigger: "on-reminder"
    },
    {
      id: "achievement",
      name: "Achievement",
      pattern: [10, 30, 10, 30, 10, 30, 10, 100],
      description: "Celebration pattern for achievements",
      trigger: "on-achievement"
    },
    {
      id: "error",
      name: "Error",
      pattern: [100, 50, 100],
      description: "Sharp pulse for errors",
      trigger: "on-error"
    }
  ];

  private static readonly FOCUS_MODES: FocusMode[] = [
    {
      id: "deep-focus",
      name: "Deep Focus",
      description: "Minimal distractions, maximum concentration",
      icon: "🎯",
      settings: {
        hideUI: true,
        blockNotifications: true,
        showTimer: true,
        showProgress: false,
        backgroundColor: "#1a1a1a",
        textColor: "#ffffff",
        fontSize: "large"
      }
    },
    {
      id: "calm-focus",
      name: "Calm Focus",
      description: "Gentle focus with reduced pressure",
      icon: "🌿",
      settings: {
        hideUI: false,
        blockNotifications: true,
        showTimer: true,
        showProgress: true,
        backgroundColor: "#f8fafb",
        textColor: "#334155",
        fontSize: "medium"
      }
    },
    {
      id: "creative-flow",
      name: "Creative Flow",
      description: "Open space for creative exploration",
      icon: "🎨",
      settings: {
        hideUI: false,
        blockNotifications: false,
        showTimer: false,
        showProgress: true,
        backgroundColor: "#fef3c7",
        textColor: "#78350f",
        fontSize: "medium"
      }
    }
  ];

  private static readonly VOICE_COMMANDS: VoiceCommand[] = [
    {
      phrase: "start timer",
      action: () => this.startTimer(),
      confidence: 0.9,
      category: "task"
    },
    {
      phrase: "pause timer",
      action: () => this.pauseTimer(),
      confidence: 0.9,
      category: "task"
    },
    {
      phrase: "add task",
      action: () => this.openQuickAdd(),
      confidence: 0.8,
      category: "task"
    },
    {
      phrase: "focus mode",
      action: () => this.activateFocusMode("deep-focus"),
      confidence: 0.85,
      category: "mode"
    },
    {
      phrase: "calm down",
      action: () => this.activateFocusMode("calm-focus"),
      confidence: 0.8,
      category: "mode"
    },
    {
      phrase: "show garden",
      action: () => this.navigateTo("garden"),
      confidence: 0.9,
      category: "navigation"
    },
    {
      phrase: "show today",
      action: () => this.navigateTo("day"),
      confidence: 0.9,
      category: "navigation"
    }
  ];

  private static activeFocusMode: FocusMode | null = null;
  private static voiceRecognitionActive: boolean = false;

  // Haptic Feedback Methods
  static triggerHaptic(patternId: string): void {
    if (!this.isHapticSupported()) return;

    const pattern = this.HAPTIC_PATTERNS.find(p => p.id === patternId);
    if (!pattern) return;

    if ('vibrate' in navigator) {
      navigator.vibrate(pattern.pattern);
    }

    // Emit event for UI feedback
    this.emitEvent('haptic-triggered', { pattern });
  }

  static triggerHapticCustom(pattern: number[]): void {
    if (!this.isHapticSupported()) return;

    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }

    this.emitEvent('haptic-custom', { pattern });
  }

  private static isHapticSupported(): boolean {
    return 'vibrate' in navigator && typeof navigator.vibrate === 'function';
  }

  // Gesture Recognition
  static initializeGestures(): GestureConfig[] {
    const gestures: GestureConfig[] = [
      {
        type: "swipe",
        direction: "left",
        action: "complete-task",
        haptic: this.HAPTIC_PATTERNS.find(p => p.id === "task-complete")
      },
      {
        type: "swipe",
        direction: "right",
        action: "postpone-task",
        haptic: this.HAPTIC_PATTERNS.find(p => p.id === "reminder")
      },
      {
        type: "swipe",
        direction: "up",
        action: "increase-priority",
        haptic: this.HAPTIC_PATTERNS.find(p => p.id === "mode-activate")
      },
      {
        type: "swipe",
        direction: "down",
        action: "decrease-priority",
        haptic: this.HAPTIC_PATTERNS.find(p => p.id === "reminder")
      },
      {
        type: "drag",
        action: "reorder-task",
        haptic: this.HAPTIC_PATTERNS.find(p => p.id === "reminder")
      },
      {
        type: "long-press",
        action: "open-task-details",
        haptic: this.HAPTIC_PATTERNS.find(p => p.id === "mode-activate")
      },
      {
        type: "tap",
        action: "select-task",
        haptic: this.HAPTIC_PATTERNS.find(p => p.id === "reminder")
      },
      {
        type: "pinch",
        action: "zoom-timeline",
        haptic: this.HAPTIC_PATTERNS.find(p => p.id === "reminder")
      }
    ];

    return gestures;
  }

  static handleGesture(gesture: GestureConfig): void {
    // Trigger haptic feedback
    if (gesture.haptic) {
      this.triggerHaptic(gesture.haptic.id);
    }

    // Handle the action
    this.emitEvent('gesture-activated', {
      type: gesture.type,
      direction: gesture.direction,
      action: gesture.action
    });

    // Execute specific action
    switch (gesture.action) {
      case "complete-task":
        this.completeCurrentTask();
        break;
      case "postpone-task":
        this.postponeCurrentTask();
        break;
      case "increase-priority":
        this.increaseTaskPriority();
        break;
      case "decrease-priority":
        this.decreaseTaskPriority();
        break;
      case "reorder-task":
        this.enableTaskReordering();
        break;
      case "open-task-details":
        this.openTaskDetails();
        break;
      case "select-task":
        this.selectTask();
        break;
      case "zoom-timeline":
        this.zoomTimeline();
        break;
    }
  }

  // Focus Mode Management
  static getFocusModes(): FocusMode[] {
    return this.FOCUS_MODES;
  }

  static activateFocusMode(modeId: string): boolean {
    const mode = this.FOCUS_MODES.find(m => m.id === modeId);
    if (!mode) return false;

    this.activeFocusMode = mode;
    this.applyFocusModeSettings(mode);
    this.triggerHaptic("mode-activate");

    this.emitEvent('focus-mode-activated', { mode });
    return true;
  }

  static deactivateFocusMode(): void {
    if (!this.activeFocusMode) return;

    const previousMode = this.activeFocusMode;
    this.activeFocusMode = null;
    this.restoreDefaultSettings();

    this.emitEvent('focus-mode-deactivated', { previousMode });
  }

  static getActiveFocusMode(): FocusMode | null {
    return this.activeFocusMode;
  }

  private static applyFocusModeSettings(mode: FocusMode): void {
    const root = document.documentElement;
    const body = document.body;

    // Apply visual settings
    if (mode.settings.hideUI) {
      body.classList.add('focus-mode-hidden-ui');
    }

    if (mode.settings.blockNotifications) {
      body.classList.add('focus-mode-block-notifications');
    }

    // Apply color scheme
    root.style.setProperty('--focus-bg-color', mode.settings.backgroundColor);
    root.style.setProperty('--focus-text-color', mode.settings.textColor);
    root.style.setProperty('--focus-font-size', this.getFontSizeValue(mode.settings.fontSize));

    // Add mode-specific class
    body.className = body.className.replace(/focus-mode-\w+/g, '');
    body.classList.add(`focus-mode-${mode.id}`);
  }

  private static restoreDefaultSettings(): void {
    const body = document.body;
    const root = document.documentElement;

    // Remove focus mode classes
    body.classList.remove('focus-mode-hidden-ui', 'focus-mode-block-notifications');
    body.className = body.className.replace(/focus-mode-\w+/g, '');

    // Restore default styles
    root.style.removeProperty('--focus-bg-color');
    root.style.removeProperty('--focus-text-color');
    root.style.removeProperty('--focus-font-size');
  }

  private static getFontSizeValue(size: "small" | "medium" | "large"): string {
    switch (size) {
      case "small": return "14px";
      case "medium": return "16px";
      case "large": return "20px";
      default: return "16px";
    }
  }

  // Voice Commands
  static startVoiceRecognition(): boolean {
    if (!this.isVoiceRecognitionSupported()) return false;

    this.voiceRecognitionActive = true;
    this.emitEvent('voice-recognition-started');

    // Initialize Web Speech API if available
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      this.initializeSpeechRecognition();
      return true;
    }

    return false;
  }

  static stopVoiceRecognition(): void {
    this.voiceRecognitionActive = false;
    this.emitEvent('voice-recognition-stopped');
  }

  private static isVoiceRecognitionSupported(): boolean {
    return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
  }

  private static initializeSpeechRecognition(): void {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      const last = event.results.length - 1;
      const transcript = event.results[last][0].transcript.toLowerCase().trim();
      
      this.processVoiceCommand(transcript);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      this.emitEvent('voice-recognition-error', { error: event.error });
    };

    recognition.start();
  }

  private static processVoiceCommand(transcript: string): void {
    // Find matching command
    const command = this.VOICE_COMMANDS.find(cmd => 
      transcript.includes(cmd.phrase) && cmd.confidence > 0.7
    );

    if (command) {
      this.triggerHaptic("mode-activate");
      command.action();
      this.emitEvent('voice-command-recognized', { 
        command: command.phrase, 
        category: command.category 
      });
    }
  }

  // Action implementations
  private static completeCurrentTask(): void {
    this.emitEvent('complete-current-task');
  }

  private static postponeCurrentTask(): void {
    this.emitEvent('postpone-current-task');
  }

  private static increaseTaskPriority(): void {
    this.emitEvent('increase-task-priority');
  }

  private static decreaseTaskPriority(): void {
    this.emitEvent('decrease-task-priority');
  }

  private static enableTaskReordering(): void {
    this.emitEvent('enable-task-reordering');
  }

  private static openTaskDetails(): void {
    this.emitEvent('open-task-details');
  }

  private static selectTask(): void {
    this.emitEvent('select-task');
  }

  private static zoomTimeline(): void {
    this.emitEvent('zoom-timeline');
  }

  private static startTimer(): void {
    this.emitEvent('start-timer');
  }

  private static pauseTimer(): void {
    this.emitEvent('pause-timer');
  }

  private static openQuickAdd(): void {
    this.emitEvent('open-quick-add');
  }

  private static navigateTo(view: string): void {
    this.emitEvent('navigate-to', { view });
  }

  // Utility methods
  static getMicroInteractionSettings(): {
    hapticEnabled: boolean;
    gestureEnabled: boolean;
    voiceEnabled: boolean;
    animationSpeed: "slow" | "normal" | "fast";
    reducedMotion: boolean;
  } {
    return {
      hapticEnabled: this.isHapticSupported(),
      gestureEnabled: true,
      voiceEnabled: this.isVoiceRecognitionSupported(),
      animationSpeed: "normal",
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches
    };
  }

  static setAnimationSpeed(speed: "slow" | "normal" | "fast"): void {
    const root = document.documentElement;
    const speedMultiplier = speed === "slow" ? "2" : speed === "fast" ? "0.5" : "1";
    
    root.style.setProperty('--animation-speed-multiplier', speedMultiplier);
    root.style.setProperty('--transition-speed-multiplier', speedMultiplier);
    
    this.emitEvent('animation-speed-changed', { speed });
  }

  static enableReducedMotion(): void {
    const root = document.documentElement;
    root.style.setProperty('--animation-speed-multiplier', '0');
    root.style.setProperty('--transition-speed-multiplier', '0');
    
    document.body.classList.add('reduced-motion');
    this.emitEvent('reduced-motion-enabled');
  }

  static disableReducedMotion(): void {
    const root = document.documentElement;
    root.style.removeProperty('--animation-speed-multiplier');
    root.style.removeProperty('--transition-speed-multiplier');
    
    document.body.classList.remove('reduced-motion');
    this.emitEvent('reduced-motion-disabled');
  }

  // Event emission helper
  private static emitEvent(eventName: string, data?: any): void {
    if (typeof window !== 'undefined' && window.eventBus) {
      window.eventBus.emit(eventName, data);
    }
    
    // Also emit custom DOM event for broader compatibility
    const event = new CustomEvent(`flowstate:${eventName}`, { detail: data });
    document.dispatchEvent(event);
  }

  // Sensory optimization
  static getSensoryProfile(): {
    hapticSensitivity: "low" | "medium" | "high";
    visualIntensity: "low" | "medium" | "high";
    audioVolume: "low" | "medium" | "high";
    colorContrast: "low" | "medium" | "high";
  } {
    // Default profile - could be stored in user preferences
    return {
      hapticSensitivity: "medium",
      visualIntensity: "medium",
      audioVolume: "medium",
      colorContrast: "medium"
    };
  }

  static adjustSensoryProfile(profile: Partial<{
    hapticSensitivity: "low" | "medium" | "high";
    visualIntensity: "low" | "medium" | "high";
    audioVolume: "low" | "medium" | "high";
    colorContrast: "low" | "medium" | "high";
  }>): void {
    const currentProfile = this.getSensoryProfile();
    const newProfile = { ...currentProfile, ...profile };
    
    // Apply haptic sensitivity adjustments
    if (profile.hapticSensitivity) {
      this.adjustHapticSensitivity(profile.hapticSensitivity);
    }
    
    // Apply visual intensity adjustments
    if (profile.visualIntensity) {
      this.adjustVisualIntensity(profile.visualIntensity);
    }
    
    // Apply color contrast adjustments
    if (profile.colorContrast) {
      this.adjustColorContrast(profile.colorContrast);
    }
    
    this.emitEvent('sensory-profile-updated', newProfile);
  }

  private static adjustHapticSensitivity(sensitivity: "low" | "medium" | "high"): void {
    const multiplier = sensitivity === "low" ? 0.5 : sensitivity === "high" ? 1.5 : 1;
    
    // Store multiplier for haptic pattern adjustment
    document.documentElement.style.setProperty('--haptic-sensitivity-multiplier', multiplier.toString());
  }

  private static adjustVisualIntensity(intensity: "low" | "medium" | "high"): void {
    const root = document.documentElement;
    
    switch (intensity) {
      case "low":
        root.style.setProperty('--border-width', '1px');
        root.style.setProperty('--shadow-opacity', '0.1');
        root.style.setProperty('--animation-intensity', '0.5');
        break;
      case "medium":
        root.style.setProperty('--border-width', '2px');
        root.style.setProperty('--shadow-opacity', '0.2');
        root.style.setProperty('--animation-intensity', '1');
        break;
      case "high":
        root.style.setProperty('--border-width', '3px');
        root.style.setProperty('--shadow-opacity', '0.3');
        root.style.setProperty('--animation-intensity', '1.5');
        break;
    }
  }

  private static adjustColorContrast(contrast: "low" | "medium" | "high"): void {
    const root = document.documentElement;
    
    switch (contrast) {
      case "low":
        root.style.setProperty('--text-contrast-ratio', '3');
        root.style.setProperty('--border-contrast', '0.3');
        break;
      case "medium":
        root.style.setProperty('--text-contrast-ratio', '4.5');
        root.style.setProperty('--border-contrast', '0.5');
        break;
      case "high":
        root.style.setProperty('--text-contrast-ratio', '7');
        root.style.setProperty('--border-contrast', '0.8');
        break;
    }
  }
}
