// ===================================
// Dopamine-Driven Features - ADHD Instant Gratification & Motivation
// ===================================

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  points: number;
  category: "consistency" | "completion" | "exploration" | "self-care";
  unlockedAt?: Date;
  rarity: "common" | "uncommon" | "rare" | "legendary";
}

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastActivity: Date;
  category: string;
  history: {
    date: Date;
    count: number;
  }[];
}

export interface Reward {
  id: string;
  name: string;
  description: string;
  icon: string;
  type: "break" | "milestone" | "self-care" | "celebration";
  trigger: string;
  unlocked: boolean;
  custom: boolean;
}

export interface InstantFeedback {
  action: string;
  visual: "pulse" | "glow" | "bounce" | "sparkle" | "confetti";
  haptic: boolean;
  sound: boolean;
  duration: number;
}

export class DopamineDrivenFeatures {
  private static readonly ACHIEVEMENTS: Achievement[] = [
    {
      id: "first-vision",
      title: "First Vision",
      description: "Created your first vision",
      icon: "🌱",
      points: 10,
      category: "exploration",
      rarity: "common"
    },
    {
      id: "week-streak",
      title: "Week Warrior",
      description: "Used the app every day for a week",
      icon: "🔥",
      points: 50,
      category: "consistency",
      rarity: "uncommon"
    },
    {
      id: "month-streak",
      title: "Monthly Master",
      description: "Used the app every day for a month",
      icon: "🏆",
      points: 200,
      category: "consistency",
      rarity: "rare"
    },
    {
      id: "task-master",
      title: "Task Master",
      description: "Completed 100 tasks",
      icon: "⭐",
      points: 100,
      category: "completion",
      rarity: "uncommon"
    },
    {
      "id": "vision-keeper",
      "title": "Vision Keeper",
      "description": "Maintained a vision for 30 days",
      "icon": "🌿",
      "points": 150,
      "category": "consistency",
      "rarity": "rare"
    },
    {
      id: "self-care-champion",
      title: "Self-Care Champion",
      description: "Took 3 breaks in one day",
      icon: "🧘",
      points: 25,
      category: "self-care",
      rarity: "common"
    },
    {
      id: "creative-explorer",
      title: "Creative Explorer",
      description: "Tried all 4 quick modes",
      icon: "🎨",
      points: 75,
      category: "exploration",
      rarity: "uncommon"
    },
    {
      id: "calm-master",
      title: "Calm Master",
      description: "Used calm mode 10 times",
      icon: "☕",
      points: 50,
      category: "self-care",
      rarity: "uncommon"
    },
    {
      id: "legendary-gardener",
      title: "Legendary Gardener",
      description: "90-day consistency streak",
      icon: "🌟",
      points: 500,
      category: "consistency",
      rarity: "legendary"
    }
  ];

  private static readonly REWARDS: Reward[] = [
    {
      id: "coffee-break",
      name: "Coffee Break",
      description: "Take a 15-minute coffee break",
      icon: "☕",
      type: "break",
      trigger: "after-5-tasks",
      unlocked: false,
      custom: false
    },
    {
      id: "walk-break",
      name: "Walk Break",
      description: "Take a 10-minute walk",
      icon: "🚶",
      type: "break",
      trigger: "after-10-tasks",
      unlocked: false,
      custom: false
    },
    {
      id: "music-break",
      name: "Music Break",
      description: "Listen to your favorite song",
      icon: "🎵",
      type: "break",
      trigger: "after-7-tasks",
      unlocked: false,
      custom: false
    },
    {
      id: "celebration",
      name: "Celebration",
      description: "Celebrate your progress!",
      icon: "🎉",
      type: "celebration",
      trigger: "milestone",
      unlocked: false,
      custom: false
    },
    {
      id: "custom-reward",
      name: "Custom Reward",
      description: "Your personal reward",
      icon: "🎁",
      type: "celebration",
      trigger: "custom",
      unlocked: false,
      custom: true
    }
  ];

  private static readonly INSTANT_FEEDBACK: InstantFeedback[] = [
    {
      action: "task-complete",
      visual: "pulse",
      haptic: true,
      sound: true,
      duration: 300
    },
    {
      action: "quick-add",
      visual: "sparkle",
      haptic: true,
      sound: false,
      duration: 200
    },
    {
      action: "mode-activate",
      visual: "glow",
      haptic: true,
      sound: false,
      duration: 500
    },
    {
      action: "achievement",
      visual: "confetti",
      haptic: true,
      sound: true,
      duration: 1000
    },
    {
      "action": "streak-preserved",
      "visual": "bounce",
      haptic: true,
      sound: false,
      duration: 400
    },
    {
      action: "reward-unlocked",
      visual: "sparkle",
      haptic: true,
      sound: false,
      duration: 600
    }
  ];

  private static userAchievements: Map<string, Achievement> = new Map();
  private static currentStreaks: Map<string, StreakData> = new Map();
  private static unlockedRewards: Set<string> = new Set();
  private static userPoints: number = 0;
  private static userLevel: number = 1;

  // Achievement System
  static getAchievements(): Achievement[] {
    return this.ACHIEVEMENTS;
  }

  static getUserAchievements(): Achievement[] {
    return Array.from(this.userAchievements.values());
  }

  static unlockAchievement(achievementId: string): boolean {
    const achievement = this.ACHIEVEMENTS.find(a => a.id === achievementId);
    if (!achievement || this.userAchievements.has(achievementId)) return false;

    this.userAchievements.set(achievementId, { ...achievement, unlockedAt: new Date() });
    this.userPoints += achievement.points;
    this.updateUserLevel();
    
    this.triggerInstantFeedback("achievement");
    this.showAchievementNotification(achievement);
    this.emitEvent('achievement-unlocked', { achievement });
    
    return true;
  }

  static checkAchievements(context: {
    tasksCompleted: number;
    visionsCreated: number;
    daysActive: number;
    modesUsed: string[];
    breaksTaken: number;
  }): void {
    // Check first vision
    if (context.visionsCreated > 0 && !this.userAchievements.has("first-vision")) {
      this.unlockAchievement("first-vision");
    }

    // Check week streak
    if (context.daysActive >= 7 && !this.userAchievements.has("week-streak")) {
      this.unlockAchievement("week-streak");
    }

    // Check month streak
    if (context.daysActive >= 30 && !this.userAchievements.has("month-streak")) {
      this.unlockAchievement("month-streak");
    }

    // Check task completion
    if (context.tasksCompleted >= 100 && !this.userAchievements.has("task-master")) {
      this.unlockAchievement("task-master");
    }

    // Check vision keeper
    const visionKeeperStreak = this.getVisionKeeperStreak();
    if (visionKeeperStreak >= 30 && !this.userAchievements.has("vision-keeper")) {
      this.unlockAchievement("vision-keeper");
    }

    // Check self-care
    if (context.breaksTaken >= 3 && !this.userAchievements.has("self-care-champion")) {
      this.unlockAchievement("self-care-champion");
    }

    // Check creative exploration
    if (context.modesUsed.length >= 4 && !this.userAchievements.has("creative-explorer")) {
      this.unlockAchievement("creative-explorer");
    }

    // Check calm mode usage
    const calmModeCount = this.getCalmModeUsage();
    if (calmModeCount >= 10 && !this.userAchievements.has("calm-master")) {
      this.unlockAchievement("calm-master");
    }

    // Check legendary gardener
    if (context.daysActive >= 90 && !this.userAchievements.has("legendary-gardener")) {
      this.unlockAchievement("legendary-gardener");
    }
  }

  private static getVisionKeeperStreak(): number {
    // This would calculate the longest continuous streak of vision maintenance
    // For now, return a default value
    return 0;
  }

  private static getCalmModeUsage(): number {
    // This would track calm mode usage
    // For now, return a default value
    return 0;
  }

  private static updateUserLevel(): void {
    const newLevel = Math.floor(this.userPoints / 100) + 1;
    if (newLevel > this.userLevel) {
      this.userLevel = newLevel;
      this.showLevelUpNotification(newLevel);
      this.emitEvent('level-up', { level: newLevel, points: this.userPoints });
    }
  }

  // Streak Management
  static getStreakData(category: string): StreakData {
    if (!this.currentStreaks.has(category)) {
      this.currentStreaks.set(category, {
        currentStreak: 0,
        longestStreak: 0,
        lastActivity: new Date(),
        category,
        history: []
      });
    }
    return this.currentStreaks.get(category)!;
  }

  static updateStreak(category: string, activity: boolean): void {
    const streak = this.getStreakData(category);
    const now = new Date();
    
    if (activity) {
      // Increment streak
      streak.currentStreak++;
      streak.lastActivity = now;
      
      // Update longest streak if needed
      if (streak.currentStreak > streak.longestStreak) {
        streak.longestStreak = streak.currentStreak;
      }
      
      // Add to history
      streak.history.push({
        date: now,
        count: streak.currentStreak
      });
      
      // Keep only last 30 days of history
      if (streak.history.length > 30) {
        streak.history = streak.history.slice(-30);
      }
      
      // Check for streak preservation
      if (streak.currentStreak === 1) {
        this.triggerInstantFeedback("streak-preserved");
      }
      
      // Check for milestone streaks
      this.checkStreakMilestones(category, streak);
    } else {
      // Streak broken
      if (streak.currentStreak > 0) {
        this.emitEvent('streak-broken', { 
          category, 
          length: streak.currentStreak,
          previousLongest: streak.longestStreak 
        });
      }
      
      streak.currentStreak = 0;
    }
    
    this.emitEvent('streak-updated', { category, streak });
  }

  private static checkStreakMilestones(category: string, streak: StreakData): void {
    const milestones = [3, 7, 14, 21, 30, 60, 90];
    
    for (const milestone of milestones) {
      if (streak.currentStreak === milestone && !this.userAchievements.has(`${category}-streak-${milestone}`)) {
        this.unlockAchievement(`${category}-streak-${milestone}`);
      }
    }
  }

  // Reward System
  static getRewards(): Reward[] {
    return this.REWARDS;
  }

  static getUnlockedRewards(): Reward[] {
    return this.REWARDS.filter(r => this.unlockedRewards.has(r.id));
  }

  static unlockReward(rewardId: string): boolean {
    const reward = this.REWARDS.find(r => r.id === rewardId);
    if (!reward || this.unlockedRewards.has(rewardId)) return false;

    this.unlockedRewards.add(rewardId);
    this.triggerInstantFeedback("reward-unlocked");
    this.showRewardNotification(reward);
    this.emitEvent('reward-unlocked', { reward });
    
    return true;
  }

  static checkRewardTriggers(context: {
    tasksCompleted: number;
    milestonesCompleted: number;
    breaksTaken: number;
    lastMilestone?: string;
  }): void {
    // Check task-based rewards
    if (context.tasksCompleted >= 5 && !this.unlockedRewards.has("coffee-break")) {
      this.unlockReward("coffee-break");
    }
    
    if (context.tasksCompleted >= 10 && !this.unlockedRewards.has("walk-break")) {
      this.unlockReward("walk-break");
    }
    
    if (context.tasksCompleted >= 7 && !this.unlockedRewards.has("music-break")) {
      this.unlockReward("music-break");
    }
    
    // Check milestone rewards
    if (context.milestonesCompleted > 0 && !this.unlockedRewards.has("celebration")) {
      this.unlockReward("celebration");
    }
    
    // Check break rewards
    if (context.breaksTaken >= 1 && !this.unlockedRewards.has("custom-reward")) {
      this.unlockReward("custom-reward");
    }
  }

  // Instant Feedback
  static triggerInstantFeedback(action: string): void {
    const feedback = this.INSTANT_FEEDBACK.find(f => f.action === action);
    if (!feedback) return;

    this.showVisualFeedback(feedback.visual);
    
    if (feedback.haptic && this.isHapticSupported()) {
      navigator.vibrate(feedback.duration);
    }
    
    if (feedback.sound) {
      this.playSoundFeedback(feedback.action);
    }
    
    this.emitEvent('instant-feedback', { action, feedback });
  }

  private static showVisualFeedback(type: "pulse" | "glow" | "bounce" | "sparkle" | "confetti"): void {
    const existing = document.querySelector('.dopamine-feedback');
    if (existing) {
      existing.remove();
    }

    const feedback = document.createElement('div');
    feedback.className = `dopamine-feedback dopamine-${type}`;
    
    switch (type) {
      case "pulse":
        feedback.innerHTML = '<div class="dopamine-pulse"></div>';
        break;
      case "glow":
        feedback.innerHTML = '<div class="dopamine-glow"></div>';
        break;
      case "bounce":
        feedback.innerHTML = '<div class="dopamine-bounce"></div>';
        break;
      case "sparkle":
        feedback.innerHTML = '<div class="dopamine-sparkle"></div>';
        break;
      case "confetti":
        feedback.innerHTML = '<div class="dopamine-confetti"></div>';
        break;
    }
    
    document.body.appendChild(feedback);
    
    // Auto-remove after animation
    setTimeout(() => {
      if (feedback.parentNode) {
        feedback.remove();
      }
    }, 1000);
  }

  private static isHapticSupported(): boolean {
    return 'vibrate' in navigator && typeof navigator.vibrate === 'function';
  }

  private static playSoundFeedback(action: string): void {
    // Create a simple sound effect using Web Audio API
    const audioContext = new (window as any).AudioContext || new (window as any).webkitAudioContext();
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Different frequencies for different actions
    switch (action) {
      case "task-complete":
        oscillator.frequency.setValue(800);
        break;
      case "achievement":
        oscillator.frequency.setValue(1200);
        break;
      case "reward-unlocked":
        oscillator.frequency.setValue(600);
        break;
      default:
        oscillator.frequency.setValue(400);
    }
    
    gainNode.gain.setValue(0.1);
    
    oscillator.start();
    gainNode.gain.exponentialRampTo(audioContext.currentTime, 0.01, 0.1);
    
    oscillator.stop(audioContext.currentTime + 0.1);
  }

  // Notification Methods
  private static showAchievementNotification(achievement: Achievement): void {
    const existing = document.querySelector('.achievement-notification');
    if (existing) {
      existing.remove();
    }

    const notification = document.createElement('div');
    notification.className = 'achievement-notification';
    notification.innerHTML = `
      <div class="achievement-content">
        <div class="achievement-icon">${achievement.icon}</div>
        <div class="achievement-info">
          <div class="achievement-title">${achievement.title}</div>
          <div class="achievement-description">${achievement.description}</div>
          <div class="achievement-points">+${achievement.points} points</div>
        </div>
        <button class="achievement-close" aria-label="Close">×</button>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 5000);
    
    // Add close button event listener
    notification.querySelector('.achievement-close')?.addEventListener('click', () => {
      notification.remove();
    });
  }

  private static showRewardNotification(reward: Reward): void {
    const existing = document.querySelector('.reward-notification');
    if (existing) {
      existing.remove();
    }

    const notification = document.createElement('div');
    notification.className = 'reward-notification';
    notification.innerHTML = `
      <div class="reward-content">
        <div class="reward-icon">${reward.icon}</div>
        <div class="reward-info">
          <div class="reward-title">${reward.name}</div>
          <div class="reward-description">${reward.description}</div>
        </div>
        <button class="reward-close" aria-label="Close">×</button>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 3000);
    
    // Add close button event listener
    notification.querySelector('.reward-close')?.addEventListener('click', () => {
      notification.remove();
    });
  }

  private static showLevelUpNotification(level: number): void {
    const existing = document.querySelector('.level-up-notification');
    if (existing) {
      existing.remove();
    }

    const notification = document.createElement('div');
    notification.className = 'level-up-notification';
    notification.innerHTML = `
      <div class="level-up-content">
        <div class="level-up-icon">⬆️</div>
        <div class="level-up-info">
          <div class="level-up-title">Level ${level}!</div>
          <div class="level-up-description">You're doing amazing!</div>
        </div>
        <button class="level-up-close" aria-label="Close">×</button>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 4 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 4000);
    
    // Add close button event listener
    notification.querySelector('.level-up-close')?.addEventListener('click', () => {
      notification.remove();
    });
  }

  // Progress Visualization
  static getProgressVisualization(): {
    totalAchievements: number;
    unlockedAchievements: number;
    completionRate: number;
    userPoints: number;
    userLevel: number;
    currentStreaks: StreakData[];
    unlockedRewards: string[];
  } {
    const totalAchievements = this.ACHIEVEMENTS.length;
    const unlockedAchievements = this.getUserAchievements().length;
    const completionRate = totalAchievements > 0 ? (unlockedAchievements / totalAchievements) * 100 : 0;
    
    return {
      totalAchievements,
      unlockedAchievements,
      completionRate,
      userPoints: this.userPoints,
      userLevel: this.userLevel,
      currentStreaks: Array.from(this.currentStreaks.values()),
      unlockedRewards: Array.from(this.unlockedRewards)
    };
  }

  // Custom Reward Management
  static addCustomReward(reward: Omit<Reward, "id">): boolean {
    const newReward: Reward = {
      ...reward,
      id: `custom-${Date.now()}`,
      unlocked: false,
      custom: true
    };
    
    this.REWARDS.push(newReward);
    this.emitEvent('custom-reward-added', { reward: newReward });
    return true;
  }

  static removeCustomReward(rewardId: string): boolean {
    const index = this.REWARDS.findIndex((r: Reward) => r.id === rewardId && r.custom);
    if (index === -1) return false;
    
    this.REWARDS.splice(index, 1);
    this.unlockedRewards.delete(rewardId);
    this.emitEvent('custom-reward-removed', { rewardId });
    return true;
  }

  // User Stats
  static getUserStats(): {
    totalPoints: number;
    currentLevel: number;
    achievementsUnlocked: number;
    rewardsUnlocked: number;
    totalAchievements: number;
    currentStreaks: Record<string, StreakData>;
    joinDate: string;
  } {
    return {
      totalPoints: this.userPoints,
      currentLevel: this.userLevel,
      achievementsUnlocked: this.userAchievements.size,
      rewardsUnlocked: this.unlockedRewards.size,
      totalAchievements: this.ACHIEVEMENTS.length,
      currentStreaks: Object.fromEntries(this.currentStreaks.entries()),
      joinDate: new Date().toISOString().split('T')[0]
    };
  }

  // Reset for testing
  static resetUserProgress(): void {
    this.userAchievements.clear();
    this.currentStreaks.clear();
    this.unlockedRewards.clear();
    this.userPoints = 0;
    this.userLevel = 1;
    
    this.emitEvent('progress-reset');
  }

  // Event emission helper
  private static emitEvent(eventName: string, data?: any): void {
    if (typeof window !== 'undefined' && (window as any).eventBus) {
      (window as any).eventBus.emit(eventName, data);
    }
    
    // Also emit custom DOM event for broader compatibility
    const event = new CustomEvent(`dopamine:${eventName}`, { detail: data });
    document.dispatchEvent(event);
  }
}
