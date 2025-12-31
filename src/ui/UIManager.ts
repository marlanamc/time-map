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
import { MonthRenderer, WeekRenderer, MobileHereRenderer } from './renderers';
import { DayViewController } from '../components/dayView/DayViewController';
import { ThemeManager } from '../theme/ThemeManager';
import { eventBus } from '../core/EventBus';
import { viewportManager } from './viewport/ViewportManager';
import { zenFocus } from '../features/ZenFocus';
import { goalDetailModal } from './modals/GoalDetailModal';
import { monthDetailModal } from './modals/MonthDetailModal';
import { quickAdd } from '../features/QuickAdd';
import { isSupabaseConfigured } from '../supabaseClient';
import type { UIElements, FilterDocListeners, ViewType, Goal, GoalLevel, Category, Priority, AccentTheme, Subtask } from '../types';

export const UI = {
  els: {}, // Shortcut reference for elements
  elements: {} as UIElements, // Will be populated by cacheElements
  dayViewController: null as DayViewController | null, // New day view controller
  _filterDocListeners: null as FilterDocListeners | null, // For managing document event listeners
  _focusRevealSetup: false, // Whether focus reveal has been initialized
  _focusRevealHideTimer: null as ReturnType<typeof setTimeout> | null, // Timer for hiding focus reveal
  _supportPanelHideTimer: null as ReturnType<typeof setTimeout> | null,
  _lastNavKey: null as string | null,
  _renderRaf: null as number | null,
  _pendingViewTransition: false,
  _scrollResetRaf: null as number | null,
  _homeProgressScopeIndex: 3 as number, // 0=day,1=week,2=month,3=year
  goalModalYear: null as number | null, // Year selected in goal modal
  goalModalLevel: "milestone" as GoalLevel, // Level of goal being created in goal modal

  setupViewportMode() {
    // Set up callbacks for ViewportManager
    viewportManager.setCallbacks({
      onViewportChange: () => {
        // Recalculate canvas dimensions on orientation change
        if (this.elements.canvasContainer) {
          // Force a reflow to recalculate dimensions
          void this.elements.canvasContainer.offsetHeight;
        }
      },
      onRenderRequired: () => {
        // Re-render current view to adjust to new dimensions
        this.renderCurrentView();
      }
    });

    // Initialize viewport detection and responsive behavior
    viewportManager.setupViewportMode();
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
    this.setupEventBusListeners(); // Set up EventBus communication
    this.setupSyncEventListeners(); // Set up sync status event listeners
    this.setupZenFocusCallbacks(); // Set up ZenFocus feature callbacks
    this.setupGoalDetailModalCallbacks(); // Set up GoalDetailModal callbacks
    this.setupQuickAddCallbacks(); // Set up QuickAdd callbacks
    this.setupMonthDetailModalCallbacks(); // Set up MonthDetailModal callbacks
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

  /**
   * Set up EventBus listeners for decoupled communication with State
   * This resolves the State ↔ UI circular dependency
   */
  setupEventBusListeners() {
    // Listen for view changes from State
    eventBus.on('view:changed', (data) => {
      this.scheduleRender(data);
    });

    // Listen for view button sync requests
    eventBus.on('view:sync-buttons', () => {
      this.syncViewButtons?.();
    });

    // Listen for toast notifications
    eventBus.on('ui:toast', (data) => {
      Toast.show(this.elements, data.icon, data.message);
    });

    // Listen for celebration animations
    eventBus.on('ui:celebrate', (data) => {
      Celebration.show(this.elements, data.icon, data.title, data.message);
    });

    console.log('✓ EventBus listeners registered in UIManager');
  },

  /**
   * Set up sync status event listeners
   * Listens to SyncQueue events and updates UI accordingly
   */
  setupSyncEventListeners() {
    // Listen for sync errors from SyncQueue
    window.addEventListener('sync-error', ((e: CustomEvent) => {
      const message = e.detail?.message || 'Sync failed';
      this.updateSyncStatus('error');
      Toast.show(this.elements, '⚠️', message);
    }) as EventListener);

    // Listen for sync storage errors from SyncQueue
    window.addEventListener('sync-storage-error', ((e: CustomEvent) => {
      const message = e.detail?.message || 'Sync queue corrupted';
      this.updateSyncStatus('error');
      Toast.show(this.elements, '⚠️', message);
    }) as EventListener);

    // Generic sync status events (syncing/synced/error/local)
    window.addEventListener('sync-status', ((e: CustomEvent) => {
      const status = e.detail?.status as ('syncing' | 'synced' | 'error' | 'local' | undefined);
      if (!status) return;
      if (status === 'syncing' || status === 'synced' || status === 'error' || status === 'local') {
        this.updateSyncStatus(status);
      }
    }) as EventListener);

    console.log('✓ Sync event listeners registered in UIManager');
  },

  /**
   * Set up ZenFocus feature callbacks
   */
  setupZenFocusCallbacks() {
    zenFocus.setCallbacks({
      escapeHtml: this.escapeHtml.bind(this),
      onRender: () => this.render(),
      onToast: (icon, message) => Toast.show(this.elements, icon, message),
      onCelebrate: (icon, title, message) => Celebration.show(this.elements, icon, title, message)
    });
  },

  /**
   * Set up GoalDetailModal callbacks
   */
  setupGoalDetailModalCallbacks() {
    goalDetailModal.setCallbacks({
      escapeHtml: this.escapeHtml.bind(this),
      formatDate: this.formatDate.bind(this),
      formatMinutes: this.formatMinutes.bind(this),
      spawnPollenSparkles: this.spawnPollenSparkles.bind(this),
      onRender: () => this.render(),
      onToast: (icon, message) => Toast.show(this.elements, icon, message)
    });
  },

  /**
   * Set up QuickAdd callbacks
   */
  setupQuickAddCallbacks() {
    quickAdd.setCallbacks({
      onRender: () => this.render(),
      onToast: (icon, message) => Toast.show(this.elements, icon, message),
      onCelebrate: (icon, title, message) => Celebration.show(this.elements, icon, title, message)
    });
  },

  /**
   * Set up MonthDetailModal callbacks
   */
  setupMonthDetailModalCallbacks() {
    monthDetailModal.setCallbacks({
      escapeHtml: this.escapeHtml.bind(this),
      onRender: () => this.render(),
      onToast: (icon, message) => Toast.show(this.elements, icon, message),
      onShowGoalDetail: (goalId) => goalDetailModal.show(goalId)
    });
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
        viewportManager.updateMobileLayoutVars();
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

    // Mobile Home: cycle time position scope when tapping the flower.
    this.elements.gardenBloom?.addEventListener("click", () => {
      if (!viewportManager.isMobileViewport()) return;
      if (State.currentView !== VIEWS.HOME) return;
      this.cycleHomeProgressScope();
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
          case "syncNow":
            this.forceCloudSync();
            break;
          case "logout":
            this.handleLogout();
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
        goalDetailModal.show(goalId);
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

    // Time Theme Picker (Developer Tool)
    const timeThemePicker = document.getElementById("timeThemePicker");
    timeThemePicker?.addEventListener("click", (e) => {
      const target = e.target as Element | null;
      const btn = target?.closest(".time-theme-btn") as HTMLElement | null;
      if (!btn || !timeThemePicker.contains(btn)) return;
      const selectedTime = btn.dataset.time;
      if (!selectedTime) return;

      // Store the override in localStorage for dev purposes
      if (selectedTime === "auto") {
        localStorage.removeItem("gardenFence.devTimeOverride");
      } else {
        localStorage.setItem("gardenFence.devTimeOverride", selectedTime);
      }

      // Update all buttons
      timeThemePicker.querySelectorAll(".time-theme-btn").forEach((b) => {
        b.setAttribute("aria-checked", "false");
      });
      btn.setAttribute("aria-checked", "true");

      // Apply the time of day override
      this.applyTimeOfDayOverride(selectedTime);
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

  cycleHomeProgressScope() {
    // Day → Week → Month → Year
    this._homeProgressScopeIndex = (this._homeProgressScopeIndex + 1) % 4;
    this.updateYearProgress();
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

  async handleLogout() {
    if (!confirm("Log out? Any unsaved changes will be synced first.")) return;

    try {
      // Force final sync of pending changes
      const { batchSaveService } = await import('../services/BatchSaveService');
      await batchSaveService.forceSave();

      // Clean up resources
      await State.cleanup();

      // Sign out from Supabase
      const { SupabaseService } = await import('../services/SupabaseService');
      await SupabaseService.signOut();

      // Emit logout event
      eventBus.emit('auth:logout');

      // Reload to show auth modal
      location.reload();
    } catch (error) {
      console.error('Error during logout:', error);
      Toast.show(this.elements, '⚠️', 'Logout failed. Please try again.');
    }
  },

  async forceCloudSync() {
    if (!navigator.onLine) {
      Toast.show(this.elements, '📡', 'You appear to be offline. Changes will sync when you’re back online.');
      this.updateSyncStatus('local');
      return;
    }

    if (!isSupabaseConfigured) {
      Toast.show(this.elements, '⚙️', 'Cloud sync is disabled (missing Supabase credentials).');
      this.updateSyncStatus('local');
      return;
    }

    try {
      this.updateSyncStatus('syncing');
      const { batchSaveService } = await import('../services/BatchSaveService');
      const { syncQueue } = await import('../services/SyncQueue');
      await Promise.allSettled([batchSaveService.forceSave(), syncQueue.forceSync()]);
      this.updateSyncStatus('synced');
      Toast.show(this.elements, '☁️', 'Synced!');
    } catch (error) {
      console.error('Force sync failed:', error);
      this.updateSyncStatus('error');
      Toast.show(this.elements, '⚠️', 'Sync failed. Try again in a moment.');
    }
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
      viewportManager.isMobileViewport() &&
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

    // Mobile Home ("Here") uses the desktop sidebar layout.
    const isMobile = viewportManager.isMobileViewport();
    const isMobileHome = isMobile && State.currentView === VIEWS.HOME;
    document.body.classList.toggle("mobile-home-view", isMobileHome);
    if (this.elements.mobileHomeView) {
      // Legacy overlay is no longer used.
      this.elements.mobileHomeView.setAttribute("hidden", "");
    }
    if (isMobileHome) {
      this.updateMobileHomeView();
    }

    viewportManager.updateMobileLayoutVars();

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
    MobileHereRenderer.render(this.elements, this.escapeHtml.bind(this), (goalId) => goalDetailModal.show(goalId));
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

    // Context is rendered inline in each calendar view (Year/Month/Week).
    // The old bar took too much vertical space, so keep it hidden for all views.
    if (!State.data || State.currentView === VIEWS.HOME || State.currentView === VIEWS.DAY || State.currentView === VIEWS.YEAR || State.currentView === VIEWS.MONTH || State.currentView === VIEWS.WEEK) {
      container.innerHTML = "";
      container.setAttribute("hidden", "");
      return;
    }

    const view = State.currentView;
    const now = new Date();
    const viewingDate = State.viewingDate ?? now;
    const viewingYear = State.viewingYear ?? viewingDate.getFullYear();
    const viewingMonth = State.viewingMonth ?? viewingDate.getMonth();
    const isCollapsed = State.data.preferences.nd.contextBarCollapsed ?? false;

    const visibleLevels: GoalLevel[] = (() => {
      switch (view) {
        case VIEWS.YEAR:
          return ["vision", "milestone"];
        case VIEWS.MONTH:
          return ["vision", "milestone", "focus"];
        case VIEWS.WEEK:
          return ["vision", "milestone", "focus"];
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
        default:
          return Goals.getForDate(viewingDate);
      }
    })().filter((g) => g.status !== "done");

    // Calculate total goals for badge
    const totalGoals = visibleLevels.reduce((sum, level) => {
      return sum + goalsInRange.filter(g => g.level === level).length;
    }, 0);

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

    // Add collapsed/expanded class
    container.className = `level-context-bar ${isCollapsed ? 'collapsed' : 'expanded'}`;
    container.dataset.collapsed = String(isCollapsed);

    // Header bar with toggle button
    const headerHtml = `
      <div class="level-context-header-bar">
        <div class="level-context-title">
          <span class="context-icon">🎯</span>
          <span>Context</span>
          ${totalGoals > 0 ? `<span class="context-count-badge">${totalGoals}</span>` : ''}
        </div>
        <button
          class="btn-context-toggle"
          type="button"
          aria-label="${isCollapsed ? 'Expand context' : 'Collapse context'}"
          aria-expanded="${!isCollapsed}"
        >
          <svg class="chevron-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
        </button>
      </div>
    `;

    // Collapsible content wrapper
    const contentHtml = `
      <div class="level-context-content">
        ${visibleLevels.map(renderLevel).join("")}
      </div>
    `;

    container.innerHTML = headerHtml + contentHtml;
    container.removeAttribute("hidden");

    // Add toggle event listener
    const toggleBtn = container.querySelector('.btn-context-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        const newCollapsedState = !isCollapsed;
        State.data!.preferences.nd.contextBarCollapsed = newCollapsedState;
        State.save();
        this.renderLevelContextBar(); // Re-render with new state
      });
    }
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

  // Get context goals (Vision/Milestone/Focus) for a specific date
  getContextGoalsForDate(date: Date): { vision: Goal[], milestone: Goal[], focus: Goal[] } {
    if (!State.data) return { vision: [], milestone: [], focus: [] };

    const allGoals = State.data.goals.filter(g => g.status !== 'done');
    const viewingYear = date.getFullYear();
    const viewingMonth = date.getMonth();

    // Get week number for the date
    const weekNum = State.getWeekNumber(date);
    const weekStart = State.getWeekStart(viewingYear, weekNum);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    // Vision: goals for the year
    const vision = allGoals.filter(g => {
      if (g.level !== 'vision') return false;
      if (!g.year) return false;
      return g.year === viewingYear;
    }).slice(0, 2); // Show max 2

    // Milestone: goals for the month
    const milestone = allGoals.filter(g => {
      if (g.level !== 'milestone') return false;
      if (g.year === undefined || g.month === undefined) return false;
      return g.year === viewingYear && g.month === viewingMonth;
    }).slice(0, 2); // Show max 2

    // Focus: goals for the week
    const focus = allGoals.filter(g => {
      if (g.level !== 'focus') return false;
      if (!g.dueDate) return false;
      const dueDate = new Date(g.dueDate);
      return dueDate >= weekStart && dueDate <= weekEnd;
    }).slice(0, 2); // Show max 2

    return { vision, milestone, focus };
  },

  // Render Day View (New Modernized Implementation)
  renderDayView() {
    const container = this.elements.calendarGrid;
    if (!container) return;

    const date = State.viewingDate;
    const allGoals = State.data?.goals || [];

    // Initialize DayViewController if not already done
    if (!this.dayViewController) {
      this.dayViewController = new DayViewController(
        container,
        {
          onGoalUpdate: (goalId: string, updates: Partial<Goal>) => {
            Goals.update(goalId, updates);
            // Re-render to update the view
            if (this.dayViewController) {
              const contextGoals = this.getContextGoalsForDate(State.viewingDate);
              this.dayViewController.setGoals(State.viewingDate, State.data?.goals || [], contextGoals);
            }
          },
          onGoalClick: (goalId: string) => {
            goalDetailModal.show(goalId);
          },
          onZenFocus: (goalId: string) => {
            zenFocus.open(goalId);
          },
          onShowToast: (emoji: string, message: string) => {
            this.showToast(emoji, message);
          },
          onCelebrate: (emoji: string, title: string, message: string) => {
            this.celebrate(emoji, title, message);
          },
          onPlantSomething: () => {
            quickAdd.show();
          },
          onGetPreference: (key: string) => {
            return (State.data?.preferences.nd as any)?.[key];
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

    // Gather context goals (Vision/Milestone/Focus)
    const contextGoals = this.getContextGoalsForDate(date);

    // Set goals and render
    this.dayViewController.setGoals(date, allGoals, contextGoals);

    // Add day view style toggle
    this.ensureDayViewStyleToggle();
  },

  ensureDayViewStyleToggle() {
    const header = document.querySelector(".day-view-header");
    if (!header) return;

    // Remove any existing toggle to avoid duplicates
    const existing = header.querySelector(".day-style-toggle");
    if (existing) existing.remove();

    // Get current mode (default to planner)
    const currentMode = State.data?.preferences?.nd?.dayViewStyle || "planner";

    // Create mode switcher
    const toggle = document.createElement("div");
    toggle.className = "day-style-toggle";
    toggle.innerHTML = `
      <button class="day-mode-btn ${currentMode === "timeline" ? "active" : ""}" data-mode="timeline" title="Timeline View">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="3" y1="6" x2="21" y2="6"></line>
          <line x1="3" y1="12" x2="21" y2="12"></line>
          <line x1="3" y1="18" x2="21" y2="18"></line>
        </svg>
        <span>Timeline</span>
      </button>
      <button class="day-mode-btn ${currentMode === "simple" ? "active" : ""}" data-mode="simple" title="Simple View">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="8" y1="6" x2="21" y2="6"></line>
          <line x1="8" y1="12" x2="21" y2="12"></line>
          <line x1="8" y1="18" x2="21" y2="18"></line>
          <circle cx="4" cy="6" r="1" fill="currentColor"></circle>
          <circle cx="4" cy="12" r="1" fill="currentColor"></circle>
          <circle cx="4" cy="18" r="1" fill="currentColor"></circle>
        </svg>
        <span>Simple</span>
      </button>
      <button class="day-mode-btn ${currentMode === "planner" ? "active" : ""}" data-mode="planner" title="Planner View">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
        <span>Planner</span>
      </button>
    `;

    // Add click handlers
    toggle.querySelectorAll(".day-mode-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const mode = (btn as HTMLElement).dataset.mode as "timeline" | "simple" | "planner";

        // Update active state
        toggle.querySelectorAll(".day-mode-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        // Save preference
        if (State.data && State.data.preferences && State.data.preferences.nd) {
          State.data.preferences.nd.dayViewStyle = mode;
          State.save();
        }

        // Trigger re-render with new mode
        if (this.dayViewController) {
          this.dayViewController.render();
          Toast.show(this.elements, "✨", `Switched to ${mode.charAt(0).toUpperCase() + mode.slice(1)} mode`);
        }
      });
    });

    header.appendChild(toggle);
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
      monthDetailModal.show(monthIndex, viewingYear);
    });

    card.addEventListener("click", () => {
      monthDetailModal.show(monthIndex, viewingYear);
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
        goalDetailModal.show((el as HTMLElement).dataset.goalId);
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
    if (viewportManager.isMobileViewport()) {
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
  // ============================================
  // Month Detail View
  // ============================================
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

    const homeScopeViews: ViewType[] = [VIEWS.DAY, VIEWS.WEEK, VIEWS.MONTH, VIEWS.YEAR];
    const effectiveView: ViewType =
      State.currentView === VIEWS.HOME
        ? homeScopeViews[this._homeProgressScopeIndex] ?? VIEWS.YEAR
        : State.currentView;

    const isHome = State.currentView === VIEWS.HOME;
    const scopeYear = isHome ? now.getFullYear() : State.viewingYear;
    const scopeMonth = isHome ? now.getMonth() : State.viewingMonth;
    const scopeDate = isHome ? now : State.viewingDate;

    switch (effectiveView) {
      case VIEWS.MONTH: {
        label = "Month position";
        start = new Date(scopeYear, scopeMonth, 1);
        end = new Date(scopeYear, scopeMonth + 1, 1);
        break;
      }
      case VIEWS.WEEK: {
        label = "Week position";
        if (isHome) {
          const wy = State.getWeekYear(now);
          const wn = State.getWeekNumber(now);
          start = State.getWeekStart(wy, wn);
        } else {
          start = State.getWeekStart(State.viewingYear, State.viewingWeek ?? 1);
        }
        end = new Date(start);
        end.setDate(end.getDate() + 7);
        break;
      }
      case VIEWS.DAY: {
        label = "Day position";
        start = new Date(scopeDate);
        start.setHours(0, 0, 0, 0);
        end = new Date(start);
        end.setDate(end.getDate() + 1);
        break;
      }
      case VIEWS.YEAR:
      default: {
        label = "Year position";
        start = new Date(scopeYear, 0, 1);
        end = new Date(scopeYear + 1, 0, 1);
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
    goalDetailModal.show(randomGoal.id);
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
    const isMobile = viewportManager.isMobileViewport();
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

    // Sync Time Theme Picker (Developer Tool)
    const timeThemePicker = document.getElementById("timeThemePicker");
    if (timeThemePicker) {
      const devTimeOverride = localStorage.getItem("gardenFence.devTimeOverride") || "auto";
      timeThemePicker.querySelectorAll<HTMLElement>(".time-theme-btn").forEach((btn) => {
        const isActive = btn.dataset.time === devTimeOverride;
        btn.setAttribute("aria-checked", String(isActive));
      });
    }
  },

  applyThemePreference() {
    const theme = State.data?.preferences?.theme;
    ThemeManager.applyFromPreference(theme);
  },

  applyLayoutVisibility() {
    // Mobile uses a different layout system (bottom tabs + Home-as-sidebar).
    // Desktop "hide/show" chrome controls don't translate well to small screens,
    // so force the primary chrome on and hide the floating handles.
    if (viewportManager.isMobileViewport()) {
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
      const isMobile = viewportManager.isMobileViewport();
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
      quickAdd.show();
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

  applyTimeOfDayOverride(timeOfDay: string) {
    const root = document.documentElement;

    // Remove all time classes
    root.classList.remove("time-dawn", "time-morning", "time-afternoon", "time-evening", "time-night");

    if (timeOfDay === "auto") {
      // Determine actual time of day
      const now = new Date();
      const hour = now.getHours();
      let actualTime = "night";
      if (hour >= 5 && hour < 7) actualTime = "dawn";
      else if (hour >= 7 && hour < 12) actualTime = "morning";
      else if (hour >= 12 && hour < 17) actualTime = "afternoon";
      else if (hour >= 17 && hour < 20) actualTime = "evening";

      root.classList.add(`time-${actualTime}`);
    } else {
      // Apply the override
      root.classList.add(`time-${timeOfDay}`);
    }

    // Trigger a garden update if available
    if ((window as any).gardenEngine) {
      (window as any).gardenEngine.update();
    }
  },
};
