// ============================================
// The Garden Fence - Boundaries & Blooms
// ADHD-Friendly Focus & Boundary Setting
// ============================================

// Import all styles (Vite bundles these automatically)
import '../styles/main.css';

// Most types are now used by the imported modules rather than app.ts directly
import type { GardenEngine } from './garden/gardenEngine';
import { State, Goals, Planning, Analytics } from './core';
import { SupabaseService } from './services/SupabaseService';
import { VIEWS } from './config';
import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient';

// Removed duplicate interfaces - now imported from types.ts

// Extend Window interface for debugging utilities
declare global {
  interface Window {
    garden?: GardenEngine;
    VisionBoard?: {
      State: typeof State;
      Goals: typeof Goals;
      Planning: typeof Planning;
      Analytics: typeof Analytics;
    };
  }
}

// ============================================
// Time Breakdown Calculator (for time blindness)
// ============================================
// Configuration & Constants (imported from src/config/)
// State Management (imported from src/core/State)
// ============================================

// ============================================
// Core Domain Modules (imported from src/core/)
// ============================================

// ============================================
// Goals (extracted to src/core/Goals.ts)
// ============================================

// ============================================
// Planning & Reviews (extracted to src/core/Planning.ts)
// ============================================

// ============================================
// Analytics (extracted to src/core/Analytics.ts)
// ============================================

// ============================================
// Streaks (extracted to src/core/Streaks.ts)
// ============================================

// ============================================
// Neurodivergent Support Module (extracted to src/features/NDSupport.ts)
// ============================================

// ============================================
// App Settings Panel (extracted to src/features/AppSettings.ts)
// ============================================

// ============================================
// UI Rendering
// ============================================

// Import UI Manager (bridge for gradual migration)
import { UI } from './ui/UIBridge';

// Import Liquid Effects for sidebar animations
import { initLiquidEffects } from './components/dayView/LiquidEffects';


// ============================================
// Initialize App
// ============================================
document.addEventListener("DOMContentLoaded", async () => {
  window.addEventListener("error", (event) => {
    try {
      console.error("Unhandled error:", event.error || event.message);
      UI?.showToast?.("⚠️", "Something went wrong. Try refreshing.");
    } catch {
      // no-op
    }
  });

  window.addEventListener("unhandledrejection", (event) => {
    try {
      console.error("Unhandled promise rejection:", event.reason);
      UI?.showToast?.("⚠️", "Something went wrong. Try refreshing.");
    } catch {
      // no-op
    }
  });

  await State.init();

  // Set up auth state change listeners for session expiration and multi-tab logout
  const supabase = await getSupabaseClient();
  supabase.auth.onAuthStateChange(async (event: string, _session: unknown) => {
    console.log('Auth state changed:', event);

    if (event === 'SIGNED_OUT') {
      // Clean up resources on logout
      await State.cleanup();
      UI.updateSyncStatus?.('local');
      location.reload();
    } else if (event === 'SIGNED_IN' && !State.data) {
      // Handle sign in (e.g., from another tab or after session refresh)
      await State.init();
      UI.init();
      UI.updateSyncStatus?.(isSupabaseConfigured ? 'synced' : 'local');
    } else if (event === 'TOKEN_REFRESHED') {
      console.log('Session token refreshed');
    }
  });

  UI.init();

  // Initialize modular components
  void UI.initModular();

  // Initialize liquid effects (time theming, shimmer, ripple)
  initLiquidEffects();

  // Initialize sync badge to reflect actual auth/config.
  try {
    const user = await SupabaseService.getUser();
    UI.updateSyncStatus?.(user && isSupabaseConfigured ? 'synced' : 'local');
  } catch {
    UI.updateSyncStatus?.('local');
  }

  // Support PWA shortcut URLs (e.g. /?view=day or /?action=new-task)
  {
    const params = new URLSearchParams(location.search);
    const view = params.get("view");
    const action = params.get("action");
    let didHandleAction = false;

    const viewMap: Record<string, typeof VIEWS[keyof typeof VIEWS]> = {
      home: VIEWS.HOME,
      day: VIEWS.DAY,
      week: VIEWS.WEEK,
      month: VIEWS.MONTH,
      year: VIEWS.YEAR,
    };

    if (view && viewMap[view]) {
      State.setView(viewMap[view]);
      didHandleAction = true;
    }

    if (action === "new-task") {
      State.setView(VIEWS.DAY);
      UI.openQuickAdd?.();
      didHandleAction = true;
    }

    if (didHandleAction && (view || action)) {
      const url = new URL(location.href);
      url.searchParams.delete("view");
      url.searchParams.delete("action");
      history.replaceState(null, "", url.toString());
    }
  }

  // Offline indicator + sync badge behavior
  {
    const connectionStatusEl = document.getElementById("connectionStatus");
    let lastOnline = navigator.onLine;

    const refreshSyncBadgeFromAuth = async () => {
      try {
        const user = await SupabaseService.getUser();
        UI.updateSyncStatus?.(user && isSupabaseConfigured ? "synced" : "local");
      } catch {
        UI.updateSyncStatus?.("local");
      }
    };

    const applyConnectionState = async (opts?: { toast?: boolean }) => {
      const online = navigator.onLine;

      if (!online) {
        connectionStatusEl?.removeAttribute("hidden");
        UI.updateSyncStatus?.("offline");
        if (opts?.toast) UI.showToast?.("📴", "Offline");
      } else {
        connectionStatusEl?.setAttribute("hidden", "");
        await refreshSyncBadgeFromAuth();
        if (opts?.toast && !lastOnline) UI.showToast?.("📶", "Back online");
      }

      lastOnline = online;
    };

    window.addEventListener("online", () => void applyConnectionState({ toast: true }));
    window.addEventListener("offline", () => void applyConnectionState({ toast: true }));
    void applyConnectionState({ toast: !navigator.onLine });
  }

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      const toastEl = document.getElementById("toast");
      const toastIconEl = document.getElementById("toastIcon");
      const toastMessageEl = document.getElementById("toastMessage");
      let toastHideTimer: number | null = null;

      const hideToast = () => {
        if (!toastEl) return;
        toastEl.classList.remove("active");
        toastEl.removeAttribute("data-toast-type");
        if (toastHideTimer) window.clearTimeout(toastHideTimer);
        toastHideTimer = null;
      };

      const showToast = (icon: string, message: string, opts?: { timeoutMs?: number; type?: string }) => {
        if (!toastEl || !toastIconEl || !toastMessageEl) return;
        if (toastHideTimer) window.clearTimeout(toastHideTimer);
        toastHideTimer = null;

        toastIconEl.textContent = icon || "";
        toastMessageEl.textContent = message;
        if (opts?.type) toastEl.setAttribute("data-toast-type", opts.type);
        toastEl.classList.add("active");

        if (typeof opts?.timeoutMs === "number" && opts.timeoutMs > 0) {
          toastHideTimer = window.setTimeout(hideToast, opts.timeoutMs);
        }
      };

      const storeSwVersion = (version: string) => {
        try {
          localStorage.setItem("gardenFence.swVersion", version);
        } catch {
          // ignore storage errors
        }
      };

      const showUpdatePrompt = (registration: ServiceWorkerRegistration) => {
        if (!toastEl || !toastIconEl || !toastMessageEl) return;
        if (!navigator.serviceWorker.controller) return; // First install.
        if (!registration.waiting) return;

        const actionsClass = "toast-actions";
        let actions = toastEl.querySelector(`.${actionsClass}`) as HTMLDivElement | null;
        if (!actions) {
          actions = document.createElement("div");
          actions.className = actionsClass;
          toastEl.appendChild(actions);
        }

        actions.innerHTML = `
          <button type="button" class="toast-action" data-sw-action="reload">Reload</button>
          <button type="button" class="toast-action secondary" data-sw-action="later">Later</button>
        `;

        actions.addEventListener(
          "click",
          (e) => {
            const target = e.target as Element | null;
            const btn = target?.closest("[data-sw-action]") as HTMLElement | null;
            const action = btn?.dataset.swAction;
            if (!action) return;
            e.preventDefault();
            e.stopPropagation();

            if (action === "reload") {
              registration.waiting?.postMessage({ type: "SKIP_WAITING" });
              hideToast();
            } else {
              hideToast();
            }
          },
          { once: true },
        );

        showToast("⬆️", "New version available.", { type: "sw-update" });
      };

      navigator.serviceWorker.addEventListener("message", (event) => {
        const type = event?.data?.type;
        if (type === "SW_VERSION" && typeof event.data.version === "string") {
          storeSwVersion(event.data.version);
        }
        if (type === "CACHES_CLEARED") {
          showToast("🧹", "Cache cleared.", { timeoutMs: 2500, type: "sw-cache" });
        }
        if (type === "CACHES_CLEAR_FAILED") {
          showToast("⚠️", "Couldn’t clear cache.", { timeoutMs: 3500, type: "sw-cache" });
        }
        if (type === "PROCESS_SYNC_QUEUE") {
          import("./services/SyncQueue")
            .then((mod) => mod.syncQueue.forceSync())
            .catch(() => {});
        }
      });

      navigator.serviceWorker
        .register("./sw.js")
        .then((registration) => {
          let refreshing = false;

          const requestUpdate = () => registration.update().catch(() => {});

          // When a new SW takes control, reload once so the latest assets are used.
          navigator.serviceWorker.addEventListener("controllerchange", () => {
            if (refreshing) return;
            refreshing = true;
            window.location.reload();
          });

          // If an update is found, prompt the user to reload.
          registration.addEventListener("updatefound", () => {
            const installing = registration.installing;
            if (!installing) return;
            installing.addEventListener("statechange", () => {
              if (installing.state !== "installed") return;
              showUpdatePrompt(registration);
            });
          });

          // Handle refresh if an update is already waiting (e.g., opened in a new tab).
          showUpdatePrompt(registration);

          // Ask the active SW for its current version.
          registration.active?.postMessage({ type: "GET_VERSION" });

          // Proactively check for updates on launch and when returning to the app.
          requestUpdate();
          setInterval(requestUpdate, 60 * 60 * 1000); // hourly
          document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "visible") requestUpdate();
          });
        })
        .catch((err) => {
          console.warn("Service worker registration failed:", err);
        });
    });
  }

  // Header "More" Menu Toggle
  const headerMoreToggle = document.getElementById("headerMoreToggle") as HTMLElement | null;
  const headerMoreDropdown = document.getElementById("headerMoreDropdown") as HTMLElement | null;

  if (headerMoreToggle && headerMoreDropdown) {
    const setOpen = (open: boolean) => {
      headerMoreToggle.setAttribute("aria-expanded", open ? "true" : "false");
      headerMoreDropdown.hidden = !open;
    };

    const isOpen = () =>
      headerMoreToggle.getAttribute("aria-expanded") === "true";

    headerMoreToggle.addEventListener("click", () => {
      setOpen(!isOpen());
    });

    // Close dropdown when clicking outside
    document.addEventListener("click", (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (
        !headerMoreToggle.contains(target) &&
        !headerMoreDropdown.contains(target)
      ) {
        setOpen(false);
      }
    });

    // Close on Escape, keep focus sensible
    headerMoreDropdown.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        headerMoreToggle.focus();
      }
    });

    // Close after clicking "action" items (but keep open for toggles like energy buttons)
    headerMoreDropdown.addEventListener("click", (e: MouseEvent) => {
      const target = e.target as Element | null;
      const closeItem = target?.closest("[data-close-header-more]");
      if (closeItem) setOpen(false);
    });
  }

  // ND Menu Toggle
  const ndMenuToggle = document.getElementById("ndMenuToggle") as HTMLElement | null;
  const ndDropdown = document.getElementById("ndDropdown") as HTMLElement | null;

  if (ndMenuToggle && ndDropdown) {
    ndMenuToggle.addEventListener("click", () => {
      const isExpanded =
        ndMenuToggle.getAttribute("aria-expanded") === "true";
      ndMenuToggle.setAttribute("aria-expanded", String(!isExpanded));
      ndDropdown.hidden = isExpanded;
    });

    // Close dropdown when clicking outside
    document.addEventListener("click", (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (!ndMenuToggle.contains(target) && !ndDropdown.contains(target)) {
        ndMenuToggle.setAttribute("aria-expanded", "false");
        ndDropdown.hidden = true;
      }
    });

    // Keyboard navigation
    ndDropdown.addEventListener("keydown", (e: KeyboardEvent) => {
      const items = Array.from(
        ndDropdown.querySelectorAll<HTMLElement>(".nd-dropdown-item"),
      );
      if (items.length === 0) return;
      const active = document.activeElement as HTMLElement | null;
      const currentIndex = active ? items.indexOf(active) : -1;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        const nextIndex =
          currentIndex < 0 ? 0 : (currentIndex + 1) % items.length;
        items[nextIndex].focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const prevIndex =
          currentIndex <= 0 ? items.length - 1 : currentIndex - 1;
        items[prevIndex].focus();
      } else if (e.key === "Escape") {
        ndMenuToggle.focus();
        ndMenuToggle.setAttribute("aria-expanded", "false");
        ndDropdown.hidden = true;
      }
    });
  }

  // Sidebar Collapsible Sections
  document.querySelectorAll<HTMLElement>(".section-toggle").forEach((toggle) => {
    toggle.addEventListener("click", () => {
      const isExpanded = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!isExpanded));

      // Save preference
      const sectionEl = toggle.closest(".sidebar-section") as HTMLElement | null;
      const section = sectionEl?.dataset.section;
      if (!section || !State.data) return;
      if (
        section !== "affirmation" &&
        section !== "upcoming" &&
        section !== "achievements"
      ) {
        return;
      }
      State.data.preferences.sidebarSections[section] = !isExpanded;
      State.save();
    });
  });

  // Restore saved sidebar section states
  function restoreSidebarStates() {
    if (!State.data) return;
    const preferences = State.data.preferences.sidebarSections;
    Object.entries(preferences).forEach(([section, expanded]) => {
      const toggle = document.querySelector(
        `[data-section="${section}"] .section-toggle`,
      ) as HTMLElement | null;
      if (toggle) {
        toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
      }
    });
  }

  // Call restore function
  restoreSidebarStates();

  // ============================================
  // Initialize Garden Engine
  // ============================================
  const initGarden = async () => {
    try {
      const { GardenEngine: GardenEngineCtor } = await import("./garden/gardenEngine");
      const savedGardenPrefs = GardenEngineCtor.loadPreferences();
      const garden = new GardenEngineCtor(savedGardenPrefs);
      garden.initialize();

      // Log garden state changes for debugging
      garden.on('timeChanged', (state) => {
        console.log('🌅 Time changed:', state.time.timeOfDay);
      });

      garden.on('seasonChanged', (state) => {
        console.log('🍂 Season changed:', state.season.season);
      });

      // Expose garden for debugging
      window.garden = garden;
    } catch (err) {
      console.error("Failed to initialize GardenEngine:", err);
    }
  };

  // Defer garden animations so first interactive paint happens sooner.
  const scheduleGardenInit = () => {
    const win = window as any;
    if (typeof win.requestIdleCallback === "function") {
      win.requestIdleCallback(() => void initGarden(), { timeout: 1500 });
      return;
    }
    setTimeout(() => void initGarden(), 250);
  };

  scheduleGardenInit();
});

// Expose for debugging (optional)
window.VisionBoard = { State, Goals, Planning, Analytics };
