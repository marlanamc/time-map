import { State } from "../../core/State";
import { ND_CONFIG } from "../../config";
import { ThemeManager } from "../../theme/ThemeManager";
import type { AccentTheme } from "../../types";

type SupportPanelCallbacks = {
  onShowBrainDump: () => void | Promise<void>;
  onShowBodyDouble: () => void | Promise<void>;
  onShowQuickWins: () => void | Promise<void>;
  onShowNDSettings: () => void | Promise<void>;
  onShowSettings: () => void | Promise<void>;
  onForceCloudSync: () => void;
  onPromptInstall: () => void | Promise<void>;
  onShowSyncIssues: () => void;
  onHandleLogout: () => void | Promise<void>;
  onToggleFocusMode: () => void;
  onApplyAccessibilityPreferences: () => Promise<void>;
  onApplyTimeOfDayOverride: (timeOfDay: string) => void;
};

export class SupportPanel {
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  private callbacks: SupportPanelCallbacks;

  constructor(callbacks: SupportPanelCallbacks) {
    this.callbacks = callbacks;
  }

  bindEvents() {
    // Support tools side panel (drawer)
    document
      .getElementById("supportPanelBtn")
      ?.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.open();
      });

    const supportPanelToggleBtn = document.getElementById(
      "supportPanelToggleBtn",
    );
    const supportPanelToggleBtnMobile = document.getElementById(
      "supportPanelToggleBtnMobile",
    );

    supportPanelToggleBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.open();
    });

    supportPanelToggleBtnMobile?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.open();
    });

    document
      .getElementById("supportPanelClose")
      ?.addEventListener("click", () => this.close());
    document
      .getElementById("supportPanelOverlay")
      ?.addEventListener("click", (e) => {
        if (e.target === e.currentTarget) this.close();
      });
    document.getElementById("supportPanel")?.addEventListener("click", (e) => {
      const target = e.target as Element | null;
      const actionEl = target?.closest("[data-action]") as HTMLElement | null;
      const action = actionEl?.dataset.action;
      if (!action) return;

      this.close();

      switch (action) {
        case "brainDump":
          void this.callbacks.onShowBrainDump();
          break;
        case "bodyDouble":
          void this.callbacks.onShowBodyDouble();
          break;
        case "quickWins":
          void this.callbacks.onShowQuickWins();
          break;
        case "ndSettings":
          void this.callbacks.onShowNDSettings();
          break;
        case "settings":
          void this.callbacks.onShowSettings();
          break;
        case "syncNow":
          this.callbacks.onForceCloudSync();
          break;
        case "install":
          void this.callbacks.onPromptInstall();
          break;
        case "syncIssues":
          this.callbacks.onShowSyncIssues();
          break;
        case "logout":
          void this.callbacks.onHandleLogout();
          break;
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      const overlay = document.getElementById("supportPanelOverlay");
      if (!overlay || overlay.hasAttribute("hidden")) return;
      this.close();
    });

    document
      .getElementById("supportPanelFocusToggle")
      ?.addEventListener("click", () => this.callbacks.onToggleFocusMode());

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
        this.syncAppearanceControls();
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
      void this.callbacks.onApplyAccessibilityPreferences();
      this.syncAppearanceControls();
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
      this.callbacks.onApplyTimeOfDayOverride(selectedTime);
    });
  }

  open() {
    const overlay = document.getElementById("supportPanelOverlay");
    if (!overlay) return;
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
    this.syncAppearanceControls();
    overlay.removeAttribute("hidden");
    overlay.classList.add("active");
    document.body.classList.add("support-panel-open");
    (
      document.getElementById("supportPanelClose") as HTMLElement | null
    )?.focus();
  }

  close() {
    const overlay = document.getElementById("supportPanelOverlay");
    if (!overlay) return;
    overlay.classList.remove("active");
    document.body.classList.remove("support-panel-open");
    if (this.hideTimer) clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => {
      overlay.setAttribute("hidden", "");
      this.hideTimer = null;
    }, 220);
  }

  syncAppearanceControls() {
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

    // Get current time-of-day theme from root element
    const root = document.documentElement;
    const timeOfDay = root.classList.contains("time-dawn")
      ? "dawn"
      : root.classList.contains("time-morning")
        ? "morning"
        : root.classList.contains("time-afternoon")
          ? "afternoon"
          : root.classList.contains("time-evening")
            ? "evening"
            : root.classList.contains("time-night")
              ? "night"
              : null;

    const accentThemes = ND_CONFIG.ACCENT_THEMES as Record<
      AccentTheme,
      { label: string; emoji: string; color: string }
    >;

    // Map time-of-day themes to relevant accent color families (at least 5 per theme)
    // Colors are grouped by color theory to match each time-of-day gradient
    // Will be sorted in ROYGBIV order after filtering
    const timeThemeAccentMap: Record<string, AccentTheme[]> = {
      dawn: ["rose", "violet", "indigo", "dawn", "evening", "fuchsia", "pink"], // Purple/pink family - soft, cool tones
      morning: [
        "mint",
        "sage",
        "sky",
        "teal",
        "morning",
        "lime",
        "cyan",
        "emerald",
        "yellow",
        "pink",
      ], // Blue/cyan/green family - fresh, energetic
      afternoon: [
        "rose",
        "coral",
        "amber",
        "afternoon",
        "violet",
        "orange",
        "pink",
        "yellow",
        "fuchsia",
      ], // Warm pink/yellow/peach + warm purple - vibrant, warm
      evening: [
        "rose",
        "violet",
        "indigo",
        "dawn",
        "evening",
        "fuchsia",
        "emerald",
        "orange",
        "pink",
      ], // Purple/pink family - warmer than dawn
      night: [
        "sky",
        "teal",
        "indigo",
        "violet",
        "night",
        "cyan",
        "lime",
        "fuchsia",
        "pink",
      ], // Deep blue/cyan family - cool, calm
    };

    // Helper function to get hue from hex color for ROYGBIV sorting
    const getHueFromHex = (hex: string): number => {
      // Handle gradient strings
      if (hex.includes("gradient")) return 999; // Put gradients at end

      const r = parseInt(hex.slice(1, 3), 16) / 255;
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const delta = max - min;

      let hue = 0;
      if (delta !== 0) {
        if (max === r) {
          hue = ((g - b) / delta) % 6;
        } else if (max === g) {
          hue = (b - r) / delta + 2;
        } else {
          hue = (r - g) / delta + 4;
        }
        hue *= 60;
        if (hue < 0) hue += 360;
      }
      return hue;
    };

    // ROYGBIV order mapping: Red(0-30), Orange(30-60), Yellow(60-90), Green(90-150), Blue(150-240), Indigo(240-270), Violet(270-360)
    const getROYGBIVOrder = (hex: string): number => {
      if (hex.includes("gradient")) return 1000; // Rainbow last
      const hue = getHueFromHex(hex);
      // Map hue to ROYGBIV position
      if (hue >= 0 && hue < 30) return 1; // Red
      if (hue >= 30 && hue < 60) return 2; // Orange
      if (hue >= 60 && hue < 90) return 3; // Yellow
      if (hue >= 90 && hue < 150) return 4; // Green
      if (hue >= 150 && hue < 240) return 5; // Blue
      if (hue >= 240 && hue < 270) return 6; // Indigo
      if (hue >= 270 && hue <= 360) return 7; // Violet
      return 8; // Fallback
    };

    // Filter to show relevant accent colors for current time theme
    // Otherwise show all accent themes
    let themesToShow: Array<[AccentTheme, (typeof accentThemes)[AccentTheme]]>;

    if (timeOfDay && timeThemeAccentMap[timeOfDay]) {
      // Get the mapped accent themes for this time-of-day
      const mappedKeys = timeThemeAccentMap[timeOfDay];
      themesToShow = mappedKeys
        .map((key) => {
          const theme = accentThemes[key];
          return theme
            ? ([key, theme] as [
                AccentTheme,
                (typeof accentThemes)[AccentTheme],
              ])
            : null;
        })
        .filter(
          (item): item is [AccentTheme, (typeof accentThemes)[AccentTheme]] =>
            item !== null,
        );

      // Always include rainbow
      themesToShow.push(["rainbow", accentThemes.rainbow]);
    } else {
      // No time theme active, show all
      themesToShow = Object.entries(accentThemes) as [
        AccentTheme,
        { label: string; emoji: string; color: string },
      ][];
    }

    // Sort by ROYGBIV order
    themesToShow.sort((a, b) => {
      const orderA = getROYGBIVOrder(a[1].color);
      const orderB = getROYGBIVOrder(b[1].color);
      if (orderA !== orderB) return orderA - orderB;
      // If same ROYGBIV category, sort by hue within that category
      return getHueFromHex(a[1].color) - getHueFromHex(b[1].color);
    });

    // Always rebuild to handle time-of-day changes
    themePicker.innerHTML = themesToShow
      .map(
        ([key, theme]) => `
              <button
                class="theme-swatch"
                data-theme="${key}"
                title="${theme.label}"
                aria-label="${theme.label}"
                role="radio"
                aria-checked="false"
                ${
                  key === "rainbow"
                    ? `style="--swatch-color: #0EA5E9"`
                    : `style="--swatch-color: ${theme.color}"`
                }
                type="button"
              >
                <span class="swatch-color" ${
                  key === "rainbow"
                    ? `style="background: linear-gradient(90deg, #E11D48, #D96320, #F4A460, #10B981, #0EA5E9, #4F46E5, #6D28D9)"`
                    : ""
                }></span>
                <span class="swatch-emoji">${theme.emoji}</span>
              </button>
            `,
      )
      .join("");

    const activeTheme = State.data.preferences.nd.accentTheme || "sage";
    themePicker.querySelectorAll<HTMLElement>(".theme-swatch").forEach((s) => {
      const isActive = s.dataset.theme === activeTheme;
      s.classList.toggle("active", isActive);
      s.setAttribute("aria-checked", String(isActive));
    });

    // Sync Time Theme Picker (Developer Tool)
    const timeThemePicker = document.getElementById("timeThemePicker");
    if (timeThemePicker) {
      const devTimeOverride =
        localStorage.getItem("gardenFence.devTimeOverride") || "auto";
      timeThemePicker
        .querySelectorAll<HTMLElement>(".time-theme-btn")
        .forEach((btn) => {
          const isActive = btn.dataset.time === devTimeOverride;
          btn.setAttribute("aria-checked", String(isActive));
        });
    }
  }
}
