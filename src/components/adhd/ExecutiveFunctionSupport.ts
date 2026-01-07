// ===================================
// Executive Function Support - ADHD Decision Reduction
// ===================================

export interface QuickMode {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  timeBlocks: TimeBlock[];
  restrictions: {
    maxTasks?: number;
    taskTypes?: string[];
    timeLimit?: number; // minutes
    notifications?: boolean;
    distractions?: string[];
  };
  benefits: string[];
}

export interface TimeBlock {
  startTime: Date;
  endTime: Date;
  title: string;
  type: "focus" | "break" | "transition" | "flex";
  color: string;
}

export interface DecisionTemplate {
  id: string;
  name: string;
  trigger: string;
  options: DecisionOption[];
  defaultOption?: number;
}

export interface DecisionOption {
  id: string;
  text: string;
  action: () => void;
  icon?: string;
  timeEstimate?: number;
  energyRequired?: "low" | "medium" | "high";
}

export class ExecutiveFunctionSupport {
  private static readonly QUICK_MODES: QuickMode[] = [
    {
      id: "deep-work",
      name: "Deep Work",
      description: "Uninterrupted focus time for complex tasks",
      icon: "🧠",
      color: "#6366f1",
      timeBlocks: [
        { startTime: new Date(0, 0, 0, 0, 9, 0), endTime: new Date(0, 0, 0, 0, 11, 0), title: "Deep Focus", type: "focus", color: "#6366f1" },
        { startTime: new Date(0, 0, 0, 0, 11, 0), endTime: new Date(0, 0, 0, 0, 11, 15), title: "Break", type: "break", color: "#4caf50" }
      ],
      restrictions: {
        maxTasks: 1,
        notifications: false,
        distractions: ["social", "email", "news"],
        timeLimit: 120
      },
      benefits: ["Maximum focus", "Reduced context switching", "Deep work quality"]
    },
    {
      id: "admin-day",
      name: "Admin Day",
      description: "Knock out routine tasks efficiently",
      icon: "📋",
      color: "#ff9800",
      timeBlocks: [
        { startTime: new Date(0, 0, 0, 0, 9, 0), endTime: new Date(0, 0, 0, 0, 10, 0), title: "Email & Messages", type: "focus", color: "#ff9800" },
        { startTime: new Date(0, 0, 0, 0, 10, 0), endTime: new Date(0, 0, 0, 0, 10, 30), title: "Quick Tasks", type: "focus", color: "#ff9800" },
        { startTime: new Date(0, 0, 0, 0, 10, 30), endTime: new Date(0, 0, 0, 0, 11, 0), title: "Planning", type: "focus", color: "#ff9800" }
      ],
      restrictions: {
        maxTasks: 5,
        taskTypes: ["admin", "routine", "planning"],
        timeLimit: 60
      },
      benefits: ["Clear inbox", "Organized systems", "Reduced mental load"]
    },
    {
      id: "creative-flow",
      name: "Creative Flow",
      description: "Open-ended time for creative exploration",
      icon: "🎨",
      color: "#e91e63",
      timeBlocks: [
        { startTime: new Date(0, 0, 0, 0, 10, 0), endTime: new Date(0, 0, 0, 0, 12, 0), title: "Creative Time", type: "flex", color: "#e91e63" }
      ],
      restrictions: {
        notifications: false,
        distractions: ["deadlines", "metrics"],
        timeLimit: 180
      },
      benefits: ["Creative freedom", "Reduced pressure", "Natural flow"]
    },
    {
      id: "recovery",
      name: "Recovery Day",
      description: "Minimal expectations, focus on well-being",
      icon: "🌿",
      color: "#4caf50",
      timeBlocks: [
        { startTime: new Date(0, 0, 0, 0, 11, 0), endTime: new Date(0, 0, 0, 0, 13, 0), title: "Gentle Activity", type: "flex", color: "#4caf50" }
      ],
      restrictions: {
        maxTasks: 2,
        notifications: false,
        timeLimit: 30
      },
      benefits: ["Energy restoration", "Stress reduction", "Self-compassion"]
    }
  ];

  private static readonly DECISION_TEMPLATES: DecisionTemplate[] = [
    {
      id: "task-overwhelm",
      name: "Task Overwhelm",
      trigger: "Too many tasks to choose from",
      options: [
        {
          id: "quick-win",
          text: "Do the quickest task (5 min or less)",
          action: () => this.selectQuickWin(),
          icon: "⚡",
          timeEstimate: 5,
          energyRequired: "low"
        },
        {
          id: "hardest-first",
          text: "Tackle the hardest task while energy is high",
          action: () => this.selectHardestTask(),
          icon: "💪",
          timeEstimate: 45,
          energyRequired: "high"
        },
        {
          id: "break-first",
          text: "Take a 5-minute break, then decide",
          action: () => this.scheduleBreak(),
          icon: "☕",
          timeEstimate: 5,
          energyRequired: "low"
        },
        {
          id: "postpone",
          text: "Postpone decision for 30 minutes",
          action: () => this.postponeDecision(),
          icon: "⏰",
          timeEstimate: 0,
          energyRequired: "low"
        }
      ],
      defaultOption: 0
    },
    {
      id: "time-blindness",
      name: "Time Planning",
      trigger: "Unsure how long something will take",
      options: [
        {
          id: "timebox",
          text: "Use a 25-minute timebox",
          action: () => this.createTimebox(25),
          icon: "⏱️",
          timeEstimate: 25,
          energyRequired: "medium"
        },
        {
          id: "double-estimate",
          text: "Double your time estimate",
          action: () => this.doubleTimeEstimate(),
          icon: "⏰",
          timeEstimate: 0,
          energyRequired: "low"
        },
        {
          id: "start-small",
          text: "Start with 15 minutes, then reassess",
          action: () => this.startSmall(),
          icon: "🎯",
          timeEstimate: 15,
          energyRequired: "low"
        },
        {
          id: "ask-help",
          text: "Ask someone for their estimate",
          action: () => this.askForHelp(),
          icon: "🤝",
          timeEstimate: 0,
          energyRequired: "low"
        }
      ],
      defaultOption: 2
    },
    {
      id: "motivation-low",
      name: "Low Motivation",
      trigger: "Feeling stuck or unmotivated",
      options: [
        {
          id: "body-doubling",
          text: "Work alongside someone (virtual or in person)",
          action: () => this.startBodyDoubling(),
          icon: "👥",
          timeEstimate: 0,
          energyRequired: "low"
        },
        {
          id: "change-scenery",
          text: "Move to a different location",
          action: () => this.changeLocation(),
          icon: "🏃",
          timeEstimate: 5,
          energyRequired: "low"
        },
        {
          id: "music-focus",
          text: "Put on focus music or white noise",
          action: () => this.startFocusMusic(),
          icon: "🎵",
          timeEstimate: 2,
          energyRequired: "low"
        },
        {
          id: "reduce-scope",
          text: "Make the task smaller or simpler",
          action: () => this.reduceTaskScope(),
          icon: "🔍",
          timeEstimate: 0,
          energyRequired: "low"
        }
      ],
      defaultOption: 3
    }
  ];

  static getQuickModes(): QuickMode[] {
    return this.QUICK_MODES;
  }

  static getQuickMode(id: string): QuickMode | undefined {
    return this.QUICK_MODES.find(mode => mode.id === id);
  }

  static activateQuickMode(modeId: string, startTime?: Date): {
    success: boolean;
    message: string;
    timeBlocks: TimeBlock[];
  } {
    const mode = this.getQuickMode(modeId);
    if (!mode) {
      return {
        success: false,
        message: "Quick mode not found",
        timeBlocks: []
      };
    }

    const baseTime = startTime || new Date();
    const timeBlocks = this.adjustTimeBlocksForCurrentTime(mode.timeBlocks, baseTime);

    // Apply restrictions
    this.applyModeRestrictions(mode);

    return {
      success: true,
      message: `Activated ${mode.name} mode. ${mode.description}`,
      timeBlocks
    };
  }

  private static adjustTimeBlocksForCurrentTime(blocks: TimeBlock[], baseTime: Date): TimeBlock[] {
    const now = baseTime;
    
    return blocks.map(block => {
      const startHour = block.startTime.getHours();
      const startMinute = block.startTime.getMinutes();
      const endHour = block.endTime.getHours();
      const endMinute = block.endTime.getMinutes();
      
      const adjustedStart = new Date(now);
      adjustedStart.setHours(startHour, startMinute);
      
      const adjustedEnd = new Date(now);
      adjustedEnd.setHours(endHour, endMinute);
      
      // Handle day wrap-around
      if (adjustedEnd < adjustedStart) {
        adjustedEnd.setDate(adjustedEnd.getDate() + 1);
      }
      
      return {
        ...block,
        startTime: adjustedStart,
        endTime: adjustedEnd
      };
    });
  }

  private static applyModeRestrictions(mode: QuickMode): void {
    // This would integrate with the main app to apply restrictions
    console.log(`[Executive Function] Applying restrictions for ${mode.name}:`, mode.restrictions);
    
    // Emit events for other parts of the app to handle
    if (typeof window !== 'undefined' && window.eventBus) {
      window.eventBus.emit('quick-mode-activated', {
        mode,
        restrictions: mode.restrictions
      });
    }
  }

  static getDecisionTemplate(trigger: string): DecisionTemplate | undefined {
    return this.DECISION_TEMPLATES.find(template => 
      template.trigger.toLowerCase().includes(trigger.toLowerCase())
    );
  }

  static getDecisionOptions(templateId: string): DecisionOption[] | undefined {
    const template = this.DECISION_TEMPLATES.find(t => t.id === templateId);
    return template?.options;
  }

  static executeDecision(templateId: string, optionId: string): boolean {
    const template = this.getDecisionTemplate(templateId);
    const option = template?.options.find(opt => opt.id === optionId);
    
    if (option) {
      option.action();
      return true;
    }
    
    return false;
  }

  // Decision option implementations
  private static selectQuickWin(): void {
    console.log("[Executive Function] Selecting quick win task");
    // Implementation would find and select the shortest task
    if (typeof window !== 'undefined' && window.eventBus) {
      window.eventBus.emit('select-quick-win');
    }
  }

  private static selectHardestTask(): void {
    console.log("[Executive Function] Selecting hardest task");
    // Implementation would find the most complex task
    if (typeof window !== 'undefined' && window.eventBus) {
      window.eventBus.emit('select-hardest-task');
    }
  }

  private static scheduleBreak(): void {
    console.log("[Executive Function] Scheduling 5-minute break");
    // Implementation would schedule a break
    if (typeof window !== 'undefined' && window.eventBus) {
      window.eventBus.emit('schedule-break', { duration: 5 });
    }
  }

  private static postponeDecision(): void {
    console.log("[Executive Function] Postponing decision");
    // Implementation would postpone the decision
    if (typeof window !== 'undefined' && window.eventBus) {
      window.eventBus.emit('postpone-decision', { duration: 30 });
    }
  }

  private static createTimebox(minutes: number): void {
    console.log(`[Executive Function] Creating ${minutes}-minute timebox`);
    // Implementation would create a timebox
    if (typeof window !== 'undefined' && window.eventBus) {
      window.eventBus.emit('create-timebox', { duration: minutes });
    }
  }

  private static doubleTimeEstimate(): void {
    console.log("[Executive Function] Doubling time estimate");
    // Implementation would double the current time estimate
    if (typeof window !== 'undefined' && window.eventBus) {
      window.eventBus.emit('double-time-estimate');
    }
  }

  private static startSmall(): void {
    console.log("[Executive Function] Starting with 15 minutes");
    // Implementation would start with a 15-minute session
    if (typeof window !== 'undefined' && window.eventBus) {
      window.eventBus.emit('start-small', { duration: 15 });
    }
  }

  private static askForHelp(): void {
    console.log("[Executive Function] Asking for help with time estimate");
    // Implementation would prompt for help
    if (typeof window !== 'undefined' && window.eventBus) {
      window.eventBus.emit('ask-for-help');
    }
  }

  private static startBodyDoubling(): void {
    console.log("[Executive Function] Starting body doubling");
    // Implementation would start a body doubling session
    if (typeof window !== 'undefined' && window.eventBus) {
      window.eventBus.emit('start-body-doubling');
    }
  }

  private static changeLocation(): void {
    console.log("[Executive Function] Changing location");
    // Implementation would suggest changing location
    if (typeof window !== 'undefined' && window.eventBus) {
      window.eventBus.emit('suggest-location-change');
    }
  }

  private static startFocusMusic(): void {
    console.log("[Executive Function] Starting focus music");
    // Implementation would start focus music
    if (typeof window !== 'undefined' && window.eventBus) {
      window.eventBus.emit('start-focus-music');
    }
  }

  private static reduceTaskScope(): void {
    console.log("[Executive Function] Reducing task scope");
    // Implementation would help reduce the task scope
    if (typeof window !== 'undefined' && window.eventBus) {
      window.eventBus.emit('reduce-task-scope');
    }
  }

  // Utility methods for external accountability
  static generateAccountabilityReport(modeId: string, duration: number): {
    mode: QuickMode;
    duration: number;
    tasksCompleted: number;
    restrictionsFollowed: boolean;
    recommendations: string[];
  } {
    const mode = this.getQuickMode(modeId);
    if (!mode) {
      throw new Error(`Quick mode ${modeId} not found`);
    }

    // This would be populated with actual data
    return {
      mode,
      duration,
      tasksCompleted: 0,
      restrictionsFollowed: true,
      recommendations: [
        "Continue with this mode for better focus",
        "Consider adjusting time blocks if needed",
        "Take breaks when feeling overwhelmed"
      ]
    };
  }

  static getRecommendedMode(context: {
    energyLevel: "high" | "medium" | "low";
    taskTypes: string[];
    timeAvailable: number; // minutes
    lastMode?: string;
  }): QuickMode {
    const { energyLevel, taskTypes, lastMode } = context;

    // Don't repeat the same mode
    if (lastMode) {
      const previousMode = this.getQuickMode(lastMode);
      if (previousMode && this.isModeSuitable(previousMode, context)) {
        return previousMode;
      }
    }

    // Energy-based recommendations
    if (energyLevel === "low") {
      const recoveryMode = this.getQuickMode("recovery");
      if (recoveryMode) return recoveryMode;
    }

    if (energyLevel === "high" && taskTypes.includes("creative")) {
      const creativeMode = this.getQuickMode("creative-flow");
      if (creativeMode) return creativeMode;
    }

    if (taskTypes.includes("admin") || taskTypes.includes("routine")) {
      const adminMode = this.getQuickMode("admin-day");
      if (adminMode) return adminMode;
    }

    // Default to deep work
    const deepWorkMode = this.getQuickMode("deep-work");
    if (deepWorkMode) return deepWorkMode;
    
    // Fallback
    return this.QUICK_MODES[0];
  }

  private static isModeSuitable(mode: QuickMode, context: {
    energyLevel: "high" | "medium" | "low";
    taskTypes: string[];
    timeAvailable: number;
  }): boolean {
    const { energyLevel, taskTypes, timeAvailable } = context;

    // Check energy compatibility
    if (energyLevel === "low" && mode.id !== "recovery") return false;
    if (energyLevel === "high" && mode.id === "recovery") return false;

    // Check time availability
    if (mode.restrictions.timeLimit && timeAvailable < mode.restrictions.timeLimit) return false;

    // Check task type compatibility
    if (mode.restrictions.taskTypes) {
      const hasCompatibleTask = taskTypes.some(type => 
        mode.restrictions.taskTypes!.includes(type.toLowerCase())
      );
      if (!hasCompatibleTask) return false;
    }

    return true;
  }
}
