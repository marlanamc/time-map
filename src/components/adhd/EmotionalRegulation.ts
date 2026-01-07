// ===================================
// Emotional Regulation - ADHD Anxiety Reduction & Self-Compassion
// ===================================

export interface CalmMode {
  id: string;
  name: string;
  description: string;
  icon: string;
  settings: {
    simplifiedUI: boolean;
    reducedNotifications: boolean;
    conservativeTimeEstimates: boolean;
    builtInBufferTime: number;
    gentleLanguage: boolean;
    backgroundColor: string;
    textColor: string;
  };
}

export interface AnxietyReductionTechnique {
  id: string;
  name: string;
  description: string;
  duration: number; // minutes
  instructions: string[];
  visualElements: string[];
  audioCues?: boolean;
}

export interface SelfCompassionMessage {
  id: string;
  category: "mistake" | "overwhelm" | "procrastination" | "perfectionism" | "burnout";
  gentle: string;
  encouraging: string;
  actionable: string;
}

export interface OverwhelmPrevention {
  trigger: string;
  threshold: number; // max items before activation
  action: "collapse" | "simplify" | "prioritize" | "break";
  settings: {
    maxVisibleItems: number;
    showLoadMore: boolean;
    groupByCategory: boolean;
  };
}

export class EmotionalRegulation {
  private static readonly CALM_MODES: CalmMode[] = [
    {
      id: "gentle-care",
      name: "Gentle Care",
      description: "Soft, nurturing environment with minimal pressure",
      icon: "🌿",
      settings: {
        simplifiedUI: true,
        reducedNotifications: true,
        conservativeTimeEstimates: true,
        builtInBufferTime: 25, // 25% buffer
        gentleLanguage: true,
        backgroundColor: "#f8fafb",
        textColor: "#64748b"
      }
    },
    {
      id: "calm-focus",
      name: "Calm Focus",
      description: "Reduced pressure with clear, gentle guidance",
      icon: "☕",
      settings: {
        simplifiedUI: false,
        reducedNotifications: true,
        conservativeTimeEstimates: true,
        builtInBufferTime: 20,
        gentleLanguage: true,
        backgroundColor: "#fef3c7",
        textColor: "#92400e"
      }
    },
    {
      id: "emergency-calm",
      name: "Emergency Calm",
      description: "Maximum reduction for overwhelming moments",
      icon: "🧘",
      settings: {
        simplifiedUI: true,
        reducedNotifications: true,
        conservativeTimeEstimates: true,
        builtInBufferTime: 50,
        gentleLanguage: true,
        backgroundColor: "#f0fdf4",
        textColor: "#166534"
      }
    }
  ];

  private static readonly ANXIETY_TECHNIQUES: AnxietyReductionTechnique[] = [
    {
      id: "box-breathing",
      name: "Box Breathing",
      description: "4-4-4-4 breathing pattern for immediate calm",
      duration: 3,
      instructions: [
        "Breathe in slowly for 4 counts",
        "Hold your breath for 4 counts",
        "Breathe out slowly for 4 counts",
        "Wait for 4 counts before repeating"
      ],
      visualElements: ["breathing-circle", "countdown-timer", "progress-ring"],
      audioCues: true
    },
    {
      id: "grounding-54321",
      name: "5-4-3-2-1 Grounding",
      description: "Engage all senses to reduce anxiety",
      duration: 5,
      instructions: [
        "Notice 5 things you can see",
        "Notice 4 things you can touch",
        "Notice 3 things you can hear",
        "Notice 2 things you can smell",
        "Notice 1 thing you can taste"
      ],
      visualElements: ["sensory-icons", "progress-tracker", "checklist"],
      audioCues: false
    },
    {
      id: "progressive-muscle",
      name: "Progressive Muscle Relaxation",
      description: "Tense and release muscle groups systematically",
      duration: 10,
      instructions: [
        "Start with your toes and feet",
        "Tense for 5 seconds, then release",
        "Work your way up through your body",
        "End with your face and scalp"
      ],
      visualElements: ["body-outline", "progress-bar", "muscle-groups"],
      audioCues: true
    },
    {
      id: "mindful-observation",
      name: "Mindful Observation",
      description: "Observe thoughts without judgment",
      duration: 5,
      instructions: [
        "Notice your thoughts as clouds passing by",
        "Don't judge or try to change them",
        "Acknowledge each thought gently",
        "Return focus to your breath when needed"
      ],
      visualElements: ["cloud-animation", "thought-bubbles", "breathing-indicator"],
      audioCues: false
    }
  ];

  private static readonly COMPASSION_MESSAGES: SelfCompassionMessage[] = [
    {
      id: "mistake-gentle",
      category: "mistake",
      gentle: "It's okay to make mistakes. Everyone does.",
      encouraging: "Mistakes are how we learn and grow.",
      actionable: "What's one small thing you can do to move forward?"
    },
    {
      id: "overwhelm-gentle",
      category: "overwhelm",
      gentle: "It's okay to feel overwhelmed. Your plate is full.",
      encouraging: "You've handled difficult things before.",
      actionable: "What's one thing you can set aside for now?"
    },
    {
      id: "procrastination-gentle",
      category: "procrastination",
      gentle: "Starting is often the hardest part.",
      encouraging: "You don't have to feel motivated to begin.",
      actionable: "Can you work on this for just 2 minutes?"
    },
    {
      id: "perfectionism-gentle",
      category: "perfectionism",
      gentle: "Done is better than perfect.",
      encouraging: "Progress, not perfection, is the goal.",
      actionable: "What's 'good enough' for this task?"
    },
    {
      id: "burnout-gentle",
      category: "burnout",
      gentle: "Your energy is precious. It's okay to rest.",
      encouraging: "Rest is productive and necessary.",
      actionable: "What's one way you can be gentle with yourself today?"
    }
  ];

  private static readonly OVERWHELM_PREVENTION: OverwhelmPrevention[] = [
    {
      trigger: "too-many-tasks",
      threshold: 7,
      action: "collapse",
      settings: {
        maxVisibleItems: 5,
        showLoadMore: true,
        groupByCategory: true
      }
    },
    {
      trigger: "too-many-decisions",
      threshold: 5,
      action: "simplify",
      settings: {
        maxVisibleItems: 3,
        showLoadMore: false,
        groupByCategory: false
      }
    },
    {
      trigger: "complex-task",
      threshold: 1,
      action: "break",
      settings: {
        maxVisibleItems: 3,
        showLoadMore: true,
        groupByCategory: false
      }
    }
  ];

  private static activeCalmMode: CalmMode | null = null;
  private static currentTechnique: AnxietyReductionTechnique | null = null;
  private static techniqueTimer: number | null = null;

  // Calm Mode Management
  static getCalmModes(): CalmMode[] {
    return this.CALM_MODES;
  }

  static activateCalmMode(modeId: string): boolean {
    const mode = this.CALM_MODES.find(m => m.id === modeId);
    if (!mode) return false;

    this.activeCalmMode = mode;
    this.applyCalmModeSettings(mode);
    this.showCompassionMessage("overwhelm");

    this.emitEvent('calm-mode-activated', { mode });
    return true;
  }

  static deactivateCalmMode(): void {
    if (!this.activeCalmMode) return;

    const previousMode = this.activeCalmMode;
    this.activeCalmMode = null;
    this.restoreDefaultSettings();

    this.emitEvent('calm-mode-deactivated', { previousMode });
  }

  static getActiveCalmMode(): CalmMode | null {
    return this.activeCalmMode;
  }

  private static applyCalmModeSettings(mode: CalmMode): void {
    const root = document.documentElement;
    const body = document.body;

    // Apply visual settings
    root.style.setProperty('--calm-bg-color', mode.settings.backgroundColor);
    root.style.setProperty('--calm-text-color', mode.settings.textColor);
    root.style.setProperty('--calm-buffer-time', mode.settings.builtInBufferTime.toString());

    // Apply UI simplification
    if (mode.settings.simplifiedUI) {
      body.classList.add('calm-mode-simple');
    }

    // Apply notification reduction
    if (mode.settings.reducedNotifications) {
      body.classList.add('calm-mode-quiet');
    }

    // Add mode-specific class
    body.className = body.className.replace(/calm-mode-\w+/g, '');
    body.classList.add(`calm-mode-${mode.id}`);

    // Apply gentle language
    if (mode.settings.gentleLanguage) {
      this.enableGentleLanguage();
    }
  }

  private static restoreDefaultSettings(): void {
    const body = document.body;
    const root = document.documentElement;

    // Remove calm mode classes
    body.classList.remove('calm-mode-simple', 'calm-mode-quiet');
    body.className = body.className.replace(/calm-mode-\w+/g, '');

    // Restore default styles
    root.style.removeProperty('--calm-bg-color');
    root.style.removeProperty('--calm-text-color');
    root.style.removeProperty('--calm-buffer-time');

    this.disableGentleLanguage();
  }

  private static enableGentleLanguage(): void {
    document.body.classList.add('gentle-language');
    this.emitEvent('gentle-language-enabled');
  }

  private static disableGentleLanguage(): void {
    document.body.classList.remove('gentle-language');
    this.emitEvent('gentle-language-disabled');
  }

  // Anxiety Reduction Techniques
  static getAnxietyTechniques(): AnxietyReductionTechnique[] {
    return this.ANXIETY_TECHNIQUES;
  }

  static startAnxietyTechnique(techniqueId: string): boolean {
    const technique = this.ANXIETY_TECHNIQUES.find(t => t.id === techniqueId);
    if (!technique) return false;

    this.currentTechnique = technique;
    this.emitEvent('anxiety-technique-started', { technique });

    // Start timer
    this.techniqueTimer = window.setTimeout(() => {
      this.completeAnxietyTechnique();
    }, technique.duration * 60 * 1000);

    return true;
  }

  static stopAnxietyTechnique(): void {
    if (this.techniqueTimer) {
      clearTimeout(this.techniqueTimer);
      this.techniqueTimer = null;
    }

    const technique = this.currentTechnique;
    this.currentTechnique = null;

    this.emitEvent('anxiety-technique-stopped', { technique });
  }

  static completeAnxietyTechnique(): void {
    const technique = this.currentTechnique;
    this.currentTechnique = null;
    this.techniqueTimer = null;

    this.emitEvent('anxiety-technique-completed', { technique });
    this.showCompassionMessage("overwhelm");
  }

  static getCurrentTechnique(): AnxietyReductionTechnique | null {
    return this.currentTechnique;
  }

  // Self-Compassion Messages
  static getCompassionMessage(category: string): SelfCompassionMessage | null {
    return this.COMPASSION_MESSAGES.find(m => m.category === category) || null;
  }

  static showCompassionMessage(category: string): void {
    const message = this.getCompassionMessage(category);
    if (!message) return;

    this.emitEvent('compassion-message', { message });
    this.displayCompassionUI(message);
  }

  private static displayCompassionUI(message: SelfCompassionMessage): void {
    // Create a gentle, non-intrusive UI element
    const existing = document.querySelector('.compassion-popup');
    if (existing) {
      existing.remove();
    }

    const popup = document.createElement('div');
    popup.className = 'compassion-popup';
    popup.innerHTML = `
      <div class="compassion-content">
        <div class="compassion-icon">💚</div>
        <div class="compassion-gentle">${message.gentle}</div>
        <div class="compassion-encouraging">${message.encouraging}</div>
        <div class="compassion-actionable">
          <button class="compassion-action-btn">${message.actionable}</button>
        </div>
        <button class="compassion-close" aria-label="Close">×</button>
      </div>
    `;

    document.body.appendChild(popup);

    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (popup.parentNode) {
        popup.remove();
      }
    }, 10000);

    // Add event listeners
    popup.querySelector('.compassion-close')?.addEventListener('click', () => {
      popup.remove();
    });

    popup.querySelector('.compassion-action-btn')?.addEventListener('click', () => {
      this.emitEvent('compassion-action-taken', { message });
      popup.remove();
    });
  }

  // Overwhelm Prevention
  static checkForOverwhelm(items: any[], trigger: string): boolean {
    const prevention = this.OVERWHELM_PREVENTION.find(p => p.trigger === trigger);
    if (!prevention || items.length <= prevention.threshold) return false;

    this.emitEvent('overwhelm-detected', { 
      trigger, 
      itemCount: items.length, 
      threshold: prevention.threshold 
    });

    this.applyOverwhelmPrevention(prevention);
    return true;
  }

  private static applyOverwhelmPrevention(prevention: OverwhelmPrevention): void {
    switch (prevention.action) {
      case "collapse":
        this.collapseItems(prevention.settings.maxVisibleItems);
        break;
      case "simplify":
        this.simplifyItems(prevention.settings.maxVisibleItems);
        break;
      case "prioritize":
        this.prioritizeItems();
        break;
      case "break":
        this.breakDownItems();
        break;
    }

    this.showCompassionMessage("overwhelm");
  }

  private static collapseItems(maxVisible: number): void {
    this.emitEvent('collapse-items', { maxVisible });
  }

  private static simplifyItems(maxVisible: number): void {
    this.emitEvent('simplify-items', { maxVisible });
  }

  private static prioritizeItems(): void {
    this.emitEvent('prioritize-items');
  }

  private static breakDownItems(): void {
    this.emitEvent('break-down-items');
  }

  // Time Estimation Adjustment
  static adjustTimeEstimate(originalMinutes: number, context: {
    energyLevel?: "high" | "medium" | "low";
    taskComplexity?: "simple" | "moderate" | "complex";
    previousAccuracy?: number; // ratio of actual/estimated
  }): number {
    const { energyLevel = "medium", taskComplexity = "moderate", previousAccuracy = 1 } = context;
    
    let adjustedMinutes = originalMinutes;

    // Apply calm mode buffer if active
    if (this.activeCalmMode) {
      adjustedMinutes *= (1 + this.activeCalmMode.settings.builtInBufferTime / 100);
    }

    // Adjust for energy level
    switch (energyLevel) {
      case "low":
        adjustedMinutes *= 1.5; // 50% more time
        break;
      case "high":
        adjustedMinutes *= 0.8; // 20% less time
        break;
    }

    // Adjust for task complexity
    switch (taskComplexity) {
      case "simple":
        adjustedMinutes *= 0.9;
        break;
      case "complex":
        adjustedMinutes *= 1.3;
        break;
    }

    // Adjust based on previous accuracy
    if (previousAccuracy > 1.2) {
      // Consistently underestimate
      adjustedMinutes *= 1.2;
    } else if (previousAccuracy < 0.8) {
      // Consistently overestimate
      adjustedMinutes *= 0.9;
    }

    return Math.round(adjustedMinutes);
  }

  // Emergency Calm Down
  static emergencyCalmDown(): void {
    this.activateCalmMode("emergency-calm");
    this.startAnxietyTechnique("box-breathing");
    
    // Reduce all stimulation
    document.body.classList.add('emergency-calm');
    
    this.emitEvent('emergency-calm-down');
  }

  // Progress Reframing
  static getProgressReframing(progress: {
    tasksCompleted: number;
    totalTasks: number;
    timeSpent: number;
    estimatedTime: number;
  }): {
    gentle: string;
    encouraging: string;
    actionable: string;
  } {
    const completionRate = progress.tasksCompleted / progress.totalTasks;
    const timeRatio = progress.timeSpent / progress.estimatedTime;

    let gentle = "";
    let encouraging = "";
    let actionable = "";

    if (completionRate === 0) {
      gentle = "Starting is often the hardest part.";
      encouraging = "You're taking the first step, which is brave.";
      actionable = "Can you work on this for just 2 minutes?";
    } else if (completionRate < 0.25) {
      gentle = "You're building momentum.";
      encouraging = "Every small step counts toward your goal.";
      actionable = "What's one more small thing you can do?";
    } else if (completionRate < 0.5) {
      gentle = "You're making good progress.";
      encouraging = "You're already partway there.";
      actionable = "Keep going at your own pace.";
    } else if (completionRate < 0.75) {
      gentle = "You're doing great!";
      encouraging = "Most of the work is already done.";
      actionable = "You're in the final stretch!";
    } else if (completionRate < 1) {
      gentle = "Almost there!";
      encouraging = "You're so close to finishing.";
      actionable = "What's one final touch you can add?";
    } else {
      gentle = "You did it!";
      encouraging = "You completed what you set out to do.";
      actionable = "Take a moment to celebrate this win.";
    }

    // Add time-based encouragement
    if (timeRatio > 1.5) {
      encouraging += " Taking the time you needed shows wisdom.";
    } else if (timeRatio < 0.5) {
      encouraging += " You worked efficiently!";
    }

    return { gentle, encouraging, actionable };
  }

  // Utility methods
  static getEmotionalState(): {
    currentMode: CalmMode | null;
    currentTechnique: AnxietyReductionTechnique | null;
    overwhelmLevel: "low" | "medium" | "high";
    lastCompassionCategory: string | null;
  } {
    return {
      currentMode: this.activeCalmMode,
      currentTechnique: this.currentTechnique,
      overwhelmLevel: this.calculateOverwhelmLevel(),
      lastCompassionCategory: null // Would be tracked in actual implementation
    };
  }

  private static calculateOverwhelmLevel(): "low" | "medium" | "high" {
    // This would be calculated based on various factors
    // For now, return a default
    return "low";
  }

  // Event emission helper
  private static emitEvent(eventName: string, data?: any): void {
    if (typeof window !== 'undefined' && (window as any).eventBus) {
      (window as any).eventBus.emit(eventName, data);
    }
    
    // Also emit custom DOM event for broader compatibility
    const event = new CustomEvent(`emotional:${eventName}`, { detail: data });
    document.dispatchEvent(event);
  }
}
