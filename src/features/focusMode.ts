import { State } from "../core/State";
import { viewportManager } from "../ui/viewport/ViewportManager";
import type { UIStateManager } from "../ui/state/UIStateManager";

export type FocusModeContext = {
  _uiState: UIStateManager;
  showToast: (iconOrMessage: string, messageOrType?: string) => void;
  applyLayoutVisibility: () => void;
  applySidebarVisibility: () => void;
  applyAccessibilityPreferences: () => Promise<void>;
  syncViewButtons: () => void;
  syncSupportPanelAppearanceControls: () => void;
  updateFocusLayoutVars: () => void;
  setupFocusHoverReveal: () => void;
  setFocusMode: (
    enabled: boolean,
    options?: { silent?: boolean; persist?: boolean },
  ) => void;
};

export function toggleFocusMode(ctx: FocusModeContext) {
  const previousView = State.currentView;
  ctx.setFocusMode(!State.focusMode);
  if (State.currentView !== previousView) {
    State.setView(previousView);
  }
}

export function setFocusMode(
  ctx: FocusModeContext,
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
    ctx.updateFocusLayoutVars();
    if (isMobile) {
      document.body.classList.add("focus-ui-revealed");
      document.getElementById("focusHandle")?.setAttribute("hidden", "");
    } else {
      ctx.setupFocusHoverReveal();
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
    ctx.showToast("", State.focusMode ? "Focus on (calmer view)" : "Focus off");
  }
}

export function applySavedUIState(ctx: FocusModeContext) {
  ctx.setFocusMode(State.focusMode, { silent: true, persist: false });

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

  ctx.applyLayoutVisibility();
  ctx.applySidebarVisibility();
  void ctx.applyAccessibilityPreferences();
  ctx.syncViewButtons();
  ctx.syncSupportPanelAppearanceControls();
}

export function updateFocusLayoutVars() {
  const header = document.querySelector(".header") as HTMLElement | null;
  const controlBar = document.querySelector(".control-bar") as HTMLElement | null;
  const root = document.documentElement;

  const getVisibleHeight = (el: HTMLElement | null) => {
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return 0;
    return rect.height;
  };

  const headerHeight = getVisibleHeight(header);
  root.style.setProperty(
    "--focus-header-height",
    `${headerHeight > 0 ? Math.max(56, headerHeight) : 0}px`,
  );

  const controlBarHeight = getVisibleHeight(controlBar);
  root.style.setProperty(
    "--focus-controlbar-height",
    `${controlBarHeight > 0 ? Math.max(48, controlBarHeight) : 0}px`,
  );
}

export function setupFocusHoverReveal(ctx: FocusModeContext) {
  if (ctx._uiState.focusRevealSetup) return;
  ctx._uiState.focusRevealSetup = true;

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
    if (ctx._uiState.focusRevealHideTimer)
      clearTimeout(ctx._uiState.focusRevealHideTimer);
  };

  const scheduleHide = () => {
    if (ctx._uiState.focusRevealHideTimer)
      clearTimeout(ctx._uiState.focusRevealHideTimer);
    ctx._uiState.focusRevealHideTimer = setTimeout(() => {
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
}
