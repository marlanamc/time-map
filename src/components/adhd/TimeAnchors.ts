// ===================================
// Time Anchors - ADHD Time Blindness Support
// ===================================

export interface TimeAnchor {
  relativeTime: string;
  visualIndicator: string;
  urgencyColor: "green" | "yellow" | "red" | "orange" | "gray";
  timeUntil?: number; // minutes until
  timeSince?: number; // minutes since
}

export interface DurationIndicator {
  estimatedMinutes: number;
  displayText: string;
  confidenceLevel: "high" | "medium" | "low";
  actualTime?: number; // for learning
}

export class TimeAnchors {
  private static readonly TIME_ANCHORS = {
    immediate: { threshold: 5, text: "now", icon: "🎯", color: "green" },
    verySoon: { threshold: 15, text: "in a few minutes", icon: "⚡", color: "green" },
    soon: { threshold: 30, text: "in about 15 min", icon: "🕐", color: "yellow" },
    later: { threshold: 60, text: "in about 30 min", icon: "⏰", color: "yellow" },
    muchLater: { threshold: 180, text: "in about an hour", icon: "📅", color: "orange" },
    tomorrow: { threshold: 1440, text: "tomorrow", icon: "🌙", color: "red" },
    future: { threshold: Infinity, text: "later this week", icon: "📆", color: "gray" }
  };

  private static readonly DURATION_CATEGORIES = {
    quick: { max: 5, text: "≈5 min", icon: "⚡", confidence: "high" },
    short: { max: 15, text: "≈15 min", icon: "🕐", confidence: "high" },
    medium: { max: 30, text: "≈30 min", icon: "⏰", confidence: "medium" },
    long: { max: 60, text: "≈1 hour", icon: "📅", confidence: "medium" },
    extended: { max: 180, text: "≈3 hours", icon: "📆", confidence: "low" },
    allDay: { max: 480, text: "≈half day", icon: "🌅", confidence: "low" }
  };

  static getTimeAnchor(targetDate: Date): TimeAnchor {
    const now = new Date();
    const diffMs = targetDate.getTime() - now.getTime();
    const diffMinutes = Math.round(diffMs / (1000 * 60));
    
    // Find the appropriate anchor
    for (const [, anchor] of Object.entries(this.TIME_ANCHORS)) {
      if (Math.abs(diffMinutes) <= anchor.threshold) {
        const isPast = diffMinutes < 0;
        const absMinutes = Math.abs(diffMinutes);
        
        return {
          relativeTime: isPast ? `${anchor.text.replace("in ", "")} ago` : anchor.text,
          visualIndicator: anchor.icon,
          urgencyColor: anchor.color as "green" | "yellow" | "red" | "orange" | "gray",
          timeUntil: isPast ? undefined : absMinutes,
          timeSince: isPast ? absMinutes : undefined
        };
      }
    }
    
    // Default to future
    return {
      relativeTime: "later this week",
      visualIndicator: "📆",
      urgencyColor: "gray"
    };
  }

  static getDurationIndicator(estimatedMinutes: number, actualMinutes?: number): DurationIndicator {
    // Find the appropriate duration category
    for (const [, category] of Object.entries(this.DURATION_CATEGORIES)) {
      if (estimatedMinutes <= category.max) {
        const confidence = actualMinutes ? 
          this.calculateConfidence(estimatedMinutes, actualMinutes) : 
          category.confidence;
        
        return {
          estimatedMinutes,
          displayText: category.text,
          confidenceLevel: confidence as "high" | "medium" | "low",
          actualTime: actualMinutes
        };
      }
    }
    
    // Default to extended
    return {
      estimatedMinutes,
      displayText: "≈3+ hours",
      confidenceLevel: "low" as const,
      actualTime: actualMinutes
    };
  }

  private static calculateConfidence(estimated: number, actual: number): "high" | "medium" | "low" {
    const ratio = actual / estimated;
    if (ratio >= 0.8 && ratio <= 1.2) return "high";
    if (ratio >= 0.6 && ratio <= 1.4) return "medium";
    return "low";
  }

  static getUrgencyColor(date: Date): "green" | "yellow" | "red" | "orange" | "gray" {
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    
    if (diffHours < -2) return "gray"; // Long past
    if (diffHours < -0.5) return "green"; // Recently past
    if (diffHours < 0) return "yellow"; // Very recent past
    if (diffHours < 1) return "green"; // Within next hour
    if (diffHours < 4) return "yellow"; // Within next few hours
    if (diffHours < 24) return "orange"; // Within next day
    return "red"; // Far future
  }

  static formatTimeWithAnchor(date: Date, options: {
    showRelative?: boolean;
    showAnchor?: boolean;
    showDuration?: boolean;
    estimatedMinutes?: number;
  } = {}): string {
    const {
      showRelative = true,
      showAnchor = true,
      showDuration = false,
      estimatedMinutes
    } = options;
    
    const anchor = this.getTimeAnchor(date);
    const timeString = date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    });
    
    let result = "";
    
    if (showAnchor && anchor.visualIndicator) {
      result += `${anchor.visualIndicator} `;
    }
    
    if (showRelative && anchor.relativeTime !== "now") {
      result += `${anchor.relativeTime} `;
    }
    
    result += timeString;
    
    if (showDuration && estimatedMinutes) {
      const duration = this.getDurationIndicator(estimatedMinutes);
      result += ` (${duration.displayText})`;
    }
    
    return result;
  }

  static createCountdownTimer(targetDate: Date, onUpdate: (timeLeft: TimeAnchor) => void): () => void {
    const update = () => {
      const anchor = this.getTimeAnchor(targetDate);
      onUpdate(anchor);
      
      // Clear interval if target time has passed
      if (anchor.timeUntil !== undefined && anchor.timeUntil <= 0) {
        clearInterval(intervalId);
      }
    };
    
    // Update immediately
    update();
    
    // Update every minute
    const intervalId = setInterval(update, 60000) as unknown as number;
    
    return () => clearInterval(intervalId);
  }

  static getTimeBlockVisuals(startTime: Date, endTime: Date): {
    duration: DurationIndicator;
    anchor: TimeAnchor;
    urgencyColor: string;
    progress?: number;
  } {
    const duration = endTime.getTime() - startTime.getTime();
    const durationMinutes = Math.round(duration / (1000 * 60));
    
    return {
      duration: this.getDurationIndicator(durationMinutes),
      anchor: this.getTimeAnchor(startTime),
      urgencyColor: this.getUrgencyColor(startTime),
      progress: this.calculateProgress(startTime, endTime)
    };
  }

  private static calculateProgress(startTime: Date, endTime: Date): number {
    const now = new Date();
    const total = endTime.getTime() - startTime.getTime();
    const elapsed = now.getTime() - startTime.getTime();
    
    if (elapsed <= 0) return 0;
    if (elapsed >= total) return 1;
    
    return Math.round((elapsed / total) * 100) / 100;
  }

  static getSmartSuggestion(currentTime: Date, context: {
    energyLevel?: "high" | "medium" | "low";
    taskType?: "creative" | "analytical" | "routine" | "social";
    lastCompleted?: Date;
  }): {
    suggestedDuration: DurationIndicator;
    suggestedStartTime: Date;
    reasoning: string;
  } {
    const { energyLevel = "medium", taskType = "routine", lastCompleted } = context;
    
    // Base duration on energy level and task type
    let baseMinutes = 30; // default
    
    if (energyLevel === "high") {
      baseMinutes = taskType === "creative" ? 90 : taskType === "analytical" ? 60 : 45;
    } else if (energyLevel === "medium") {
      baseMinutes = taskType === "creative" ? 60 : taskType === "analytical" ? 45 : 30;
    } else { // low energy
      baseMinutes = taskType === "routine" ? 25 : 15;
    }
    
    // Adjust based on last completed task
    if (lastCompleted) {
      const timeSinceLast = (currentTime.getTime() - lastCompleted.getTime()) / (1000 * 60);
      if (timeSinceLast < 15) {
        baseMinutes = Math.min(baseMinutes, 15); // Keep it short if just finished something
      } else if (timeSinceLast > 120) {
        baseMinutes = Math.max(baseMinutes, 45); // Longer break, can handle more
      }
    }
    
    const suggestedStartTime = new Date(currentTime.getTime() + 5 * 60000); // 5 min buffer
    
    return {
      suggestedDuration: this.getDurationIndicator(baseMinutes),
      suggestedStartTime,
      reasoning: this.generateReasoning(baseMinutes, energyLevel, taskType)
    };
  }

  private static generateReasoning(minutes: number, energy: string, type: string): string {
    const reasons = [];
    
    if (energy === "low") {
      reasons.push("low energy - keep it short");
    } else if (energy === "high") {
      reasons.push("high energy - can focus longer");
    }
    
    if (type === "creative") {
      reasons.push("creative work needs time to get into flow");
    } else if (type === "routine") {
      reasons.push("routine tasks can be done efficiently");
    }
    
    if (minutes >= 60) {
      reasons.push("longer session for deep work");
    } else if (minutes <= 15) {
      reasons.push("quick win to build momentum");
    }
    
    return reasons.join(", ");
  }
}
