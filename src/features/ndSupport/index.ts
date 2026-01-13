// ===================================
// ND Support Coordinator
// Main entry point that maintains backward compatibility
// ===================================
import { State } from '../../core/State';
import { Goals } from '../../core/Goals';
import { ModalManager } from '../../utils/modalManager';
import { ND_CONFIG } from '../../config';
import { BrainDump } from './BrainDump';
import { BreakReminders } from './BreakReminders';
import { BodyDouble } from './BodyDouble';
import { AccessibilityPreferences } from './AccessibilityPreferences';
import * as utils from './utils';
import type { NDSupportCallbacks, BrainDumpEntry, BodyDoubleSession, Goal, Priority } from './types';
import type { AccentTheme, FontChoice, TextSpacing, ColorBlindMode, BreakReminder, MaxVisibleTasks, FeedbackStyle } from '../../types';

// Feature instances
const brainDump = new BrainDump();
const breakReminders = new BreakReminders();
const bodyDouble = new BodyDouble();
const accessibilityPreferences = new AccessibilityPreferences();

let callbacks: NDSupportCallbacks = {};

// Coordinator class that maintains backward compatibility
class NDSupportCoordinator {
  setCallbacks(cb: NDSupportCallbacks) {
    callbacks = cb;
    brainDump.setCallbacks(cb);
    breakReminders.setCallbacks(cb);
    bodyDouble.setCallbacks(cb);
    accessibilityPreferences.setCallbacks(cb);
  }

  // Initialize ND features
  init() {
    this.applyAccessibilityPreferences();
    this.startBreakReminder();
    this.checkTransitionWarnings();
  }

  // Delegate to AccessibilityPreferences
  applyAccessibilityPreferences(): void {
    accessibilityPreferences.applyAll();
  }

  // Delegate to BreakReminders
  startBreakReminder(): void {
    breakReminders.start();
  }

  // Delegate to BrainDump
  addToBrainDump(thought: string): BrainDumpEntry {
    return brainDump.addEntry(thought);
  }

  getBrainDump(): BrainDumpEntry[] {
    return brainDump.getEntries();
  }

  processBrainDumpItem(id: string, action: string): void {
    brainDump.processItem(id, action);
  }

  clearProcessedBrainDump(): void {
    brainDump.clearProcessed();
  }

  showBrainDumpModal(): void {
    brainDump.showModal();
  }

  // Delegate to BodyDouble
  startBodyDouble(minutes: number): BodyDoubleSession {
    return bodyDouble.start(minutes);
  }

  getBodyDoubleRemaining(): number | null {
    return bodyDouble.getRemaining();
  }

  endBodyDouble(sessionId: string, completed: boolean = false): void {
    bodyDouble.end(sessionId, completed);
  }

  showBodyDoubleModal(): void {
    bodyDouble.showModal();
  }

  // Utility methods - delegate to utils
  icon(emojiChar: string, symbolChar: string = ""): string {
    return utils.icon(emojiChar, symbolChar);
  }

  getCategoryIcon(categoryKey: string): string {
    return utils.getCategoryIcon(categoryKey);
  }

  getStatusIcon(statusKey: string): string {
    return utils.getStatusIcon(statusKey);
  }

  getPriorityIcon(priorityKey: string): string {
    return utils.getPriorityIcon(priorityKey);
  }

  getAchievementIcon(achievementKey: string): string {
    return utils.getAchievementIcon(achievementKey);
  }

  // Transition warnings
  checkTransitionWarnings(): void {
    accessibilityPreferences.checkTransitionWarnings();
  }

  // Get filtered goals based on overwhelm settings
  getFilteredGoals(goals: Goal[]): Goal[] {
    if (!State.data) return goals;
    const prefs = State.data.preferences.nd;
    const maxVisible =
      ND_CONFIG.MAX_VISIBLE_TASKS[prefs.maxVisibleTasks] || 10;

    let filtered = goals;

    // Hide completed if preference set
    if (prefs.hideCompletedTasks) {
      filtered = filtered.filter((g) => g.status !== "done");
    }

    // Limit visible tasks based on overwhelm setting
    if (filtered.length > maxVisible) {
      // Prioritize by priority, then by due date
      filtered.sort((a: Goal, b: Goal) => {
        const priorityOrder: Record<Priority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
        return (
          (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2)
        );
      });
      filtered = filtered.slice(0, maxVisible);
    }

    return filtered;
  }

  // Get a random initiation prompt
  getInitiationPrompt(): string {
    const prompts = ND_CONFIG.INITIATION_PROMPTS;
    return prompts[Math.floor(Math.random() * prompts.length)];
  }

  // Get a permission slip for perfectionism
  getPermissionSlip(): string {
    const slips = ND_CONFIG.PERMISSION_SLIPS;
    return slips[Math.floor(Math.random() * slips.length)];
  }

  // Handle blocker selection
  handleBlocker(action: string, goalId?: string): void {
    switch (action) {
      case "break_down":
        callbacks.onShowToast?.(
          "Let's break this into tiny steps. What's the smallest first action?",
          "info",
        );
        break;
      case "simplify":
        callbacks.onShowToast?.(
          "What's the 'good enough' version? Do that instead.",
          "info",
        );
        break;
      case "mark_blocked":
        if (goalId) Goals.update(goalId, { status: "blocked" });
        callbacks.onShowToast?.(
          "Marked as blocked. What can you work on instead?",
          "info",
        );
        break;
      case "defer":
        callbacks.onShowToast?.(
          "It's okay to rest. This will still be here when you're ready.",
          "info",
        );
        break;
      case "focus_mode":
        callbacks.onSetFocusMode?.(true);
        break;
      case "clarify_why":
        callbacks.onShowToast?.(
          "Why did you set this intention? Reconnect with what you want from it.",
          "info",
        );
        break;
      case "permission_slip":
        callbacks.onShowToast?.(this.getPermissionSlip(), "success");
        break;
      case "brain_dump":
        this.showBrainDumpModal();
        break;
    }
  }

  // Show dopamine menu for low motivation
  showDopamineMenu(): void {
    const menu = ND_CONFIG.DOPAMINE_MENU;
    const modal = document.createElement("div");
    modal.className = "modal-overlay active dopamine-menu-modal";
    modal.innerHTML = `
        <div class="modal">
          <div class="modal-header">
            <h2 class="modal-title">Quick Wins</h2>
            <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
          </div>
          <div class="modal-body">
            <p class="dopamine-intro">Low on motivation? Pick something small to get a quick win:</p>
            <div class="dopamine-options">
              ${menu
        .map(
          (item, i) => `
                <button class="dopamine-option" data-index="${i}">
                  <span class="dopamine-icon" data-icon="${item.icon}"></span>
                  <span class="dopamine-label">${item.label}</span>
                  <span class="dopamine-time">${item.time}</span>
                </button>
              `,
        )
        .join("")}
            </div>
          </div>
        </div>
      `;

    document.body.appendChild(modal);

    modal.querySelectorAll(".dopamine-option").forEach((btn) => {
      btn.addEventListener("click", (e: Event) => {
        const target = e.currentTarget as HTMLElement;
        if (!target) return;
        const index = parseInt(target.dataset.index || '0');
        modal.remove();
        this.handleDopamineChoice(index);
      });
    });

    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.remove();
    });
  }

  handleDopamineChoice(index: number): void {
    const actions = [
      () => callbacks.onShowToast?.("Find your easiest task and check it off!", "info"),
      () => callbacks.onShowToast?.("Pick one intention to return to today.", "info"),
      () => this.showBrainDumpModal(),
      () => callbacks.onShowToast?.("Pick any intention and adjust it a little.", "info"),
      () =>
        callbacks.onShowToast?.(
          "Add a note to any intention — even just \"thinking about this\"",
          "info",
        ),
      () =>
        callbacks.onShowToast?.(
          "Look at your achievements. You've done great things!",
          "success",
        ),
      () => callbacks.onPickRandomGoal?.(),
      () => {
        this.startBodyDouble(15);
        callbacks.onShowToast?.(
          "Body double started! 15 minutes of focus time.",
          "success",
        );
      },
    ];

    if (actions[index]) actions[index]();
  }

  // Show "What's blocking you?" helper
  showBlockerHelper(goalId: string): void {
    const modal = document.createElement("div");
    modal.className = "modal-overlay active blocker-helper-modal";
    modal.innerHTML = `
        <div class="modal">
          <div class="modal-header">
            <h2 class="modal-title">What's blocking you?</h2>
            <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
          </div>
          <div class="modal-body">
            <p>It's okay to feel stuck. Let's figure out what's going on:</p>
            <div class="blocker-options">
              ${ND_CONFIG.BLOCKER_PROMPTS.map(
      (prompt) => `
                <button class="blocker-option" data-action="${prompt.action}">
                  ${prompt.label}
                </button>
              `,
    ).join("")}
            </div>
          </div>
        </div>
      `;

    document.body.appendChild(modal);

    modal.querySelectorAll(".blocker-option").forEach((btn) => {
      btn.addEventListener("click", (e: Event) => {
        const target = e.currentTarget as HTMLElement;
        if (!target) return;
        const action = target.dataset.action || '';
        modal.remove();
        this.handleBlocker(action, goalId);
      });
    });

    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.remove();
    });
  }

  // Show initiation prompt for starting a task
  showInitiationPrompt(goalTitle: string): void {
    const prompt = this.getInitiationPrompt();
    const modal = document.createElement("div");
    modal.className = "modal-overlay active initiation-modal";
    modal.innerHTML = `
        <div class="modal">
          <div class="modal-header">
            <h2 class="modal-title">Ready to start?</h2>
            <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
          </div>
          <div class="modal-body">
            <p class="initiation-goal">Starting: <strong>${(callbacks.onEscapeHtml ?? ((x: string) => x))(goalTitle)}</strong></p>
            <div class="initiation-prompt">
              <p class="prompt-text">${prompt}</p>
            </div>
            <div class="initiation-actions">
              <button class="btn btn-ghost" onclick="this.closest('.modal-overlay').remove()">Not yet</button>
              <button class="btn btn-primary" id="startNowBtn">Let's go</button>
              <button class="btn btn-ghost" id="newPromptBtn">Different tip</button>
            </div>
          </div>
        </div>
      `;

    document.body.appendChild(modal);

    document.getElementById("newPromptBtn")?.addEventListener("click", () => {
      const promptText = modal.querySelector(".prompt-text") as HTMLElement | null;
      if (promptText) promptText.textContent = this.getInitiationPrompt();
    });

    document.getElementById("startNowBtn")?.addEventListener("click", () => {
      modal.remove();
      callbacks.onShowToast?.(
        "You're doing it! Remember: progress over perfection.",
        "success",
      );
    });

    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.remove();
    });
  }

  // Show ND settings panel (large method - keeping for backward compatibility)
  showSettingsPanel(): void {
    if (!State.data) return;
    const prefs = State.data.preferences.nd;
    const modal = document.createElement("div");
    modal.className = "modal-overlay active nd-settings-modal";
    modal.innerHTML = `
        <div class="modal modal-lg">
          <div class="modal-header">
            <h2 class="modal-title">🧩 Accessibility & Overwhelm Support</h2>
            <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
          </div>
          <div class="modal-body nd-settings-body">
            <div class="settings-section">
              <h3>Appearance</h3>
              <div class="setting-row">
                <label>Accent Color</label>
                <div class="theme-picker" role="radiogroup" aria-label="Choose accent color">
                  ${Object.entries(ND_CONFIG.ACCENT_THEMES)
        .map(
          ([key, theme]) => `
                    <button
                      class="theme-swatch ${prefs.accentTheme === key ? "active" : ""}"
                      data-theme="${key}"
                      title="${theme.label}"
                      aria-label="${theme.label}"
                      ${key === "rainbow" ? `style="--swatch-color: #0EA5E9"` : `style="--swatch-color: ${theme.color}"`}
                    >
                      <span class="swatch-color" ${key === "rainbow" ? `style="background: linear-gradient(90deg, #E11D48, #D96320, #F4A460, #10B981, #0EA5E9, #4F46E5, #6D28D9)"` : ""}></span>
                      <span class="swatch-emoji">${theme.emoji}</span>
                    </button>
                  `,
        )
        .join("")}
                </div>
              </div>
            </div>

            <div class="settings-section">
              <h3>Overwhelm Support</h3>
              <div class="setting-row checkbox-row">
                <label>
                  <input type="checkbox" id="ndSimplified" ${prefs.simplifiedView ? "checked" : ""}>
                  Simplified view (less visual clutter)
                </label>
              </div>
              <div class="setting-row checkbox-row">
                <label>
                  <input type="checkbox" id="ndReduceEmojis" ${prefs.reduceEmojis ? "checked" : ""}>
                  Reduce emojis (less visual noise)
                </label>
              </div>
              <div class="setting-row">
	                <label>Intention visibility</label>
                <select id="ndMaxTasks">
	                  <option value="overwhelmed" ${prefs.maxVisibleTasks === "overwhelmed" ? "selected" : ""}>Minimal (1 intention)</option>
	                  <option value="low_energy" ${prefs.maxVisibleTasks === "low_energy" ? "selected" : ""}>Low energy (3 intentions)</option>
	                  <option value="normal" ${prefs.maxVisibleTasks === "normal" ? "selected" : ""}>Normal (10 intentions)</option>
                  <option value="high_energy" ${prefs.maxVisibleTasks === "high_energy" ? "selected" : ""}>Show all</option>
                </select>
              </div>
              <div class="setting-row checkbox-row">
                <label>
                  <input type="checkbox" id="ndHideCompleted" ${prefs.hideCompletedTasks ? "checked" : ""}>
	                  Hide done intentions
                </label>
              </div>
            </div>

            <div class="settings-section">
              <h3>Visual Preferences</h3>
              <div class="setting-row">
                <label>Font Style</label>
                <select id="ndFontChoice">
                  <option value="default" ${prefs.fontChoice === "default" ? "selected" : ""}>Default (Inter)</option>
                  <option value="dyslexia" ${prefs.fontChoice === "dyslexia" ? "selected" : ""}>Dyslexia-friendly</option>
                  <option value="mono" ${prefs.fontChoice === "mono" ? "selected" : ""}>Monospace</option>
                  <option value="readable" ${prefs.fontChoice === "readable" ? "selected" : ""}>High readability</option>
                </select>
              </div>
              <div class="setting-row">
                <label>Text Spacing</label>
                <select id="ndTextSpacing">
                  <option value="compact" ${prefs.textSpacing === "compact" ? "selected" : ""}>Compact</option>
                  <option value="normal" ${prefs.textSpacing === "normal" ? "selected" : ""}>Normal</option>
                  <option value="relaxed" ${prefs.textSpacing === "relaxed" ? "selected" : ""}>Relaxed</option>
                  <option value="dyslexia" ${prefs.textSpacing === "dyslexia" ? "selected" : ""}>Dyslexia-optimized</option>
                </select>
              </div>
              <div class="setting-row">
                <label>Color Vision</label>
                <select id="ndColorBlind">
                  <option value="none" ${prefs.colorBlindMode === "none" ? "selected" : ""}>Standard</option>
                  <option value="deuteranopia" ${prefs.colorBlindMode === "deuteranopia" ? "selected" : ""}>Deuteranopia (green-blind)</option>
                  <option value="protanopia" ${prefs.colorBlindMode === "protanopia" ? "selected" : ""}>Protanopia (red-blind)</option>
                  <option value="tritanopia" ${prefs.colorBlindMode === "tritanopia" ? "selected" : ""}>Tritanopia (blue-blind)</option>
                </select>
              </div>
            </div>

            <div class="settings-section">
              <h3>Focus & Attention</h3>
              <div class="setting-row">
                <label>Break Reminders</label>
                <select id="ndBreakReminder">
                  <option value="pomodoro" ${prefs.breakReminder === "pomodoro" ? "selected" : ""}>Every 25 min (Pomodoro)</option>
                  <option value="gentle" ${prefs.breakReminder === "gentle" ? "selected" : ""}>Every 45 min (Gentle)</option>
                  <option value="hyperfocus" ${prefs.breakReminder === "hyperfocus" ? "selected" : ""}>Every 90 min (Hyperfocus)</option>
                  <option value="off" ${prefs.breakReminder === "off" ? "selected" : ""}>Off</option>
                </select>
              </div>
              <div class="setting-row checkbox-row">
                <label>
                  <input type="checkbox" id="ndInitiationPrompts" ${prefs.showInitiationPrompts ? "checked" : ""}>
                  Show "how to start" prompts
                </label>
              </div>
              <div class="setting-row checkbox-row">
                <label>
                  <input type="checkbox" id="ndTransitionWarnings" ${prefs.transitionWarnings ? "checked" : ""}>
                  Warn me before deadlines
                </label>
              </div>
            </div>

            <div class="settings-section">
              <h3>Feedback & Rewards</h3>
              <div class="setting-row">
                <label>Celebration Style</label>
                <select id="ndFeedbackStyle">
                  <option value="minimal" ${prefs.feedbackStyle === "minimal" ? "selected" : ""}>Minimal (quiet)</option>
                  <option value="subtle" ${prefs.feedbackStyle === "subtle" ? "selected" : ""}>Subtle (glow only)</option>
                  <option value="moderate" ${prefs.feedbackStyle === "moderate" ? "selected" : ""}>Moderate (confetti)</option>
                  <option value="celebration" ${prefs.feedbackStyle === "celebration" ? "selected" : ""}>Full celebration! 🎉</option>
                </select>
              </div>
            </div>

            <div class="modal-actions">
              <button class="btn btn-primary" id="saveNdSettings">Save Preferences</button>
            </div>
          </div>
        </div>
      `;

    document.body.appendChild(modal);

    // Theme swatch click handlers
    modal.querySelectorAll(".theme-swatch").forEach((swatch) => {
      swatch.addEventListener("click", (e) => {
        modal
          .querySelectorAll(".theme-swatch")
          .forEach((s) => s.classList.remove("active"));
        const target = e.currentTarget as HTMLElement;
        if (target) target.classList.add("active");
      });
    });

    document
      .getElementById("saveNdSettings")
      ?.addEventListener("click", () => {
        if (!State.data) return;
        // Get selected theme
        const activeTheme = modal.querySelector(".theme-swatch.active") as HTMLElement | null;
        const selectedTheme = activeTheme
          ? activeTheme.dataset.theme
          : "teal";

        // Save all preferences
        State.data.preferences.nd = {
          ...State.data.preferences.nd,
          accentTheme: selectedTheme as AccentTheme,
          fontChoice: (document.getElementById("ndFontChoice") as HTMLSelectElement).value as FontChoice,
          textSpacing: (document.getElementById("ndTextSpacing") as HTMLSelectElement).value as TextSpacing,
          colorBlindMode: (document.getElementById("ndColorBlind") as HTMLSelectElement).value as ColorBlindMode,
          simplifiedView: (document.getElementById("ndSimplified") as HTMLInputElement).checked,
          reduceEmojis: (document.getElementById("ndReduceEmojis") as HTMLInputElement).checked,
          breakReminder: (document.getElementById("ndBreakReminder") as HTMLSelectElement).value as BreakReminder,
          maxVisibleTasks: (document.getElementById("ndMaxTasks") as HTMLSelectElement).value as MaxVisibleTasks,
          showInitiationPrompts: (document.getElementById(
            "ndInitiationPrompts",
          ) as HTMLInputElement).checked,
          transitionWarnings: (document.getElementById("ndTransitionWarnings") as HTMLInputElement)
            .checked,
          feedbackStyle: (document.getElementById("ndFeedbackStyle") as HTMLSelectElement).value as FeedbackStyle,
          hideCompletedTasks:
            (document.getElementById("ndHideCompleted") as HTMLInputElement).checked,
        };
        State.save();
        this.applyAccessibilityPreferences();
        this.startBreakReminder();
        modal.remove();
        callbacks.onShowToast?.("Settings saved! ✨", "success");
        callbacks.onScheduleRender?.();
      });

    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.remove();
    });
  }

  // Show appearance panel (similar to settings but includes theme toggle)
  showAppearancePanel(): void {
    if (!State.data) return;
    const prefs = State.data.preferences;
    const nd = prefs.nd;

    const modalManager = new ModalManager();
    const modal = modalManager.create("modal-overlay active appearance-modal", `
        <div class="modal modal-lg">
          <div class="modal-header">
            <h2 class="modal-title">🎨 Settings & Appearance</h2>
            <button class="modal-close" aria-label="Close">×</button>
          </div>
          <div class="modal-body nd-settings-body">
            <div class="settings-section">
              <h3>Theme</h3>
              <div class="setting-row checkbox-row">
                <label>
                  <input type="checkbox" id="appearanceNightGarden" ${prefs.theme === "night" || prefs.theme === "dark" ? "checked" : ""}>
                  Dark Garden Mode
                </label>
              </div>
            </div>

            <div class="settings-section">
              <h3>Accent</h3>
              <div class="setting-row">
                <label>Accent Color</label>
                <div class="theme-picker" role="radiogroup" aria-label="Choose accent color">
                  ${Object.entries(ND_CONFIG.ACCENT_THEMES)
        .map(
          ([key, theme]) => `
                      <button
                        class="theme-swatch ${nd.accentTheme === key ? "active" : ""}"
                        data-theme="${key}"
                        title="${theme.label}"
                        aria-label="${theme.label}"
                        ${key === "rainbow" ? `style="--swatch-color: #0EA5E9"` : `style="--swatch-color: ${theme.color}"`}
                        type="button"
                      >
                        <span class="swatch-color" ${key === "rainbow" ? `style="background: linear-gradient(90deg, #E11D48, #D96320, #F4A460, #10B981, #0EA5E9, #4F46E5, #6D28D9)"` : ""}></span>
                        <span class="swatch-emoji">${theme.emoji}</span>
                      </button>
                    `,
        )
        .join("")}
                </div>
              </div>
            </div>

            <div class="settings-section">
              <h3>Overwhelm Support</h3>
              <div class="setting-row checkbox-row">
                <label>
                  <input type="checkbox" id="ndSimplified" ${nd.simplifiedView ? "checked" : ""}>
                  Simplified view (less visual clutter)
                </label>
              </div>
              <div class="setting-row checkbox-row">
                <label>
                  <input type="checkbox" id="ndReduceEmojis" ${nd.reduceEmojis ? "checked" : ""}>
                  Reduce emojis (less visual noise)
                </label>
              </div>
              <div class="setting-row">
	                <label>Intention visibility</label>
                <select id="ndMaxTasks">
	                  <option value="overwhelmed" ${nd.maxVisibleTasks === "overwhelmed" ? "selected" : ""}>Minimal (1 intention)</option>
	                  <option value="low_energy" ${nd.maxVisibleTasks === "low_energy" ? "selected" : ""}>Low energy (3 intentions)</option>
	                  <option value="normal" ${nd.maxVisibleTasks === "normal" ? "selected" : ""}>Normal (10 intentions)</option>
                  <option value="high_energy" ${nd.maxVisibleTasks === "high_energy" ? "selected" : ""}>Show all</option>
                </select>
              </div>
              <div class="setting-row checkbox-row">
                <label>
                  <input type="checkbox" id="ndHideCompleted" ${nd.hideCompletedTasks ? "checked" : ""}>
	                  Hide done intentions
                </label>
              </div>
            </div>

            <div class="settings-section">
              <h3>Visual Preferences</h3>
              <div class="setting-row">
                <label>Font Style</label>
                <select id="ndFontChoice">
                  <option value="default" ${nd.fontChoice === "default" ? "selected" : ""}>Default (Inter)</option>
                  <option value="dyslexia" ${nd.fontChoice === "dyslexia" ? "selected" : ""}>Dyslexia-friendly</option>
                  <option value="mono" ${nd.fontChoice === "mono" ? "selected" : ""}>Monospace</option>
                  <option value="readable" ${nd.fontChoice === "readable" ? "selected" : ""}>High readability</option>
                </select>
              </div>
              <div class="setting-row">
                <label>Text Spacing</label>
                <select id="ndTextSpacing">
                  <option value="compact" ${nd.textSpacing === "compact" ? "selected" : ""}>Compact</option>
                  <option value="normal" ${nd.textSpacing === "normal" ? "selected" : ""}>Normal</option>
                  <option value="relaxed" ${nd.textSpacing === "relaxed" ? "selected" : ""}>Relaxed</option>
                  <option value="dyslexia" ${nd.textSpacing === "dyslexia" ? "selected" : ""}>Dyslexia-optimized</option>
                </select>
              </div>
              <div class="setting-row">
                <label>Color Vision</label>
                <select id="ndColorBlind">
                  <option value="none" ${nd.colorBlindMode === "none" ? "selected" : ""}>Standard</option>
                  <option value="deuteranopia" ${nd.colorBlindMode === "deuteranopia" ? "selected" : ""}>Deuteranopia (green-blind)</option>
                  <option value="protanopia" ${nd.colorBlindMode === "protanopia" ? "selected" : ""}>Protanopia (red-blind)</option>
                  <option value="tritanopia" ${nd.colorBlindMode === "tritanopia" ? "selected" : ""}>Tritanopia (blue-blind)</option>
                </select>
              </div>
            </div>

            <div class="settings-section">
              <h3>Focus & Attention</h3>
              <div class="setting-row">
                <label>Break Reminders</label>
                <select id="ndBreakReminder">
                  <option value="pomodoro" ${nd.breakReminder === "pomodoro" ? "selected" : ""}>Every 25 min (Pomodoro)</option>
                  <option value="gentle" ${nd.breakReminder === "gentle" ? "selected" : ""}>Every 45 min (Gentle)</option>
                  <option value="hyperfocus" ${nd.breakReminder === "hyperfocus" ? "selected" : ""}>Every 90 min (Hyperfocus)</option>
                  <option value="off" ${nd.breakReminder === "off" ? "selected" : ""}>Off</option>
                </select>
              </div>
              <div class="setting-row checkbox-row">
                <label>
                  <input type="checkbox" id="ndInitiationPrompts" ${nd.showInitiationPrompts ? "checked" : ""}>
                  Show "how to start" prompts
                </label>
              </div>
              <div class="setting-row checkbox-row">
                <label>
                  <input type="checkbox" id="ndTransitionWarnings" ${nd.transitionWarnings ? "checked" : ""}>
                  Warn me before deadlines
                </label>
              </div>
            </div>

            <div class="settings-section">
              <h3>Feedback & Rewards</h3>
              <div class="setting-row">
                <label>Celebration Style</label>
                <select id="ndFeedbackStyle">
                  <option value="minimal" ${nd.feedbackStyle === "minimal" ? "selected" : ""}>Minimal (quiet)</option>
                  <option value="subtle" ${nd.feedbackStyle === "subtle" ? "selected" : ""}>Subtle (glow only)</option>
                  <option value="moderate" ${nd.feedbackStyle === "moderate" ? "selected" : ""}>Moderate (confetti)</option>
                  <option value="celebration" ${nd.feedbackStyle === "celebration" ? "selected" : ""}>Full celebration! 🎉</option>
                </select>
              </div>
            </div>
          </div>
          <div class="modal-actions">
            <button class="btn btn-primary" id="saveAppearance">Save Preferences</button>
          </div>
        </div>
      `);

    // Theme swatch selection
    modalManager.addModalListeners(".theme-swatch", "click", (e: Event) => {
      modal.querySelectorAll(".theme-swatch").forEach((s: Element) => s.classList.remove("active"));
      const target = e.currentTarget as HTMLElement;
      target.classList.add("active");
    });

    // Save button
    modalManager.addModalListener("#saveAppearance", "click", () => {
      if (!State.data) return;
      const nightGarden = !!(modal.querySelector("#appearanceNightGarden") as HTMLInputElement)?.checked;
      const activeTheme = modal.querySelector(".theme-swatch.active") as HTMLElement | null;
      const selectedTheme = activeTheme
        ? activeTheme.dataset.theme
        : (State.data.preferences.nd.accentTheme || "sage");

      State.data.preferences.theme = nightGarden ? "night" : "day";
      State.data.preferences.nd = {
        ...State.data.preferences.nd,
        accentTheme: selectedTheme as AccentTheme,
        fontChoice: (document.getElementById("ndFontChoice") as HTMLSelectElement).value as FontChoice,
        textSpacing: (document.getElementById("ndTextSpacing") as HTMLSelectElement).value as TextSpacing,
        colorBlindMode: (document.getElementById("ndColorBlind") as HTMLSelectElement).value as ColorBlindMode,
        simplifiedView: (document.getElementById("ndSimplified") as HTMLInputElement).checked,
        reduceEmojis: (document.getElementById("ndReduceEmojis") as HTMLInputElement).checked,
        breakReminder: (document.getElementById("ndBreakReminder") as HTMLSelectElement).value as BreakReminder,
        maxVisibleTasks: (document.getElementById("ndMaxTasks") as HTMLSelectElement).value as MaxVisibleTasks,
        showInitiationPrompts: (document.getElementById("ndInitiationPrompts") as HTMLInputElement).checked,
        transitionWarnings: (document.getElementById("ndTransitionWarnings") as HTMLInputElement).checked,
        feedbackStyle: (document.getElementById("ndFeedbackStyle") as HTMLSelectElement).value as FeedbackStyle,
        hideCompletedTasks: (document.getElementById("ndHideCompleted") as HTMLInputElement).checked,
      };
      State.save();

      this.applyAccessibilityPreferences();
      this.startBreakReminder();
      callbacks.onScheduleRender?.();
      modalManager.remove();
      callbacks.onShowToast?.("✨", "Settings saved");
    });

    // Close button
    modalManager.addModalListener(".modal-close", "click", () => {
      modalManager.remove();
    });

    // Click outside to close
    modalManager.addEventListener(modal, "click", (e: Event) => {
      if (e.target === modal) modalManager.remove();
    });
  }
}

// Export singleton instance for backward compatibility
export const NDSupport = new NDSupportCoordinator();
