// ===================================
// UI Manager - Main UI Orchestration
// ===================================
import { State } from '../core/State';
import { Goals } from '../core/Goals';
import { Planning } from '../core/Planning';
import { Streaks } from '../core/Streaks';
import { NDSupport } from '../features/NDSupport';
import { AppSettings } from '../features/AppSettings';
import { CONFIG, ND_CONFIG, VIEWS } from '../config';
import { TimeBreakdown } from '../utils/TimeBreakdown';
import { cacheElements } from './elements/UIElements';
import { Toast } from './feedback/Toast';
import { Celebration } from './feedback/Celebration';
import { MonthRenderer, WeekRenderer, HomeRenderer } from './renderers';
import { DayViewController } from '../components/dayView/DayViewController';
import { ThemeManager } from '../theme/ThemeManager';
import type { UIElements, FilterDocListeners, ViewType, Goal, GoalLevel, Category, Priority, AccentTheme, Subtask, GoalStatus } from '../types';

export const UI = {
  els: {}, // Shortcut reference for elements
  elements: {} as UIElements, // Will be populated by cacheElements
  dayViewController: null as DayViewController | null, // New day view controller
  _filterDocListeners: null as FilterDocListeners | null, // For managing document event listeners
  _focusRevealSetup: false, // Whether focus reveal has been initialized
  _focusRevealHideTimer: null as ReturnType<typeof setTimeout> | null, // Timer for hiding focus reveal
  _supportPanelHideTimer: null as ReturnType<typeof setTimeout> | null,
  _mobileMql: null as MediaQueryList | null,
  _mobileModeSetup: false,
  _initialMobileDefaultsApplied: false,
  _lastNavKey: null as string | null,
  _renderRaf: null as number | null,
  _pendingViewTransition: false,
  _scrollResetRaf: null as number | null,
  _mobileLayoutRaf: null as number | null,
  goalModalYear: null as number | null, // Year selected in goal modal
  goalModalLevel: "milestone" as GoalLevel, // Level of goal being created in goal modal
  isMobileViewport(): boolean {
    if (this._mobileMql) return this._mobileMql.matches;
    return window.matchMedia("(max-width: 600px)").matches;
  },

  setupViewportMode() {
    if (this._mobileModeSetup) return;
    this._mobileModeSetup = true;

    this._mobileMql = window.matchMedia("(max-width: 600px)");

    const apply = () => {
      const isMobile = this.isMobileViewport();
      document.body.classList.toggle("is-mobile", isMobile);
      this.syncMobileDateNavPlacement(isMobile);

      // Show/hide mobile support panel button
      const mobileSupportBtn = document.getElementById("supportPanelToggleBtnMobile");
      if (mobileSupportBtn) {
        if (isMobile) {
          mobileSupportBtn.removeAttribute("hidden");
        } else {
          mobileSupportBtn.setAttribute("hidden", "");
        }
      }

      // First-load defaults: mobile always starts on Home view.
      // (We don't persist this so desktop preferences don't get overwritten.)
      if (isMobile && !this._initialMobileDefaultsApplied) {
        this._initialMobileDefaultsApplied = true;
        document.body.classList.add("mobile-home-view");
        State.currentView = VIEWS.HOME;
      }

      // Recalculate canvas dimensions on orientation change
      if (this.elements.canvasContainer) {
        // Force a reflow to recalculate dimensions
        void this.elements.canvasContainer.offsetHeight;
        // Re-render current view to adjust to new dimensions
        this.renderCurrentView();
      }

      this.updateMobileLayoutVars();
    };

    apply();

    // Keep body class in sync on resize/orientation change.
    const mql = this._mobileMql;
    if (mql) {
      const onChange = () => apply();
      try {
        mql.addEventListener("change", onChange);
      } catch {
        // Safari < 14
        mql.addListener(onChange);
      }
    }

    // Handle orientation changes explicitly
    window.addEventListener("orientationchange", () => {
      // Delay to allow browser to update viewport
      setTimeout(() => {
        apply();
      }, 100);
    });

    // Also handle resize events as fallback
    window.addEventListener("resize", () => {
      apply();
    });
  },

  syncMobileDateNavPlacement(isMobile: boolean) {
    const dateNav = document.querySelector(".date-nav") as HTMLElement | null;
    const controlCenter = document.querySelector(".control-center") as HTMLElement | null;
    const headerSlot = document.getElementById("headerMobileNav") as HTMLElement | null;

    if (!dateNav || !controlCenter || !headerSlot) return;

    document.body.classList.toggle("mobile-date-nav-in-header", isMobile);
    headerSlot.setAttribute("aria-hidden", String(!isMobile));

    if (isMobile) {
      headerSlot.appendChild(dateNav);
    } else {
      controlCenter.appendChild(dateNav);
    }
  },

  updateMobileLayoutVars() {
    if (this._mobileLayoutRaf !== null) {
      cancelAnimationFrame(this._mobileLayoutRaf);
    }

    this._mobileLayoutRaf = requestAnimationFrame(() => {
      this._mobileLayoutRaf = null;

      const root = document.documentElement;
      const isMobile = this.isMobileViewport();

      if (!isMobile) {
        root.style.removeProperty("--mobile-tab-bar-height");
        root.style.removeProperty("--mobile-home-stats-height");
        return;
      }

      const tabBar = document.getElementById("mobileTabBar");
      const tabBarHeight = tabBar
        ? Math.round(tabBar.getBoundingClientRect().height)
        : 0;
      root.style.setProperty("--mobile-tab-bar-height", `${tabBarHeight}px`);

      const isMobileHomeView = document.body.classList.contains("mobile-home-view");
      const timeStats = document.querySelector(".time-stats") as HTMLElement | null;
      const statsHeight = isMobileHomeView && timeStats
        ? Math.round(timeStats.getBoundingClientRect().height)
        : 0;
      root.style.setProperty("--mobile-home-stats-height", `${statsHeight}px`);
    });
  },
  getCurrentLevel(): GoalLevel {
    switch (State.currentView) {
      case "year": return "vision";
      case "month": return "milestone";
      case "week": return "focus";
      case "day": return "intention";
      default: return "milestone";
    }
  },

  showQuickAdd() {
    const overlay = document.createElement("div");
    overlay.className = "quick-add-overlay";
    overlay.innerHTML = `
      <div class="quick-add-container">
        <div class="quick-add-header">
          <span class="quick-add-emoji">🌱</span>
          <span class="quick-add-label">Quick Intention</span>
        </div>
        <input type="text" id="quickAddInput" placeholder="What's one small thing for today?" autofocus>
        <div class="quick-add-tip">Press Enter to save • Esc to cancel</div>
      </div>
    `;

    document.body.appendChild(overlay);
    const input = overlay.querySelector("#quickAddInput") as HTMLInputElement;
    input.focus();

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && input.value.trim()) {
        this.saveQuickAdd(input.value.trim());
        overlay.remove();
      }
      if (e.key === "Escape") {
        overlay.remove();
      }
    });

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.remove();
    });
  },

  saveQuickAdd(title: string) {
    Goals.create({
      title,
      level: "intention",
      category: "personal",
      priority: "medium",
      month: new Date().getMonth(),
      year: new Date().getFullYear()
    });

    this.render();
    this.showToast("🌱", "Intention captured. Go for it!");
    this.celebrate("✨", "Captured!", "Focus on this one thing.");
  },

  openZenFocus(goalId: string) {
    const goal = Goals.getById(goalId);
    if (!goal) return;

    const overlay = document.createElement("div");
    overlay.className = "zen-focus-overlay";

    const cat = goal.category ? CONFIG.CATEGORIES[goal.category] : null;
    const levelInfo = CONFIG.LEVELS[goal.level] || CONFIG.LEVELS.intention;

    overlay.innerHTML = `
	      <div class="zen-focus-container">
	        <button class="zen-close-btn">×</button>

	        <div class="zen-header">
	          <div class="zen-level-badge">
	            <span class="zen-emoji">${levelInfo.emoji}</span>
	            <span class="zen-label">${levelInfo.label}</span>
          </div>
          ${cat ? `<div class="zen-category" style="color: ${cat.color}">${cat.emoji} ${cat.label}</div>` : ""}
        </div>

        <h1 class="zen-title">${this.escapeHtml(goal.title)}</h1>
        ${goal.description ? `<p class="zen-desc">${this.escapeHtml(goal.description)}</p>` : ""}

        <div class="zen-subtasks">
          ${goal.subtasks.length > 0 ? `
            <h3>Action Steps</h3>
            <div class="zen-subtask-list">
              ${goal.subtasks.map((s, idx) => `
                <div class="zen-subtask-item ${s.done ? 'done' : ''}" data-idx="${idx}">
                  <div class="zen-subtask-checkbox ${s.done ? 'checked' : ''}"></div>
                  <span>${this.escapeHtml(s.title)}</span>
                </div>
              `).join('')}
            </div>
          ` : `
            <div class="zen-empty-subtasks">Focus on the big picture.</div>
          `}
        </div>

        <div class="zen-footer">
          <button class="zen-complete-btn ${goal.status === 'done' ? 'completed' : ''}">
            ${goal.status === 'done' ? '✅ Completed' : '✨ Mark as Done'}
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Event handlers
    overlay.querySelector(".zen-close-btn")?.addEventListener("click", () => overlay.remove());
    overlay.querySelectorAll(".zen-subtask-item").forEach(item => {
      item.addEventListener("click", () => {
        const idx = parseInt((item as HTMLElement).dataset.idx || "0");
        goal.subtasks[idx].done = !goal.subtasks[idx].done;
        State.save();
        this.render();
        this.openZenFocus(goalId); // Re-render zen view
        overlay.remove();
        this.showToast("💎", "Step completed!");
      });
    });

    overlay.querySelector(".zen-complete-btn")?.addEventListener("click", () => {
      goal.status = goal.status === 'done' ? 'in-progress' : 'done';
      State.save();
      this.render();
      overlay.remove();
      if (goal.status === 'done') {
        this.celebrate("🏆", "Level Up!", `Finished: ${goal.title}`);
      }
    });
  },

  updateSyncStatus(status: 'syncing' | 'synced' | 'error' | 'local'): void {
    const el = document.getElementById("syncStatus");
    const supportPanelEl = document.getElementById("supportPanelSyncStatus");

    const updateElement = (element: HTMLElement | null) => {
      if (!element) return;
      const icon = element.querySelector(".sync-icon");
      const text = element.querySelector(".sync-text");

      element.classList.remove("syncing", "synced", "error");

      if (status === 'syncing') {
        element.classList.add("syncing");
        if (icon) icon.textContent = "⏳";
        if (text) text.textContent = "Syncing...";
      } else if (status === 'synced') {
        element.classList.add("synced");
        if (icon) icon.textContent = "✅";
        if (text) text.textContent = "Cloud Saved";
        // Revert to subtle synced look after 3s
        setTimeout(() => {
          if (icon && element.classList.contains("synced")) icon.textContent = "☁️";
          if (text && element.classList.contains("synced")) text.textContent = "Synced";
        }, 3000);
      } else if (status === 'error') {
        element.classList.add("error");
        if (icon) icon.textContent = "❌";
        if (text) text.textContent = "Sync Error";
      } else {
        if (icon) icon.textContent = "☁️";
        if (text) text.textContent = "Local Only";
      }
    };

    // Update both elements
    updateElement(el);
    updateElement(supportPanelEl);
  },

  init() {
    this.cacheElements();
    this.els = this.elements; // Alias for convenience
    this.bindEvents();
    this.setupViewportMode();
    this.applySavedUIState();
    this.render();
    this.updateTimeDisplay();
    this.updateYearProgress();
    this.renderAchievements();

    // Initialize ND Support features
    NDSupport.init();

    // Set up periodic updates
    setInterval(() => this.updateTimeDisplay(), 60000);

    // Update body double timer display
    setInterval(() => this.updateBodyDoubleDisplay(), 1000);

    // Check for weekly review prompt
    if (Planning.shouldPromptReview()) {
      setTimeout(() => this.showReviewPrompt(), 3000);
    }
  },

  // Update body double timer display
  updateBodyDoubleDisplay() {
    const remaining = NDSupport.getBodyDoubleRemaining();
    const display = document.getElementById("bodyDoubleDisplay");
    const timer = document.getElementById("bdTimer");

    if (remaining && display && timer) {
      const mins = Math.floor(remaining / 60);
      const secs = remaining % 60;
      timer.textContent = `${mins}:${secs.toString().padStart(2, "0")}`;
      display.removeAttribute("hidden");
    } else if (display) {
      display.setAttribute("hidden", "");
    }
  },

  cacheElements() {
    this.elements = cacheElements();
  },

  bindEvents() {
    // View switcher (desktop)
    document.querySelectorAll(".view-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.body.classList.remove("mobile-home-view");
        State.setView((btn as HTMLElement).dataset.view as ViewType);
        this.syncViewButtons();
      });
    });

    // Mobile tab bar
    // Mobile tab bar
    document.querySelectorAll(".mobile-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        const view = (tab as HTMLElement).dataset.view;
        State.setView(view as ViewType);
        this.syncViewButtons();
        this.updateMobileLayoutVars();
      });
    });

    // Date navigation
    document
      .getElementById("navPrev")
      ?.addEventListener("click", () => State.navigate(-1));
    document
      .getElementById("navNext")
      ?.addEventListener("click", () => State.navigate(1));
    document.getElementById("navToday")?.addEventListener("click", () => {
      State.goToDate(new Date());
      this.render();
    });

    // Support tools side panel (drawer)
    document
      .getElementById("supportPanelBtn")
      ?.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.openSupportPanel();
      });

    // Support panel toggle buttons (desktop and mobile)
    const supportPanelToggleBtn = document.getElementById("supportPanelToggleBtn");
    const supportPanelToggleBtnMobile = document.getElementById("supportPanelToggleBtnMobile");

    supportPanelToggleBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.openSupportPanel();
    });

    supportPanelToggleBtnMobile?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.openSupportPanel();
    });
    document
      .getElementById("supportPanelClose")
      ?.addEventListener("click", () => this.closeSupportPanel());
    document
      .getElementById("supportPanelOverlay")
      ?.addEventListener("click", (e) => {
        if (e.target === e.currentTarget) this.closeSupportPanel();
      });
    document
      .getElementById("supportPanel")
      ?.addEventListener("click", (e) => {
        const target = e.target as Element | null;
        const actionEl = target?.closest("[data-action]") as HTMLElement | null;
        const action = actionEl?.dataset.action;
        if (!action) return;

        this.closeSupportPanel();

        switch (action) {
          case "brainDump":
            NDSupport.showBrainDumpModal();
            break;
          case "bodyDouble":
            NDSupport.showBodyDoubleModal();
            break;
          case "quickWins":
            NDSupport.showDopamineMenu();
            break;
          case "ndSettings":
            NDSupport.showSettingsPanel();
            break;
          case "settings":
            AppSettings.showPanel();
            break;
        }
      });

    // Handle collapsible section toggles
    document.addEventListener("click", (e) => {
      const target = e.target as Element | null;
      const toggle = target?.closest("[data-toggle]") as HTMLElement | null;
      if (!toggle) return;

      const sectionId = toggle.dataset.toggle;
      const content = document.querySelector(`[data-section="${sectionId}"]`);

      if (content) {
        const isExpanded = toggle.getAttribute("aria-expanded") === "true";
        toggle.setAttribute("aria-expanded", String(!isExpanded));
        content.classList.toggle("expanded");
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      const overlay = document.getElementById("supportPanelOverlay");
      if (!overlay || overlay.hasAttribute("hidden")) return;
      this.closeSupportPanel();
    });

    // Legacy year navigation (fallback)
    document
      .getElementById("prevYear")
      ?.addEventListener("click", () => this.changeYear(-1));
    document
      .getElementById("nextYear")
      ?.addEventListener("click", () => this.changeYear(1));

    // Add Goal Button
    document
      .getElementById("addGoalBtn")
      ?.addEventListener("click", () =>
        this.openGoalModal(this.getCurrentLevel(), State.viewingMonth, State.viewingYear),
      );

    // Modal controls
    document
      .getElementById("closeModal")
      ?.addEventListener("click", () => this.closeGoalModal());
    document
      .getElementById("cancelModal")
      ?.addEventListener("click", () => this.closeGoalModal());
    document.getElementById("goalModal")?.addEventListener("click", (e) => {
      if ((e.target as HTMLElement)?.id === "goalModal") this.closeGoalModal();
    });

    // Goal form submission
    this.elements.goalForm?.addEventListener("submit", (e: Event) =>
      this.handleGoalSubmit(e),
    );

    // Level context bar interactions (Vision/Milestone/Focus/Intention)
    this.elements.levelContextBar?.addEventListener("click", (e) => {
      const target = e.target as Element | null;
      if (!target) return;

      const goalEl = target.closest("[data-goal-id]") as HTMLElement | null;
      const goalId = goalEl?.dataset.goalId;
      if (goalId) {
        this.showGoalDetail(goalId);
        return;
      }

      const addEl = target.closest('[data-action="add-level"]') as HTMLElement | null;
      const level = addEl?.dataset.level as GoalLevel | undefined;
      if (!level) return;
      this.openGoalModal(level, State.viewingMonth, State.viewingYear);
    });

    // Zoom controls
    document
      .getElementById("zoomIn")
      ?.addEventListener("click", () => this.zoom(10));
    document
      .getElementById("zoomOut")
      ?.addEventListener("click", () => this.zoom(-10));

    // Focus mode
    document
      .getElementById("focusModeBtn")
      ?.addEventListener("click", () => this.toggleFocusMode());
    document
      .getElementById("focusToggle")
      ?.addEventListener("click", () => this.toggleFocusMode());
    document
      .getElementById("supportPanelFocusToggle")
      ?.addEventListener("click", () => this.toggleFocusMode());

    // Support panel appearance controls
    document
      .getElementById("supportPanelThemeToggle")
      ?.addEventListener("click", () => {
        if (!State.data) return;
        const current = ThemeManager.resolveTheme(State.data.preferences.theme);
        const next = current === "night" ? "day" : "night";
        State.data.preferences.theme = next;
        ThemeManager.applyFromPreference(next);
        State.save();
        this.syncSupportPanelAppearanceControls();
      });

    const supportPanelThemePicker = document.getElementById(
      "supportPanelThemePicker",
    );
    supportPanelThemePicker?.addEventListener("click", (e) => {
      const target = e.target as Element | null;
      const swatch = target?.closest(".theme-swatch") as HTMLElement | null;
      if (!swatch || !supportPanelThemePicker.contains(swatch)) return;
      const selectedTheme = swatch.dataset.theme as AccentTheme | undefined;
      if (!selectedTheme || !State.data) return;

      State.data.preferences.nd = {
        ...State.data.preferences.nd,
        accentTheme: selectedTheme,
      };
      State.save();
      NDSupport.applyAccessibilityPreferences();
      this.syncSupportPanelAppearanceControls();
    });

    // Layout visibility shortcuts
    document.getElementById("hideSidebarBtn")?.addEventListener("click", () => {
      if (!State.data) return;
      State.data.preferences.layout = {
        ...(State.data.preferences.layout || {}),
        showSidebar: false,
      };
      State.save();
      this.applyLayoutVisibility();
    });

    document.getElementById("sidebarHandle")?.addEventListener("click", () => {
      if (!State.data) return;
      State.data.preferences.layout = {
        ...(State.data.preferences.layout || {}),
        showSidebar: true,
      };
      State.save();
      this.applyLayoutVisibility();
    });

    // Settings
    document
      .getElementById("appSettingsBtn")
      ?.addEventListener("click", () => AppSettings.showPanel());

    // Affirmation click
    document
      .getElementById("affirmationPanel")
      ?.addEventListener("click", () => this.showRandomAffirmation());

    // Pick random goal
    document
      .getElementById("pickOneBtn")
      ?.addEventListener("click", () => this.pickRandomGoal());

    // Celebration close
    document
      .getElementById("closeCelebration")
      ?.addEventListener("click", () => this.closeCelebration());

    // Keyboard shortcuts
    document.addEventListener("keydown", (e) => this.handleKeyboard(e));

    // Canvas pan and zoom
    this.setupCanvasInteraction();

    // ND Support button bindings
    document
      .getElementById("brainDumpBtn")
      ?.addEventListener("click", () => NDSupport.showBrainDumpModal());
    document
      .getElementById("bodyDoubleBtn")
      ?.addEventListener("click", () => NDSupport.showBodyDoubleModal());
    document
      .getElementById("ndSettingsBtn")
      ?.addEventListener("click", () => NDSupport.showSettingsPanel());
    document
      .getElementById("appearanceBtn")
      ?.addEventListener("click", () => NDSupport.showAppearancePanel());
    document
      .getElementById("dopamineMenuBtn")
      ?.addEventListener("click", () => NDSupport.showDopamineMenu());

    // Body double stop button
    document.getElementById("bdStop")?.addEventListener("click", () => {
      if (!State.data) return;
      const sessions = State.data.bodyDoubleHistory;
      const active = sessions[sessions.length - 1];
      if (active && !active.endedAt) {
        NDSupport.endBodyDouble(active.id, false);
        document
          .getElementById("bodyDoubleDisplay")
          ?.setAttribute("hidden", "");
      }
    });

    // Affirmation panel keyboard accessibility
    document
      .getElementById("affirmationPanel")
      ?.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          this.showRandomAffirmation();
        }
      });
  },

  openSupportPanel() {
    const overlay = document.getElementById("supportPanelOverlay");
    if (!overlay) return;
    if (this._supportPanelHideTimer) {
      clearTimeout(this._supportPanelHideTimer);
      this._supportPanelHideTimer = null;
    }
    this.syncSupportPanelAppearanceControls();
    overlay.removeAttribute("hidden");
    overlay.classList.add("active");
    document.body.classList.add("support-panel-open");
    (document.getElementById("supportPanelClose") as HTMLElement | null)?.focus();
  },

  closeSupportPanel() {
    const overlay = document.getElementById("supportPanelOverlay");
    if (!overlay) return;
    overlay.classList.remove("active");
    document.body.classList.remove("support-panel-open");
    if (this._supportPanelHideTimer) clearTimeout(this._supportPanelHideTimer);
    this._supportPanelHideTimer = setTimeout(() => {
      overlay.setAttribute("hidden", "");
      this._supportPanelHideTimer = null;
    }, 220);
  },

  setupCanvasInteraction() {
    let isDragging = false;
    let startX: number, startY: number, scrollLeft: number, scrollTop: number;

    const container = this.elements.canvasContainer;
    if (!container) return;

    // Helper to check if target should allow panning
    const shouldAllowPan = (target: Element | null): boolean => {
      if (!target) return false;
      return !(
        target.closest(".month-card") ||
        target.closest(".goal-item") ||
        target.closest(".day-goal-card") ||
        target.closest("button") ||
        target.closest("input") ||
        target.closest("select") ||
        target.closest("textarea") ||
        target.closest(".modal") ||
        target.closest(".header-more-dropdown") ||
        target.closest(".support-panel")
      );
    };

    // Mouse events (desktop)
    container.addEventListener("mousedown", (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (!shouldAllowPan(target)) return;
      isDragging = true;
      container.classList.add("grabbing");
      startX = e.pageX - container.offsetLeft;
      startY = e.pageY - container.offsetTop;
      scrollLeft = container.scrollLeft;
      scrollTop = container.scrollTop;
    });

    container.addEventListener("mouseleave", () => {
      isDragging = false;
      container.classList.remove("grabbing");
    });

    container.addEventListener("mouseup", () => {
      isDragging = false;
      container.classList.remove("grabbing");
    });

    container.addEventListener("mousemove", (e: MouseEvent) => {
      if (!isDragging) return;
      e.preventDefault();
      const x = e.pageX - container.offsetLeft;
      const y = e.pageY - container.offsetTop;
      const walkX = (x - startX) * 1.5;
      const walkY = (y - startY) * 1.5;
      container.scrollLeft = scrollLeft - walkX;
      container.scrollTop = scrollTop - walkY;
    });

    // Mouse wheel zoom (non-passive because we conditionally preventDefault)
    container.addEventListener("wheel", (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        this.zoom(e.deltaY < 0 ? 10 : -10);
      }
    }, { passive: false });
  },

  scheduleRender(opts?: { transition?: boolean }) {
    if (opts?.transition) this._pendingViewTransition = true;
    if (this._renderRaf !== null) return;

    this._renderRaf = window.requestAnimationFrame(() => {
      this._renderRaf = null;
      const useViewTransition = this._pendingViewTransition;
      this._pendingViewTransition = false;

      const doc = document as unknown as {
        startViewTransition?: (cb: () => void) => void;
      };

      if (useViewTransition && typeof doc.startViewTransition === "function") {
        doc.startViewTransition(() => {
          this.render();
        });
        return;
      }

      this.render();
    });
  },

  render() {
    if (this._renderRaf !== null) {
      cancelAnimationFrame(this._renderRaf);
      this._renderRaf = null;
      this._pendingViewTransition = false;
    }

    const navKey = (() => {
      const year = State.viewingYear;
      const month = State.viewingMonth;
      const week = State.viewingWeek;
      const day = State.viewingDate ? State.viewingDate.toISOString().slice(0, 10) : "";

      switch (State.currentView) {
        case VIEWS.YEAR:
          return `year:${year}`;
        case VIEWS.MONTH:
          return `month:${year}-${month}`;
        case VIEWS.WEEK:
          return `week:${year}-${week}`;
        case VIEWS.DAY:
          return `day:${day}`;
        default:
          return `${State.currentView}:${day}`;
      }
    })();

    const shouldResetScroll = navKey !== this._lastNavKey;
    this._lastNavKey = navKey;

    // Mobile Day view should be readable at default scale; reset zoom only when navigating.
    if (
      shouldResetScroll &&
      this.isMobileViewport() &&
      State.currentView === VIEWS.DAY &&
      State.zoom !== 100
    ) {
      State.zoom = 100;
      if (this.elements.canvas) {
        this.elements.canvas.style.transform = `scale(${State.zoom / 100})`;
      }
      if (this.elements.zoomLevel) {
        this.elements.zoomLevel.textContent = `${State.zoom}%`;
      }
    }

    this.renderCurrentView();
    this.renderLevelContextBar();
    this.renderCategoryFilters();
    this.renderUpcomingGoals();
    this.updateDateDisplay();
    this.updateYearProgress();
    Streaks.check();
    this.updateStreakDisplay();
    this.updateYearProgress();
    Streaks.check();
    this.updateStreakDisplay();

    // Mobile Home View Logic
    const mobileHomeView = document.getElementById("mobileHomeView");
    if (State.currentView === VIEWS.HOME) {
      document.body.classList.add("mobile-home-view");
      if (mobileHomeView) mobileHomeView.removeAttribute("hidden");
      this.updateMobileHomeView();
    } else {
      document.body.classList.remove("mobile-home-view");
      if (mobileHomeView) mobileHomeView.setAttribute("hidden", "");
    }

    this.updateMobileLayoutVars();

    if (shouldResetScroll) {
      if (this._scrollResetRaf !== null) {
        cancelAnimationFrame(this._scrollResetRaf);
      }

      this._scrollResetRaf = requestAnimationFrame(() => {
        this._scrollResetRaf = null;
        const canvasContainer = this.elements.canvasContainer;
        if (canvasContainer) {
          canvasContainer.scrollTop = 0;
          canvasContainer.scrollLeft = 0;
        }

        const appEl = document.querySelector(".app") as HTMLElement | null;
        if (appEl) appEl.scrollTop = 0;

        const scrollingElement = document.scrollingElement as HTMLElement | null;
        if (scrollingElement) scrollingElement.scrollTop = 0;
      });
    }
  },

  updateMobileHomeView() {
    HomeRenderer.render(this.elements, this.escapeHtml.bind(this), (goalId) => this.showGoalDetail(goalId));
  },

  // Render based on current view
  renderCurrentView() {
    const container = this.elements.calendarGrid;
    if (!container) {
      console.error("renderCurrentView: calendarGrid element not found! Current view:", State.currentView);
      return;
    }
    console.log("renderCurrentView: rendering view", State.currentView);

    // Update view button states
    this.syncViewButtons();

    if (State.currentView !== VIEWS.DAY && this.dayViewController) {
      this.dayViewController.unmount();
      this.dayViewController = null;
    }

    switch (State.currentView) {
      case VIEWS.YEAR:
        this.renderCalendar();
        break;
      case VIEWS.MONTH:
        this.renderMonthView();
        break;
      case VIEWS.WEEK:
        this.renderWeekView();
        break;
      case VIEWS.DAY:
        this.renderDayView();
        break;
      case VIEWS.HOME:
        // Do nothing for main grid, overlay is handled in render()
        break;
      default:
        this.renderCalendar();
    }
  },

  renderLevelContextBar() {
    const container = this.elements.levelContextBar;
    if (!container) return;

    if (!State.data || State.currentView === VIEWS.HOME) {
      container.innerHTML = "";
      container.setAttribute("hidden", "");
      return;
    }

    const view = State.currentView;
    const now = new Date();
    const viewingDate = State.viewingDate ?? now;
    const viewingYear = State.viewingYear ?? viewingDate.getFullYear();
    const viewingMonth = State.viewingMonth ?? viewingDate.getMonth();

    const visibleLevels: GoalLevel[] = (() => {
      switch (view) {
        case VIEWS.YEAR:
          return ["vision", "milestone"];
        case VIEWS.MONTH:
          return ["vision", "milestone", "focus"];
        case VIEWS.WEEK:
          return ["vision", "milestone", "focus"];
        case VIEWS.DAY:
          return ["vision", "milestone", "focus", "intention"];
        default:
          return ["vision", "milestone"];
      }
    })();

    const goalsInRange = (() => {
      switch (view) {
        case VIEWS.YEAR: {
          const start = new Date(viewingYear, 0, 1);
          const end = new Date(viewingYear, 11, 31);
          return Goals.getForRange(start, end);
        }
        case VIEWS.MONTH:
          return Goals.getByMonth(viewingMonth, viewingYear);
        case VIEWS.WEEK: {
          const weekNum =
            State.viewingWeek ?? State.getWeekNumber(viewingDate);
          const weekStart = State.getWeekStart(viewingYear, weekNum);
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekEnd.getDate() + 6);
          return Goals.getForRange(weekStart, weekEnd);
        }
        case VIEWS.DAY:
          return Goals.getForDate(viewingDate);
        default:
          return Goals.getForDate(viewingDate);
      }
    })().filter((g) => g.status !== "done");

    const priorityRank: Record<Priority, number> = {
      urgent: 0,
      high: 1,
      medium: 2,
      low: 3,
    };

    const renderLevel = (level: GoalLevel) => {
      const levelCfg = CONFIG.LEVELS[level];
      const goals = goalsInRange
        .filter((g) => g.level === level)
        .slice()
        .sort((a, b) => {
          const pr = priorityRank[a.priority] - priorityRank[b.priority];
          if (pr !== 0) return pr;
          const upd = (b.updatedAt || "").localeCompare(a.updatedAt || "");
          if (upd !== 0) return upd;
          return a.title.localeCompare(b.title);
        });

      const shown = goals.slice(0, 2);
      const remaining = Math.max(0, goals.length - shown.length);

      const goalsHtml =
        shown.length > 0
          ? `
            <div class="level-context-goals">
              ${shown
                .map(
                  (g) =>
                    `<button type="button" class="level-context-goal" data-goal-id="${g.id}">${this.escapeHtml(g.title)}</button>`,
                )
                .join("")}
              ${remaining > 0 ? `<span class="level-context-goal level-context-more">+${remaining}</span>` : ""}
            </div>
          `
          : `<div class="level-context-empty">No ${levelCfg.label.toLowerCase()} set</div>`;

      return `
        <div class="level-context-item" data-level="${level}">
          <div class="level-context-header">
            <div class="level-context-label">
              <span aria-hidden="true">${levelCfg.emoji}</span>
              <span>${levelCfg.label}</span>
            </div>
            <button type="button" class="level-context-action" data-action="add-level" data-level="${level}">+ Add</button>
          </div>
          ${goalsHtml}
        </div>
      `;
    };

    container.innerHTML = visibleLevels.map(renderLevel).join("");
    container.removeAttribute("hidden");
  },

  // Update the date display based on current view
  updateDateDisplay() {
    const display = document.getElementById("dateDisplay");
    if (!display) return;

    const now = new Date();
    const isToday = State.viewingDate.toDateString() === now.toDateString();

    let text = "";
    switch (State.currentView) {
      case VIEWS.YEAR:
        text = State.viewingYear.toString();
        display.classList.toggle(
          "is-today",
          State.viewingYear === now.getFullYear(),
        );
        break;
      case VIEWS.MONTH:
        text = `${CONFIG.MONTHS[State.viewingMonth]} ${State.viewingYear}`;
        display.classList.toggle(
          "is-today",
          State.viewingMonth === now.getMonth() &&
          State.viewingYear === now.getFullYear(),
        );
        break;
      case VIEWS.WEEK:
        const weekStart = State.getWeekStart(
          State.viewingYear,
          State.viewingWeek || 1,
        );
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        text = `${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${weekEnd.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
        display.classList.toggle(
          "is-today",
          now >= weekStart && now <= weekEnd,
        );
        break;
      case VIEWS.DAY:
        text = State.viewingDate.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        });
        display.classList.toggle("is-today", isToday);
        break;
    }
    display.textContent = text;

    const isRedundant = true;
    display.classList.toggle("is-hidden", isRedundant);
    display.setAttribute("aria-hidden", isRedundant ? "true" : "false");
  },

  // Render Month View
  renderMonthView() {
    MonthRenderer.render(this.elements, this.escapeHtml.bind(this));
  },

  // Render Week View
  renderWeekView() {
    WeekRenderer.render(this.elements, this.escapeHtml.bind(this));
  },

  // Render Day View (New Modernized Implementation)
  renderDayView() {
    const container = this.elements.calendarGrid;
    if (!container) return;

    const date = State.viewingDate;
    const allGoals = State.data?.goals || [];

    // Force planner mode for Day View
    if (State.data && State.data.preferences.nd.dayViewStyle !== "planner") {
      State.data.preferences.nd.dayViewStyle = "planner";
      State.save();
    }

    // Initialize DayViewController if not already done
    if (!this.dayViewController) {
      this.dayViewController = new DayViewController(
        container,
        {
          onGoalUpdate: (goalId: string, updates: Partial<Goal>) => {
            Goals.update(goalId, updates);
            // Re-render to update the view
            if (this.dayViewController) {
              this.dayViewController.setGoals(State.viewingDate, State.data?.goals || []);
            }
          },
          onGoalClick: (goalId: string) => {
            this.showGoalDetail(goalId);
          },
          onZenFocus: (goalId: string) => {
            this.openZenFocus(goalId);
          },
          onShowToast: (emoji: string, message: string) => {
            this.showToast(emoji, message);
          },
          onCelebrate: (emoji: string, title: string, message: string) => {
            this.celebrate(emoji, title, message);
          },
          onPlantSomething: () => {
            this.showQuickAdd();
          },
          onGetPreference: (key: string) => {
            // Force planner style when asked
            if (key === "dayViewStyle") return "planner";
            return (State.data?.preferences.nd as any)[key];
          },
          onNavigate: (direction: number) => {
            State.navigate(direction);
          },
        },
        CONFIG,
      );

      // Mount the controller
      this.dayViewController.mount();
    }

    // Set goals and render
    this.dayViewController.setGoals(date, allGoals);

    // Remove old style toggle if present (we only use Planner mode now)
    this.ensureDayViewStyleToggle();
  },

  ensureDayViewStyleToggle() {
    const header = document.querySelector(".day-view-header");
    if (!header) return;

    // Remove any existing toggle
    const existing = header.querySelector(".day-style-toggle");
    if (existing) existing.remove();
  },

  // Render a single goal card for day view
  renderDayGoalCard(goal: Goal, opts?: { variant?: "planter" | "seed" | "compost"; style?: string }) {
    const cat = goal.category ? CONFIG.CATEGORIES[goal.category] : undefined;
    const isCompleted = goal.status === "done";
    const levelInfo = CONFIG.LEVELS[goal.level] || CONFIG.LEVELS.intention;
    const variant = opts?.variant ?? "seed";
    const variantClass =
      variant === "planter"
        ? "day-goal-variant-planter"
        : variant === "compost"
          ? "day-goal-variant-compost"
          : "day-goal-variant-seed";
    const styleAttr = opts?.style ? ` style="${opts.style}"` : "";
    const dragAttrs =
      variant === "seed" && !isCompleted
        ? ` draggable="true" aria-grabbed="false"`
        : variant === "planter" && !isCompleted
          ? ` draggable="true" aria-grabbed="false"`
          : "";

    const resizeHandles =
      variant === "planter" && !isCompleted
        ? `
          <div class="planter-resize-handle planter-resize-handle-top" data-resize="top"></div>
          <div class="planter-resize-handle planter-resize-handle-bottom" data-resize="bottom"></div>
        `
        : "";

    return `
      <div class="day-goal-card ${variantClass} ${isCompleted ? "completed" : ""}" data-goal-id="${goal.id}" role="button" tabindex="0"${styleAttr}${dragAttrs}>
        ${resizeHandles}
        <div class="day-goal-checkbox ${isCompleted ? "checked" : ""}"></div>
        <div class="day-goal-content">
          <div class="day-goal-level">
            <span class="day-goal-level-emoji">${levelInfo.emoji}</span>
            <span class="day-goal-level-label">${levelInfo.label}</span>
          </div>
          <div class="day-goal-title">${this.escapeHtml(goal.title)}</div>
          ${goal.description ? `<div class="day-goal-desc">${this.escapeHtml(goal.description)}</div>` : ""}
          <div class="day-goal-meta">
            ${goal.startTime ? `<span class="day-goal-time">🕒 ${goal.startTime}${goal.endTime ? ` - ${goal.endTime}` : ""}</span>` : ""}
            ${cat ? `<span class="day-goal-cat" style="color: ${cat.color}">${cat.emoji} ${cat.label}</span>` : ""}
            ${goal.priority !== "medium" ? `<span class="day-goal-priority priority-${goal.priority}">${CONFIG.PRIORITIES[goal.priority]?.symbol || ""} ${goal.priority}</span>` : ""}
            <button class="btn-zen-focus" title="Zen Focus Mode" data-goal-id="${goal.id}">👁️ Focus</button>
          </div>
        </div>
        ${goal.progress > 0 && goal.progress < 100
        ? `
            <div class="day-goal-progress">
              <div class="progress-bar-lg">
                <div class="progress-fill-lg" style="width: ${goal.progress}%"></div>
              </div>
            </div>
          `
        : ""
      }
      </div>
    `;
  },

  // Helper to render a simple goals list
  renderGoalsList(goals: Goal[]) {
    if (goals.length === 0) {
      return "";
    }
    return goals
      .map((g) => {
        const cat = g.category ? CONFIG.CATEGORIES[g.category] : undefined;
        return `
          <div class="goal-item ${g.status === "done" ? "completed" : ""}" data-goal-id="${g.id}">
            <div class="goal-checkbox ${g.status === "done" ? "checked" : ""}"></div>
            <div class="goal-content">
              <div class="goal-title">${this.escapeHtml(g.title)}</div>
              <div class="goal-tags">
                <span class="goal-tag">${cat?.emoji ?? ""} ${cat?.label ?? ""}</span>
              </div>
            </div>
          </div>
        `;
      })
      .join("");
  },

  changeYear(delta: number) {
    State.navigate(delta);
  },

  updateYearDisplay() {
    const currentYear = new Date().getFullYear();
    if (this.elements.yearDisplay) {
      this.elements.yearDisplay.textContent = String(State.viewingYear);
      this.elements.yearDisplay.classList.toggle(
        "current-year",
        State.viewingYear === currentYear,
      );
    }
  },

  renderCalendar() {
    const container = this.elements.calendarGrid;
    if (!container) {
      console.error("renderCalendar: calendarGrid element not found!");
      return;
    }
    console.log("renderCalendar: rendering calendar for year", State.viewingYear);

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const viewingYear = State.viewingYear;

    // Update year display
    this.updateYearDisplay();

    // Render year header + grid
    container.className = "year-view-container";
    container.innerHTML = "";

    const yearView = document.createElement("div");
    yearView.className = "year-view";

    const header = document.createElement("div");
    header.className = "year-view-header";
    header.innerHTML = `
      <h2 class="year-view-title">${viewingYear}</h2>
      <p class="year-view-subtitle">Your year as a garden of months</p>
    `;

    const grid = document.createElement("div");
    grid.className = "calendar-grid";

    yearView.appendChild(header);
    yearView.appendChild(grid);
    container.appendChild(yearView);
    console.log("renderCalendar: Created yearView structure, container children:", container.children.length);

    CONFIG.MONTHS.forEach((monthName, monthIndex) => {
      try {
        const card = this.createMonthCard(
          monthIndex,
          monthName,
          currentMonth,
          currentYear,
          viewingYear,
        );

        // Click handler to drill into month view
        card.addEventListener("click", (e) => {
          // Don't navigate if clicking on a goal item
          const target = e.target as Element | null;
          if (target?.closest(".goal-item")) return;
          State.viewingMonth = monthIndex;
          State.viewingYear = viewingYear;
          State.viewingDate = new Date(viewingYear, monthIndex, 1);
          State.setView(VIEWS.MONTH);
        });

        grid.appendChild(card);
      } catch (error) {
        console.error(`renderCalendar: Error creating card for ${monthName}:`, error);
      }
    });
    console.log("renderCalendar: Finished creating", CONFIG.MONTHS.length, "month cards, grid children:", grid.children.length);
  },

  createMonthCard(
    monthIndex: number,
    monthName: string,
    currentMonth: number,
    currentYear: number,
    viewingYear: number,
  ) {
    const card = document.createElement("div");
    card.className = "month-card";
    card.dataset.month = String(monthIndex);
    card.dataset.year = String(viewingYear);

    // Determine card state based on viewing year vs current year
    const isCurrentYear = viewingYear === currentYear;
    const isPastYear = viewingYear < currentYear;
    const isFutureYear = viewingYear > currentYear;

    if (isCurrentYear && monthIndex === currentMonth) {
      card.classList.add("current");
    } else if (isPastYear || (isCurrentYear && monthIndex < currentMonth)) {
      card.classList.add("past");
    } else {
      card.classList.add("future");
    }

    // Year view is milestone-oriented (month goals), not week/day tasks.
    const monthGoals = Goals.getByMonth(monthIndex, viewingYear).filter((g) => g.level === "milestone");
    const completedCount = monthGoals.filter(
      (g) => g.status === "done",
    ).length;
    const progressPercent =
      monthGoals.length > 0
        ? Math.round((completedCount / monthGoals.length) * 100)
        : 0;

    // Time context with breakdown
    let timeContext = "";
    let timeDetail = "";
    const breakdown = TimeBreakdown.calculate(monthIndex, viewingYear);

    if (isPastYear) {
      timeContext = `${currentYear - viewingYear} year${currentYear - viewingYear > 1 ? "s" : ""} ago`;
      timeDetail = "";
    } else if (isFutureYear) {
      const monthsAway =
        (viewingYear - currentYear) * 12 + (monthIndex - currentMonth);
      timeContext = `In ${monthsAway} months`;
      timeDetail =
        breakdown.days > 0
          ? `${breakdown.days} days • ${breakdown.weeks} weeks`
          : "";
    } else if (monthIndex === currentMonth) {
      timeContext = "This month";
      timeDetail = `${breakdown.days} days left`;
    } else if (monthIndex === currentMonth + 1) {
      timeContext = "Next month";
      timeDetail = `${breakdown.days} days • ${breakdown.weeks} weeks`;
    } else if (monthIndex > currentMonth) {
      timeContext = `In ${monthIndex - currentMonth} months`;
      timeDetail = `${breakdown.days} days • ${breakdown.weekends} weekends`;
    } else {
      timeContext = `${currentMonth - monthIndex} months ago`;
      timeDetail = "";
    }

    card.innerHTML = `
      <div class="month-header">
        <div class="month-name">${monthName}</div>
        <div class="month-context">${timeContext}</div>
        ${timeDetail ? `<div class="month-time-detail">${timeDetail}</div>` : ""}
      </div>
      <div class="month-progress">
        <div class="month-progress-bar">
          <div class="month-progress-fill" style="width: ${progressPercent}%"></div>
        </div>
        <div class="month-progress-label">${completedCount}/${monthGoals.length} milestones</div>
      </div>
      <div class="month-goals">
        ${this.renderMonthGoals(monthGoals)}
      </div>
      <div class="month-actions">
        <button class="btn btn-sm btn-ghost add-goal-btn" data-month="${monthIndex}">+ Add Milestone</button>
        <button class="btn btn-sm btn-ghost view-month-btn" data-month="${monthIndex}">View Details</button>
      </div>
    `;

    // Bind events
    card.querySelector(".add-goal-btn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.openGoalModal("milestone", monthIndex, viewingYear);
    });

    card.querySelector(".view-month-btn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.showMonthDetail(monthIndex, viewingYear);
    });

    card.addEventListener("click", () => {
      this.showMonthDetail(monthIndex, viewingYear);
    });

    return card;
  },

  renderMonthGoals(goals: Goal[]) {
    if (goals.length === 0) {
      return "";
    }

    // Filter by active category
    let filteredGoals = goals;
    if (State.activeCategory !== "all") {
      filteredGoals = goals.filter(
        (g) => g.category === State.activeCategory,
      );
    }

    return filteredGoals
      .slice(0, 5)
      .map((goal) => {
        const cat = goal.category ? (CONFIG.CATEGORIES[goal.category] ?? null) : null;
        const statusClass = goal.status === "done" ? "completed" : "";
        const priorityTag =
          goal.priority === "urgent" || goal.priority === "high"
            ? `<span class="goal-tag priority-${goal.priority}">${CONFIG.PRIORITIES[goal.priority]?.symbol || ""} ${goal.priority}</span>`
            : "";

        const level = CONFIG.LEVELS[goal.level] || CONFIG.LEVELS.milestone;
        const subtasksSummary =
          goal.subtasks.length > 0
            ? `${goal.subtasks.filter((s: Subtask) => s.done).length}/${goal.subtasks.length}`
            : "";

        return `
          <div class="goal-item ${statusClass}" data-goal-id="${goal.id}">
            <div class="goal-checkbox ${goal.status === "done" ? "checked" : ""}" data-goal-id="${goal.id}"></div>
            <div class="goal-content">
              <div class="goal-title">
                <span class="goal-level-emoji">${level.emoji}</span>
                ${this.escapeHtml(goal.title)}
              </div>
              <div class="goal-meta">
                ${cat ? `<span class="goal-category" style="color: ${cat.color}">${cat.emoji}</span>` : ""}
                ${subtasksSummary ? `<span class="goal-subtasks">${subtasksSummary}</span>` : ""}
                ${priorityTag}
                ${goal.progress > 0 && goal.progress < 100 ? `<span class="goal-progress-text">${goal.progress}%</span>` : ""}
              </div>
              ${goal.progress > 0 ? `<div class="goal-progress"><div class="goal-progress-fill" style="width: ${goal.progress}%"></div></div>` : ""}
            </div>
            <button class="btn btn-icon btn-ghost goal-edit-btn" data-goal-id="${goal.id}" type="button" aria-label="Goal options">⋮</button>
          </div>
        `;
      })
      .join("");
  },

  renderCategoryFilters() {
    const container = this.elements.categoryFilters;
    if (!container) return;

    const categories = [
      { id: "all", label: "All", emoji: "✨" },
      ...Object.entries(CONFIG.CATEGORIES).map(([id, cat]) => ({
        id,
        label: cat.label,
        emoji: cat.emoji,
      })),
    ];

    const activeId = State.activeCategory || "all";
    const active = categories.find((c) => c.id === activeId) || categories[0];

    container.innerHTML = `
      <div class="filter-dropdown">
        <button class="filter-trigger" type="button" aria-haspopup="menu" aria-expanded="false">
          <span class="filter-value">${active.emoji} ${active.label}</span>
          <span class="filter-caret" aria-hidden="true">▾</span>
        </button>
        <div class="filter-menu" role="menu" hidden>
          ${categories
        .map(
          (cat) => `
                <button
                  class="category-filter ${activeId === cat.id ? "active" : ""}"
                  type="button"
                  role="menuitemradio"
                  aria-checked="${activeId === cat.id}"
                  data-category="${cat.id}"
                >
                  ${cat.emoji} ${cat.label}
                </button>
              `,
        )
        .join("")}
        </div>
      </div>
    `;

    const dropdown = container.querySelector(".filter-dropdown") as HTMLElement | null;
    const trigger = container.querySelector(".filter-trigger") as HTMLElement | null;
    const menu = container.querySelector(".filter-menu") as HTMLElement | null;

    if (!dropdown || !trigger || !menu) return;

    const closeMenu = () => {
      menu.hidden = true;
      trigger.setAttribute("aria-expanded", "false");
    };

    const openMenu = () => {
      menu.hidden = false;
      trigger.setAttribute("aria-expanded", "true");
      const activeBtn = menu.querySelector(".category-filter.active") as HTMLElement | null;
      (activeBtn || menu.querySelector(".category-filter") as HTMLElement | null)?.focus?.();
    };

    if (this._filterDocListeners) {
      document.removeEventListener("click", this._filterDocListeners.onDocClick);
      document.removeEventListener(
        "keydown",
        this._filterDocListeners.onDocKeydown,
      );
      this._filterDocListeners = null;
    }

    trigger.addEventListener(
      "click",
      () => {
        if (menu.hidden) openMenu();
        else closeMenu();
      },
    );

    trigger.addEventListener(
      "keydown",
      (e) => {
        if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openMenu();
        }
        if (e.key === "Escape") {
          e.preventDefault();
          closeMenu();
        }
      },
    );

    const onDocClick = (e: MouseEvent) => {
      if (!dropdown.contains(e.target as Node | null)) closeMenu();
    };

    const onDocKeydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu();
    };

    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onDocKeydown);
    this._filterDocListeners = { onDocClick, onDocKeydown };

    menu.addEventListener(
      "keydown",
      (e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          closeMenu();
          trigger.focus();
        }
      },
    );

    // Bind filter events
    menu.querySelectorAll(".category-filter").forEach((btn) => {
      btn.addEventListener(
        "click",
        () => {
          State.activeCategory = (btn as HTMLElement).dataset.category ?? "all";
          closeMenu();
          this.renderCategoryFilters();
          this.renderCalendar();
          this.renderUpcomingGoals();
        },
      );
    });
  },

  renderUpcomingGoals() {
    const container = this.elements.upcomingGoals;
    if (!container) return;

    const upcoming = Goals.getUpcoming(5);

    if (upcoming.length === 0) {
      // Reduce visual clutter when empty
      this.elements.whatsNextPanel?.setAttribute("hidden", "");
      container.innerHTML = "";
      return;
    }

    this.elements.whatsNextPanel?.removeAttribute("hidden");

    container.innerHTML = upcoming
      .map((goal) => {
        const cat = goal.category ? (CONFIG.CATEGORIES[goal.category] ?? null) : null;
        const monthName = CONFIG.MONTHS[goal.month];

        const timeLeft = TimeBreakdown.getSimpleTimeLeft(
          goal.month,
          goal.year,
        );

        return `
          <div class="upcoming-goal" data-goal-id="${goal.id}">
            <div class="upcoming-dot" style="background: ${cat ? cat.color : "rgba(255, 255, 255, 0.18)"}"></div>
            <div class="upcoming-content">
              <div class="upcoming-title">${this.escapeHtml(goal.title)}</div>
              <div class="upcoming-meta">${monthName} • ${timeLeft}</div>
            </div>
          </div>
        `;
      })
      .join("");

    // Bind click events
    container.querySelectorAll(".upcoming-goal").forEach((el: Element) => {
      el.addEventListener("click", () => {
        this.showGoalDetail((el as HTMLElement).dataset.goalId);
      });
    });
  },

  renderAchievements() {
    const container = this.elements.achievementsGrid;
    if (!container) return;
    if (!State.data) return;

    const unlocked = State.data.achievements;

    container.innerHTML = Object.entries(CONFIG.ACHIEVEMENTS)
      .map(
        ([id, ach]) => `
          <div class="achievement ${unlocked.includes(id) ? "unlocked" : ""}" data-tooltip="${this.escapeHtml(ach.desc)}">
            ${ach.emoji}
          </div>
        `,
      )
      .join("");
  },

  // ============================================
  // Modal Handling
  // ============================================
  openGoalModal(level: GoalLevel = "milestone", preselectedMonth: number | null = null, preselectedYear: number | null = null): void {
    this.goalModalLevel = level;
    this.goalModalYear =
      preselectedYear ?? State.viewingYear ?? new Date().getFullYear();

    // Update modal titles based on level
    const title = document.getElementById("goal-modal-title");
    const label = document.querySelector('label[for="goalTitle"]');

    if (title) {
      if (level === "vision") title.textContent = "Create New Vision";
      else if (level === "milestone") title.textContent = "Set New Milestone";
      else if (level === "focus") title.textContent = "Define New Focus";
      else if (level === "intention") title.textContent = "Set New Intention";
    }

    if (label) {
      if (level === "vision") label.textContent = "What is your vision for this year?";
      else if (level === "milestone") label.textContent = "What is your milestone for this month?";
      else if (level === "focus") label.textContent = "What is your focus for this week?";
      else if (level === "intention") label.textContent = "What is your intention for today?";
    }

    // Customize modal fields based on goal level
    const monthGroup = document.querySelector('label[for="goalMonth"]')?.parentElement as HTMLElement;
    const monthLabel = document.querySelector('label[for="goalMonth"]') as HTMLElement;
    const monthSelect = document.getElementById("goalMonth") as HTMLSelectElement;
    const categoryGroup = document.querySelector('label[for="goalCategory"]')?.parentElement as HTMLElement;

    // Use a more resilient selector for the time fields row
    const timeGroup = document.getElementById("goalStartTime")?.closest(".form-row") as HTMLElement;
    const priorityGroup = document.querySelector('label[for="goalPriority"]')?.parentElement as HTMLElement;
    const yearGroup = document.getElementById("goalYearGroup") as HTMLElement | null;
    const yearInput = document.getElementById("goalYear") as HTMLInputElement | null;
    const startDateGroup = document.getElementById("goalStartDateGroup") as HTMLElement | null;
    const startDateInput = document.getElementById("goalStartDate") as HTMLInputElement | null;
    const startDateLabel = document.querySelector('label[for="goalStartDate"]') as HTMLElement | null;
    const milestoneDurationGroup = document.getElementById("milestoneDurationGroup") as HTMLElement | null;
    const milestoneDurationSelect = document.getElementById("milestoneDurationMonths") as HTMLSelectElement | null;
    const focusDurationGroup = document.getElementById("focusDurationGroup") as HTMLElement | null;
    const focusDurationSelect = document.getElementById("focusDurationWeeks") as HTMLSelectElement | null;
    const submitBtn = document.querySelector('#goalForm button[type="submit"]') as HTMLElement;

    // Update submit button text based on goal level
    if (submitBtn) {
      if (level === "vision") submitBtn.textContent = "Create Vision";
      else if (level === "milestone") submitBtn.textContent = "Set Milestone";
      else if (level === "focus") submitBtn.textContent = "Define Focus";
      else if (level === "intention") submitBtn.textContent = "Set Intention";
    }

    // Reset required states first
    if (monthSelect) monthSelect.required = false;
    if (yearGroup) yearGroup.style.display = "none";
    if (startDateGroup) startDateGroup.style.display = "none";
    if (milestoneDurationGroup) milestoneDurationGroup.style.display = "none";
    if (focusDurationGroup) focusDurationGroup.style.display = "none";

    const toYmdLocal = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };

    if (yearInput) {
      yearInput.value = String(this.goalModalYear);
      yearInput.onchange = () => {
        const raw = Number.parseInt(yearInput.value, 10);
        if (Number.isFinite(raw)) {
          this.goalModalYear = raw;
          if (this.goalModalLevel === "milestone") {
            this.populateMonthSelect(preselectedMonth, raw);
          }
          this.updateGoalModalTimeBreakdown();
        }
      };
    }

    if (monthGroup && monthLabel && monthSelect) {
      if (level === "vision") {
        // Vision: year-only
        monthGroup.style.display = "none";
        this.setFieldVisibility(timeGroup, false);
        if (priorityGroup) priorityGroup.style.display = "block";
        if (categoryGroup) categoryGroup.style.display = "block";
        if (yearGroup) yearGroup.style.display = "block";
      } else if (level === "milestone") {
        // Milestone: month(s)
        monthGroup.style.display = "block";
        monthSelect.required = true;
        monthLabel.textContent = "Start month";
        this.populateMonthSelect(preselectedMonth, this.goalModalYear);
        this.setFieldVisibility(timeGroup, false);
        if (priorityGroup) priorityGroup.style.display = "block";
        if (categoryGroup) categoryGroup.style.display = "block";
        if (yearGroup) yearGroup.style.display = "block";
        if (milestoneDurationGroup) milestoneDurationGroup.style.display = "block";
        if (milestoneDurationSelect) milestoneDurationSelect.value = "1";
      } else if (level === "focus") {
        // Focus: week(s)
        monthGroup.style.display = "none";
        this.setFieldVisibility(timeGroup, false);
        if (priorityGroup) priorityGroup.style.display = "block";
        if (categoryGroup) categoryGroup.style.display = "block";
        if (startDateGroup) startDateGroup.style.display = "block";
        if (startDateLabel) startDateLabel.textContent = "Week of";
        if (startDateInput) {
          const weekNum = State.viewingWeek ?? State.getWeekNumber(State.viewingDate ?? new Date());
          const weekStart = State.getWeekStart(State.viewingYear ?? new Date().getFullYear(), weekNum);
          startDateInput.value = toYmdLocal(weekStart);
        }
        if (focusDurationGroup) focusDurationGroup.style.display = "block";
        if (focusDurationSelect) focusDurationSelect.value = "1";
      } else if (level === "intention") {
        // Intention: single day
        monthGroup.style.display = "none";
        this.setFieldVisibility(timeGroup, true);
        if (priorityGroup) priorityGroup.style.display = "none";
        if (categoryGroup) categoryGroup.style.display = "none";
        if (startDateGroup) startDateGroup.style.display = "block";
        if (startDateLabel) startDateLabel.textContent = "Date";
        if (startDateInput) startDateInput.value = toYmdLocal(State.viewingDate ?? new Date());
      }
    }

    // Show time breakdown for all goal levels
    setTimeout(() => this.updateGoalModalTimeBreakdown(), 0);

    this.elements.goalModal?.classList.add("active");

    // Scroll focused input into view on mobile when keyboard appears
    if (this.isMobileViewport()) {
      // Wait for modal animation to complete, then focus and scroll first input
      setTimeout(() => {
        const firstInput = this.elements.goalModal?.querySelector("input, select, textarea") as HTMLElement | null;
        if (firstInput) {
          firstInput.focus();
          // Scroll into view with smooth behavior
          setTimeout(() => {
            firstInput.scrollIntoView({ behavior: "smooth", block: "center" });
          }, 100);
        }
      }, 300);

      // Also handle focus events on inputs to scroll them into view when keyboard appears
      const handleInputFocus = (e: FocusEvent) => {
        const target = e.target as HTMLElement;
        if (target && (target.tagName === "INPUT" || target.tagName === "SELECT" || target.tagName === "TEXTAREA")) {
          setTimeout(() => {
            target.scrollIntoView({ behavior: "smooth", block: "center" });
          }, 150);
        }
      };

      // Store handler reference for cleanup
      const modal = this.elements.goalModal;
      if (modal) {
        modal.addEventListener("focusin", handleInputFocus);
        // Clean up on modal close
        const originalClose = this.closeGoalModal.bind(this);
        this.closeGoalModal = () => {
          modal.removeEventListener("focusin", handleInputFocus);
          originalClose();
        };
      }
    }
    document.getElementById("goalTitle")?.focus();
  },

  closeGoalModal() {
    this.elements.goalModal?.classList.remove("active");
    this.elements.goalForm?.reset();
    this.goalModalYear = null;
  },

  setFieldVisibility(element: HTMLElement | null, visible: boolean) {
    if (!element) return;
    element.style.display = visible ? "grid" : "none";
  },

  populateMonthSelect(
    preselectedMonth: number | null = null,
    year: number | null = null,
  ) {
    const select = this.elements.goalMonth;
    if (!select) return;

    const now = new Date();
    const nowMonth = now.getMonth();
    const nowYear = now.getFullYear();

    const currentMonth = preselectedMonth ?? State.viewingMonth ?? nowMonth;
    const currentYear = year ?? this.goalModalYear ?? State.viewingYear ?? nowYear;

    select.innerHTML = CONFIG.MONTHS.map((name, idx) => {
      const timeLeft = TimeBreakdown.getSimpleTimeLeft(idx, currentYear);
      const isPast =
        currentYear < nowYear || (currentYear === nowYear && idx < nowMonth);
      return `<option value="${idx}" ${idx === currentMonth ? "selected" : ""} ${isPast ? 'class="past-month"' : ""}>${name} ${!isPast ? `(${timeLeft})` : "(past)"}</option>`;
    }).join("");

    // Ensure the select has a valid value even if HTML parsing fails.
    select.value = String(currentMonth);

    // Add listener to show time breakdown when month changes
    select.onchange = () => this.updateGoalModalTimeBreakdown();

    // Show initial time breakdown
    setTimeout(() => this.updateGoalModalTimeBreakdown(), 0);
  },

  updateGoalModalTimeBreakdown() {
    const level = this.goalModalLevel;
    if (!level) return;

    // Find or create the time breakdown container in the modal
    let breakdownContainer = document.getElementById("modalTimeBreakdown");
    if (!breakdownContainer) {
      breakdownContainer = document.createElement("div");
      breakdownContainer.id = "modalTimeBreakdown";
      breakdownContainer.className = "modal-time-breakdown";
      // Insert after the first form-group (title field)
      const firstFormGroup = this.elements.goalForm?.querySelector(".form-group");
      if (firstFormGroup) {
        const parent = firstFormGroup.parentNode;
        if (parent) parent.insertBefore(breakdownContainer, firstFormGroup.nextSibling);
      }
    }

    // Generate HTML based on goal level
    let html = "";
    const currentYear = this.goalModalYear ?? State.viewingYear ?? new Date().getFullYear();

    if (level === "intention") {
      // Day level - hours left in day
      html = TimeBreakdown.generateHTML(0, currentYear, false, "intention");
    } else if (level === "focus") {
      // Week level - days/weekends/sessions in week
      html = TimeBreakdown.generateHTML(0, currentYear, false, "focus");
    } else if (level === "vision") {
      // Year level - months/quarters/weeks/sessions in year
      html = TimeBreakdown.generateHTML(0, currentYear, false, "vision");
    } else if (level === "milestone") {
      // Month level - use month selection
      const select = this.elements.goalMonth;
      if (!select) return;
      const selectedMonth = Number.parseInt(select.value, 10);
      if (!Number.isFinite(selectedMonth)) return;
      html = TimeBreakdown.generateHTML(selectedMonth, currentYear, false, "milestone");
    }

    breakdownContainer.innerHTML = html;
  },

  handleGoalSubmit(e: Event) {
    e.preventDefault();

    const titleEl = document.getElementById("goalTitle") as HTMLInputElement | null;
    const monthEl = document.getElementById("goalMonth") as HTMLSelectElement | null;
    const yearEl = document.getElementById("goalYear") as HTMLInputElement | null;
    const startDateEl = document.getElementById("goalStartDate") as HTMLInputElement | null;
    const milestoneDurationEl = document.getElementById("milestoneDurationMonths") as HTMLSelectElement | null;
    const focusDurationEl = document.getElementById("focusDurationWeeks") as HTMLSelectElement | null;
    const categoryEl = document.getElementById("goalCategory") as HTMLSelectElement | null;
    const priorityEl = document.getElementById("goalPriority") as HTMLSelectElement | null;
    const startTimeEl = document.getElementById("goalStartTime") as HTMLInputElement | null;
    const endTimeEl = document.getElementById("goalEndTime") as HTMLInputElement | null;

    const title = titleEl?.value.trim() ?? "";
    if (!title) return;

    // Get values based on goal level - some fields may be hidden
    let month = NaN;
    let year =
      this.goalModalYear ?? State.viewingYear ?? new Date().getFullYear();
    let startDate: string | undefined;
    let durationMonths = NaN;
    let durationWeeks = NaN;
    let category: Category = null;
    let priority: Priority = "medium";
    let startTime: string | null = null;
    let endTime: string | null = null;

    // Only get month if the field is visible (milestones)
    if (monthEl && (monthEl.parentElement as HTMLElement)?.style.display !== "none") {
      month = parseInt(monthEl.value, 10);
    }

    // Only get year if the field is visible (visions/milestones)
    if (yearEl && (yearEl.parentElement as HTMLElement)?.style.display !== "none") {
      const yearRaw = parseInt(yearEl.value, 10);
      if (Number.isFinite(yearRaw)) year = yearRaw;
    }

    // Only get start date if visible (focus/intentions)
    if (startDateEl && (startDateEl.parentElement as HTMLElement)?.style.display !== "none") {
      const raw = startDateEl.value?.trim();
      startDate = raw ? raw : undefined;
    }

    // Only get milestone duration if visible
    if (milestoneDurationEl && (milestoneDurationEl.parentElement as HTMLElement)?.style.display !== "none") {
      durationMonths = parseInt(milestoneDurationEl.value, 10);
    }

    // Only get focus duration if visible
    if (focusDurationEl && (focusDurationEl.parentElement as HTMLElement)?.style.display !== "none") {
      durationWeeks = parseInt(focusDurationEl.value, 10);
    }

    // Only get category if the field is visible
    if (categoryEl && (categoryEl.parentElement as HTMLElement)?.style.display !== "none") {
      const categoryRaw = categoryEl?.value;
      category =
        categoryRaw && categoryRaw in CONFIG.CATEGORIES
          ? (categoryRaw as Exclude<Category, null>)
          : null;
    }

    // Only get priority if the field is visible
    if (priorityEl && (priorityEl.parentElement as HTMLElement)?.style.display !== "none") {
      const priorityRaw = priorityEl?.value;
      priority =
        priorityRaw === "low" ||
          priorityRaw === "medium" ||
          priorityRaw === "high" ||
          priorityRaw === "urgent"
          ? (priorityRaw as Priority)
          : "medium";
    }

    // Only get time fields if they're visible (intentions)
    if (startTimeEl && (startTimeEl.parentElement?.parentElement as HTMLElement)?.style.display !== "none") {
      startTime = startTimeEl?.value || null;
      endTime = endTimeEl?.value || null;
    }

    if (!title) return;

    // For levels that don't use month selection, let Goals.create handle auto-anchoring
    const goalData: any = {
      title,
      level: this.goalModalLevel,
      category,
      priority,
      startTime,
      endTime,
    };

    if (this.goalModalLevel === "vision") {
      goalData.year = year;
    }

    if (this.goalModalLevel === "milestone") {
      if (Number.isFinite(month)) goalData.month = month;
      if (Number.isFinite(year)) goalData.year = year;
      if (Number.isFinite(durationMonths)) goalData.durationMonths = durationMonths;
    }

    if (this.goalModalLevel === "focus") {
      if (startDate) goalData.startDate = startDate;
      if (Number.isFinite(durationWeeks)) goalData.durationWeeks = durationWeeks;
    }

    if (this.goalModalLevel === "intention") {
      if (startDate) goalData.startDate = startDate;
    }

    Goals.create(goalData);

    this.closeGoalModal();
    this.render();
    this.showToast("✨", "Anchor placed.");
  },

  // ============================================
  // Goal Detail View
  // ============================================
  showGoalDetail(goalId?: string) {
    if (!goalId) return;
    const goal = Goals.getById(goalId);
    if (!goal) return;

    State.selectedGoal = goalId;
    const cat = goal.category ? (CONFIG.CATEGORIES[goal.category] ?? null) : null;
    const status = CONFIG.STATUSES[goal.status];

    const modal = document.createElement("div");
    modal.className = "modal-overlay active";
    modal.id = "goalDetailModal";
    modal.innerHTML = `
                <div class="modal modal-lg">
                    <div class="modal-header">
                        <div class="goal-detail-header">
                            ${cat
        ? `<span class="goal-category-badge" style="background: ${cat.color}20; color: ${cat.color}">
                                ${cat.emoji} ${cat.label}
                            </span>`
        : ""
      }
                            <span class="goal-status-badge" style="background: ${status.color}20; color: ${status.color}">
                                ${status.emoji} ${status.label}
                            </span>
                        </div>
                        <button class="modal-close" id="closeGoalDetail">×</button>
                    </div>
                    <div class="modal-body">
                        <h2 class="goal-detail-title">${this.escapeHtml(goal.title)}</h2>

                        ${goal.description ? `<p class="goal-description">${this.escapeHtml(goal.description)}</p>` : ""}

                        <!-- Time Breakdown Section -->
                        <div class="detail-section time-section">
                            <h3>⏰ Time You Have</h3>
                            ${TimeBreakdown.generateHTML(goal.month, goal.year, false, goal.level)}
                        </div>

                        <!-- Progress Section -->
                        <div class="detail-section">
                            <h3>Progress</h3>
                            <div class="progress-control">
                                <div class="progress-bar-lg">
                                    <div class="progress-fill-lg" style="width: ${goal.progress}%"></div>
                                </div>
                                <span class="progress-value">${goal.progress}%</span>
                            </div>
                            <input type="range" min="0" max="100" value="${goal.progress}"
                                   class="progress-slider" id="progressSlider">
                        </div>

                        <!-- Status Section -->
                        <div class="detail-section">
                            <h3>Status</h3>
                            <div class="status-buttons">
                                ${Object.entries(CONFIG.STATUSES)
        .map(
          ([id, s]) => `
                                    <button class="status-btn ${goal.status === id ? "active" : ""}"
                                            data-status="${id}" style="--status-color: ${s.color}">
                                        ${s.emoji} ${s.label}
                                    </button>
                                `,
        )
        .join("")}
                            </div>
                        </div>

                        <!-- Subtasks Section -->
                        <div class="detail-section">
                            <h3>Subtasks <span class="count">(${goal.subtasks.filter((s) => s.done).length}/${goal.subtasks.length})</span></h3>
                            <div class="subtasks-list" id="subtasksList">
                                ${goal.subtasks
        .map(
          (s) => `
                                    <div class="subtask-item ${s.done ? "done" : ""}" data-subtask-id="${s.id}">
                                        <div class="subtask-checkbox ${s.done ? "checked" : ""}"></div>
                                        <span class="subtask-title">${this.escapeHtml(s.title)}</span>
                                        <button class="btn btn-icon btn-ghost subtask-delete">×</button>
                                    </div>
                                `,
        )
        .join("")}
                            </div>
                            <div class="add-subtask">
                                <input type="text" placeholder="Add a subtask..." id="newSubtaskInput">
                                <button class="btn btn-sm btn-primary" id="addSubtaskBtn">Add</button>
                            </div>
                        </div>

                        <!-- Notes Section -->
                        <div class="detail-section">
                            <h3>Notes & Reflections</h3>
                            <div class="notes-list" id="notesList">
                                ${goal.notes
        .map(
          (n) => `
                                    <div class="note-item">
                                        <p>${this.escapeHtml(n.text)}</p>
                                        <span class="note-date">${this.formatDate(n.createdAt)}</span>
                                    </div>
                                `,
        )
        .join("")}
                            </div>
                            <div class="add-note">
                                <textarea placeholder="Add a note..." id="newNoteInput"></textarea>
                                <button class="btn btn-sm btn-primary" id="addNoteBtn">Add Note</button>
                            </div>
                        </div>

                        <!-- Time Tracking -->
                        <div class="detail-section">
                            <h3>Time Spent</h3>
                            <div class="time-summary">
                                <span class="time-total">${this.formatMinutes(Goals.getTotalTime(goalId))}</span>
                                <button class="btn btn-sm btn-ghost" id="logTimeBtn">+ Log Time</button>
                            </div>
                            ${goal.lastWorkedOn ? `<p class="last-worked">Last worked on: ${this.formatDate(goal.lastWorkedOn)}</p>` : ""}
                        </div>

                        <!-- Meta Info -->
                        <div class="detail-meta">
                            <span>Created: ${this.formatDate(goal.createdAt)}</span>
                            ${goal.completedAt ? `<span>Completed: ${this.formatDate(goal.completedAt)}</span>` : ""}
                        </div>
                    </div>
                    <div class="modal-actions">
                        <button class="btn btn-danger" id="deleteGoalBtn">Remove Anchor</button>
                        <button class="btn btn-primary" id="saveGoalBtn">Save Changes</button>
                    </div>
                </div>
            `;

    document.body.appendChild(modal);
    this.bindGoalDetailEvents(modal, goalId);
  },

  bindGoalDetailEvents(modal: HTMLElement, goalId: string) {
    // Close button
    modal.querySelector("#closeGoalDetail")?.addEventListener("click", () => {
      modal.remove();
      State.selectedGoal = null;
    });

    // Click outside to close
    modal.addEventListener("click", (e: MouseEvent) => {
      if (e.target === modal) {
        modal.remove();
        State.selectedGoal = null;
      }
    });

    // Progress slider: update modal UI on input, persist on change (prevents render/sync churn).
    const progressFill = modal.querySelector(".progress-fill-lg") as HTMLElement | null;
    const progressValue = modal.querySelector(".progress-value") as HTMLElement | null;
    const setProgressUI = (progress: number) => {
      if (progressFill) progressFill.style.width = `${progress}%`;
      if (progressValue) progressValue.textContent = `${progress}%`;
    };

    modal.querySelector("#progressSlider")?.addEventListener("input", (e: Event) => {
      const target = e.target as HTMLInputElement | null;
      const progress = target ? parseInt(target.value, 10) : NaN;
      if (!Number.isFinite(progress)) return;
      setProgressUI(progress);
    });

    modal.querySelector("#progressSlider")?.addEventListener("change", (e: Event) => {
      const target = e.target as HTMLInputElement | null;
      const progress = target ? parseInt(target.value, 10) : NaN;
      if (!Number.isFinite(progress)) return;
      Goals.update(goalId, { progress });
      setProgressUI(progress);
    });

    // Status buttons
    modal.querySelectorAll(".status-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const status = (btn as HTMLElement).dataset.status;
        if (!status) return;
        Goals.update(goalId, { status: status as Goal["status"] });
        modal
          .querySelectorAll(".status-btn")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        if (status === "done") {
          Goals.complete(goalId);
          modal.remove();
          this.render();
        }
      });
    });

    // Add subtask
    const addSubtask = () => {
      const input = modal.querySelector("#newSubtaskInput") as HTMLInputElement | null;
      const title = input?.value.trim() ?? "";
      if (!title) return;

      Goals.addSubtask(goalId, title);
      if (input) input.value = "";
      this.refreshGoalDetail(modal, goalId);
    };

    modal
      .querySelector("#addSubtaskBtn")
      ?.addEventListener("click", addSubtask);
    (modal.querySelector("#newSubtaskInput") as HTMLInputElement | null)
      ?.addEventListener("keydown", (e: KeyboardEvent) => {
        if (e.key === "Enter") addSubtask();
      });

    // Toggle subtasks
    modal.querySelectorAll(".subtask-checkbox").forEach((cb) => {
      cb.addEventListener("click", (e: Event) => {
        const mouseEvent = e as MouseEvent;
        const subtaskItem = cb.closest(".subtask-item") as HTMLElement | null;
        const subtaskId = subtaskItem?.dataset.subtaskId;
        if (!subtaskId) return;

        // If checking (not unchecking), spawn sparkles
        const checkbox = cb as HTMLInputElement;
        if (checkbox.checked) {
          this.spawnPollenSparkles(mouseEvent.clientX, mouseEvent.clientY);
        }

        Goals.toggleSubtask(goalId, subtaskId);
        this.refreshGoalDetail(modal, goalId);
      });
    });

    // Delete subtasks
    modal.querySelectorAll(".subtask-delete").forEach((btn) => {
      btn.addEventListener("click", () => {
        const subtaskItem = btn.closest(".subtask-item") as HTMLElement | null;
        const subtaskId = subtaskItem?.dataset.subtaskId;
        if (!subtaskId) return;
        Goals.deleteSubtask(goalId, subtaskId);
        this.refreshGoalDetail(modal, goalId);
      });
    });

    // Add note
    modal.querySelector("#addNoteBtn")?.addEventListener("click", () => {
      const input = modal.querySelector("#newNoteInput") as HTMLInputElement | null;
      const text = input?.value.trim() ?? "";
      if (!text) return;

      Goals.addNote(goalId, text);
      if (input) input.value = "";
      this.refreshGoalDetail(modal, goalId);
    });

    // Log time
    modal.querySelector("#logTimeBtn")?.addEventListener("click", () => {
      const minutesRaw = prompt("How many minutes did you work on this?");
      const minutes = minutesRaw ? parseInt(minutesRaw, 10) : NaN;
      if (Number.isFinite(minutes)) {
        Goals.logTime(goalId, minutes);
        this.refreshGoalDetail(modal, goalId);
        this.showToast("⏱️", "Time logged!");
      }
    });

    // Delete goal
    modal.querySelector("#deleteGoalBtn")?.addEventListener("click", () => {
      if (confirm("Remove this anchor?")) {
        Goals.delete(goalId);
        modal.remove();
        this.render();
        this.showToast("🗑️", "Anchor removed");
      }
    });

    // Save changes
    modal.querySelector("#saveGoalBtn")?.addEventListener("click", () => {
      modal.remove();
      State.selectedGoal = null;
      this.render();
      this.showToast("✅", "Changes saved");
    });
  },

  refreshGoalDetail(modal: HTMLElement, goalId: string) {
    modal.remove();
    this.showGoalDetail(goalId);
  },

  // ============================================
  // Month Detail View
  // ============================================
  showMonthDetail(monthIndex: number, year: number = new Date().getFullYear()) {
    const monthGoals = Goals.getByMonth(monthIndex, year).filter(
      (g) => g.level !== "intention" && g.level !== "vision",
    );
    const monthName = CONFIG.MONTHS[monthIndex];

    const modal = document.createElement("div");
    modal.className = "modal-overlay active";
    modal.id = "monthDetailModal";
    modal.innerHTML = `
                <div class="modal modal-xl">
                    <div class="modal-header">
                        <h2 class="modal-title">${monthName} ${year}</h2>
                        <button class="modal-close" id="closeMonthDetail">×</button>
                    </div>
                    <div class="modal-body">
                        <!-- Month Overview -->
                        <div class="month-overview">
                            <div class="overview-stat">
                                <div class="stat-value">${monthGoals.length}</div>
                                <div class="stat-label">Total Anchors</div>
                            </div>
                            <div class="overview-stat">
                                <div class="stat-value">${monthGoals.filter((g) => g.status === "done").length}</div>
                                <div class="stat-label">Completed</div>
                            </div>
                            <div class="overview-stat">
                                <div class="stat-value">${monthGoals.filter((g) => g.status === "in-progress").length}</div>
                                <div class="stat-label">In Progress</div>
                            </div>
                            <div class="overview-stat">
                                <div class="stat-value">${Math.round(monthGoals.reduce((s, g) => s + g.progress, 0) / (monthGoals.length || 1))}%</div>
                                <div class="stat-label">Avg Progress</div>
                            </div>
                        </div>

                        <!-- Milestones by Status -->
                        <div class="goals-by-status">
                            ${this.renderGoalsByStatus(monthGoals)}
                        </div>

                        <!-- Add Milestone for this month -->
                        <div class="quick-add-goal">
                            <input type="text" placeholder="Quick add a milestone for ${monthName}..." id="quickGoalInput">
                            <select id="quickGoalCategory">
                                <option value="">No category</option>
                                ${Object.entries(CONFIG.CATEGORIES)
        .map(
          ([id, cat]) => `
                                    <option value="${id}">${cat.emoji} ${cat.label}</option>
                                `
        )
        .join("")}
                            </select>
                            <button class="btn btn-primary" id="quickAddGoalBtn">Add</button>
                        </div>
                    </div>
                </div>
            `;

    document.body.appendChild(modal);

    // Bind events
    modal
      .querySelector("#closeMonthDetail")
      ?.addEventListener("click", () => modal.remove());
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.remove();
    });

    // Quick add goal
    modal.querySelector("#quickAddGoalBtn")?.addEventListener("click", () => {
      const input = modal.querySelector("#quickGoalInput") as HTMLInputElement | null;
      const categorySelect = modal.querySelector("#quickGoalCategory") as HTMLSelectElement | null;
      const title = input?.value.trim() ?? "";
      const categoryRaw = categorySelect?.value;
      const category: Category =
        categoryRaw && categoryRaw in CONFIG.CATEGORIES
          ? (categoryRaw as Exclude<Category, null>)
          : null;

      if (!title) return;

      Goals.create({
        title,
        level: "milestone",
        month: monthIndex,
        year,
        category,
      });

      if (input) input.value = "";
      modal.remove();
      this.render();
      this.showToast("✨", "Milestone placed.");
    });

    // Clicking on goal items opens detail
    modal.querySelectorAll(".goal-item").forEach((el) => {
      el.addEventListener("click", () => {
        modal.remove();
        this.showGoalDetail((el as HTMLElement).dataset.goalId);
      });
    });
  },

  renderGoalsByStatus(goals: Goal[]) {
    const grouped: Record<GoalStatus, Goal[]> = {
      "not-started": goals.filter((g) => g.status === "not-started"),
      "in-progress": goals.filter((g) => g.status === "in-progress"),
      blocked: goals.filter((g) => g.status === "blocked"),
      done: goals.filter((g) => g.status === "done"),
    };

    return (Object.entries(grouped) as [GoalStatus, Goal[]][])
      .map(([status, statusGoals]) => {
        const statusConfig = CONFIG.STATUSES[status];
        return `
                    <div class="status-column">
                        <h3 class="status-header" style="color: ${statusConfig.color}">
                            ${statusConfig.emoji} ${statusConfig.label} (${statusGoals.length})
                        </h3>
                        <div class="status-goals">
                            ${statusGoals
            .map((goal) => {
              const cat = goal.category ? CONFIG.CATEGORIES[goal.category] : null;
              const level = CONFIG.LEVELS[goal.level] || CONFIG.LEVELS.milestone;
              return `
                                    <div class="goal-item" data-goal-id="${goal.id}">
                                        <div class="goal-content">
                                            <div class="goal-title">
                                                <span class="goal-level-emoji">${level.emoji}</span>
                                                ${this.escapeHtml(goal.title)}
                                            </div>
                                            <div class="goal-meta">
                                                ${cat ? `<span style="color: ${cat.color}">${cat.emoji}</span>` : ""}
                                                <span>${goal.progress}%</span>
                                            </div>
                                        </div>
                                    </div>
                                `;
            })
            .join("") || ""
          }
                        </div>
                    </div>
                `;
      })
      .join("");
  },

  // ============================================
  // Weekly Review
  // ============================================
  showReviewPrompt() {
    if (sessionStorage.getItem("reviewPromptShown")) return;
    sessionStorage.setItem("reviewPromptShown", "true");

    const toast = document.createElement("div");
    toast.className = "review-prompt";
    toast.innerHTML = `
                <div class="review-prompt-content">
                    <span class="review-emoji">📝</span>
                    <span class="review-text">Time for your weekly review!</span>
                    <button class="btn btn-sm btn-primary" id="startReviewBtn">Start Review</button>
                    <button class="btn btn-sm btn-ghost" id="dismissReviewBtn">Later</button>
                </div>
            `;

    document.body.appendChild(toast);

    toast.querySelector("#startReviewBtn")?.addEventListener("click", () => {
      toast.remove();
      this.showWeeklyReview();
    });

    toast
      .querySelector("#dismissReviewBtn")
      ?.addEventListener("click", () => {
        toast.remove();
      });
  },

  showWeeklyReview() {
    const weekGoals = Planning.getWeekGoals();
    const completed = weekGoals.filter((g) => g.status === "done");

    const modal = document.createElement("div");
    modal.className = "modal-overlay active";
    modal.innerHTML = `
                <div class="modal modal-lg">
                    <div class="modal-header">
                        <h2 class="modal-title">📝 Weekly Review</h2>
                        <button class="modal-close" id="closeReview">×</button>
                    </div>
                    <div class="modal-body">
                        <div class="review-section">
                            <h3>🎉 This Week's Wins</h3>
                            <p class="review-hint">What felt good this week? (${completed.length} anchors marked done)</p>
                            <textarea id="reviewWins" placeholder="List your wins this week..."></textarea>
                        </div>

                        <div class="review-section">
                            <h3>🧗 Challenges Faced</h3>
                            <textarea id="reviewChallenges" placeholder="What obstacles did you encounter?"></textarea>
                        </div>

                        <div class="review-section">
                            <h3>💡 Key Learnings</h3>
                            <textarea id="reviewLearnings" placeholder="What did you learn?"></textarea>
                        </div>

                        <div class="review-section">
                            <h3>🎯 Next Week's Priorities</h3>
                            <textarea id="reviewPriorities" placeholder="What will you focus on next week?"></textarea>
                        </div>

                        <div class="review-section">
                            <h3>How are you feeling?</h3>
                            <div class="mood-selector">
                                <button class="mood-btn" data-mood="1">😫</button>
                                <button class="mood-btn" data-mood="2">😕</button>
                                <button class="mood-btn" data-mood="3">😐</button>
                                <button class="mood-btn" data-mood="4">🙂</button>
                                <button class="mood-btn" data-mood="5">😊</button>
                            </div>
                        </div>
                    </div>
                    <div class="modal-actions">
                        <button class="btn btn-ghost" id="cancelReview">Skip</button>
                        <button class="btn btn-primary" id="saveReview">Save Review ✨</button>
                    </div>
                </div>
            `;

    document.body.appendChild(modal);

    let selectedMood = 3;

    modal
      .querySelector("#closeReview")
      ?.addEventListener("click", () => modal.remove());
    modal
      .querySelector("#cancelReview")
      ?.addEventListener("click", () => modal.remove());

    modal.querySelectorAll(".mood-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        modal
          .querySelectorAll(".mood-btn")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        selectedMood = parseInt((btn as HTMLElement).dataset.mood ?? "3", 10);
      });
    });

    modal.querySelector("#saveReview")?.addEventListener("click", () => {
      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());

      Planning.createWeeklyReview({
        weekStart: weekStart.toISOString(),
        weekEnd: now.toISOString(),
        wins: (
          (modal.querySelector("#reviewWins") as HTMLTextAreaElement | null)
            ?.value ?? ""
        )
          .split("\n")
          .filter(Boolean),
        challenges: (
          (modal.querySelector("#reviewChallenges") as HTMLTextAreaElement | null)
            ?.value ?? ""
        )
          .split("\n")
          .filter(Boolean),
        learnings:
          (modal.querySelector("#reviewLearnings") as HTMLTextAreaElement | null)
            ?.value ?? "",
        nextWeekPriorities: (
          (modal.querySelector("#reviewPriorities") as HTMLTextAreaElement | null)
            ?.value ?? ""
        )
          .split("\n")
          .filter(Boolean),
        mood: selectedMood,
      });

      modal.remove();
      this.showToast("📝", "Weekly review saved!");
      this.render();
    });
  },

  // ============================================
  // UI Utilities
  // ============================================
  updateTimeDisplay() {
    const now = new Date();
    const monthName = CONFIG.MONTHS[now.getMonth()];
    const dayNum = now.getDate();

    if (this.elements.nowDate) {
      this.elements.nowDate.textContent = `${monthName} ${dayNum}`;
    }

    if (this.elements.nowContext) {
      const dayOfWeek = now.toLocaleDateString("en-US", { weekday: "long" });
      this.elements.nowContext.textContent = dayOfWeek;
    }

    // Days and weeks left in year
    // Use conservative calculation (floor) for time blindness - only count full weeks
    const endOfYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
    const daysLeft = Math.ceil((endOfYear.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const weeksLeft = Math.floor(daysLeft / 7);

    if (this.elements.daysLeft) {
      this.elements.daysLeft.textContent = String(daysLeft);
    }
    if (this.elements.weeksLeft) {
      this.elements.weeksLeft.textContent = String(weeksLeft);
    }
  },

  updateYearProgress() {
    const now = new Date();

    const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
    const toPercent = (ratio: number) => Math.round(clamp01(ratio) * 100);

    let start: Date;
    let end: Date;
    let label = "Progress";

    switch (State.currentView) {
      case VIEWS.MONTH: {
        label = "Month position";
        start = new Date(State.viewingYear, State.viewingMonth, 1);
        end = new Date(State.viewingYear, State.viewingMonth + 1, 1);
        break;
      }
      case VIEWS.WEEK: {
        label = "Week position";
        start = State.getWeekStart(State.viewingYear, State.viewingWeek ?? 1);
        end = new Date(start);
        end.setDate(end.getDate() + 7);
        break;
      }
      case VIEWS.DAY: {
        label = "Day position";
        start = new Date(State.viewingDate);
        start.setHours(0, 0, 0, 0);
        end = new Date(start);
        end.setDate(end.getDate() + 1);
        break;
      }
      case VIEWS.YEAR:
      default: {
        label = "Year position";
        start = new Date(State.viewingYear, 0, 1);
        end = new Date(State.viewingYear + 1, 0, 1);
        break;
      }
    }

    const ratio = (now.getTime() - start.getTime()) / (end.getTime() - start.getTime());
    const progress = toPercent(ratio);

    if (this.elements.yearProgressFill) {
      this.elements.yearProgressFill.style.width = `${progress}%`;
    }
    if (this.elements.yearProgressValue) {
      this.elements.yearProgressValue.textContent = `${progress}%`;
    }
    if (this.elements.yearProgressLabel) {
      this.elements.yearProgressLabel.textContent = label;
    }

    // Garden Bloom Animation
    if (this.elements.flowerPetals) {
      const petals = this.elements.flowerPetals.querySelectorAll(".petal");
      const scale = 0.2 + (progress / 100) * 0.8; // Scale from 0.2 to 1.0
      const rotationOffset = (progress / 100) * 10; // Slight rotation shift

      petals.forEach((petal: Element, index: number) => {
        const baseRotation = index * 72;
        const p = petal as SVGElement;
        p.style.transform = `rotate(${baseRotation + rotationOffset}deg) scale(${scale})`;
      });

      if (this.elements.gardenBloom) {
        if (progress >= 100) {
          this.elements.gardenBloom.classList.add("full-bloom");
        } else {
          this.elements.gardenBloom.classList.remove("full-bloom");
        }
      }
    }

    if (this.elements.timeProgress) {
      this.elements.timeProgress.setAttribute("aria-label", label);
      this.elements.timeProgress.setAttribute("aria-valuenow", String(progress));
      this.elements.timeProgress.setAttribute("aria-valuetext", `${progress}%`);
    }
  },

  spawnPollenSparkles(x: number, y: number) {
    const colors = ["var(--petal)", "var(--sage)", "var(--sunset)", "#FFD700"];
    for (let i = 0; i < 8; i++) {
      const sparkle = document.createElement("div");
      sparkle.className = "pollen-sparkle";
      sparkle.style.left = `${x}px`;
      sparkle.style.top = `${y}px`;
      sparkle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];

      const tx = (Math.random() - 0.5) * 100;
      const ty = (Math.random() - 0.5) * 100;
      sparkle.style.setProperty("--tx", `${tx}px`);
      sparkle.style.setProperty("--ty", `${ty}px`);
      sparkle.style.animation = `pollen-drift ${0.6 + Math.random() * 0.4}s var(--ease-out) forwards`;

      document.body.appendChild(sparkle);
      setTimeout(() => sparkle.remove(), 1000);
    }
  },

  updateStreakDisplay() {
    if (this.elements.streakCount) {
      this.elements.streakCount.textContent = String(Streaks.getCount());
    }
  },

  showRandomAffirmation() {
    const affirmation =
      CONFIG.AFFIRMATIONS[
      Math.floor(Math.random() * CONFIG.AFFIRMATIONS.length)
      ];
    const affirmationText = this.elements.affirmationText;
    if (affirmationText) {
      affirmationText.style.opacity = "0";
      setTimeout(() => {
        affirmationText.textContent = `"${affirmation}"`;
        affirmationText.style.opacity = "1";
      }, 200);
    }
  },

  pickRandomGoal() {
    const upcoming = Goals.getUpcoming(10);
    if (upcoming.length === 0) {
      this.showToast("", "Nothing to pick from yet.");
      return;
    }

    const randomGoal = upcoming[Math.floor(Math.random() * upcoming.length)];

    // Highlight the picked goal
    this.showGoalDetail(randomGoal.id);
    this.showToast("", `Return to: ${randomGoal.title}`);
  },

  zoom(delta: number) {
    State.zoom = Math.max(50, Math.min(150, State.zoom + delta));
    if (this.elements.canvas) {
      this.elements.canvas.style.transform = `scale(${State.zoom / 100})`;
    }
    if (this.elements.zoomLevel) {
      this.elements.zoomLevel.textContent = `${State.zoom}%`;
    }
  },

  toggleFocusMode() {
    const previousView = State.currentView;
    this.setFocusMode(!State.focusMode);
    if (State.currentView !== previousView) {
      State.setView(previousView);
    }
  },

  setFocusMode(
    enabled: boolean,
    options: { silent?: boolean; persist?: boolean } = {},
  ) {
    const { silent = false, persist = true } = options;

    State.focusMode = !!enabled;
    if (persist && State.data) {
      State.data.preferences.focusMode = State.focusMode;
      State.save();
    }

    document.body.classList.toggle("focus-mode", State.focusMode);
    const isMobile = this.isMobileViewport();
    if (State.focusMode) {
      this.updateFocusLayoutVars();
      if (isMobile) {
        // Mobile has no hover; keep controls accessible without the reveal system.
        document.body.classList.add("focus-ui-revealed");
        document.getElementById("focusHandle")?.setAttribute("hidden", "");
      } else {
        this.setupFocusHoverReveal();
        document.getElementById("focusHandle")?.removeAttribute("hidden");
      }
    } else {
      document.body.classList.remove("focus-ui-revealed");
      document.getElementById("focusHandle")?.setAttribute("hidden", "");
    }

    const focusToggle = document.getElementById("focusToggle");
    const focusModeBtn = document.getElementById("focusModeBtn");
    const supportPanelFocusToggle = document.getElementById("supportPanelFocusToggle");

    if (focusToggle) {
      focusToggle.classList.toggle("active", State.focusMode);
      focusToggle.setAttribute("aria-checked", String(State.focusMode));
    }
    if (focusModeBtn) {
      focusModeBtn.classList.toggle("active", State.focusMode);
      focusModeBtn.setAttribute("aria-pressed", String(State.focusMode));
    }
    if (supportPanelFocusToggle) {
      supportPanelFocusToggle.classList.toggle("active", State.focusMode);
      supportPanelFocusToggle.setAttribute("aria-checked", String(State.focusMode));
    }

    if (!silent) {
      this.showToast(
        "",
        State.focusMode ? "Focus on (calmer view)" : "Focus off",
      );
    }
  },

  applySavedUIState() {
    this.setFocusMode(State.focusMode, { silent: true, persist: false });

    const focusToggle = document.getElementById("focusToggle");
    const focusModeBtn = document.getElementById("focusModeBtn");
    const supportPanelFocusToggle = document.getElementById("supportPanelFocusToggle");

    if (focusToggle) {
      focusToggle.classList.toggle("active", State.focusMode);
      focusToggle.setAttribute("aria-checked", String(State.focusMode));
    }
    if (supportPanelFocusToggle) {
      supportPanelFocusToggle.classList.toggle("active", State.focusMode);
      supportPanelFocusToggle.setAttribute("aria-checked", String(State.focusMode));
    }
    if (focusModeBtn) {
      focusModeBtn.classList.toggle("active", State.focusMode);
      focusModeBtn.setAttribute("aria-pressed", String(State.focusMode));
    }

    this.applyLayoutVisibility();
    this.applySidebarVisibility();
    NDSupport.applyAccessibilityPreferences();
    this.syncViewButtons();
    this.syncSupportPanelAppearanceControls();
  },

  syncSupportPanelAppearanceControls() {
    if (!State.data) return;

    const themeToggle = document.getElementById("supportPanelThemeToggle");
    if (themeToggle) {
      const isNight =
        ThemeManager.resolveTheme(State.data.preferences.theme) === "night";
      themeToggle.classList.toggle("active", isNight);
      themeToggle.setAttribute("aria-checked", String(isNight));
    }

    const themePicker = document.getElementById("supportPanelThemePicker");
    if (!themePicker) return;

    const accentThemes = ND_CONFIG.ACCENT_THEMES as Record<
      AccentTheme,
      { label: string; emoji: string; color: string }
    >;

    if (themePicker.childElementCount === 0) {
      themePicker.innerHTML = Object.entries(accentThemes)
        .map(
          ([key, theme]) => `
              <button
                class="theme-swatch"
                data-theme="${key}"
                title="${theme.label}"
                aria-label="${theme.label}"
                role="radio"
                aria-checked="false"
                style="--swatch-color: ${theme.color}"
                type="button"
              >
                <span class="swatch-color"></span>
                <span class="swatch-emoji">${theme.emoji}</span>
              </button>
            `,
        )
        .join("");
    }

    const activeTheme = State.data.preferences.nd.accentTheme || "sage";
    themePicker.querySelectorAll<HTMLElement>(".theme-swatch").forEach((s) => {
      const isActive = s.dataset.theme === activeTheme;
      s.classList.toggle("active", isActive);
      s.setAttribute("aria-checked", String(isActive));
    });
  },

  applyThemePreference() {
    const theme = State.data?.preferences?.theme;
    ThemeManager.applyFromPreference(theme);
  },

  applyLayoutVisibility() {
    // Mobile uses a different layout system (bottom tabs + Home-as-sidebar).
    // Desktop "hide/show" chrome controls don't translate well to small screens,
    // so force the primary chrome on and hide the floating handles.
    if (this.isMobileViewport()) {
      document.body.classList.remove(
        "hide-header",
        "hide-control-bar",
        "hide-sidebar",
        "hide-now-panel",
      );
      document.getElementById("layoutHandle")?.setAttribute("hidden", "");
      document.getElementById("sidebarHandle")?.setAttribute("hidden", "");
      return;
    }

    const defaults = State.getDefaultData().preferences;
    const layout = State.data?.preferences?.layout ?? defaults.layout;

    document.body.classList.toggle("hide-header", layout.showHeader === false);
    document.body.classList.toggle(
      "hide-control-bar",
      layout.showControlBar === false,
    );
    document.body.classList.toggle("hide-sidebar", layout.showSidebar === false);
    document.body.classList.toggle(
      "hide-now-panel",
      layout.showNowPanel === false,
    );

    const layoutHandle = document.getElementById("layoutHandle");
    if (layoutHandle) {
      if (layout.showHeader === false && !State.focusMode) {
        layoutHandle.removeAttribute("hidden");
      } else {
        layoutHandle.setAttribute("hidden", "");
      }
    }

    const sidebarHandle = document.getElementById("sidebarHandle");
    if (sidebarHandle) {
      // Hide sidebar handle on mobile devices (unnecessary on mobile)
      const isMobile = window.matchMedia("(max-width: 600px)").matches;
      if (layout.showSidebar === false && !State.focusMode && !isMobile) {
        sidebarHandle.removeAttribute("hidden");
      } else {
        sidebarHandle.setAttribute("hidden", "");
      }
    }
  },

  applySidebarVisibility() {
    const defaults = State.getDefaultData().preferences;
    const sidebar = State.data?.preferences?.sidebar ?? defaults.sidebar;

    document.body.classList.toggle(
      "hide-affirmation",
      sidebar.showAffirmation === false,
    );
    document.body.classList.toggle(
      "hide-whats-next",
      sidebar.showWhatsNext === false,
    );
    document.body.classList.toggle(
      "hide-achievements",
      sidebar.showAchievements === false,
    );
  },

  updateFocusLayoutVars() {
    const header = document.querySelector(".header") as HTMLElement | null;
    const controlBar = document.querySelector(".control-bar") as HTMLElement | null;
    const root = document.documentElement;

    if (header) {
      root.style.setProperty(
        "--focus-header-height",
        `${Math.max(56, header.offsetHeight)}px`,
      );
    }
    if (controlBar) {
      root.style.setProperty(
        "--focus-controlbar-height",
        `${Math.max(48, controlBar.offsetHeight)}px`,
      );
    }
  },

  setupFocusHoverReveal() {
    if (this._focusRevealSetup) return;
    this._focusRevealSetup = true;

    const revealTop = document.getElementById("focusRevealTop");
    const revealLeft = document.getElementById("focusRevealLeft");
    const focusHandle = document.getElementById("focusHandle");
    const header = document.querySelector(".header");
    const sidebar = document.querySelector(".sidebar");
    const controlBar = document.querySelector(".control-bar");

    const setHandleHidden = (hidden: boolean) => {
      if (!focusHandle) return;
      if (hidden) focusHandle.setAttribute("hidden", "");
      else focusHandle.removeAttribute("hidden");
    };

    const reveal = () => {
      if (!State.focusMode) return;
      document.body.classList.add("focus-ui-revealed");
      if (this._focusRevealHideTimer) clearTimeout(this._focusRevealHideTimer);
    };

    const scheduleHide = () => {
      if (this._focusRevealHideTimer) clearTimeout(this._focusRevealHideTimer);
      this._focusRevealHideTimer = setTimeout(() => {
        if (!State.focusMode) return;
        document.body.classList.remove("focus-ui-revealed");
      }, 500);
    };

    const toggleReveal = () => {
      if (!State.focusMode) return;
      const isRevealed = document.body.classList.contains("focus-ui-revealed");
      if (isRevealed) {
        document.body.classList.remove("focus-ui-revealed");
      } else {
        reveal();
      }
    };

    // Keep an always-available control for touch devices (no hover)
    setHandleHidden(!State.focusMode);

    [revealTop, revealLeft, header, sidebar, controlBar].forEach((el) => {
      if (!el) return;
      el.addEventListener("mouseenter", reveal);
      el.addEventListener("mouseleave", scheduleHide);
      el.addEventListener("focusin", reveal);
      el.addEventListener("focusout", scheduleHide);
    });

    [revealTop, revealLeft, focusHandle].forEach((el) => {
      if (!el) return;
      el.addEventListener("click", toggleReveal);
      el.addEventListener(
        "touchstart",
        () => {
          toggleReveal();
        },
        { passive: true },
      );
    });
  },

  syncViewButtons() {
    // Sync desktop view buttons
    document.querySelectorAll(".view-btn").forEach((btn) => {
      const isActive = (btn as HTMLElement).dataset.view === State.currentView;
      btn.classList.toggle("active", isActive);
      btn.setAttribute("aria-selected", String(isActive));
    });

    // Sync mobile tab bar
    const isMobileHomeView = document.body.classList.contains("mobile-home-view");
    document.querySelectorAll(".mobile-tab").forEach((tab) => {
      const tabView = (tab as HTMLElement).dataset.view;
      let isActive = false;
      if (tabView === "home") {
        isActive = isMobileHomeView;
      } else {
        isActive = !isMobileHomeView && tabView === State.currentView;
      }
      tab.classList.toggle("active", isActive);
      tab.setAttribute("aria-selected", String(isActive));
    });
  },

  showToast(iconOrMessage: string, messageOrType: string = "") {
    Toast.show(this.elements, iconOrMessage, messageOrType);
  },

  celebrate(emoji: string, title: string, text: string) {
    Celebration.show(this.elements, emoji, title, text);
  },

  closeCelebration() {
    Celebration.close(this.elements);
  },

  spawnConfetti() {
    Celebration.spawnConfetti(this.elements);
  },

  handleKeyboard(e: KeyboardEvent) {
    // Don't trigger shortcuts when typing in inputs
    const target = e.target as HTMLElement | null;
    if (
      target?.tagName === "INPUT" ||
      target?.tagName === "TEXTAREA" ||
      !!target?.isContentEditable
    ) {
      // Only allow Escape in inputs
      if (e.key !== "Escape") return;
    }

    // Escape to close modals
    if (e.key === "Escape") {
      document.querySelectorAll(".modal-overlay.active").forEach((modal) => {
        modal.remove();
      });
      this.closeGoalModal();
      this.closeCelebration();
    }

    // View switching: 1 = Year, 2 = Month, 3 = Week, 4 = Day
    if (e.key === "1" && !e.ctrlKey && !e.metaKey) {
      State.setView(VIEWS.YEAR);
      this.syncViewButtons();
      this.showToast("", "Year view");
    }
    if (e.key === "2" && !e.ctrlKey && !e.metaKey) {
      State.setView(VIEWS.MONTH);
      this.syncViewButtons();
      this.showToast("", "Month view");
    }
    if (e.key === "3" && !e.ctrlKey && !e.metaKey) {
      State.setView(VIEWS.WEEK);
      this.syncViewButtons();
      this.showToast("", "Week view");
    }
    if (e.key === "4" && !e.ctrlKey && !e.metaKey) {
      State.setView(VIEWS.DAY);
      this.syncViewButtons();
      this.showToast("", "Day view");
    }

    // Arrow key navigation
    if (e.key === "ArrowLeft" && !e.ctrlKey && !e.metaKey) {
      State.navigate(-1);
    }
    if (e.key === "ArrowRight" && !e.ctrlKey && !e.metaKey) {
      State.navigate(1);
    }

    // T for Today
    if (e.key === "t" && !e.ctrlKey && !e.metaKey) {
      State.goToDate(new Date());
      this.render();
      this.showToast("", "Jumped to today");
    }

    // Ctrl/Cmd + N for new anchor
    if ((e.ctrlKey || e.metaKey) && e.key === "n") {
      e.preventDefault();
      this.openGoalModal(this.getCurrentLevel(), State.viewingMonth, State.viewingYear);
    }

    // Ctrl/Cmd + F for focus mode
    if ((e.ctrlKey || e.metaKey) && e.key === "f" && !e.shiftKey) {
      e.preventDefault();
      this.toggleFocusMode();
    }

    // B for brain dump
    if (e.key === "b" && !e.ctrlKey && !e.metaKey) {
      NDSupport.showBrainDumpModal();
    }

    // I for Quick-Add Intention
    if (e.key === "i" && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      this.showQuickAdd();
    }

    // ? for keyboard shortcuts help
    if (e.key === "?" || (e.shiftKey && e.key === "/")) {
      this.showKeyboardShortcuts();
    }
  },

  // Show keyboard shortcuts help
  showKeyboardShortcuts() {
    const modal = document.createElement("div");
    modal.className = "modal-overlay active";
    modal.innerHTML = `
        <div class="modal">
          <div class="modal-header">
            <h2 class="modal-title">⌨️ Keyboard Shortcuts</h2>
            <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
          </div>
          <div class="modal-body">
            <div class="shortcuts-grid">
              <div class="shortcut-section">
                <h3>Views</h3>
                <div class="shortcut-item"><kbd>1</kbd> Year view</div>
                <div class="shortcut-item"><kbd>2</kbd> Month view</div>
                <div class="shortcut-item"><kbd>3</kbd> Week view</div>
                <div class="shortcut-item"><kbd>4</kbd> Day view</div>
              </div>
              <div class="shortcut-section">
                <h3>Navigation</h3>
                <div class="shortcut-item"><kbd>←</kbd> Previous</div>
                <div class="shortcut-item"><kbd>→</kbd> Next</div>
                <div class="shortcut-item"><kbd>T</kbd> Go to today</div>
              </div>
              <div class="shortcut-section">
                <h3>Actions</h3>
                <div class="shortcut-item"><kbd>⌘/Ctrl</kbd> + <kbd>N</kbd> New anchor</div>
                <div class="shortcut-item"><kbd>⌘/Ctrl</kbd> + <kbd>F</kbd> Focus (calmer view)</div>
                <div class="shortcut-item"><kbd>B</kbd> Brain dump</div>
                <div class="shortcut-item"><kbd>Esc</kbd> Close modal</div>
              </div>
            </div>
          </div>
        </div>
      `;
    document.body.appendChild(modal);
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.remove();
    });
  },

  // ============================================
  // Utility Methods
  // ============================================
  escapeHtml(text: string) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  },

  formatDate(dateString: string) {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  },

  formatMinutes(minutes: number) {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  },
};
