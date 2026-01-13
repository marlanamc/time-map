// ===================================
// Neurodivergent Support Features Module
// ===================================
import { State } from '../core/State';
import { Goals } from '../core/Goals';
import { ThemeManager } from '../theme/ThemeManager';
import { ModalManager } from '../utils/modalManager';
import { CONFIG, ND_CONFIG } from '../config';
import DB, { DB_STORES } from '../db';
import { dirtyTracker } from '../services/DirtyTracker';
import { debouncedBrainDumpSync } from '../utils/syncHelpers';
import { syncQueue } from '../services/SyncQueue';
import { SupabaseService } from '../services/SupabaseService';
import type {
  BrainDumpEntry,
  TextSpacing,
  BodyDoubleSession,
  Goal,
  Priority,
  AccentTheme,
  FontChoice,
  ColorBlindMode,
  BreakReminder,
  MaxVisibleTasks,
  FeedbackStyle
} from '../types';

// Callback interface for UI interactions
interface NDSupportCallbacks {
  onShowToast?: (message: string, type?: string) => void;
  onScheduleRender?: () => void;
  onSetFocusMode?: (enabled: boolean) => void;
  onEscapeHtml?: (text: string) => string;
  onOpenGoalModal?: (level: string, month: number, year: number) => void;
  onShowKeyboardShortcuts?: () => void;
  onPickRandomGoal?: () => void;
}

let callbacks: NDSupportCallbacks = {};

function persistBrainDumpEntryToIndexedDb(entry: BrainDumpEntry): void {
  void DB.update(DB_STORES.BRAIN_DUMP, entry).catch((err: unknown) => {
    console.warn('[NDSupport] Failed to persist brain dump entry to IndexedDB:', err);
  });
}

function deleteBrainDumpEntryFromIndexedDb(id: string): void {
  void DB.delete(DB_STORES.BRAIN_DUMP, id).catch((err: unknown) => {
    console.warn('[NDSupport] Failed to delete brain dump entry from IndexedDB:', err);
  });
}

export const NDSupport = {
  setCallbacks(cb: NDSupportCallbacks) {
    callbacks = cb;
  },


  breakTimer: null as ReturnType<typeof setInterval> | null,
  bodyDoubleTimer: null as ReturnType<typeof setInterval> | null,
  bodyDoubleEndTime: null as number | null,

  // Initialize ND features
  init() {
    this.applyAccessibilityPreferences();
    this.startBreakReminder();
    this.checkTransitionWarnings();
  },

  // Apply visual accessibility preferences
  applyAccessibilityPreferences(): void {
    if (!State.data) return;
    const prefs = State.data.preferences.nd;
    const root = document.documentElement;

    ThemeManager.applyFromPreference(State.data.preferences.theme);

    // Apply accent theme
    if (prefs.accentTheme) {
      const themeClasses = [
        "theme-rose",
        "theme-coral",
        "theme-amber",
        "theme-mint",
        "theme-sage",
        "theme-sky",
        "theme-teal",
        "theme-indigo",
        "theme-violet",
        "theme-rainbow",
      ] as const;

      // Remove all theme classes first
      document.body.classList.remove(...themeClasses);
      root.classList.remove(...themeClasses);

      const themeClass = `theme-${prefs.accentTheme}`;
      document.body.classList.add(themeClass);
      root.classList.add(themeClass);
    }

    // Apply font choice
    const fontOptions = ND_CONFIG.FONT_OPTIONS as Record<string, string>;
    if (prefs.fontChoice && fontOptions[prefs.fontChoice]) {
      root.style.setProperty(
        "--font-sans",
        fontOptions[prefs.fontChoice],
      );
    }

    // Apply text spacing
    const textSpacing = (ND_CONFIG as any).TEXT_SPACING as Record<TextSpacing, { lineHeight: string; letterSpacing: string; wordSpacing: string }> | undefined;
    if (prefs.textSpacing && textSpacing && textSpacing[prefs.textSpacing]) {
      const spacing = textSpacing[prefs.textSpacing];
      root.style.setProperty("--line-height-base", spacing.lineHeight);
      root.style.setProperty("--letter-spacing", spacing.letterSpacing);
      root.style.setProperty("--word-spacing", spacing.wordSpacing);
    }

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
  },

  // Brain dump - parking lot for intrusive thoughts
  addToBrainDump(thought: string): BrainDumpEntry {
    if (!State.data) {
      State.init();
      if (!State.data) throw new Error("State not initialized");
    }
    const entry: BrainDumpEntry = {
      id: crypto.randomUUID(),
      text: thought,
      createdAt: new Date().toISOString(),
      processed: false,
    };
    State.data.brainDump.unshift(entry);
    State.save();
    persistBrainDumpEntryToIndexedDb(entry);
    dirtyTracker.markDirty('brainDump', entry.id);
    debouncedBrainDumpSync(entry);
    return entry;
  },

  getBrainDump(): BrainDumpEntry[] {
    if (!State.data) return [];
    return State.data.brainDump || [];
  },

  processBrainDumpItem(id: string, action: string): void {
    if (!State.data) return;
    const item = State.data.brainDump.find((i) => i.id === id);
    if (item) {
      item.processed = true;
      item.processedAction = action;
      item.processedAt = new Date().toISOString();
      State.save();
      persistBrainDumpEntryToIndexedDb(item);
      dirtyTracker.markDirty('brainDump', item.id);
      debouncedBrainDumpSync(item);
    }
  },

  clearProcessedBrainDump(): void {
    if (!State.data) return;
    const removed = State.data.brainDump.filter((i) => i.processed);
    State.data.brainDump = State.data.brainDump.filter((i) => !i.processed);
    State.save();

    removed.forEach((item) => {
      deleteBrainDumpEntryFromIndexedDb(item.id);
      SupabaseService.deleteBrainDump(item.id).catch((error) => {
        try {
          syncQueue.enqueue({ type: 'delete', entity: 'brainDump', data: { id: item.id } });
        } catch (queueError) {
          console.warn('[NDSupport] Failed to queue brain dump delete:', { error, queueError });
        }
      });
    });
  },

  // Body doubling timer
  startBodyDouble(minutes: number): BodyDoubleSession {
    if (!State.data) {
      State.init();
      if (!State.data) throw new Error("State not initialized");
    }
    if (this.bodyDoubleTimer) {
      clearInterval(this.bodyDoubleTimer);
      this.bodyDoubleTimer = null;
    }

    this.bodyDoubleEndTime = Date.now() + minutes * 60 * 1000;

    const session: BodyDoubleSession = {
      id: Date.now().toString(36),
      startedAt: new Date().toISOString(),
      duration: minutes,
      completedAt: null,
      goalId: null,
      completed: false,
    };
    State.data.bodyDoubleHistory.push(session);
    State.save();

    this.bodyDoubleTimer = setInterval(() => {
      if (this.bodyDoubleEndTime) {
        const remaining = this.bodyDoubleEndTime - Date.now();
        if (remaining <= 0) {
          this.endBodyDouble(session.id, true);
        }
      }
    }, 1000) as ReturnType<typeof setInterval>;

    return session;
  },

  getBodyDoubleRemaining(): number | null {
    if (!this.bodyDoubleEndTime) return null;
    const remaining = this.bodyDoubleEndTime - Date.now();
    if (remaining <= 0) return null;
    return Math.ceil(remaining / 1000);
  },

  endBodyDouble(sessionId: string, completed: boolean = false): void {
    if (this.bodyDoubleTimer) {
      clearInterval(this.bodyDoubleTimer);
      this.bodyDoubleTimer = null;
    }
    this.bodyDoubleEndTime = null;

    if (!State.data) return;
    const session = State.data.bodyDoubleHistory.find(
      (s) => s.id === sessionId,
    );
    if (session) {
      session.completed = completed;
      session.completedAt = completed ? new Date().toISOString() : null;
      session.endedAt = new Date().toISOString();
      State.save();
    }

    if (completed) {
      callbacks.onShowToast?.(
        "Body double session complete! Great focus! 🎉",
        "success",
      );
    }
  },

  // Break reminders for hyperfocus protection
  startBreakReminder(): void {
    if (!State.data) return;
    const interval =
      ND_CONFIG.BREAK_INTERVALS[State.data.preferences.nd.breakReminder];
    if (!interval) return;

    if (this.breakTimer) {
      clearInterval(this.breakTimer);
      this.breakTimer = null;
    }

    this.breakTimer = setInterval(
      () => {
        this.showBreakReminder();
      },
      interval * 60 * 1000,
    ) as ReturnType<typeof setInterval>;
  },

  showBreakReminder(): void {
    const messages = [
      "Time for a break! Stretch, hydrate, or look at something far away.",
      "Break time! Your brain needs a reset. Step away for 5 minutes.",
      "Pause check: Have you moved your body recently?",
      "Hydration check! Grab some water.",
      "Screen break time. Rest your eyes for a moment.",
    ];
    const message = messages[Math.floor(Math.random() * messages.length)];
    callbacks.onShowToast?.(message, "info");
  },

  // Get a random initiation prompt
  getInitiationPrompt(): string {
    const prompts = ND_CONFIG.INITIATION_PROMPTS;
    return prompts[Math.floor(Math.random() * prompts.length)];
  },

  // Get a permission slip for perfectionism
  getPermissionSlip(): string {
    const slips = ND_CONFIG.PERMISSION_SLIPS;
    return slips[Math.floor(Math.random() * slips.length)];
  },

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
  },

  // Helper to conditionally show emoji or symbol based on user preference
  icon(emojiChar: string, symbolChar: string = ""): string {
    if (State.data?.preferences?.nd?.reduceEmojis) {
      return symbolChar;
    }
    return emojiChar;
  },

  // Get category display (emoji or symbol based on preference)
  getCategoryIcon(categoryKey: string): string {
    const categories = CONFIG.CATEGORIES as Record<string, { emoji: string; symbol: string; label: string; color: string }>;
    const cat = categories[categoryKey];
    if (!cat) return "";
    return this.icon(cat.emoji, cat.symbol);
  },

  // Get status display (emoji or symbol based on preference)
  getStatusIcon(statusKey: string): string {
    const statuses = CONFIG.STATUSES as Record<string, { emoji: string; symbol: string; label: string; color: string }>;
    const status = statuses[statusKey];
    if (!status) return "";
    return this.icon(status.emoji, status.symbol);
  },

  // Get priority display (emoji or symbol based on preference)
  getPriorityIcon(priorityKey: string): string {
    const priorities = CONFIG.PRIORITIES as Record<string, { emoji: string; symbol: string; label: string; color: string }>;
    const priority = priorities[priorityKey];
    if (!priority) return "";
    return this.icon(priority.emoji, priority.symbol);
  },

  // Get achievement display (emoji or symbol based on preference)
  getAchievementIcon(achievementKey: string): string {
    const achievements = CONFIG.ACHIEVEMENTS as Record<string, { emoji: string; symbol: string; label: string; desc: string }>;
    const achievement = achievements[achievementKey];
    if (!achievement) return "";
    return this.icon(achievement.emoji, achievement.symbol);
  },

  // Check for upcoming deadline transitions
  checkTransitionWarnings(): void {
    if (!State.data || !State.data.preferences.nd.transitionWarnings) return;

    const goals = Goals.getAll();
    const now = new Date();

    goals.forEach((goal) => {
      if (goal.dueDate && goal.status !== "done") {
        const due = new Date(goal.dueDate);
        const hoursUntil = (due.getTime() - now.getTime()) / (1000 * 60 * 60);

        if (hoursUntil <= 24 && hoursUntil > 0) {
          callbacks.onShowToast?.(
            `⏰ "${goal.title}" is coming up in less than 24 hours.`,
            "warning",
          );
        }
      }
    });
  },

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
  },

  // Show brain dump modal
  showBrainDumpModal() {
    const existingModal = document.querySelector(".brain-dump-modal");
    if (existingModal) existingModal.remove();

    const brainDump = this.getBrainDump();
    const unprocessed = brainDump.filter((i) => !i.processed);

    const modal = document.createElement("div");
    modal.className = "modal-overlay active brain-dump-modal";
    modal.innerHTML = `
        <div class="modal modal-lg">
          <div class="modal-header">
            <h2 class="modal-title">Brain Dump</h2>
            <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
          </div>
          <div class="modal-body">
            <p class="brain-dump-intro">Got thoughts bouncing around? Dump them here. Get them out of your head so you can focus.</p>
            <div class="add-thought">
              <textarea id="brainDumpInput" placeholder="What's on your mind? Type it out and let it go..." rows="3"></textarea>
              <button class="btn btn-primary" id="addThoughtBtn">Dump it</button>
            </div>
            <div class="brain-dump-list">
              <h3>Parked thoughts (${unprocessed.length})</h3>
              ${unprocessed.length === 0 ? '<p class="empty-state">Your mind is clear!</p>' : ""}
              ${unprocessed
        .map(
          (item) => `
                <div class="brain-dump-item" data-id="${item.id}">
                  <p class="thought-text">${(callbacks.onEscapeHtml ?? ((x: string) => x))(item.text)}</p>
                  <div class="thought-actions">
                      <button class="btn btn-sm btn-ghost" data-action="convert">Make milestone</button>
                    <button class="btn btn-sm btn-ghost" data-action="dismiss">Dismiss</button>
                  </div>
                </div>
              `,
        )
        .join("")}
            </div>
          </div>
        </div>
      `;

    document.body.appendChild(modal);

    // Event listeners
    const addBtn = document.getElementById("addThoughtBtn");
    if (addBtn) {
      addBtn.addEventListener("click", () => {
        const input = document.getElementById("brainDumpInput") as HTMLInputElement | null;
        if (input) {
          const text = input.value.trim();
          if (text) {
            this.addToBrainDump(text);
            input.value = "";
            this.showBrainDumpModal(); // Refresh
            callbacks.onShowToast?.("Thought parked!", "success");
          }
        }
      });
    }

    modal.querySelectorAll(".thought-actions button").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const target = e.target as HTMLElement;
        const item = target.closest(".brain-dump-item") as HTMLElement | null;
        if (!item) return;
        const id = item.dataset.id;
        const action = target.dataset.action;

        if (action === "convert" && id) {
          const thought = brainDump.find((i) => i.id === id);
          if (thought) {
            this.processBrainDumpItem(id, "converted");
            callbacks.onOpenGoalModal?.("milestone", State.viewingMonth, State.viewingYear);
            setTimeout(() => {
              const titleInput = document.getElementById("goalTitle") as HTMLInputElement | null;
              if (titleInput) {
                titleInput.value = thought.text;
              }
            }, 100);
          }
        } else if (action === "dismiss" && id) {
          this.processBrainDumpItem(id, "dismissed");
          this.showBrainDumpModal(); // Refresh
        }

        modal.remove();
      });
    });

    // Close on backdrop click
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.remove();
    });
  },

  // Show dopamine menu for low motivation
  showDopamineMenu() {
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
  },

  handleDopamineChoice(index: number) {
    const actions = [
      () => callbacks.onShowToast?.("Find your easiest task and check it off!", "info"),
      () => callbacks.onShowToast?.("Pick one intention to return to today.", "info"),
      () => this.showBrainDumpModal(),
      () => callbacks.onShowToast?.("Pick any intention and adjust it a little.", "info"),
      () =>
        callbacks.onShowToast?.(
          "Add a note to any intention — even just “thinking about this”",
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
  },

  // Show ND settings panel
  showSettingsPanel() {
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
  },

  // Appearance (theme + accent + accessibility)
  showAppearancePanel() {
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
  },

  // Show body double timer modal
  showBodyDoubleModal() {
    const remaining = this.getBodyDoubleRemaining();

    if (remaining) {
      // Show active timer
      const mins = Math.floor(remaining / 60);
      const secs = remaining % 60;
      callbacks.onShowToast?.(
        `Body double active: ${mins}:${secs.toString().padStart(2, "0")} remaining`,
        "info",
      );
      return;
    }

    const modal = document.createElement("div");
    modal.className = "modal-overlay active body-double-modal";
    modal.innerHTML = `
        <div class="modal">
          <div class="modal-header">
            <h2 class="modal-title">Body Double Timer</h2>
            <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
          </div>
          <div class="modal-body">
            <p class="body-double-intro">Body doubling helps with focus! Pick a duration and work alongside the timer.</p>
            <div class="body-double-options">
              ${ND_CONFIG.BODY_DOUBLE_DURATIONS.map(
      (mins) => `
                <button class="body-double-option" data-minutes="${mins}">
                  <span class="bd-time">${mins}</span>
                  <span class="bd-label">minutes</span>
                </button>
              `,
    ).join("")}
            </div>
            <div class="body-double-tip">
              <p><strong>Tip:</strong> Tell someone you're starting, or imagine a supportive friend working beside you.</p>
            </div>
          </div>
        </div>
      `;

    document.body.appendChild(modal);

    modal.querySelectorAll(".body-double-option").forEach((btn) => {
      btn.addEventListener("click", (e: Event) => {
        const target = e.currentTarget as HTMLElement;
        if (!target) return;
        const minutes = parseInt(target.dataset.minutes || '0');
        this.startBodyDouble(minutes);
        modal.remove();
        callbacks.onShowToast?.(
          `Body double started! ${minutes} minutes of focus time.`,
          "success",
        );
      });
    });

    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.remove();
    });
  },

  // Show "What's blocking you?" helper
  showBlockerHelper(goalId: string) {
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
  },

  // Show initiation prompt for starting a task
  showInitiationPrompt(goalTitle: string) {
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
  },
};


// Streak Management is now handled by the core/Streaks module
