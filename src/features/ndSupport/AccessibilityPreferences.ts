// Accessibility Preferences Management
import { State } from '../../core/State';
import { Goals } from '../../core/Goals';
import { ThemeManager } from '../../theme/ThemeManager';
import { ND_CONFIG } from '../../config';
import { TextSpacingManager } from './TextSpacing';
import { ColorTheming } from './ColorTheming';
import type { NDSupportCallbacks } from './types';

export class AccessibilityPreferences {
  private callbacks: NDSupportCallbacks = {};
  private textSpacingManager: TextSpacingManager;
  private colorTheming: ColorTheming;

  constructor() {
    this.textSpacingManager = new TextSpacingManager();
    this.colorTheming = new ColorTheming();
  }

  setCallbacks(callbacks: NDSupportCallbacks): void {
    this.callbacks = callbacks;
    this.textSpacingManager.setCallbacks(callbacks);
    this.colorTheming.setCallbacks(callbacks);
  }

  applyAll(): void {
    if (!State.data) return;
    const prefs = State.data.preferences.nd;
    const root = document.documentElement;

    ThemeManager.applyFromPreference(State.data.preferences.theme);

    // Apply font choice
    const fontOptions = ND_CONFIG.FONT_OPTIONS as Record<string, string>;
    if (prefs.fontChoice && fontOptions[prefs.fontChoice]) {
      root.style.setProperty(
        "--font-sans",
        fontOptions[prefs.fontChoice],
      );
    }

    // Apply text spacing
    this.textSpacingManager.apply();

    // Apply color blind mode - remove all first, then add if needed
    document.body.classList.remove(
      "colorblind-deuteranopia",
      "colorblind-protanopia",
      "colorblind-tritanopia",
    );
    if (prefs.colorBlindMode && prefs.colorBlindMode !== "none") {
      document.body.classList.add(`colorblind-${prefs.colorBlindMode}`);
    }

    // Apply simplified view - toggle properly
    document.body.classList.toggle("simplified-view", !!prefs.simplifiedView);

    // Apply reduced emojis mode - toggle properly
    document.body.classList.toggle("reduce-emojis", !!prefs.reduceEmojis);

    // Apply color theming
    this.colorTheming.apply();
  }

  checkTransitionWarnings(): void {
    if (!State.data || !State.data.preferences.nd.transitionWarnings) return;

    const goals = Goals.getAll();
    const now = new Date();

    goals.forEach((goal) => {
      if (goal.dueDate && goal.status !== "done") {
        const due = new Date(goal.dueDate);
        const hoursUntil = (due.getTime() - now.getTime()) / (1000 * 60 * 60);

        if (hoursUntil <= 24 && hoursUntil > 0) {
          this.callbacks.onShowToast?.(
            `⏰ "${goal.title}" is coming up in less than 24 hours.`,
            "warning",
          );
        }
      }
    });
  }
}
