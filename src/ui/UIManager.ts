// ===================================
// UI Manager - Main UI Orchestration
// ===================================
import { State } from "../core/State";
import { Goals, ensurePlanningFocusForGoal } from "../core/Goals";
import DB, { DB_STORES } from "../db";
import { Streaks } from "../core/Streaks";
import { CONFIG, VIEWS } from "../config";
import { TimeBreakdown } from "../utils/TimeBreakdown";
import { cacheElements } from "./elements/UIElements";
import {
  buildShareMessage,
  copyShareText,
  tryNativeShare,
} from "../utils/share";
import { Toast } from "../components/feedback/Toast";
import { Celebration } from "../components/feedback/Celebration";
import { TimeVisualizations } from "../garden/timeVisualizations";
import {
  HomeRenderer,
  MobileHereRenderer,
  YearRenderer,
} from "./renderers";
import type { DayViewController } from "../components/dayView/DayViewController";
import { ThemeManager } from "../theme/ThemeManager";
import { eventBus } from "../core/EventBus";
import { viewportManager } from "./viewport/ViewportManager";
import { goalDetailModal } from "../components/modals/GoalDetailModal";
import { monthDetailModal } from "../components/modals/MonthDetailModal";
import { eventModal } from "../components/modals/EventModal";
import { PlanningPage } from "./pages/PlanningPage";
// Import MapPage for side effects (registers eventBus listener)
import "./pages/MapPage";
import { isSupabaseConfigured } from "../supabaseClient";
import { batchSaveService } from "../services/BatchSaveService";
import { SupabaseService } from "../services/supabase";
import { syncQueue } from "../services/SyncQueue";
import { conflictDetector } from "../services/sync/ConflictDetector";
import { createFeatureLoaders } from "../features/featureLoaders";
import { InstallPromptHandler } from "./interactions/InstallPromptHandler";
import { KeyboardHandler } from "./interactions/KeyboardHandler";
import { TouchHandler } from "./interactions/TouchHandler";
import { SupportPanel } from "./panels/SupportPanel";
import { SettingsPanel } from "./panels/SettingsPanel";
import { DateNavigator } from "./navigation/DateNavigator";
import { ViewNavigator } from "./navigation/ViewNavigator";
import { RenderCoordinator } from "./rendering/RenderCoordinator";
import { UIStateManager } from "./state/UIStateManager";
import {
  escapeHtml as escapeHtmlUtil,
  formatDate as formatDateUtil,
  formatMinutes as formatMinutesUtil,
} from "./utils";
import type {
  FeatureLoaders,
  NDSupportApi,
  AppSettingsApi,
  ZenFocusApi,
  QuickAddApi,
} from "../features/featureLoaders";
import * as goalModal from "../components/modals/GoalModal";
import * as weeklyReview from "../features/weeklyReview";
import * as focusMode from "../features/focusMode";
import * as keyboardShortcuts from "./keyboardShortcuts";
import * as syncIssues from "../features/syncIssues";
import type { UIElements, ViewType, Goal, GoalLevel } from "../types";

const ZOOM_CONTROL_HIDE_SELECTORS = [
  ".day-view-container",
  ".planner-day-view",
  ".modal-overlay.active",
  '.delete-confirmation-dialog[data-dialog-visible="true"]',
  ".delete-confirmation-dialog.visible",
];

let zoomControlObserver: MutationObserver | null = null;

function shouldHideZoomControls(): boolean {
  if (typeof document === "undefined") {
    return false;
  }
  return ZOOM_CONTROL_HIDE_SELECTORS.some((selector) =>
    Boolean(document.querySelector(selector)),
  );
}

function updateZoomControlVisibility(): void {
  if (typeof document === "undefined") return;
  document.body.classList.toggle(
    "zoom-controls-hidden",
    shouldHideZoomControls(),
  );
}

function watchZoomControlVisibility(): void {
  if (
    typeof document === "undefined" ||
    typeof MutationObserver === "undefined"
  ) {
    return;
  }
  if (zoomControlObserver) return;

  zoomControlObserver = new MutationObserver(() => {
    updateZoomControlVisibility();
  });

  zoomControlObserver.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["class", "data-dialog-visible"],
  });

  updateZoomControlVisibility();
}

type QuickAddShowOptions = Parameters<QuickAddApi["show"]>[0];

export const UI = {
  els: {}, // Shortcut reference for elements
  elements: {} as UIElements, // Will be populated by cacheElements
  dayViewController: null as DayViewController | null, // New day view controller
  _uiState: new UIStateManager(),
  _featureLoaders: null as FeatureLoaders | null,
  _installPromptHandler: null as InstallPromptHandler | null,
  _touchHandler: null as TouchHandler | null,
  _supportPanel: null as SupportPanel | null,
  _renderCoordinator: null as RenderCoordinator | null,
  _settingsPanel: null as SettingsPanel | null,

  get goalModalYear(): number | null {
    return this._uiState.goalModalYear;
  },

  set goalModalYear(value: number | null) {
    this._uiState.goalModalYear = value;
  },

  get goalModalLevel(): GoalLevel {
    return this._uiState.goalModalLevel;
  },

  set goalModalLevel(value: GoalLevel) {
    this._uiState.goalModalLevel = value;
  },

  getFeatureLoaders(): FeatureLoaders {
    if (this._featureLoaders) return this._featureLoaders;
    this._featureLoaders = createFeatureLoaders({
      toast: (iconOrMessage, messageOrType) =>
        this.showToast(iconOrMessage, messageOrType ?? ""),
      appSettingsCallbacks: {
        onShowToast: (message, type) => this.showToast(message, type ?? ""),
        onScheduleRender: () => this.scheduleRender(),
        onShowKeyboardShortcuts: () => this.showKeyboardShortcuts(),
        onSetFocusMode: (enabled, options) =>
          this.setFocusMode(enabled, options),
        onApplyLayoutVisibility: () => this.applyLayoutVisibility(),
        onApplySidebarVisibility: () => this.applySidebarVisibility(),
        onSyncViewButtons: () => this.syncViewButtons(),
      },
    });
    return this._featureLoaders;
  },

  getSupportPanel(): SupportPanel {
    if (this._supportPanel) return this._supportPanel;
    this._supportPanel = new SupportPanel({
      onShowBrainDump: () =>
        this.ensureNDSupport().then((nd) => nd.showBrainDumpModal()),
      onShowBodyDouble: () =>
        this.ensureNDSupport().then((nd) => nd.showBodyDoubleModal()),
      onShowQuickWins: () =>
        this.ensureNDSupport().then((nd) => nd.showDopamineMenu()),
      onShowNDSettings: () =>
        this.ensureNDSupport().then((nd) => nd.showSettingsPanel()),
      onShowSettings: () => this.showSettingsPanel(),
      onPromptInstall: () => this.promptInstall(),
      onShowSyncIssues: () => {
        syncIssues.showSyncIssuesModal({
          showToast: (iconOrMessage, messageOrType) =>
            this.showToast(iconOrMessage, messageOrType ?? ""),
          updateSyncStatus: (status) => this.updateSyncStatus(status),
        });
        this.syncSyncIssuesBadge();
      },
      onHandleLogout: () => this.handleLogout(),
      onToggleFocusMode: () => this.toggleFocusMode(),
      onApplyAccessibilityPreferences: () =>
        this.applyAccessibilityPreferences(),
      onApplyTimeOfDayOverride: (timeOfDay) =>
        this.applyTimeOfDayOverride(timeOfDay),
    });

    return this._supportPanel;
  },

  getSettingsPanel(): SettingsPanel {
    if (this._settingsPanel) return this._settingsPanel;
    this._settingsPanel = new SettingsPanel({
      ensureAppSettings: () => this.ensureAppSettings(),
    });
    return this._settingsPanel;
  },

  showSettingsPanel() {
    this.getSettingsPanel().show();
  },

  getRenderCoordinator(): RenderCoordinator {
    if (this._renderCoordinator) return this._renderCoordinator;
    this._renderCoordinator = new RenderCoordinator({
      elements: this.elements,
      callbacks: {
        renderCategoryFilters: () => this.renderCategoryFilters(),
        renderUpcomingGoals: () => this.renderUpcomingGoals(),
        updateDateDisplay: () => this.updateDateDisplay(),
        updateTimeDisplay: () => this.updateTimeDisplay(),
        updateYearProgress: () => this.updateYearProgress(),
        updateStreaks: () => {
          Streaks.check();
          this.updateStreakDisplay();
        },
        updateMobileHomeView: () => this.updateMobileHomeView(),
        syncAddButtonLabel: () => this.syncAddButtonLabel(),
        syncViewButtons: () => this.syncViewButtons(),
        updateZoomControls: () => updateZoomControlVisibility(),
        renderDayView: () => this.renderDayView(),
        renderCalendar: () => {
          YearRenderer.render(this.elements, {
            escapeHtml: (text: string) => this.escapeHtml(text),
            openGoalModal: (
              level: GoalLevel,
              month: number | null,
              year: number,
            ) => this.openGoalModal(level, month, year),
            updateYearDisplay: () => this.updateYearDisplay(),
          });
        },
        openGoalModal: (
          level: any,
          month: number,
          year: number,
          options?: any,
        ) => this.openGoalModal(level, month, year, options),
        openGoalDetail: (goalId: string) => this.openGoalDetail(goalId),
        openVisionDetail: (visionId: string) => this.openVisionDetail(visionId),
        openGoalEdit: (goalId: string) => goalDetailModal.show(goalId),
        closeGoalDetailPage: () => this.closeGoalDetailPage(),
        closeVisionPage: () => this.closeVisionPage(),
        escapeHtml: (text: string) => escapeHtmlUtil(text),
        dayViewController: this.dayViewController,
      },
    });

    return this._renderCoordinator;
  },

  getLevelLabel(
    level: GoalLevel,
    opts?: { lowercase?: boolean; plural?: boolean },
  ): string {
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
        if (!viewportManager.isMobileViewport()) {
          document.body.classList.remove("mobile-home-view");
        }
      },
      onRenderRequired: () => {
        // Re-render current view to adjust to new dimensions
        this.render();
      },
    });

    // Initialize viewport detection and responsive behavior
    viewportManager.setupViewportMode();
  },
  getCurrentLevel(): GoalLevel {
    switch (State.currentView) {
      case "year":
        return "vision";
      case "month":
        return "milestone";
      case "week":
        return "focus";
      case "day":
        return "intention";
      default:
        return "milestone";
    }
  },

  updateSyncStatus(
    status: "syncing" | "synced" | "error" | "local" | "offline",
  ): void {
    const el = document.getElementById("syncStatus");

    const updateElement = (element: HTMLElement | null) => {
      if (!element) return;
      const icon = element.querySelector(".sync-icon");
      const text = element.querySelector(".sync-text");

      element.classList.remove("syncing", "synced", "error", "offline");

      if (status === "syncing") {
        element.classList.add("syncing");
        if (icon) icon.textContent = "…";
        if (text) text.textContent = "Saving in background";
      } else if (status === "synced") {
        element.classList.add("synced");
        if (icon) icon.textContent = "☁️";
        if (text) text.textContent = "All changes saved";
      } else if (status === "error") {
        element.classList.add("error");
        if (icon) icon.textContent = "⚠️";
        if (text) text.textContent = "Having trouble syncing";
      } else if (status === "offline") {
        element.classList.add("offline");
        if (icon) icon.textContent = "📡";
        if (text) text.textContent = "Working offline";
      } else {
        if (icon) icon.textContent = "💾";
        if (text) text.textContent = "Saved on this device";
      }
    };

    // Update header sync status only (support panel sync status removed)
    updateElement(el);
  },

  init() {
    this.cacheElements();
    this.els = this.elements; // Alias for convenience
    this.setupRendererEventListeners();
    this.bindEvents();
    watchZoomControlVisibility();
    this.setupEventBusListeners(); // Set up EventBus communication
    this.setupSyncEventListeners(); // Set up sync status event listeners
    this.setupInstallPrompt(); // Set up PWA install prompt handling
    this.setupGoalsCallbacks(); // Set up Goals callbacks (toast, sync status, etc.)
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
    setInterval(() => {
      this.updateTimeDisplay();
      if (
        viewportManager.isMobileViewport() &&
        State.currentView === VIEWS.HOME
      ) {
        this.updateMobileHomeView();
      }
    }, 60000);

    // Update body double timer display
    setInterval(() => this.updateBodyDoubleDisplay(), 1000);

    // Check for weekly review prompt
    // TODO: Revisit weekly review prompt - disabled for now
    // if (Planning.shouldPromptReview()) {
    //   setTimeout(() => this.showReviewPrompt(), 3000);
    // }
  },

  setupRendererEventListeners() {
    if (this._uiState.rendererEventListenersSetup) return;
    this._uiState.rendererEventListenersSetup = true;

    this.elements.calendarGrid?.addEventListener("goal-click", (e) => {
      const ev = e as CustomEvent<{ goalId?: string }>;
      const goalId = ev.detail?.goalId;
      if (goalId) goalDetailModal.show(goalId);
    });

    this.elements.calendarGrid?.addEventListener("open-goal-modal", (e) => {
      const ev = e as CustomEvent<{
        level?: GoalLevel;
        month?: number | null;
        year?: number;
      }>;
      const level = ev.detail?.level;
      if (!level) return;
      const month = ev.detail?.month ?? null;
      const year = ev.detail?.year ?? State.viewingYear;
      this.openGoalModal(level, month, year);
    });

    this.elements.calendarGrid?.addEventListener("open-event-modal", (e) => {
      const ev = e as CustomEvent<{ date?: string; eventId?: string }>;
      const raw = ev.detail?.date ?? "";
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
      const date = match
        ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
        : (State.viewingDate ?? new Date());
      eventModal.show({ date, eventId: ev.detail?.eventId });
    });
  },

  setupSwipeNavigation() {
    if (!this._touchHandler) {
      this._touchHandler = new TouchHandler({
        elements: this.elements,
        onRender: () => this.render(),
        onShowToast: (icon, message) => this.showToast(icon, message),
      });
    }

    this._touchHandler.setupSwipeNavigation();
  },

  setupPullToRefresh() {
    if (!this._touchHandler) {
      this._touchHandler = new TouchHandler({
        elements: this.elements,
        onRender: () => this.render(),
        onShowToast: (icon, message) => this.showToast(icon, message),
      });
    }

    this._touchHandler.setupPullToRefresh();
  },

  hideInitialLoadingUI() {
    const loading = document.getElementById("appLoading");
    if (!loading) return;

    // Allow initial paint of the skeleton before fading it out.
    window.requestAnimationFrame(() => {
      loading.classList.add("loaded");
      // Always remove the loading overlay after a timeout to prevent it from blocking interactions
      window.setTimeout(() => {
        loading.remove();
        console.log("✓ App loading overlay removed");
      }, 650);
    });
  },

  /**
   * Set up EventBus listeners for decoupled communication with State
   * This resolves the State ↔ UI circular dependency
   */
  setupEventBusListeners() {
    // Listen for view changes from State
    eventBus.on("view:changed", (data) => {
      // Enable smooth transitions for view changes
      const transitionOptions = {
        transition: true,
        ...data,
      };
      // Persist the view to localStorage
      this._uiState.saveView(data.view || State.currentView);
      this.scheduleRender(transitionOptions);
    });

    // Listen for view button sync requests
    eventBus.on("view:sync-buttons", () => {
      this.syncViewButtons?.();
    });

    // Listen for toast notifications
    // Follow-up: replace emoji arg with type: 'success'|'warning'|'info' and centralized icon mapping.
    eventBus.on("ui:toast", (data) => {
      Toast.show(this.elements, data.icon, data.message);
    });

    // Listen for celebration animations
    eventBus.on("ui:celebrate", (data) => {
      Celebration.show(this.elements, data.icon, data.title, data.message);
    });

    eventBus.on("garden:plan-requested", (data) => {
      void this.openPlanningPage(data?.goalId ?? null);
    });

    eventBus.on("garden:review-requested", () => {
      this.showWeeklyReview();
    });

    // Listen for time range changes to update day view
    window.addEventListener("time-range-changed", () => {
      if (State.currentView === VIEWS.DAY) {
        // Reset the last time range so day view will be recreated with new range
        this._uiState.lastTimeRange = null;
        this.renderDayView();
      }
    });

    console.log("✓ EventBus listeners registered in UIManager");
  },

  /**
   * Set up sync status event listeners
   * Listens to SyncQueue events and updates UI accordingly
   */
  setupSyncEventListeners() {
    // Listen for sync errors from SyncQueue
    window.addEventListener("sync-error", ((e: CustomEvent) => {
      const message = e.detail?.message || "Sync failed";
      this.updateSyncStatus("error");
      Toast.show(
        this.elements,
        "🌥️",
        `We'll keep trying to save your changes. ${message}`,
      );
      this.syncSyncIssuesBadge();
    }) as EventListener);

    // Listen for sync storage errors from SyncQueue
    window.addEventListener("sync-storage-error", ((e: CustomEvent) => {
      const message = e.detail?.message || "Sync queue corrupted";
      this.updateSyncStatus("error");
      Toast.show(
        this.elements,
        "🌥️",
        `We hit a hiccup saving changes. ${message}`,
      );
    }) as EventListener);

    // Generic sync status events (syncing/synced/error/local)
    window.addEventListener("sync-status", ((e: CustomEvent) => {
      const status = e.detail?.status as
        | "syncing"
        | "synced"
        | "error"
        | "local"
        | "offline"
        | undefined;
      if (!status) return;
      if (
        status === "syncing" ||
        status === "synced" ||
        status === "error" ||
        status === "local" ||
        status === "offline"
      ) {
        this.updateSyncStatus(status);
      }
    }) as EventListener);

    // Listen for sync conflicts (multi-device edits)
    window.addEventListener("sync-conflict", ((e: CustomEvent) => {
      const conflict = e.detail;
      if (!conflict) return;

      const message = conflictDetector.formatConflictMessage(conflict);

      // Show a subtle notification for conflicts
      if (conflict.resolution === "remote_wins") {
        // User's local changes were overwritten - more prominent warning
        Toast.show(this.elements, "⚠️", message);
      } else {
        // User's version won - subtle confirmation
        console.log("[UIManager] Sync conflict resolved:", message);
      }
    }) as EventListener);

    console.log("✓ Sync event listeners registered in UIManager");
  },

  syncSyncIssuesBadge() {
    const btn = document.getElementById("syncIssuesBtn");
    if (!btn) return;
    const count = syncIssues.getFailureCount();
    btn.classList.toggle("install-available", count > 0);
    if (count > 0) {
      btn.removeAttribute("hidden");
      const desc = btn.querySelector(".support-panel-desc");
      if (desc)
        desc.textContent = `We're retrying ${count} change${
          count === 1 ? "" : "s"
        }`;
    } else {
      btn.setAttribute("hidden", "");
      const desc = btn.querySelector(".support-panel-desc");
      if (desc) desc.textContent = "Automatic sync & backup";
    }
  },

  setupInstallPrompt() {
    if (!this._installPromptHandler) {
      this._installPromptHandler = new InstallPromptHandler({
        elements: this.elements,
        onSyncIssuesBadge: () => this.syncSyncIssuesBadge(),
      });
    }

    this._installPromptHandler.setup();
  },

  async promptInstall() {
    if (!this._installPromptHandler) {
      this._installPromptHandler = new InstallPromptHandler({
        elements: this.elements,
        onSyncIssuesBadge: () => this.syncSyncIssuesBadge(),
      });
    }

    await this._installPromptHandler.promptInstall();
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
      onCelebrate: (icon, title, message) =>
        Celebration.show(this.elements, icon, title, message),
    });
  },

  /**
   * Set up Goals callbacks for error handling and sync status
   */
  setupGoalsCallbacks() {
    Goals.setCallbacks({
      onCelebrate: (emoji, title, message) => {
        Celebration.show(this.elements, emoji, title, message);
      },
      onScheduleRender: () => {
        this.render();
      },
      onUpdateSyncStatus: (status) => {
        this.updateSyncStatus(
          status as "syncing" | "synced" | "error" | "local" | "offline",
        );
      },
      onShowToast: (icon, message) => {
        Toast.show(this.elements, icon, message);
      },
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
      onToast: (icon, message) => Toast.show(this.elements, icon, message),
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
      onCelebrate: (icon, title, message) =>
        Celebration.show(this.elements, icon, title, message),
    });
  },

  openQuickAdd(opts?: QuickAddShowOptions) {
    void this.ensureQuickAdd().then((qa) => qa?.show(opts));
  },

  /**
   * Set up MonthDetailModal callbacks
   */
  setupMonthDetailModalCallbacks() {
    monthDetailModal.setCallbacks({
      escapeHtml: this.escapeHtml.bind(this),
      onRender: () => this.render(),
      onToast: (icon, message) => Toast.show(this.elements, icon, message),
      onShowGoalDetail: (goalId) => goalDetailModal.show(goalId),
    });
  },

  // Update body double timer display
  updateBodyDoubleDisplay() {
    const remaining = this.getFeatureLoaders()
      .getNDSupportIfLoaded()
      ?.getBodyDoubleRemaining?.();
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

  navigateToMobileHomeView() {
    if (!viewportManager.isMobileViewport()) return;
    // Toggle: if already on Home, return to the last non-Home view; otherwise remember current view and go Home.
    if (State.currentView === VIEWS.HOME) {
      const targetView = this._uiState.lastNonHomeView || VIEWS.YEAR;
      State.setView(targetView);
    } else {
      this._uiState.lastNonHomeView = State.currentView;
      State.setView(VIEWS.HOME);
    }
    viewportManager.updateMobileLayoutVars();
  },

  bindEvents() {
    ViewNavigator.bindViewSwitchers({
      onSyncViewButtons: () => this.syncViewButtons(),
      onUpdateMobileLayoutVars: () => viewportManager.updateMobileLayoutVars(),
    });

    DateNavigator.bindDateNavigation({
      onRender: () => this.render(),
    });

    const goToHomeView = () => this.navigateToMobileHomeView();
    this.elements.headerLogo?.addEventListener("click", goToHomeView);
    this.elements.headerLogo?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        goToHomeView();
      }
    });

    // Mobile Home: cycle time position scope when tapping the flower.
    this.elements.gardenBloom?.addEventListener("click", () => {
      if (!viewportManager.isMobileViewport()) return;
      if (State.currentView !== VIEWS.HOME) return;
      this.cycleHomeProgressScope();
    });

    this.getSupportPanel().bindEvents();
    this.getSettingsPanel().bindEvents();

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

    // Add Goal Button
    document
      .getElementById("addGoalBtn")
      ?.addEventListener("click", () =>
        this.openGoalModal(
          this.getCurrentLevel(),
          State.viewingMonth,
          State.viewingYear,
        ),
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

      const addEl = target.closest(
        '[data-action="add-level"]',
      ) as HTMLElement | null;
      const level = addEl?.dataset.level as GoalLevel | undefined;
      if (!level) return;
      this.openGoalModal(level, State.viewingMonth, State.viewingYear);
    });

    // Zoom controls - disabled on mobile
    const zoomInBtn = document.getElementById("zoomIn");
    const zoomOutBtn = document.getElementById("zoomOut");
    if (zoomInBtn && zoomOutBtn) {
      // Only enable zoom on desktop
      if (!viewportManager.isMobileViewport()) {
        zoomInBtn.addEventListener("click", () => this.zoom(10));
        zoomOutBtn.addEventListener("click", () => this.zoom(-10));
      }
    }

    // Focus mode
    document
      .getElementById("focusModeBtn")
      ?.addEventListener("click", () => this.toggleFocusMode());
    document
      .getElementById("focusToggle")
      ?.addEventListener("click", () => this.toggleFocusMode());

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
      ?.addEventListener(
        "click",
        () => void this.ensureNDSupport().then((nd) => nd.showBrainDumpModal()),
      );
    document
      .getElementById("bodyDoubleBtn")
      ?.addEventListener(
        "click",
        () =>
          void this.ensureNDSupport().then((nd) => nd.showBodyDoubleModal()),
      );
    document
      .getElementById("ndSettingsBtn")
      ?.addEventListener(
        "click",
        () => void this.ensureNDSupport().then((nd) => nd.showSettingsPanel()),
      );
    document
      .getElementById("appearanceBtn")
      ?.addEventListener(
        "click",
        () =>
          void this.ensureNDSupport().then((nd) => nd.showAppearancePanel()),
      );
    document
      .getElementById("dopamineMenuBtn")
      ?.addEventListener(
        "click",
        () => void this.ensureNDSupport().then((nd) => nd.showDopamineMenu()),
      );

    document
      .getElementById("showShortcutsBtn")
      ?.addEventListener("click", () => this.showKeyboardShortcuts());

    // Body double stop button
    document.getElementById("bdStop")?.addEventListener("click", () => {
      if (!State.data) return;
      const sessions = State.data.bodyDoubleHistory;
      const active = sessions[sessions.length - 1];
      if (active && !active.endedAt) {
        void this.ensureNDSupport().then((nd) =>
          nd.endBodyDouble(active.id, false),
        );
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
    this._uiState.homeProgressScopeIndex =
      (this._uiState.homeProgressScopeIndex + 1) % 4;
    this.updateYearProgress();
    this.updateTimeDisplay(); // Update stats when scope changes
  },

  openSupportPanel() {
    this.getSupportPanel().open();
  },

  closeSupportPanel() {
    this.getSupportPanel().close();
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
      eventBus.emit("auth:logout");

      // Reload to show auth modal
      location.reload();
    } catch (error) {
      console.error("Error during logout:", error);
      Toast.show(this.elements, "⚠️", "Logout failed. Please try again.");
    }
  },

  async forceCloudSync() {
    if (!navigator.onLine) {
      Toast.show(
        this.elements,
        "📡",
        "You appear to be offline. Changes will sync when you’re back online.",
      );
      this.updateSyncStatus("local");
      return;
    }

    if (!isSupabaseConfigured) {
      Toast.show(
        this.elements,
        "⚙️",
        "Cloud sync is disabled (missing Supabase credentials).",
      );
      this.updateSyncStatus("local");
      return;
    }

    try {
      this.updateSyncStatus("syncing");
      await Promise.allSettled([
        batchSaveService.forceSave(),
        syncQueue.forceSync(),
      ]);
      this.updateSyncStatus("synced");
      Toast.show(this.elements, "☁️", "Synced!");
    } catch (error) {
      console.error("Force sync failed:", error);
      this.updateSyncStatus("error");
      Toast.show(this.elements, "⚠️", "Sync failed. Try again in a moment.");
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
    // Disabled on mobile - no zoom functionality
    if (!viewportManager.isMobileViewport()) {
      container.addEventListener(
        "wheel",
        (e: WheelEvent) => {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            this.zoom(e.deltaY < 0 ? 10 : -10);
          }
        },
        { passive: false },
      );
    }
  },

  scheduleRender(opts?: { transition?: boolean }) {
    this.getRenderCoordinator().scheduleRender(opts);
  },

  render() {
    this.getRenderCoordinator().render();
  },

  /**
   * Batch DOM updates to prevent flashing during tab switches
   */
  batchRenderUpdates(shouldResetScroll: boolean) {
    this.getRenderCoordinator().batchRenderUpdates(shouldResetScroll);
  },

  /**
   * Handle scroll reset with proper timing
   */
  handleScrollReset() {
    this.getRenderCoordinator().handleScrollReset();
  },

  updateMobileHomeView() {
    if (!viewportManager.isMobileViewport()) return;
    if (State.currentView !== VIEWS.HOME) return;
    if (!this.elements.mobileHomeView) return;

    HomeRenderer.render(this.elements, this.escapeHtml.bind(this), (goalId) =>
      goalDetailModal.show(goalId),
    );
    MobileHereRenderer.render(
      this.elements,
      this.escapeHtml.bind(this),
      (goalId) => goalDetailModal.show(goalId),
    );
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
        text = `${weekStart.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })} - ${weekEnd.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })}`;
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

  // Get context goals (Vision/Milestone/Focus) for a specific date
  getContextGoalsForDate(date: Date): {
    vision: Goal[];
    milestone: Goal[];
    focus: Goal[];
  } {
    if (!State.data) return { vision: [], milestone: [], focus: [] };

    // Canonical context ranges for the given date.
    // - Vision: active during the date's year
    // - Milestone: active during the date's month
    // - Focus: active during the date's ISO week (Mon-Sun)
    const year = date.getFullYear();
    const month = date.getMonth();

    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31);

    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);

    const weekYear = State.getWeekYear(date);
    const weekNum = State.getWeekNumber(date);
    const weekStart = State.getWeekStart(weekYear, weekNum);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    // Use the canonical overlap definition via Goals.getForRange() / getGoalDateRange().
    const vision = Goals.getForRange(yearStart, yearEnd)
      .filter((g) => g.status !== "done" && g.level === "vision")
      .slice(0, 2);

    const milestone = Goals.getForRange(monthStart, monthEnd)
      .filter((g) => g.status !== "done" && g.level === "milestone")
      .slice(0, 2);

    const focus = Goals.getForRange(weekStart, weekEnd)
      .filter((g) => g.status !== "done" && g.level === "focus")
      .slice(0, 2);

    return { vision, milestone, focus };
  },

  // Render Day View (New Modernized Implementation)
  renderDayView() {
    const container = this.elements.calendarGrid;
    if (!container) return;

    if (!this._uiState.dayViewControllerCtor) {
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

    // Get time range preferences from settings
    const timeRangePrefs = TimeVisualizations.getTimeRangePreferences();
    // Convert hours to minutes (e.g., 8 AM = 8 * 60 = 480 minutes)
    const timeWindowStart = timeRangePrefs.startHour * 60;
    const timeWindowEnd = timeRangePrefs.endHour * 60;

    // Check if we need to recreate the controller due to time range change
    const needsRecreate =
      this.dayViewController &&
      this._uiState.lastTimeRange &&
      (this._uiState.lastTimeRange.start !== timeWindowStart ||
        this._uiState.lastTimeRange.end !== timeWindowEnd);

    if (needsRecreate) {
      // Destroy existing controller
      if (this.dayViewController) {
        this.dayViewController.unmount();
        this.dayViewController = null;
      }
    }

    // Initialize DayViewController if not already done
    if (!this.dayViewController) {
      this.dayViewController = new this._uiState.dayViewControllerCtor(
        container,
        {
          onGoalUpdate: (goalId: string, updates: Partial<Goal>) => {
            const updatedGoal = Goals.update(goalId, updates);
            if (!updatedGoal) return;
            // Explicitly ensure persistence and re-render
            void State.save();
            void DB.update(DB_STORES.GOALS, updatedGoal).catch((err) => {
              console.warn(
                "[UIManager] Failed to sync goal to IndexedDB:",
                err,
              );
            });

            // Re-render to update the view
            if (this.dayViewController) {
              const contextGoals = this.getContextGoalsForDate(
                State.viewingDate,
              );
              this.dayViewController.setGoals(
                State.viewingDate,
                State.data?.goals || [],
                contextGoals,
              );
            }
          },
          onGoalClick: (goalId: string) => {
            goalDetailModal.show(goalId);
          },
          onOpenGoalDetail: (goalId: string) => this.openGoalDetail(goalId),
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
            // eslint-disable-next-line security/detect-object-injection
            return (State.data?.preferences.nd as any)?.[key];
          },
          onNavigate: (direction: number) => {
            State.navigate(direction);
          },
        },
        CONFIG,
        {
          timeWindowStart,
          timeWindowEnd,
        },
      );

      // Mount the controller
      this.dayViewController.mount();

      // Store the time range we used
      this._uiState.lastTimeRange = {
        start: timeWindowStart,
        end: timeWindowEnd,
      };
    }

    // Gather context goals (Vision/Milestone/Focus)
    const contextGoals = this.getContextGoalsForDate(date);

    // Set goals and render
    this.dayViewController.setGoals(date, allGoals, contextGoals);

    // Auto-scroll to current time on mobile when viewing today
    if (viewportManager.isMobileViewport()) {
      const today = new Date();
      const viewingDate = State.viewingDate;
      const isToday =
        viewingDate &&
        viewingDate.toDateString() === today.toDateString();

      if (isToday) {
        // Scroll-to-time feature disabled - current time indicator is now pinned at top
        // No automatic scrolling should occur
      }
    }
  },

  async ensureDayViewControllerCtor(): Promise<void> {
    if (this._uiState.dayViewControllerCtor) return;
    if (this._uiState.dayViewControllerLoading)
      return this._uiState.dayViewControllerLoading;

    this._uiState.dayViewControllerLoading =
      import("../components/dayView/DayViewController")
        .then((mod) => {
          this._uiState.dayViewControllerCtor = mod.DayViewController as any;
        })
        .catch((err) => {
          console.error("Failed to load DayViewController:", err);
          this.showToast("⚠️", "Couldn’t load Day view");
        })
        .finally(() => {
          this._uiState.dayViewControllerLoading = null;
        });

    return this._uiState.dayViewControllerLoading;
  },

  // Render a single goal card for day view
  renderDayGoalCard(
    goal: Goal,
    opts?: { variant?: "planter" | "seed" | "compost"; style?: string },
  ) {
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
      <div class="day-goal-card ${variantClass} ${
        isCompleted ? "completed" : ""
      }" data-goal-id="${
        goal.id
      }" role="button" tabindex="0"${styleAttr}${dragAttrs}>
        ${resizeHandles}
        <div class="day-goal-checkbox ${isCompleted ? "checked" : ""}"></div>
        <div class="day-goal-content">
          <div class="day-goal-level">
            <span class="day-goal-level-emoji">${levelInfo.emoji}</span>
            <span class="day-goal-level-label">${levelInfo.label}</span>
          </div>
          <div class="day-goal-title">${this.escapeHtml(goal.title)}</div>
          ${
            goal.description
              ? `<div class="day-goal-desc">${this.escapeHtml(
                  goal.description,
                )}</div>`
              : ""
          }
          <div class="day-goal-meta">
            ${
              goal.startTime
                ? `<span class="day-goal-time">🕒 ${goal.startTime}${
                    goal.endTime ? ` - ${goal.endTime}` : ""
                  }</span>`
                : ""
            }
            ${
              cat
                ? `<span class="day-goal-cat" style="color: ${cat.color}">${cat.emoji} ${cat.label}</span>`
                : ""
            }
            ${
              goal.priority !== "medium"
                ? `<span class="day-goal-priority priority-${goal.priority}">${
                    CONFIG.PRIORITIES[goal.priority]?.symbol || ""
                  } ${goal.priority}</span>`
                : ""
            }
            <button class="btn-zen-focus" title="Zen Focus Mode" data-goal-id="${
              goal.id
            }">👁️ Focus</button>
          </div>
        </div>
        ${
          goal.progress > 0 && goal.progress < 100
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
          <div class="goal-item ${
            g.status === "done" ? "completed" : ""
          }" data-goal-id="${g.id}">
            <div class="goal-checkbox ${
              g.status === "done" ? "checked" : ""
            }"></div>
            <div class="goal-content">
              <div class="goal-title">${this.escapeHtml(g.title)}</div>
              <div class="goal-tags">
                <span class="goal-tag">${cat?.emoji ?? ""} ${
                  cat?.label ?? ""
                }</span>
              </div>
            </div>
          </div>
        `;
      })
      .join("");
  },

  changeYear(delta: number) {
    DateNavigator.changeYear(delta);
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

    const dropdown = container.querySelector(
      ".filter-dropdown",
    ) as HTMLElement | null;
    const trigger = container.querySelector(
      ".filter-trigger",
    ) as HTMLElement | null;
    const menu = container.querySelector(".filter-menu") as HTMLElement | null;

    if (!dropdown || !trigger || !menu) return;

    const closeMenu = () => {
      menu.hidden = true;
      trigger.setAttribute("aria-expanded", "false");
    };

    const openMenu = () => {
      menu.hidden = false;
      trigger.setAttribute("aria-expanded", "true");
      const activeBtn = menu.querySelector(
        ".category-filter.active",
      ) as HTMLElement | null;
      (
        activeBtn ||
        (menu.querySelector(".category-filter") as HTMLElement | null)
      )?.focus?.();
    };

    if (this._uiState.filterDocListeners) {
      document.removeEventListener(
        "click",
        this._uiState.filterDocListeners.onDocClick,
      );
      document.removeEventListener(
        "keydown",
        this._uiState.filterDocListeners.onDocKeydown,
      );
      this._uiState.filterDocListeners = null;
    }

    trigger.addEventListener("click", () => {
      if (menu.hidden) openMenu();
      else closeMenu();
    });

    trigger.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openMenu();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        closeMenu();
      }
    });

    const onDocClick = (e: MouseEvent) => {
      if (!dropdown.contains(e.target as Node | null)) closeMenu();
    };

    const onDocKeydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu();
    };

    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onDocKeydown);
    this._uiState.filterDocListeners = { onDocClick, onDocKeydown };

    menu.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeMenu();
        trigger.focus();
      }
    });

    // Bind filter events
    menu.querySelectorAll(".category-filter").forEach((btn) => {
      btn.addEventListener("click", () => {
        State.activeCategory = (btn as HTMLElement).dataset.category ?? "all";
        closeMenu();
        this.renderCategoryFilters();
        YearRenderer.render(this.elements, {
          escapeHtml: (text: string) => this.escapeHtml(text),
          openGoalModal: (
            level: GoalLevel,
            month: number | null,
            year: number,
          ) => this.openGoalModal(level, month, year),
          updateYearDisplay: () => this.updateYearDisplay(),
        });
        this.renderUpcomingGoals();
      });
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
        const cat = goal.category
          ? (CONFIG.CATEGORIES[goal.category] ?? null)
          : null;
        const monthName = CONFIG.MONTHS[goal.month];

        const timeLeft = TimeBreakdown.getSimpleTimeLeft(goal.month, goal.year);

        return `
          <div class="upcoming-goal" data-goal-id="${goal.id}">
            <div class="upcoming-dot" style="background: ${
              cat ? cat.color : "rgba(255, 255, 255, 0.18)"
            }"></div>
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

    const achievementConfig = CONFIG.ACHIEVEMENTS as Record<
      string,
      { emoji: string; label: string; desc: string }
    >;

    const shareAchievement = async (achievementId: string) => {
      // eslint-disable-next-line security/detect-object-injection
      const achievement = achievementConfig[achievementId];
      if (!achievement) return;

      const payload = {
        title: achievement.label,
        text: `${achievement.emoji} ${achievement.label} — ${achievement.desc}\nCaptured in The Garden Fence.`,
        url: location.href,
      };

      const result = await tryNativeShare(payload);
      if (result === "shared") {
        this.showToast("📤", `${achievement.label} shared`);
        return;
      }
      if (result === "cancelled") {
        return;
      }

      const fallbackText = buildShareMessage(payload);
      const copied = await copyShareText(fallbackText);
      this.showToast(
        copied ? "📋" : "📄",
        copied
          ? `${achievement.label} ready to paste`
          : "Tap and hold to copy this text manually",
      );
    };

    container.innerHTML = Object.entries(achievementConfig)
      .map(([id, ach]) => {
        const isUnlocked = unlocked.includes(id);
        const shareButton = isUnlocked
          ? `<button
              class="achievement-share-btn"
              type="button"
              data-achievement-id="${id}"
              aria-label="Share ${ach.label}"
              title="Share ${ach.label}"
            >⤴</button>`
          : "";
        return `
          <div class="achievement ${isUnlocked ? "unlocked" : ""}" data-tooltip="${this.escapeHtml(
            ach.desc,
          )}">
            <span class="achievement-emoji">${ach.emoji}</span>
            ${shareButton}
          </div>
        `;
      })
      .join("");

    container
      .querySelectorAll<HTMLButtonElement>(".achievement-share-btn")
      .forEach((btn) => {
        btn.addEventListener("click", (event) => {
          event.stopPropagation();
          event.preventDefault();
          const achievementId = btn.dataset.achievementId;
          if (!achievementId) return;
          void shareAchievement(achievementId);
        });
      });
  },

  // ============================================
  // Modal Handling
  // ============================================
  openGoalModal(
    level: GoalLevel = "milestone",
    preselectedMonth: number | null = null,
    preselectedYear: number | null = null,
    link?: { parentId: string; parentLevel: GoalLevel } | null,
  ): void {
    goalModal.openGoalModal(
      this,
      level,
      preselectedMonth,
      preselectedYear,
      link,
    );
  },

  openVisionDetail(visionId: string): void {
    if (!visionId) return;
    if (State.currentView !== VIEWS.VISION_DETAIL) {
      this._uiState.lastViewBeforeVision = State.currentView;
    }
    State.setGoalDetailGoal(null);
    State.setVisionDetailId(visionId);
    State.setView(VIEWS.VISION_DETAIL);
  },

  openGoalDetail(goalId: string): void {
    if (!goalId) return;
    if (State.currentView !== VIEWS.GOAL_DETAIL) {
      this._uiState.lastViewBeforeDetail = State.currentView;
      this._uiState.lastVisionBeforeDetailId =
        State.currentView === VIEWS.VISION_DETAIL ? State.visionDetailId : null;
    }
    State.setGoalDetailGoal(goalId);
    State.setView(VIEWS.GOAL_DETAIL);
  },

  closeGoalDetailPage(): void {
    const fallbackView = this._uiState.lastViewBeforeDetail ?? VIEWS.GARDEN;
    const fallbackVisionId =
      fallbackView === VIEWS.VISION_DETAIL
        ? this._uiState.lastVisionBeforeDetailId
        : null;
    this._uiState.lastViewBeforeDetail = null;
    this._uiState.lastVisionBeforeDetailId = null;
    State.setGoalDetailGoal(null);
    State.setVisionDetailId(fallbackVisionId);
    State.setView(fallbackView);
  },

  closeVisionPage(): void {
    const fallbackView = this._uiState.lastViewBeforeVision ?? VIEWS.GARDEN;
    this._uiState.lastViewBeforeVision = null;
    State.setGoalDetailGoal(null);
    State.setVisionDetailId(null);
    State.setView(fallbackView);
  },

  closeGoalModal() {
    goalModal.closeGoalModal(this);
  },

  handleGoalSubmit(e: Event) {
    goalModal.handleGoalSubmit(this, e);
  },

  async openPlanningPage(goalId?: string | null) {
    if (!goalId) {
      await PlanningPage.open();
      return;
    }

    const goal = Goals.getById(goalId);
    if (!goal) {
      await PlanningPage.open();
      return;
    }

    try {
      const focus = await ensurePlanningFocusForGoal(goal);
      await PlanningPage.open(focus.id);
    } catch (err) {
      console.warn("Planning request failed for goal", err);
      await PlanningPage.open();
    }
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

    // Time left calculations - different metrics for each view
    const isHome = State.currentView === VIEWS.HOME;
    const isGarden = State.currentView === VIEWS.GARDEN;

    // For HOME view, use the scope index to determine which view's metrics to show
    // For other views, use the actual current view
    const homeScopeViews: ViewType[] = [
      VIEWS.DAY,
      VIEWS.WEEK,
      VIEWS.MONTH,
      VIEWS.YEAR,
    ];
    const effectiveView: ViewType =
      State.currentView === VIEWS.HOME
        ? (homeScopeViews[this._uiState.homeProgressScopeIndex] ?? VIEWS.YEAR)
        : State.currentView === VIEWS.GARDEN
          ? VIEWS.YEAR // Garden view shows year stats
          : State.currentView;

    // Use current date/year for HOME and GARDEN views, otherwise use State viewing values
    const scopeYear =
      isHome || isGarden ? now.getFullYear() : State.viewingYear;
    const scopeMonth = isHome || isGarden ? now.getMonth() : State.viewingMonth;
    const scopeDate = isHome || isGarden ? now : State.viewingDate;

    let end: Date;
    let daysLeft: number;
    let weeksLeft: number;
    let daysLeftLabel = "Days Left";
    let weeksLeftLabel = "Weeks Left";
    let daysAriaLabel = "Days left in year";
    let weeksAriaLabel = "Weeks left in year";

    switch (effectiveView) {
      case VIEWS.DAY: {
        // Hours left | Minutes left (in current day)
        end = new Date(scopeDate);
        end.setHours(23, 59, 59, 999);
        const msLeft = Math.max(0, end.getTime() - now.getTime());
        const hoursLeft = Math.floor(msLeft / (1000 * 60 * 60));
        const minutesLeft = Math.floor(
          (msLeft % (1000 * 60 * 60)) / (1000 * 60),
        );
        daysLeft = hoursLeft;
        weeksLeft = minutesLeft;
        daysLeftLabel = "Hours Left";
        weeksLeftLabel = "Minutes Left";
        daysAriaLabel = "Hours left today";
        weeksAriaLabel = "Minutes left today";
        break;
      }
      case VIEWS.WEEK: {
        // Days left (in week) | Weeks left (in month)
        if (isHome || effectiveView === VIEWS.WEEK) {
          const wy = State.getWeekYear(scopeDate);
          const wn = State.getWeekNumber(scopeDate);
          end = State.getWeekStart(wy, wn);
          end.setDate(end.getDate() + 7);
        } else {
          end = State.getWeekStart(State.viewingYear, State.viewingWeek ?? 1);
          end.setDate(end.getDate() + 7);
        }
        const daysInWeek = Math.max(
          0,
          Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
        );

        // Weeks left in current month
        const monthEnd = new Date(
          scopeYear,
          scopeMonth + 1,
          0,
          23,
          59,
          59,
          999,
        );
        const daysInMonth = Math.max(
          0,
          Math.ceil(
            (monthEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
          ),
        );
        const weeksInMonth = Math.floor(daysInMonth / 7);

        daysLeft = daysInWeek;
        weeksLeft = weeksInMonth;
        daysLeftLabel = "Days Left";
        weeksLeftLabel = "Weeks Left";
        daysAriaLabel = "Days left this week";
        weeksAriaLabel = "Weeks left this month";
        break;
      }
      case VIEWS.MONTH: {
        // Weeks left (in month) | Months left (in year)
        const monthEnd = new Date(
          scopeYear,
          scopeMonth + 1,
          0,
          23,
          59,
          59,
          999,
        );
        const daysInMonth = Math.max(
          0,
          Math.ceil(
            (monthEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
          ),
        );
        const weeksInMonth = Math.floor(daysInMonth / 7);

        // Months left in current year (from end of the month being viewed)
        // Formula: 12 - (monthIndex + 1) where monthIndex is 0-11
        // January (0): 12 - 1 = 11 months left, December (11): 12 - 12 = 0 months left
        const monthsInYear = Math.max(0, 12 - (scopeMonth + 1));

        daysLeft = weeksInMonth;
        weeksLeft = monthsInYear;
        daysLeftLabel = "Weeks Left";
        weeksLeftLabel = "Months Left";
        daysAriaLabel = "Weeks left this month";
        weeksAriaLabel = "Months left this year";
        break;
      }
      case VIEWS.YEAR:
      default: {
        // Days left (in year) | Weeks left (in year)
        end = new Date(scopeYear, 11, 31, 23, 59, 59, 999);
        daysLeft = Math.max(
          0,
          Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
        );
        weeksLeft = Math.floor(daysLeft / 7);
        daysLeftLabel = "Days Left";
        weeksLeftLabel = "Weeks Left";
        daysAriaLabel = "Days left this year";
        weeksAriaLabel = "Weeks left this year";
        break;
      }
    }

    if (this.elements.daysLeft) {
      this.elements.daysLeft.textContent = String(daysLeft);
      this.elements.daysLeft.setAttribute("aria-label", daysAriaLabel);
    }
    if (this.elements.weeksLeft) {
      this.elements.weeksLeft.textContent = String(weeksLeft);
      this.elements.weeksLeft.setAttribute("aria-label", weeksAriaLabel);
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

    const homeScopeViews: ViewType[] = [
      VIEWS.DAY,
      VIEWS.WEEK,
      VIEWS.MONTH,
      VIEWS.YEAR,
    ];
    const effectiveView: ViewType =
      State.currentView === VIEWS.HOME
        ? (homeScopeViews[this._uiState.homeProgressScopeIndex] ?? VIEWS.YEAR)
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

    const ratio =
      (now.getTime() - start.getTime()) / (end.getTime() - start.getTime());
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
        p.style.transform = `rotate(${
          baseRotation + rotationOffset
        }deg) scale(${scale})`;
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
      this.elements.timeProgress.setAttribute(
        "aria-valuenow",
        String(progress),
      );
      this.elements.timeProgress.setAttribute("aria-valuetext", `${progress}%`);
    }

    // Update Timeline
    this.updateTimeline(start, end, now, effectiveView, progress);
  },

  updateTimeline(
    start: Date,
    end: Date,
    now: Date,
    view: ViewType,
    progress: number,
  ) {
    if (
      !this.elements.nowTimelineWidget ||
      !this.elements.nowTimelineBar ||
      !this.elements.nowTimelineFill ||
      !this.elements.nowTimelineMarker ||
      !this.elements.nowTimelineLabel ||
      !this.elements.nowTimelineStart ||
      !this.elements.nowTimelineRemaining ||
      !this.elements.nowTimelineEnd
    ) {
      return;
    }

    const clampedProgress = Math.max(0, Math.min(100, progress));

    // Format labels based on view
    let startLabel = "";
    let endLabel = "";
    let remainingLabel = "";

    if (view === VIEWS.DAY) {
      // Day view: show 6 AM to 10 PM
      const currentHour = now.getHours();
      const dayStart = new Date(now);
      dayStart.setHours(6, 0, 0, 0);
      const dayEnd = new Date(now);
      dayEnd.setHours(22, 0, 0, 0);

      // Calculate progress within the day (6 AM to 10 PM)
      const dayProgress =
        now < dayStart
          ? 0
          : now > dayEnd
            ? 100
            : ((now.getTime() - dayStart.getTime()) /
                (dayEnd.getTime() - dayStart.getTime())) *
              100;

      startLabel = "6 AM";
      endLabel = "10 PM";
      const hoursRemaining = Math.max(0, 22 - currentHour);
      remainingLabel = `${hoursRemaining}h left`;

      // Update progress for day view
      const dayProgressClamped = Math.max(0, Math.min(100, dayProgress));
      this.elements.nowTimelineFill.style.width = `${dayProgressClamped}%`;
      this.elements.nowTimelineMarker.style.left = `${dayProgressClamped}%`;

      // Time-of-day theming
      const timeOfDay =
        currentHour < 12
          ? "morning"
          : currentHour < 17
            ? "afternoon"
            : "evening";
      this.elements.nowTimelineBar.setAttribute("data-time-of-day", timeOfDay);
    } else {
      // Week, Month, Year views
      const remainingMs = Math.max(0, end.getTime() - now.getTime());

      if (view === VIEWS.WEEK) {
        const daysRemaining = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));
        startLabel = start.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
        endLabel = new Date(end.getTime() - 1).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
        remainingLabel = `${daysRemaining}d left`;
      } else if (view === VIEWS.MONTH) {
        const daysRemaining = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));
        startLabel = start.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
        endLabel = new Date(end.getTime() - 1).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
        remainingLabel = `${daysRemaining}d left`;
      } else {
        // YEAR view
        const daysRemaining = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));
        startLabel = start.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
        // End is the first day of next year, so show last day of current year
        const lastDayOfYear = new Date(end.getTime() - 1);
        endLabel = lastDayOfYear.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
        remainingLabel = `${daysRemaining}d left`;
      }

      this.elements.nowTimelineFill.style.width = `${clampedProgress}%`;
      this.elements.nowTimelineMarker.style.left = `${clampedProgress}%`;
      this.elements.nowTimelineBar.removeAttribute("data-time-of-day");
    }

    // Update labels
    if (this.elements.nowTimelineStart) {
      this.elements.nowTimelineStart.textContent = startLabel;
    }
    if (this.elements.nowTimelineEnd) {
      this.elements.nowTimelineEnd.textContent = endLabel;
    }
    if (this.elements.nowTimelineRemaining) {
      this.elements.nowTimelineRemaining.textContent = remainingLabel;
    }
  },

  spawnPollenSparkles(x: number, y: number) {
    const colors = ["var(--petal)", "var(--sage)", "var(--sunset)", "#FFD700"];
    for (let i = 0; i < 8; i++) {
      const sparkle = document.createElement("div");
      sparkle.className = "pollen-sparkle";
      sparkle.style.left = `${x}px`;
      sparkle.style.top = `${y}px`;
      sparkle.style.backgroundColor =
        colors[Math.floor(Math.random() * colors.length)];

      const tx = (Math.random() - 0.5) * 100;
      const ty = (Math.random() - 0.5) * 100;
      sparkle.style.setProperty("--tx", `${tx}px`);
      sparkle.style.setProperty("--ty", `${ty}px`);
      sparkle.style.animation = `pollen-drift ${
        0.6 + Math.random() * 0.4
      }s var(--ease-out) forwards`;

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

    // Restore last active view from localStorage
    const savedView = this._uiState.loadView();
    if (savedView && savedView !== State.currentView) {
      State.setView(savedView);
    }
  },

  syncSupportPanelAppearanceControls() {
    this.getSupportPanel().syncAppearanceControls();
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
    document.body.classList.toggle(
      "hide-sidebar",
      layout.showSidebar === false,
    );
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
    ViewNavigator.syncViewButtons();
  },

  showToast(iconOrMessage: string, messageOrType: string = "", options?: any) {
    Toast.show(this.elements, iconOrMessage, messageOrType, options);
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
    KeyboardHandler.handleKeyDown(e, {
      closeModals: () => {
        document.querySelectorAll(".modal-overlay.active").forEach((modal) => {
          modal.remove();
        });
        this.closeGoalModal();
        this.closeCelebration();
      },
      syncViewButtons: () => this.syncViewButtons(),
      showToast: (iconOrMessage, messageOrType) =>
        this.showToast(iconOrMessage, messageOrType ?? ""),
      render: () => this.render(),
      openNewItem: () =>
        this.openGoalModal(
          this.getCurrentLevel(),
          State.viewingMonth,
          State.viewingYear,
        ),
      toggleFocusMode: () => this.toggleFocusMode(),
      showBrainDumpModal: () =>
        this.ensureNDSupport().then((nd) => nd.showBrainDumpModal()),
      showQuickAdd: () => this.ensureQuickAdd().then((qa) => qa?.show()),
      showKeyboardShortcuts: () => this.showKeyboardShortcuts(),
    });
  },

  // Show keyboard shortcuts help
  showKeyboardShortcuts() {
    keyboardShortcuts.showKeyboardShortcuts();
  },

  // ============================================
  // Utility Methods (delegates to pure utilities)
  // ============================================
  escapeHtml(text: string) {
    return escapeHtmlUtil(text);
  },

  formatDate(dateString: string) {
    return formatDateUtil(dateString);
  },

  formatMinutes(minutes: number) {
    return formatMinutesUtil(minutes);
  },

  applyTimeOfDayOverride(timeOfDay: string) {
    const root = document.documentElement;

    // Remove all time classes
    root.classList.remove(
      "time-dawn",
      "time-morning",
      "time-afternoon",
      "time-evening",
      "time-night",
    );

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
