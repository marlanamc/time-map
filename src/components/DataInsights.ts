// ===================================
// Data-Driven Insights - ADHD Pattern Recognition & Personalization
// ===================================

export interface ProductivityPattern {
  id: string;
  name: string;
  description: string;
  confidence: number; // 0-1
  impact: "positive" | "negative" | "neutral";
  data: {
    frequency: number;
    correlation: number;
    trend: "increasing" | "decreasing" | "stable";
  };
  recommendations: string[];
}

export interface PersonalInsight {
  id: string;
  category: "energy" | "time" | "motivation" | "focus" | "wellbeing";
  title: string;
  description: string;
  actionable: boolean;
  priority: "high" | "medium" | "low";
  data: {
    current: number;
    baseline: number;
    trend: number;
    confidence: number;
  };
  suggestions: string[];
}

export interface LearningMetrics {
  timeEstimationAccuracy: number; // ratio of actual/estimated
  taskCompletionRate: number;
  energyPattern: {
    high: number[];
    medium: number[];
    low: number[];
  };
  distractionPatterns: {
    type: string;
    frequency: number;
    impact: number;
  }[];
  motivationTriggers: {
    trigger: string;
    effectiveness: number;
  }[];
}

export interface PersonalizationProfile {
  userId: string;
  preferences: {
    workStyle: "deep" | "collaborative" | "flexible";
    energyPeaks: number[]; // hours of day
    focusDuration: number; // minutes
    breakFrequency: number; // minutes between breaks
    motivationType: "achievement" | "progress" | "social" | "autonomy";
    sensoryProfile: {
      hapticSensitivity: "low" | "medium" | "high";
      visualIntensity: "low" | "medium" | "high";
      audioVolume: "low" | "medium" | "high";
    };
  };
  adaptations: {
    timeEstimates: number; // multiplier
    taskComplexity: "simple" | "moderate" | "complex";
    notificationFrequency: number;
    uiComplexity: "minimal" | "balanced" | "detailed";
  };
  lastUpdated: Date;
}

export class DataInsights {
  private static userMetrics: LearningMetrics = {
    timeEstimationAccuracy: 1.0,
    taskCompletionRate: 0.0,
    energyPattern: {
      high: [],
      medium: [],
      low: []
    },
    distractionPatterns: [],
    motivationTriggers: []
  };

  private static personalizationProfile: PersonalizationProfile | null = null;

  // Pattern Recognition
  static analyzeProductivityPatterns(data: {
    tasksCompleted: Array<{
      completedAt: Date;
      duration: number;
      complexity: "simple" | "moderate" | "complex";
      energyLevel: "high" | "medium" | "low";
    }>;
    distractions: Array<{
      type: string;
      time: Date;
      impact: number;
    }>;
    energyLevels: Array<{
      time: Date;
      level: "high" | "medium" | "low";
    }>;
  }): ProductivityPattern[] {
    const patterns: ProductivityPattern[] = [];

    // Analyze time-based patterns
    const hourlyProductivity = this.analyzeHourlyProductivity(data.tasksCompleted);
    patterns.push(...hourlyProductivity);

    // Analyze energy patterns
    const energyPatterns = this.analyzeEnergyPatterns(data.tasksCompleted, data.energyLevels);
    patterns.push(...energyPatterns);

    // Analyze distraction patterns
    const distractionPatterns = this.analyzeDistractionPatterns(data.distractions);
    patterns.push(...distractionPatterns);

    return patterns.sort((a, b) => b.confidence - a.confidence);
  }

  private static analyzeHourlyProductivity(tasks: Array<{
    completedAt: Date;
    duration: number;
    complexity: string;
    energyLevel: string;
  }>): ProductivityPattern[] {
    const hourlyData: Record<number, { count: number; avgDuration: number; avgComplexity: number }> = {};

    tasks.forEach(task => {
      const hour = task.completedAt.getHours();
      if (!hourlyData[hour]) {
        hourlyData[hour] = { count: 0, avgDuration: 0, avgComplexity: 0 };
      }
      hourlyData[hour].count++;
      hourlyData[hour].avgDuration = (hourlyData[hour].avgDuration + task.duration) / hourlyData[hour].count;
      hourlyData[hour].avgComplexity = task.complexity === 'simple' ? 1 : task.complexity === 'moderate' ? 2 : 3;
    });

    const patterns: ProductivityPattern[] = [];

    // Morning peak (6-12)
    const morningHours = [6, 7, 8, 9, 10, 11, 12];
    const morningProductivity = morningHours.reduce((sum, hour) => sum + (hourlyData[hour]?.count || 0), 0);
    if (morningProductivity > 0) {
      patterns.push({
        id: "morning-productivity",
        name: "Morning Productivity Peak",
        description: "You're most productive in the morning hours",
        confidence: Math.min(morningProductivity / 10, 1),
        impact: "positive",
        data: {
          frequency: morningProductivity / tasks.length,
          correlation: 0.8,
          trend: "stable"
        },
        recommendations: [
          "Schedule important tasks before noon",
          "Use morning energy for complex work",
          "Save routine tasks for afternoon"
        ]
      });
    }

    // Afternoon slump (13-17)
    const afternoonHours = [13, 14, 15, 16, 17];
    const afternoonProductivity = afternoonHours.reduce((sum, hour) => sum + (hourlyData[hour]?.count || 0), 0);
    if (afternoonProductivity < morningProductivity * 0.5) {
      patterns.push({
        id: "afternoon-slump",
        name: "Afternoon Energy Dip",
        description: "Energy drops significantly in early afternoon",
        confidence: 0.75,
        impact: "negative",
        data: {
          frequency: 0.6,
          correlation: -0.6,
          trend: "stable"
        },
        recommendations: [
          "Schedule breaks around 2-3 PM",
          "Use afternoon for routine tasks",
          "Consider a short walk or stretch"
        ]
      });
    }

    // Evening boost (18-22)
    const eveningHours = [18, 19, 20, 21, 22];
    const eveningProductivity = eveningHours.reduce((sum, hour) => sum + (hourlyData[hour]?.count || 0), 0);
    if (eveningProductivity > afternoonProductivity) {
      patterns.push({
        id: "evening-creativity",
        name: "Evening Creative Boost",
        description: "Creative work flows better in evening hours",
        confidence: Math.min(eveningProductivity / 5, 1),
        impact: "positive",
        data: {
          frequency: eveningProductivity / tasks.length,
          correlation: 0.5,
          trend: "increasing"
        },
        recommendations: [
          "Save creative tasks for evening",
          "Use evening for brainstorming",
          "Avoid complex analytical work at night"
        ]
      });
    }

    return patterns;
  }

  private static analyzeEnergyPatterns(tasks: Array<{
    completedAt: Date;
    duration: number;
    complexity: string;
    energyLevel: string;
  }>, _energyLevels: Array<{
    time: Date;
    level: "high" | "medium" | "low";
  }>): ProductivityPattern[] {
    const patterns: ProductivityPattern[] = [];

    // Analyze energy-productivity correlation
    const energyProductivity: Record<string, { tasks: number; avgDuration: number }> = {
      high: { tasks: 0, avgDuration: 0 },
      medium: { tasks: 0, avgDuration: 0 },
      low: { tasks: 0, avgDuration: 0 }
    };

    tasks.forEach(task => {
      energyProductivity[task.energyLevel].tasks++;
      energyProductivity[task.energyLevel].avgDuration = 
        (energyProductivity[task.energyLevel].avgDuration + task.duration) / 
        energyProductivity[task.energyLevel].tasks;
    });

    const highEnergyProductivity = energyProductivity.high.tasks;
    const totalTasks = tasks.length;

    if (highEnergyProductivity > totalTasks * 0.3) {
      patterns.push({
        id: "high-energy-productivity",
        name: "High Energy Productivity",
        description: "You complete significantly more tasks when energy is high",
        confidence: 0.8,
        impact: "positive",
        data: {
          frequency: highEnergyProductivity / totalTasks,
          correlation: 0.7,
          trend: "stable"
        },
        recommendations: [
          "Identify and protect your high-energy periods",
          "Schedule challenging tasks during high energy",
          "Use low energy for maintenance tasks"
        ]
      });
    }

    return patterns;
  }

  private static analyzeDistractionPatterns(distractions: Array<{
    type: string;
    time: Date;
    impact: number;
  }>): ProductivityPattern[] {
    const patterns: ProductivityPattern[] = [];

    // Group distractions by type
    const distractionTypes: Record<string, { count: number; totalImpact: number }> = {};
    distractions.forEach(d => {
      if (!distractionTypes[d.type]) {
        distractionTypes[d.type] = { count: 0, totalImpact: 0 };
      }
      distractionTypes[d.type].count++;
      distractionTypes[d.type].totalImpact += d.impact;
    });

    // Find most common distraction
    const mostCommon = Object.entries(distractionTypes)
      .sort(([, a], [, b]) => b.count - a.count)[0];

    if (mostCommon && mostCommon[1].count > 3) {
      patterns.push({
        id: "common-distraction",
        name: `${mostCommon[0]} Distraction Pattern`,
        description: `You frequently get distracted by ${mostCommon[0]}`,
        confidence: Math.min(mostCommon[1].count / 10, 1),
        impact: "negative",
        data: {
          frequency: mostCommon[1].count / distractions.length,
          correlation: -0.5,
          trend: "stable"
        },
        recommendations: [
          `Minimize exposure to ${mostCommon[0]} during work`,
          "Use website blockers or notification filters",
          "Schedule specific times for checking notifications"
        ]
      });
    }

    return patterns;
  }

  // Personal Insights Generation
  static generatePersonalInsights(metrics: LearningMetrics): PersonalInsight[] {
    const insights: PersonalInsight[] = [];

    // Time estimation insights
    if (metrics.timeEstimationAccuracy > 1.3) {
      insights.push({
        id: "time-underestimation",
        category: "time",
        title: "Time Underestimation Pattern",
        description: "You consistently underestimate how long tasks will take",
        actionable: true,
        priority: "high",
        data: {
          current: metrics.timeEstimationAccuracy,
          baseline: 1.0,
          trend: 0.1,
          confidence: 0.8
        },
        suggestions: [
          "Add 30% buffer to all time estimates",
          "Use the Pomodoro technique for better time awareness",
          "Track actual vs estimated time for learning"
        ]
      });
    } else if (metrics.timeEstimationAccuracy < 0.8) {
      insights.push({
        id: "time-overestimation",
        category: "time",
        title: "Time Overestimation Pattern",
        description: "You tend to overestimate how long tasks will take",
        actionable: true,
        priority: "medium",
        data: {
          current: metrics.timeEstimationAccuracy,
          baseline: 1.0,
          trend: -0.05,
          confidence: 0.7
        },
        suggestions: [
          "Be more confident in your time estimates",
          "Try shorter work sessions",
          "Use time tracking to build accuracy"
        ]
      });
    }

    // Task completion insights
    if (metrics.taskCompletionRate < 0.8) {
      insights.push({
        id: "low-completion-rate",
        category: "motivation",
        title: "Low Task Completion Rate",
        description: "You're starting more tasks than you're completing",
        actionable: true,
        priority: "high",
        data: {
          current: metrics.taskCompletionRate,
          baseline: 0.8,
          trend: -0.05,
          confidence: 0.9
        },
        suggestions: [
          "Break down large tasks into smaller steps",
          "Use the 2-minute rule for starting tasks",
          "Focus on completing 3 tasks per day"
        ]
      });
    }

    // Energy pattern insights
    const highEnergyHours = metrics.energyPattern.high.length;
    if (highEnergyHours > 0) {
      insights.push({
        id: "energy-peak-identification",
        category: "energy",
        title: "Energy Peak Hours Identified",
        description: `Your peak energy hours are ${highEnergyHours > 1 ? metrics.energyPattern.high.join(', ') : metrics.energyPattern.high[0]?.toString() || 'unknown'}`,
        actionable: true,
        priority: "medium",
        data: {
          current: highEnergyHours,
          baseline: 2,
          trend: 0,
          confidence: 0.6
        },
        suggestions: [
          "Schedule important work during peak hours",
          "Protect your peak energy from interruptions",
          "Use low energy for routine tasks"
        ]
      });
    }

    return insights.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  // Personalization Engine
  static createPersonalizationProfile(userId: string, metrics: LearningMetrics): PersonalizationProfile {
    const profile: PersonalizationProfile = {
      userId,
      preferences: {
        workStyle: this.inferWorkStyle(metrics),
        energyPeaks: this.identifyEnergyPeaks(metrics.energyPattern),
        focusDuration: this.calculateOptimalFocusDuration(metrics),
        breakFrequency: this.calculateOptimalBreakFrequency(metrics),
        motivationType: this.identifyMotivationType(metrics),
        sensoryProfile: this.inferSensoryProfile(metrics)
      },
      adaptations: {
        timeEstimates: metrics.timeEstimationAccuracy,
        taskComplexity: this.inferTaskComplexityPreference(metrics),
        notificationFrequency: this.calculateOptimalNotificationFrequency(metrics),
        uiComplexity: this.inferUIComplexityPreference(metrics)
      },
      lastUpdated: new Date()
    };

    this.personalizationProfile = profile;
    return profile;
  }

  private static inferWorkStyle(_metrics: LearningMetrics): "deep" | "collaborative" | "flexible" {
    // Analyze task patterns to infer work style
    // For now, return collaborative as default
    return "collaborative";
  }

  private static identifyEnergyPeaks(energyPattern: {
    high: number[];
    medium: number[];
    low: number[];
  }): number[] {
    return energyPattern.high.sort((a, b) => a - b);
  }

  private static calculateOptimalFocusDuration(metrics: LearningMetrics): number {
    // Base on task completion patterns
    if (metrics.taskCompletionRate > 0.8) return 45; // Can focus longer
    if (metrics.taskCompletionRate < 0.5) return 25; // Needs shorter sessions
    return 35; // Default
  }

  private static calculateOptimalBreakFrequency(metrics: LearningMetrics): number {
    // Based on energy patterns and task completion
    if (metrics.energyPattern.low.length > metrics.energyPattern.high.length) return 20;
    return 45;
  }

  private static identifyMotivationType(_metrics: LearningMetrics): "achievement" | "progress" | "social" | "autonomy" {
    // This would be based on user behavior analysis
    // For now, return achievement as default
    return "achievement";
  }

  private static inferSensoryProfile(_metrics: LearningMetrics): {
    hapticSensitivity: "low" | "medium" | "high";
    visualIntensity: "low" | "medium" | "high";
    audioVolume: "low" | "medium" | "high";
  } {
    // This would be based on user preferences and behavior
    return {
      hapticSensitivity: "medium",
      visualIntensity: "medium",
      audioVolume: "medium"
    };
  }

  private static inferTaskComplexityPreference(metrics: LearningMetrics): "simple" | "moderate" | "complex" {
    // Based on completion rates by complexity
    if (metrics.taskCompletionRate > 0.8) return "complex";
    if (metrics.taskCompletionRate < 0.5) return "simple";
    return "moderate";
  }

  private static calculateOptimalNotificationFrequency(metrics: LearningMetrics): number {
    // Based on distraction patterns and task completion
    if (metrics.distractionPatterns.length > 5) return 120; // 2 hours
    return 60; // 1 hour
  }

  private static inferUIComplexityPreference(metrics: LearningMetrics): "minimal" | "balanced" | "detailed" {
    // Based on task completion and complexity preference
    if (metrics.taskCompletionRate < 0.6) return "minimal";
    if (metrics.taskCompletionRate > 0.8) return "detailed";
    return "balanced";
  }

  // Learning and Adaptation
  static updateLearningMetrics(newData: {
    taskCompleted: {
      estimatedDuration: number;
      actualDuration: number;
      completed: boolean;
      energyLevel: "high" | "medium" | "low";
      complexity: "simple" | "moderate" | "complex";
    };
    distraction?: {
      type: string;
      impact: number;
    };
    motivationTrigger?: {
      trigger: string;
      effectiveness: number;
    };
  }): void {
    // Update time estimation accuracy
    const accuracy = newData.taskCompleted.actualDuration / newData.taskCompleted.estimatedDuration;
    this.userMetrics.timeEstimationAccuracy = 
      (this.userMetrics.timeEstimationAccuracy * 0.8) + (accuracy * 0.2); // Weighted average

    // Update task completion rate
    const completionRate = newData.taskCompleted.completed ? 1 : 0;
    this.userMetrics.taskCompletionRate = 
      (this.userMetrics.taskCompletionRate * 0.9) + (completionRate * 0.1);

    // Update energy pattern
    const hour = new Date().getHours();
    this.userMetrics.energyPattern[newData.taskCompleted.energyLevel].push(hour);
    // Keep only last 30 days of data
    if (this.userMetrics.energyPattern[newData.taskCompleted.energyLevel].length > 30) {
      this.userMetrics.energyPattern[newData.taskCompleted.energyLevel] = 
        this.userMetrics.energyPattern[newData.taskCompleted.energyLevel].slice(-30);
    }

    // Update distraction patterns
    if (newData.distraction) {
      const existingIndex = this.userMetrics.distractionPatterns.findIndex(
        d => d.type === newData.distraction.type
      );
      if (existingIndex >= 0) {
        this.userMetrics.distractionPatterns[existingIndex].frequency++;
        this.userMetrics.distractionPatterns[existingIndex].impact = 
          (this.userMetrics.distractionPatterns[existingIndex].impact + newData.distraction.impact) / 2;
      } else {
        this.userMetrics.distractionPatterns.push({
          type: newData.distraction.type,
          frequency: 1,
          impact: newData.distraction.impact
        });
      }
    }

    // Update motivation triggers
    if (newData.motivationTrigger) {
      const existingIndex = this.userMetrics.motivationTriggers.findIndex(
        m => m.trigger === newData.motivationTrigger.trigger
      );
      if (existingIndex >= 0) {
        this.userMetrics.motivationTriggers[existingIndex].effectiveness = 
          (this.userMetrics.motivationTriggers[existingIndex].effectiveness + newData.motivationTrigger.effectiveness) / 2;
      } else {
        this.userMetrics.motivationTriggers.push({
          trigger: newData.motivationTrigger.trigger,
          effectiveness: newData.motivationTrigger.effectiveness
        });
      }
    }

    // Update personalization profile if it exists
    if (this.personalizationProfile) {
      this.personalizationProfile = this.createPersonalizationProfile(
        this.personalizationProfile.userId,
        this.userMetrics
      );
    }
  }

  // Smart Suggestions
  static getSmartSuggestions(context: {
    currentTime: Date;
    currentEnergyLevel: "high" | "medium" | "low";
    upcomingTasks: Array<{
      id: string;
      title: string;
      estimatedDuration: number;
      complexity: "simple" | "moderate" | "complex";
      priority: "high" | "medium" | "low";
    }>;
    recentDistractions: string[];
  }): {
    taskRecommendations: Array<{
      taskId: string;
      reason: string;
      confidence: number;
    }>;
    timingRecommendations: Array<{
      suggestion: string;
      reason: string;
    }>;
    environmentalRecommendations: Array<{
      suggestion: string;
      reason: string;
    }>;
  } {
    const suggestions = {
      taskRecommendations: [] as Array<{
        taskId: string;
        reason: string;
        confidence: number;
      }>,
      timingRecommendations: [] as Array<{
        suggestion: string;
        reason: string;
      }>,
      environmentalRecommendations: [] as Array<{
        suggestion: string;
        reason: string;
      }>
    };

    // Task recommendations based on energy and patterns
    context.upcomingTasks.forEach(task => {
      let confidence = 0.5;
      let reason = "";

      // Energy matching
      if (context.currentEnergyLevel === "high" && task.complexity === "complex") {
        confidence += 0.3;
        reason += "High energy for complex work. ";
      } else if (context.currentEnergyLevel === "low" && task.complexity === "simple") {
        confidence += 0.3;
        reason += "Simple task for low energy. ";
      }

      // Priority matching
      if (task.priority === "high") {
        confidence += 0.2;
        reason += "High priority task. ";
      }

      // Time estimation accuracy
      if (this.userMetrics.timeEstimationAccuracy < 1.2) {
        confidence += 0.1;
        reason += "Good time estimation accuracy. ";
      }

      if (confidence > 0.6) {
        suggestions.taskRecommendations.push({
          taskId: task.id,
          reason: reason.trim(),
          confidence
        });
      }
    });

    // Timing recommendations
    const hour = context.currentTime.getHours();
    if (hour >= 9 && hour <= 11 && context.currentEnergyLevel === "high") {
      suggestions.timingRecommendations.push({
        suggestion: "This is your peak productivity window",
        reason: "Morning high energy detected"
      });
    }

    if (hour >= 14 && hour <= 16 && context.currentEnergyLevel === "low") {
      suggestions.timingRecommendations.push({
        suggestion: "Consider taking a break or switching to routine tasks",
        reason: "Afternoon energy dip detected"
      });
    }

    // Environmental recommendations
    if (context.recentDistractions.includes("social media")) {
      suggestions.environmentalRecommendations.push({
        suggestion: "Enable social media blockers",
        reason: "Social media distractions detected"
      });
    }

    if (context.recentDistractions.length > 3) {
      suggestions.environmentalRecommendations.push({
        suggestion: "Try focus mode with reduced notifications",
        reason: "Multiple distractions detected"
      });
    }

    return suggestions;
  }

  // Analytics Dashboard Data
  static getAnalyticsData(): {
    productivityPatterns: ProductivityPattern[];
    userMetrics: LearningMetrics;
    personalizationProfile: PersonalizationProfile | null;
    insights: PersonalInsight[];
    lastUpdated: Date;
  } {
    return {
      productivityPatterns: [],
      userMetrics: this.userMetrics,
      personalizationProfile: this.personalizationProfile,
      insights: this.generatePersonalInsights(this.userMetrics),
      lastUpdated: new Date()
    };
  }

  // Export and Import for backup
  static exportUserData(): string {
    const data = {
      userMetrics: this.userMetrics,
      personalizationProfile: this.personalizationProfile,
      exportDate: new Date().toISOString()
    };
    return JSON.stringify(data, null, 2);
  }

  static importUserData(data: string): boolean {
    try {
      const parsed = JSON.parse(data);
      this.userMetrics = parsed.userMetrics || this.userMetrics;
      this.personalizationProfile = parsed.personalizationProfile || null;
      return true;
    } catch (error) {
      console.error('Failed to import user data:', error);
      return false;
    }
  }
}