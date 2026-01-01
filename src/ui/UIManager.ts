// ===================================
// UI Manager - Main UI Orchestration
// ===================================
import { State } from '../core/State';
import { Goals } from '../core/Goals';
import { Planning } from '../core/Planning';
import { Streaks } from '../core/Streaks';
import { CONFIG, ND_CONFIG, VIEWS } from '../config';
import { TimeBreakdown } from '../utils/TimeBreakdown';
import { cacheElements } from './elements/UIElements';
import { Toast } from './feedback/Toast';
import { Celebration } from './feedback/Celebration';
import { MonthRenderer, WeekRenderer, MobileHereRenderer, GardenRenderer } from './renderers';
import type { DayViewController } from '../components/dayView/DayViewController';
import { ThemeManager } from '../theme/ThemeManager';
import { eventBus } from '../core/EventBus';
import { viewportManager } from './viewport/ViewportManager';
import { goalDetailModal } from './modals/GoalDetailModal';
import { monthDetailModal } from './modals/MonthDetailModal';
import { isSupabaseConfigured } from '../supabaseClient';
import { batchSaveService } from '../services/BatchSaveService';
import { SupabaseService } from '../services/SupabaseService';
import { syncQueue } from '../services/SyncQueue';
import { SwipeNavigator } from './gestures/SwipeNavigator';
import { haptics } from '../utils/haptics';
import { createFeatureLoaders } from './featureLoaders';
import type { FeatureLoaders, NDSupportApi, AppSettingsApi, ZenFocusApi, QuickAddApi } from './featureLoaders';
import * as goalModal from './goalModal';
import * as weeklyReview from './weeklyReview';
import * as focusMode from './focusMode';
import * as keyboardShortcuts from './keyboardShortcuts';
import * as syncIssues from './syncIssues';
import type { UIElements, FilterDocListeners, ViewType, Goal, GoalLevel, AccentTheme, Subtask } from '../types';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

export const UI = {
  els: {}, // Shortcut reference for elements
  elements: {} as UIElements, // Will be populated by cacheElements
  dayViewController: null as DayViewController | null, // New day view controller
  _dayViewControllerCtor: null as (new (...args: any[]) => DayViewController) | null,
  _dayViewControllerLoading: null as Promise<void> | null,
  _featureLoaders: null as FeatureLoaders | null,
  _filterDocListeners: null as FilterDocListeners | null, // For managing document event listeners
  _focusRevealSetup: false, // Whether focus reveal has been initialized
  _focusRevealHideTimer: null as ReturnType<typeof setTimeout> | null, // Timer for hiding focus reveal
  _supportPanelHideTimer: null as ReturnType<typeof setTimeout> | null,
  _lastNavKey: null as string | null,
  _renderRaf: null as number | null,
  _pendingViewTransition: false,
  _scrollResetRaf: null as number | null,
  _homeProgressScopeIndex: 3 as number, // 0=day,1=week,2=month,3=year
  _deferredInstallPrompt: null as BeforeInstallPromptEvent | null,
  _rendererEventListenersSetup: false,
  _swipeNavigator: null as SwipeNavigator | null,
  _pullToRefreshCleanup: null as (() => void) | null,
  goalModalYear: null as number | null, // Year selected in goal modal
  goalModalLevel: "milestone" as GoalLevel, // Level of goal being created in goal modal

  getFeatureLoaders(): FeatureLoaders {
    if (this._featureLoaders) return this._featureLoaders;
    this._featureLoaders = createFeatureLoaders({
      toast: (iconOrMessage, messageOrType) =>
        this.showToast(iconOrMessage, messageOrType ?? ""),
      appSettingsCallbacks: {
        onShowToast: (message, type) => this.showToast(message, type ?? ""),
        onScheduleRender: () => this.scheduleRender(),
        onShowKeyboardShortcuts: () => this.showKeyboardShortcuts(),
        onSetFocusMode: (enabled, options) => this.setFocusMode(enabled, options),
        onApplyLayoutVisibility: () => this.applyLayoutVisibility(),
        onApplySidebarVisibility: () => this.applySidebarVisibility(),
        onSyncViewButtons: () => this.syncViewButtons(),
      },
    });
    return this._featureLoaders;
  },

  getLevelLabel(level: GoalLevel, opts?: { lowercase?: boolean; plural?: boolean }): string {
    const base = (() => {
      switch (level) {
        case "vision":
          return "Vision";
        case "milestone":
          return "Milestone";
        case "focus":
          return "Focus";
        case "intention":
          return "Intention";
        default:
          return "Intention";
      }
    })();

    const plural = opts?.plural
      ? base === "Focus"
        ? "Focuses"
        : `${base}s`
      : base;
    return opts?.lowercase ? plural.toLowerCase() : plural;
  },

  async ensureNDSupport(): Promise<NDSupportApi> {
    return this.getFeatureLoaders().ensureNDSupport();
  },

  async ensureAppSettings(): Promise<AppSettingsApi> {
    return this.getFeatureLoaders().ensureAppSettings();
  },

  async ensureZenFocus(): Promise<ZenFocusApi | null> {
    return this.getFeatureLoaders().ensureZenFocus();
  },

  async ensureQuickAdd(): Promise<QuickAddApi | null> {
    return this.getFeatureLoaders().ensureQuickAdd();
  },

  deferNDSupportInit() {
    this.getFeatureLoaders().deferNDSupportInit();
  },

  async applyAccessibilityPreferences(): Promise<void> {
    await this.getFeatureLoaders().applyAccessibilityPreferences();
  },

  syncAddButtonLabel() {
    const btn = document.getElementById("addGoalBtn");
    if (!btn) return;
    const level = this.getCurrentLevel();
    const label = this.getLevelLabel(level);
    btn.setAttribute("aria-label", `Set new ${label.toLowerCase()}`);
    btn.setAttribute("title", `Set new ${label.toLowerCase()}`);
  },

  setupViewportMode() {
    // Set up callbacks for ViewportManager
    viewportManager.setCallbacks({
      onViewportChange: () => {
        // Recalculate canvas dimensions on orientation change
        if (this.elements.canvasContainer) {
          // Force a reflow to recalculate dimensions
          void this.elements.canvasContainer.offsetHeight;
        }
        this.setupSwipeNavigation();
        this.setupPullToRefresh();
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


  updateSyncStatus(status: 'syncing' | 'synced' | 'error' | 'local' | 'offline'): void {
    const el = document.getElementById("syncStatus");
    const supportPanelEl = document.getElementById("supportPanelSyncStatus");

    const updateElement = (element: HTMLElement | null) => {
      if (!element) return;
      const icon = element.querySelector(".sync-icon");
      const text = element.querySelector(".sync-text");

      element.classList.remove("syncing", "synced", "error", "offline");

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
      } else if (status === 'offline') {
        element.classList.add("offline");
        if (icon) icon.textContent = "📴";
        if (text) text.textContent = "Offline";
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
    this.setupRendererEventListeners();
    this.bindEvents();
    this.setupEventBusListeners(); // Set up EventBus communication
    this.setupSyncEventListeners(); // Set up sync status event listeners
    this.setupInstallPrompt(); // Set up PWA install prompt handling
    void this.setupZenFocusCallbacks(); // Set up ZenFocus feature callbacks
    this.setupGoalDetailModalCallbacks(); // Set up GoalDetailModal callbacks
    void this.setupQuickAddCallbacks(); // Set up QuickAdd callbacks
    this.setupMonthDetailModalCallbacks(); // Set up MonthDetailModal callbacks
    this.setupViewportMode();
    this.setupSwipeNavigation();
    this.setupPullToRefresh();
    this.syncAddButtonLabel();
    this.applySavedUIState();
    this.render();
    this.hideInitialLoadingUI();
    this.updateTimeDisplay();
    this.updateYearProgress();
    this.renderAchievements();

    // Initialize ND Support features after initial paint to keep first-load snappy.
    this.deferNDSupportInit();

    // Set up periodic updates
    setInterval(() => this.updateTimeDisplay(), 60000);

    // Update body double timer display
    setInterval(() => this.updateBodyDoubleDisplay(), 1000);

    // Check for weekly review prompt
    if (Planning.shouldPromptReview()) {
      setTimeout(() => this.showReviewPrompt(), 3000);
    }
  },

  setupRendererEventListeners() {
    if (this._rendererEventListenersSetup) return;
    this._rendererEventListenersSetup = true;

    this.elements.calendarGrid?.addEventListener("goal-click", (e) => {
      const ev = e as CustomEvent<{ goalId?: string }>;
      const goalId = ev.detail?.goalId;
      if (goalId) goalDetailModal.show(goalId);
    });
  },

  setupSwipeNavigation() {
    const isMobile = viewportManager.isMobileViewport();
    const el = this.elements.canvasContainer;
    if (!isMobile || !el) {
      this._swipeNavigator?.detach();
      this._swipeNavigator = null;
      return;
    }

    if (!this._swipeNavigator) {
      const shouldHandleStart = (target: Element | null) => {
        if (!target) return true;
        return !(
          target.closest("input") ||
          target.closest("textarea") ||
          target.closest("select") ||
          target.closest("button") ||
          target.closest("a") ||
          target.closest(".modal") ||
          target.closest(".modal-overlay") ||
          target.closest(".support-panel") ||
          target.closest("[data-disable-swipe]")
        );
      };

      const viewOrder: ViewType[] = [VIEWS.HOME, VIEWS.DAY, VIEWS.WEEK, VIEWS.MONTH, VIEWS.YEAR];
      const navigate = (dir: "left" | "right") => {
        const idx = viewOrder.indexOf(State.currentView);
        if (idx === -1) return;
        const nextIdx = dir === "left" ? idx + 1 : idx - 1;
        if (nextIdx < 0 || nextIdx >= viewOrder.length) return;
        State.setView(viewOrder[nextIdx]);
      };

      this._swipeNavigator = new SwipeNavigator({
        onSwipe: (direction) => navigate(direction),
        shouldHandleStart,
      });
    }

    this._swipeNavigator.attach(el);
  },

  setupPullToRefresh() {
    const isMobile = viewportManager.isMobileViewport();
    const container = this.elements.canvasContainer;
    const indicator = document.getElementById("pullToRefresh");
    const labelEl = document.getElementById("pullToRefreshLabel");

    if (!isMobile || !container || !indicator) {
      this._pullToRefreshCleanup?.();
      this._pullToRefreshCleanup = null;
      return;
    }

    // Already attached
    if (this._pullToRefreshCleanup) return;

    const thresholdPx = 72;
    const maxPullPx = 140;

    let startX = 0;
    let startY = 0;
    let pulling = false;
    let locked = false;
    let pullPx = 0;

    const canStart = (target: Element | null) => {
      if (!target) return true;
      return !(
        target.closest("input") ||
        target.closest("textarea") ||
        target.closest("select") ||
        target.closest("button") ||
        target.closest("a") ||
        target.closest(".modal") ||
        target.closest(".modal-overlay") ||
        target.closest(".support-panel") ||
        target.closest("[data-disable-pull-to-refresh]")
      );
    };

    const setIndicator = (opts: { active: boolean; pull?: number; ready?: boolean; loading?: boolean; label?: string }) => {
      indicator.classList.toggle("active", !!opts.active);
      indicator.classList.toggle("ready", !!opts.ready);
      indicator.classList.toggle("loading", !!opts.loading);
      if (typeof opts.pull === "number") {
        indicator.style.setProperty("--ptr-pull", `${opts.pull}px`);
      }
      if (labelEl && typeof opts.label === "string") {
        labelEl.textContent = opts.label;
      }
    };

    const reset = () => {
      pulling = false;
      locked = false;
      pullPx = 0;
      setIndicator({ active: false, pull: 0, ready: false, loading: false, label: "Pull to refresh" });
    };

    const doRefresh = async () => {
      if (!navigator.onLine) {
        this.showToast("📴", "Offline — can’t refresh");
        haptics.impact("light");
        return;
      }

      const prevData = State.data;
      try {
        await State.load();
        if (!State.data && prevData) State.data = prevData;
        this.render();
        this.showToast("🔄", "Refreshed");
        haptics.impact("medium");
      } catch (e) {
        console.error("Pull-to-refresh failed:", e);
        if (!State.data && prevData) State.data = prevData;
        this.showToast("⚠️", "Refresh failed");
        haptics.impact("light");
      }
    };

    const onTouchStart = (e: TouchEvent) => {
      if (!canStart(e.target as Element | null)) return;
      if (container.scrollTop > 0) return;
      if (e.touches.length !== 1) return;

      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      pulling = true;
      locked = false;
      pullPx = 0;
      setIndicator({ active: true, pull: 0, ready: false, loading: false, label: "Pull to refresh" });
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!pulling) return;
      if (container.scrollTop > 0) return reset();
      if (e.touches.length !== 1) return reset();

      const t = e.touches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      if (dy <= 0) return reset();

      // Only handle if it is mostly vertical. If the user is swiping horizontally, bail.
      if (!locked) {
        if (Math.abs(dx) > Math.abs(dy) * 0.75) return reset();
        locked = true;
      }

      // We are handling the gesture: prevent scroll bounce and take control.
      e.preventDefault();
      pullPx = Math.min(maxPullPx, dy * 0.9);
      const ready = pullPx >= thresholdPx;
      setIndicator({
        active: true,
        pull: pullPx,
        ready,
        loading: false,
        label: ready ? "Release to refresh" : "Pull to refresh",
      });
    };

    const onTouchEnd = async () => {
      if (!pulling) return;
      const shouldRefresh = pullPx >= thresholdPx;
      pulling = false;
      locked = false;

      if (!shouldRefresh) return reset();

      setIndicator({ active: true, pull: thresholdPx, ready: true, loading: true, label: "Refreshing…" });
      await doRefresh();
      window.setTimeout(reset, 450);
    };

    container.addEventListener("touchstart", onTouchStart, { passive: true });
    container.addEventListener("touchmove", onTouchMove, { passive: false });
    container.addEventListener("touchend", onTouchEnd, { passive: true });
    container.addEventListener("touchcancel", reset, { passive: true });

    this._pullToRefreshCleanup = () => {
      container.removeEventListener("touchstart", onTouchStart);
      container.removeEventListener("touchmove", onTouchMove);
      container.removeEventListener("touchend", onTouchEnd);
      container.removeEventListener("touchcancel", reset);
      reset();
    };
  },

  hideInitialLoadingUI() {
    const loading = document.getElementById("appLoading");
    if (!loading) return;

    // Allow initial paint of the skeleton before fading it out.
    window.requestAnimationFrame(() => {
      loading.classList.add("loaded");
      window.setTimeout(() => loading.remove(), 650);
    });
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
      Toast.show(this.elements, '⚠️', `Sync needs attention: ${message}`);
      this.syncSyncIssuesBadge();
    }) as EventListener);

    // Listen for sync storage errors from SyncQueue
    window.addEventListener('sync-storage-error', ((e: CustomEvent) => {
      const message = e.detail?.message || 'Sync queue corrupted';
      this.updateSyncStatus('error');
      Toast.show(this.elements, '⚠️', `Sync error: ${message}`);
    }) as EventListener);

    // Generic sync status events (syncing/synced/error/local)
    window.addEventListener('sync-status', ((e: CustomEvent) => {
      const status = e.detail?.status as ('syncing' | 'synced' | 'error' | 'local' | 'offline' | undefined);
      if (!status) return;
      if (status === 'syncing' || status === 'synced' || status === 'error' || status === 'local' || status === 'offline') {
        this.updateSyncStatus(status);
      }
    }) as EventListener);

    console.log('✓ Sync event listeners registered in UIManager');
  },

  syncSyncIssuesBadge() {
    const btn = document.getElementById("syncIssuesBtn");
    if (!btn) return;
    const count = syncIssues.getFailureCount();
    btn.classList.toggle("install-available", count > 0);
    if (count > 0) {
      btn.removeAttribute("hidden");
      const desc = btn.querySelector(".support-panel-desc");
      if (desc) desc.textContent = `${count} change${count === 1 ? "" : "s"} need review`;
    } else {
      btn.setAttribute("hidden", "");
      const desc = btn.querySelector(".support-panel-desc");
      if (desc) desc.textContent = "Resolve failed sync changes";
    }
  },

  setupInstallPrompt() {
    const installBtn = document.getElementById("installAppBtn");
    if (!installBtn) return;

    const supportPanelToggleBtn = document.getElementById("supportPanelToggleBtn");
    const supportPanelToggleBtnMobile = document.getElementById("supportPanelToggleBtnMobile");
    const supportPanelBtn = document.getElementById("supportPanelBtn");
    const toggleBtns = [supportPanelToggleBtn, supportPanelToggleBtnMobile, supportPanelBtn].filter(
      Boolean,
    ) as HTMLElement[];

    const INSTALL_TOAST_LAST_SHOWN_KEY = "gardenFence.install.toastShownAt";
    const INSTALL_PROMPT_DISMISSED_AT_KEY = "gardenFence.install.dismissedAt";
    const INSTALL_TOAST_COOLDOWN_MS = 1000 * 60 * 60 * 24; // 24h

    const readNumber = (key: string) => {
      try {
        const raw = localStorage.getItem(key);
        const parsed = raw ? Number.parseInt(raw, 10) : NaN;
        return Number.isFinite(parsed) ? parsed : 0;
      } catch {
        return 0;
      }
    };

    const writeNow = (key: string) => {
      try {
        localStorage.setItem(key, String(Date.now()));
      } catch {
        // ignore
      }
    };

    const setInstallAvailable = (available: boolean) => {
      installBtn.classList.toggle("install-available", available);
      toggleBtns.forEach((btn) => btn.classList.toggle("install-available", available));

      if (available) installBtn.removeAttribute("hidden");
      else installBtn.setAttribute("hidden", "");
    };

    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      this._deferredInstallPrompt = e as BeforeInstallPromptEvent;
      setInstallAvailable(true);

      const lastToastAt = readNumber(INSTALL_TOAST_LAST_SHOWN_KEY);
      const dismissedAt = readNumber(INSTALL_PROMPT_DISMISSED_AT_KEY);
      const now = Date.now();
      const canToast =
        now - lastToastAt > INSTALL_TOAST_COOLDOWN_MS &&
        now - dismissedAt > INSTALL_TOAST_COOLDOWN_MS;
      if (canToast) {
      Toast.show(this.elements, "📲", "Install is available in Support Tools.");
        writeNow(INSTALL_TOAST_LAST_SHOWN_KEY);
      }
    });

    window.addEventListener("appinstalled", () => {
      this._deferredInstallPrompt = null;
      setInstallAvailable(false);
      Toast.show(this.elements, "✅", "App installed.");
    });

    this.syncSyncIssuesBadge();
  },

  async promptInstall() {
    const installBtn = document.getElementById("installAppBtn");
    const deferred = this._deferredInstallPrompt;
    if (!deferred) {
      Toast.show(this.elements, "ℹ️", "Install isn’t available right now.");
      return;
    }

    try {
      await deferred.prompt();
      const choice = await deferred.userChoice.catch(() => null);
      if (choice?.outcome === "accepted") {
        Toast.show(this.elements, "✅", "Installing…");
      } else if (choice?.outcome === "dismissed") {
        try {
          localStorage.setItem(
            "gardenFence.install.dismissedAt",
            String(Date.now()),
          );
        } catch {
          // ignore
        }
        Toast.show(this.elements, "👍", "Not now.");
      }
    } catch (error) {
      console.error("Install prompt failed:", error);
      Toast.show(this.elements, "⚠️", "Install failed.");
    } finally {
      this._deferredInstallPrompt = null;
      installBtn?.setAttribute("hidden", "");
    }
  },

  /**
   * Set up ZenFocus feature callbacks
   */
  async setupZenFocusCallbacks() {
    const zenFocus = await this.ensureZenFocus();
    zenFocus?.setCallbacks({
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
  async setupQuickAddCallbacks() {
    const quickAdd = await this.ensureQuickAdd();
    quickAdd?.setCallbacks({
      onRender: () => this.render(),
      onToast: (icon, message) => Toast.show(this.elements, icon, message),
      onCelebrate: (icon, title, message) => Celebration.show(this.elements, icon, title, message)
    });
  },

  openQuickAdd() {
    void this.ensureQuickAdd().then((qa) => qa?.show());
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
    const remaining = this.getFeatureLoaders().getNDSupportIfLoaded()?.getBodyDoubleRemaining?.();
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
            void this.ensureNDSupport().then((nd) => nd.showBrainDumpModal());
            break;
          case "bodyDouble":
            void this.ensureNDSupport().then((nd) => nd.showBodyDoubleModal());
            break;
          case "quickWins":
            void this.ensureNDSupport().then((nd) => nd.showDopamineMenu());
            break;
          case "ndSettings":
            void this.ensureNDSupport().then((nd) => nd.showSettingsPanel());
            break;
          case "settings":
            void this.ensureAppSettings().then((s) => s.showPanel());
            break;
          case "syncNow":
            this.forceCloudSync();
            break;
          case "install":
            void this.promptInstall();
            break;
          case "syncIssues":
            syncIssues.showSyncIssuesModal({
              showToast: (iconOrMessage, messageOrType) =>
                this.showToast(iconOrMessage, messageOrType ?? ""),
              updateSyncStatus: (status) => this.updateSyncStatus(status),
            });
            this.syncSyncIssuesBadge();
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
      void this.applyAccessibilityPreferences();
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
      ?.addEventListener("click", () => void this.ensureAppSettings().then((s) => s.showPanel()));

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
      ?.addEventListener("click", () => void this.ensureNDSupport().then((nd) => nd.showBrainDumpModal()));
    document
      .getElementById("bodyDoubleBtn")
      ?.addEventListener("click", () => void this.ensureNDSupport().then((nd) => nd.showBodyDoubleModal()));
    document
      .getElementById("ndSettingsBtn")
      ?.addEventListener("click", () => void this.ensureNDSupport().then((nd) => nd.showSettingsPanel()));
    document
      .getElementById("appearanceBtn")
      ?.addEventListener("click", () => void this.ensureNDSupport().then((nd) => nd.showAppearancePanel()));
    document
      .getElementById("dopamineMenuBtn")
      ?.addEventListener("click", () => void this.ensureNDSupport().then((nd) => nd.showDopamineMenu()));

    // Body double stop button
    document.getElementById("bdStop")?.addEventListener("click", () => {
      if (!State.data) return;
      const sessions = State.data.bodyDoubleHistory;
      const active = sessions[sessions.length - 1];
      if (active && !active.endedAt) {
        void this.ensureNDSupport().then((nd) => nd.endBodyDouble(active.id, false));
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
    this.updateTimeDisplay(); // Update stats when scope changes
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
      await batchSaveService.forceSave();

      // Clean up resources
      await State.cleanup();

      // Sign out from Supabase
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
    // Garden view also uses sidebar-like layout on mobile
    const isMobile = viewportManager.isMobileViewport();
    const isMobileHome = isMobile && State.currentView === VIEWS.HOME;
    const isMobileGarden = isMobile && State.currentView === VIEWS.GARDEN;
    document.body.classList.toggle("mobile-home-view", isMobileHome);
    document.body.classList.toggle("mobile-garden-view", isMobileGarden);
    if (this.elements.mobileHomeView) {
      // Legacy overlay is no longer used.
      this.elements.mobileHomeView.setAttribute("hidden", "");
    }
    if (isMobileHome) {
      this.updateMobileHomeView();
    }

    viewportManager.updateMobileLayoutVars();
    this.syncAddButtonLabel();

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
      case VIEWS.GARDEN:
        GardenRenderer.render(
          this.elements,
          this.escapeHtml.bind(this),
          (goalId) => goalDetailModal.show(goalId),
          (level) => this.openGoalModal(level, State.viewingMonth, State.viewingYear),
        );
        break;
      default:
        this.renderCalendar();
    }
  },

  renderLevelContextBar() {
    const container = this.elements.levelContextBar;
    if (!container) return;

    // Level context bar is no longer needed - always hide it
    container.innerHTML = "";
    container.setAttribute("hidden", "");
    container.style.display = "none";
    return;
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

    if (!this._dayViewControllerCtor) {
      container.innerHTML = `
        <div class="mobile-card" style="max-width: 520px; margin: 0 auto;">
          <div class="card-label">Loading…</div>
          <div style="opacity: 0.8; padding-top: 8px;">Preparing Day view</div>
        </div>
      `;
      void this.ensureDayViewControllerCtor().then(() => {
        if (State.currentView === VIEWS.DAY) this.renderDayView();
      });
      return;
    }

    const date = State.viewingDate;
    const allGoals = State.data?.goals || [];

    // Initialize DayViewController if not already done
    if (!this.dayViewController) {
      this.dayViewController = new this._dayViewControllerCtor(
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
            void this.ensureZenFocus().then((zf) => zf?.open(goalId));
          },
          onShowToast: (emoji: string, message: string) => {
            this.showToast(emoji, message);
          },
          onCelebrate: (emoji: string, title: string, message: string) => {
            this.celebrate(emoji, title, message);
          },
          onPlantSomething: () => {
            void this.ensureQuickAdd().then((qa) => qa?.show());
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

  async ensureDayViewControllerCtor(): Promise<void> {
    if (this._dayViewControllerCtor) return;
    if (this._dayViewControllerLoading) return this._dayViewControllerLoading;

    this._dayViewControllerLoading = import("../components/dayView/DayViewController")
      .then((mod) => {
        this._dayViewControllerCtor = mod.DayViewController as any;
      })
      .catch((err) => {
        console.error("Failed to load DayViewController:", err);
        this.showToast("⚠️", "Couldn’t load Day view");
      })
      .finally(() => {
        this._dayViewControllerLoading = null;
      });

    return this._dayViewControllerLoading;
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
        if (State.data) {
          State.data.preferences.nd = {
            ...(State.data.preferences.nd || {}),
            dayViewStyle: mode,
          };
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
            <button class="btn btn-icon btn-ghost goal-edit-btn" data-goal-id="${goal.id}" type="button" aria-label="Options">⋮</button>
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
    goalModal.openGoalModal(this, level, preselectedMonth, preselectedYear);
  },

  closeGoalModal() {
    goalModal.closeGoalModal(this);
  },

  setFieldVisibility(element: HTMLElement | null, visible: boolean) {
    goalModal.setFieldVisibility(element, visible);
  },

  populateMonthSelect(
    preselectedMonth: number | null = null,
    year: number | null = null,
  ) {
    goalModal.populateMonthSelect(this, preselectedMonth, year);
  },

  updateGoalModalTimeBreakdown() {
    goalModal.updateGoalModalTimeBreakdown(this);
  },

  handleGoalSubmit(e: Event) {
    goalModal.handleGoalSubmit(this, e);
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
    weeklyReview.showReviewPrompt(this);
  },

  showWeeklyReview() {
    weeklyReview.showWeeklyReview(this);
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

    // Days and weeks left - based on current scope (day, week, month, year) when in home view
    // Otherwise, default to year stats
    const homeScopeViews: ViewType[] = [VIEWS.DAY, VIEWS.WEEK, VIEWS.MONTH, VIEWS.YEAR];
    const effectiveView: ViewType =
      State.currentView === VIEWS.HOME
        ? homeScopeViews[this._homeProgressScopeIndex] ?? VIEWS.YEAR
        : VIEWS.YEAR; // Default to year stats when not in home view

    const isHome = State.currentView === VIEWS.HOME;
    const scopeYear = isHome ? now.getFullYear() : State.viewingYear;
    const scopeMonth = isHome ? now.getMonth() : State.viewingMonth;
    const scopeDate = isHome ? now : State.viewingDate;

    let end: Date;
    let daysLeft: number;
    let weeksLeft: number;
    let daysLeftLabel = 'Days Left';
    let weeksLeftLabel = 'Weeks Left';
    let daysAriaLabel = 'Days left in year';
    let weeksAriaLabel = 'Weeks left in year';

    switch (effectiveView) {
      case VIEWS.DAY: {
        // Days/hours left in current day
        end = new Date(scopeDate);
        end.setHours(23, 59, 59, 999);
        const hoursLeft = Math.max(0, (end.getTime() - now.getTime()) / (1000 * 60 * 60));
        daysLeft = hoursLeft > 0 ? 1 : 0; // Show 1 if any time left, 0 if day is over
        weeksLeft = Math.ceil(hoursLeft);
        daysLeftLabel = 'Days Left';
        weeksLeftLabel = 'Hours Left';
        daysAriaLabel = 'Days left today';
        weeksAriaLabel = 'Hours left today';
        break;
      }
      case VIEWS.WEEK: {
        // Days left in current week
        if (isHome) {
          const wy = State.getWeekYear(now);
          const wn = State.getWeekNumber(now);
          end = State.getWeekStart(wy, wn);
          end.setDate(end.getDate() + 7);
        } else {
          end = State.getWeekStart(State.viewingYear, State.viewingWeek ?? 1);
          end.setDate(end.getDate() + 7);
        }
        daysLeft = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
        weeksLeft = 0;
        daysLeftLabel = 'Days Left';
        weeksLeftLabel = 'Weeks Left';
        daysAriaLabel = 'Days left this week';
        weeksAriaLabel = 'Weeks left this week';
        break;
      }
      case VIEWS.MONTH: {
        // Days/weeks left in current month
        end = new Date(scopeYear, scopeMonth + 1, 1);
        daysLeft = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
        weeksLeft = Math.floor(daysLeft / 7);
        daysLeftLabel = 'Days Left';
        weeksLeftLabel = 'Weeks Left';
        daysAriaLabel = 'Days left this month';
        weeksAriaLabel = 'Weeks left this month';
        break;
      }
      case VIEWS.YEAR:
      default: {
        // Days/weeks left in year
        end = new Date(scopeYear, 11, 31, 23, 59, 59, 999);
        daysLeft = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
        weeksLeft = Math.floor(daysLeft / 7);
        daysLeftLabel = 'Days Left';
        weeksLeftLabel = 'Weeks Left';
        daysAriaLabel = 'Days left this year';
        weeksAriaLabel = 'Weeks left this year';
        break;
      }
    }

    if (this.elements.daysLeft) {
      this.elements.daysLeft.textContent = String(daysLeft);
      this.elements.daysLeft.setAttribute('aria-label', daysAriaLabel);
    }
    if (this.elements.weeksLeft) {
      this.elements.weeksLeft.textContent = String(weeksLeft);
      this.elements.weeksLeft.setAttribute('aria-label', weeksAriaLabel);
    }
    if (this.elements.daysLeftLabel) {
      this.elements.daysLeftLabel.textContent = daysLeftLabel;
    }
    if (this.elements.weeksLeftLabel) {
      this.elements.weeksLeftLabel.textContent = weeksLeftLabel;
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
    focusMode.toggleFocusMode(this);
  },

  setFocusMode(
    enabled: boolean,
    options: { silent?: boolean; persist?: boolean } = {},
  ) {
    focusMode.setFocusMode(this, enabled, options);
  },

  applySavedUIState() {
    focusMode.applySavedUIState(this);
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
    focusMode.updateFocusLayoutVars();
  },

  setupFocusHoverReveal() {
    focusMode.setupFocusHoverReveal(this);
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
    const isMobileGardenView = document.body.classList.contains("mobile-garden-view");
    document.querySelectorAll(".mobile-tab").forEach((tab) => {
      const tabView = (tab as HTMLElement).dataset.view;
      let isActive = false;
      if (tabView === "home") {
        isActive = isMobileHomeView;
      } else if (tabView === "garden") {
        isActive = isMobileGardenView;
      } else {
        isActive = !isMobileHomeView && !isMobileGardenView && tabView === State.currentView;
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

    // Ctrl/Cmd + N for new item (based on view)
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
      void this.ensureNDSupport().then((nd) => nd.showBrainDumpModal());
    }

    // I for Quick-Add Intention
    if (e.key === "i" && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      void this.ensureQuickAdd().then((qa) => qa?.show());
    }

    // ? for keyboard shortcuts help
    if (e.key === "?" || (e.shiftKey && e.key === "/")) {
      this.showKeyboardShortcuts();
    }
  },

  // Show keyboard shortcuts help
  showKeyboardShortcuts() {
    keyboardShortcuts.showKeyboardShortcuts();
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
