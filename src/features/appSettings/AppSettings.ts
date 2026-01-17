// ===================================
// App Settings Panel Module
// ===================================
import { State } from "../../core/State";
import { CONFIG, VIEWS } from "../../config";
import { NDSupport } from "../ndSupport";
import type {
  AppData,
  ViewType,
  Goal,
  WeeklyReview,
  BrainDumpEntry,
  BodyDoubleSession,
} from "../../types";

// Callback interface for UI interactions
interface AppSettingsCallbacks {
  onShowToast?: (message: string, type?: string) => void;
  onScheduleRender?: () => void;
  onShowKeyboardShortcuts?: () => void;
  onSetFocusMode?: (
    enabled: boolean,
    options?: { silent?: boolean; persist?: boolean },
  ) => void;
  onApplyLayoutVisibility?: () => void;
  onApplySidebarVisibility?: () => void;
  onSyncViewButtons?: () => void;
}

let callbacks: AppSettingsCallbacks = {};

export const AppSettings = {
  setCallbacks(cb: AppSettingsCallbacks) {
    callbacks = cb;
  },

  showPanel() {
    if (!State.data) return;
    const isMobile = document.body.classList.contains("is-mobile");
    const modal = document.createElement("div");
    modal.className = "modal-overlay active app-settings-modal";

    const prefs = State.data.preferences;
    const sidebarPrefs = prefs.sidebar || {};

    modal.innerHTML = `
        <div class="modal modal-lg">
          <div class="modal-header">
            <h2 class="modal-title">Settings</h2>
            <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
          </div>
          <div class="modal-body nd-settings-body">
            <div class="settings-section">
              <h3>General</h3>
              ${
                isMobile
                  ? ""
                  : `
                <div class="setting-row">
                  <label for="settingsDefaultView">Default view</label>
                  <select id="settingsDefaultView">
                    <option value="year" ${prefs.defaultView === VIEWS.YEAR ? "selected" : ""}>Year</option>
                    <option value="month" ${prefs.defaultView === VIEWS.MONTH ? "selected" : ""}>Month</option>
                    <option value="week" ${prefs.defaultView === VIEWS.WEEK ? "selected" : ""}>Week</option>
                    <option value="day" ${prefs.defaultView === VIEWS.DAY ? "selected" : ""}>Day</option>
                  </select>
                </div>
              `
              }
              <div class="setting-row checkbox-row">
                <label>
                  <input type="checkbox" id="settingsFocusMode" ${prefs.focusMode ? "checked" : ""}>
                  Start in Focus (reduce visual noise)
                </label>
              </div>
              <div class="setting-row">
                <label for="settingsThemeMode">Theme mode</label>
                <select id="settingsThemeMode">
                  <option value="auto" ${!localStorage.getItem("gardenFence.theme") && !prefs.theme ? "selected" : ""}>Automatic (time-based)</option>
                  <option value="manual" ${localStorage.getItem("gardenFence.theme") || prefs.theme ? "selected" : ""}>Manual (user choice)</option>
                </select>
              </div>
              ${
                isMobile
                  ? ""
                  : `
                <div class="setting-row">
                  <label>Help</label>
                  <button class="btn btn-ghost" id="settingsShortcutsBtn">Keyboard shortcuts</button>
                </div>
              `
              }
            </div>

            ${
              isMobile
                ? ""
                : `
              <div class="settings-section">
                <h3>Visibility</h3>
                <div class="setting-row checkbox-row">
                  <label>
                    <input type="checkbox" id="settingsShowHeader" ${prefs.layout?.showHeader !== false ? "checked" : ""}>
                    Show header
                  </label>
                </div>
                <div class="setting-row checkbox-row">
                  <label>
                    <input type="checkbox" id="settingsShowControlBar" ${prefs.layout?.showControlBar !== false ? "checked" : ""}>
                    Show top controls
                  </label>
                </div>
                <div class="setting-row checkbox-row">
                  <label>
                    <input type="checkbox" id="settingsShowSidebar" ${prefs.layout?.showSidebar !== false ? "checked" : ""}>
                    Show sidebar
                  </label>
                </div>
                <div class="setting-row checkbox-row">
                  <label>
                    <input type="checkbox" id="settingsShowNowPanel" ${prefs.layout?.showNowPanel !== false ? "checked" : ""}>
                    Show "You Are Here"
                  </label>
                </div>
              </div>
            `
            }

            <div class="settings-section">
              <h3>Garden & Growth</h3>
              <div class="setting-row">
                <label for="settingsCheckInDay">Weekly Check-in Day</label>
                <select id="settingsCheckInDay">
                  <option value="0" ${prefs.nd?.checkInDay === 0 ? "selected" : ""}>Sunday</option>
                  <option value="1" ${prefs.nd?.checkInDay === 1 ? "selected" : ""}>Monday</option>
                  <option value="2" ${prefs.nd?.checkInDay === 2 ? "selected" : ""}>Tuesday</option>
                  <option value="3" ${prefs.nd?.checkInDay === 3 ? "selected" : ""}>Wednesday</option>
                  <option value="4" ${prefs.nd?.checkInDay === 4 ? "selected" : ""}>Thursday</option>
                  <option value="5" ${prefs.nd?.checkInDay === 5 ? "selected" : ""}>Friday</option>
                  <option value="6" ${prefs.nd?.checkInDay === 6 ? "selected" : ""}>Saturday</option>
                </select>
              </div>
              <div class="setting-row">
                <label for="settingsCheckInTime">Check-in Time</label>
                <input type="time" id="settingsCheckInTime" value="${prefs.nd?.checkInTime || "09:00"}">
              </div>
            </div>

            <div class="settings-section">
              <h3>Accessibility & Overwhelm Support</h3>
              <div class="setting-row">
                <label>Support settings</label>
                <button class="btn btn-ghost" id="openNdSettingsBtn">Open</button>
              </div>
            </div>

            ${
              isMobile
                ? ""
                : `
              <div class="settings-section">
                <h3>Sidebar</h3>
                <div class="setting-row checkbox-row">
                  <label>
                    <input type="checkbox" id="settingsShowAffirmation" ${sidebarPrefs.showAffirmation ? "checked" : ""}>
                    Show affirmation
                  </label>
                </div>
                <div class="setting-row checkbox-row">
                  <label>
                    <input type="checkbox" id="settingsShowWhatsNext" ${sidebarPrefs.showWhatsNext ? "checked" : ""}>
                    Show Coming Up
                  </label>
                </div>
                <div class="setting-row checkbox-row">
                  <label>
                    <input type="checkbox" id="settingsShowAchievements" ${sidebarPrefs.showAchievements ? "checked" : ""}>
                    Show achievements
                  </label>
                </div>
              </div>
            `
            }

            <div class="settings-section">
              <h3>Data</h3>
              <div class="setting-row">
                <div class="setting-label">
                  <label>Version</label>
                  <div class="setting-description">Offline cache (service worker)</div>
                </div>
                <div class="setting-control">
                  <div id="settingsSwVersion" style="font-size: var(--text-sm); font-weight: 650; color: var(--text-secondary);">—</div>
                </div>
              </div>
              <div class="setting-row">
                <div class="setting-label">
                  <label>Offline cache</label>
                  <div class="setting-description">Clear stored files and reload</div>
                </div>
                <div class="setting-control">
                  <button class="btn btn-ghost" id="clearCacheBtn" type="button">Clear cache</button>
                </div>
              </div>
              <div class="setting-row">
                <label>Backup</label>
                <button class="btn btn-ghost" id="downloadBackupBtn">Download JSON</button>
              </div>
              <div class="setting-row">
                <label>Export goals</label>
                <button class="btn btn-ghost" id="exportGoalsJsonBtn" type="button">JSON</button>
                <button class="btn btn-ghost" id="exportGoalsCsvBtn" type="button">CSV</button>
              </div>
              <div class="setting-row">
                <label>Restore</label>
                <button class="btn btn-ghost" id="importBackupBtn">Import JSON</button>
                <input type="file" id="importBackupFile" accept="application/json,.json" hidden />
              </div>
              <div class="setting-row">
                <label>Reset</label>
                <button class="btn btn-ghost" id="resetPrefsBtn">Reset preferences</button>
                <button class="btn btn-ghost" id="resetAllBtn">Reset all data</button>
              </div>
            </div>

            <div class="modal-actions">
              <button class="btn btn-primary" id="saveAppSettings">Save Settings</button>
            </div>
          </div>
        </div>
      `;

    document.body.appendChild(modal);

    const swVersionEl = modal.querySelector(
      "#settingsSwVersion",
    ) as HTMLElement | null;
    if (swVersionEl) {
      try {
        swVersionEl.textContent =
          localStorage.getItem("gardenFence.swVersion") || "—";
      } catch {
        swVersionEl.textContent = "—";
      }
    }

    const clearCacheBtn = modal.querySelector(
      "#clearCacheBtn",
    ) as HTMLButtonElement | null;
    clearCacheBtn?.addEventListener("click", async () => {
      if (!confirm("Clear offline cache and reload?")) return;
      if (clearCacheBtn) {
        clearCacheBtn.disabled = true;
        clearCacheBtn.textContent = "Clearing...";
      }

      const clearViaWindow = async () => {
        if (!("caches" in window))
          throw new Error("Cache storage not available");
        const keys = await caches.keys();
        await Promise.all(
          keys
            .filter((k) => k.startsWith("garden-fence-"))
            .map((k) => caches.delete(k)),
        );
      };

      try {
        if (
          "serviceWorker" in navigator &&
          navigator.serviceWorker.controller
        ) {
          const controller = navigator.serviceWorker.controller;
          const result = await new Promise<"ok" | "fail" | "timeout">(
            (resolve) => {
              let timeoutId: number | null = null;
              const onMessage = (event: MessageEvent) => {
                const type = event?.data?.type;
                if (type === "CACHES_CLEARED") finish("ok");
                if (type === "CACHES_CLEAR_FAILED") finish("fail");
              };
              const finish = (value: "ok" | "fail" | "timeout") => {
                if (timeoutId) window.clearTimeout(timeoutId);
                timeoutId = null;
                navigator.serviceWorker.removeEventListener(
                  "message",
                  onMessage,
                );
                resolve(value);
              };
              timeoutId = window.setTimeout(() => finish("timeout"), 4000);
              navigator.serviceWorker.addEventListener("message", onMessage);
              controller.postMessage({ type: "CLEAR_CACHES" });
            },
          );

          if (result !== "ok") await clearViaWindow();
        } else {
          await clearViaWindow();
        }

        window.location.reload();
      } catch (e) {
        console.error(e);
        alert("Couldn’t clear cache.");
        if (clearCacheBtn) {
          clearCacheBtn.disabled = false;
          clearCacheBtn.textContent = "Clear cache";
        }
      }
    });

    modal
      .querySelector("#settingsShortcutsBtn")
      ?.addEventListener("click", () => {
        callbacks.onShowKeyboardShortcuts?.();
      });

    modal.querySelector("#openNdSettingsBtn")?.addEventListener("click", () => {
      modal.remove();
      NDSupport.showSettingsPanel();
    });

    modal.querySelector("#downloadBackupBtn")?.addEventListener("click", () => {
      this.downloadBackup();
      callbacks.onShowToast?.("⬇️", "Backup downloaded");
    });

    modal
      .querySelector("#exportGoalsJsonBtn")
      ?.addEventListener("click", () => {
        this.downloadGoalsJson();
        callbacks.onShowToast?.("⬇️", "Goals exported");
      });

    modal.querySelector("#exportGoalsCsvBtn")?.addEventListener("click", () => {
      this.downloadGoalsCsv();
      callbacks.onShowToast?.("⬇️", "Goals exported");
    });

    const importFile = modal.querySelector(
      "#importBackupFile",
    ) as HTMLInputElement | null;
    modal.querySelector("#importBackupBtn")?.addEventListener("click", () => {
      importFile?.click();
    });

    importFile?.addEventListener("change", async () => {
      const file = importFile.files?.[0];
      if (importFile) importFile.value = "";
      if (!file) return;
      try {
        await this.importBackup(file);
      } catch (e) {
        console.error(e);
        callbacks.onShowToast?.("⚠️", "Import failed");
      }
    });

    modal.querySelector("#resetPrefsBtn")?.addEventListener("click", () => {
      if (
        !confirm(
          "Reset preferences back to defaults? Your goals and history will stay.",
        )
      )
        return;
      this.resetPreferences();
    });

    modal.querySelector("#resetAllBtn")?.addEventListener("click", () => {
      if (
        !confirm(
          "This will permanently delete ALL data on this device. Continue?",
        )
      )
        return;
      if (!confirm("Last check: delete everything?")) return;
      this.resetAllData();
    });

    modal.querySelector("#saveAppSettings")?.addEventListener("click", () => {
      const defaultView = (
        modal.querySelector("#settingsDefaultView") as HTMLSelectElement | null
      )?.value;
      const startFocusMode = !!(
        modal.querySelector("#settingsFocusMode") as HTMLInputElement
      )?.checked;
      const showHeader = !!(
        modal.querySelector("#settingsShowHeader") as HTMLInputElement
      )?.checked;
      const showControlBar = !!(
        modal.querySelector("#settingsShowControlBar") as HTMLInputElement
      )?.checked;
      const showSidebar = !!(
        modal.querySelector("#settingsShowSidebar") as HTMLInputElement
      )?.checked;
      const showNowPanel = !!(
        modal.querySelector("#settingsShowNowPanel") as HTMLInputElement
      )?.checked;
      const showAffirmation = !!(
        modal.querySelector("#settingsShowAffirmation") as HTMLInputElement
      )?.checked;
      const showWhatsNext = !!(
        modal.querySelector("#settingsShowWhatsNext") as HTMLInputElement
      )?.checked;
      const showAchievements = !!(
        modal.querySelector("#settingsShowAchievements") as HTMLInputElement
      )?.checked;
      const checkInDay = parseInt(
        (modal.querySelector("#settingsCheckInDay") as HTMLSelectElement | null)
          ?.value || "0",
        10,
      );
      const checkInTime =
        (modal.querySelector("#settingsCheckInTime") as HTMLInputElement | null)
          ?.value || "09:00";
      const themeMode =
        (modal.querySelector("#settingsThemeMode") as HTMLSelectElement | null)
          ?.value || "auto";

      if (
        State.data &&
        defaultView &&
        (Object.values(VIEWS) as ViewType[]).includes(defaultView as ViewType)
      ) {
        const view = defaultView as ViewType;
        State.data.preferences.defaultView = view;
        State.currentView = view;
      }

      if (State.data) {
        State.data.preferences.focusMode = startFocusMode;
        if (callbacks.onSetFocusMode) {
          callbacks.onSetFocusMode(startFocusMode, { silent: true });
        } else {
          State.focusMode = startFocusMode;
          document.body.classList.toggle("focus-mode", startFocusMode);
        }

        if (!isMobile) {
          State.data.preferences.layout = {
            ...(State.data.preferences.layout || {}),
            showHeader,
            showControlBar,
            showSidebar,
            showNowPanel,
          };

          State.data.preferences.sidebar = {
            ...State.data.preferences.sidebar,
            showAffirmation,
            showWhatsNext,
            showAchievements,
          };
        }

        State.data.preferences.nd = {
          ...State.data.preferences.nd,
          checkInDay,
          checkInTime,
        };

        // Handle theme mode setting
        if (themeMode === "auto") {
          // Switch to automatic mode - clear manual theme
          localStorage.removeItem("gardenFence.theme");
          State.data.preferences.theme = "";
          // Simplify the theme application by triggering a page reload which will apply the auto theme
          window.location.reload();
        } else if (themeMode === "manual") {
          // Switch to manual mode - if no manual theme is set, use current system theme
          if (
            !State.data.preferences.theme &&
            !localStorage.getItem("gardenFence.theme")
          ) {
            const currentHour = new Date().getHours();
            const isNightTime = currentHour < 6 || currentHour >= 18;
            State.data.preferences.theme = isNightTime ? "night" : "day";
          }
        }

        State.save();
      }
      NDSupport.applyAccessibilityPreferences();
      callbacks.onApplyLayoutVisibility?.();
      callbacks.onApplySidebarVisibility?.();
      callbacks.onSyncViewButtons?.();
      callbacks.onScheduleRender?.();
      modal.remove();
      callbacks.onShowToast?.("✅", "Settings saved");
    });

    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.remove();
    });
  },

  downloadBackup() {
    const date = new Date().toISOString().split("T")[0];
    const filename = `visionboard-backup-${date}.json`;

    const payload = {
      exportedAt: new Date().toISOString(),
      storageKey: CONFIG.STORAGE_KEY,
      data: State.data,
    };

    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  downloadGoalsJson() {
    const date = new Date().toISOString().split("T")[0];
    const filename = `visionboard-goals-${date}.json`;

    const payload = {
      exportedAt: new Date().toISOString(),
      storageKey: CONFIG.STORAGE_KEY,
      goals: State.data?.goals ?? [],
    };

    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  downloadGoalsCsv() {
    const date = new Date().toISOString().split("T")[0];
    const filename = `visionboard-goals-${date}.csv`;
    const goals = State.data?.goals ?? [];

    const escape = (value: unknown): string => {
      if (value === null || value === undefined) return "";
      const s = String(value);
      if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };

    const rows: string[] = [];
    const headers = [
      "id",
      "title",
      "level",
      "description",
      "month",
      "year",
      "category",
      "priority",
      "status",
      "progress",
      "dueDate",
      "startTime",
      "endTime",
      "completedAt",
      "lastWorkedOn",
      "createdAt",
      "updatedAt",
      "tags",
      "parentId",
      "parentLevel",
    ];
    rows.push(headers.join(","));

    goals.forEach((g) => {
      rows.push(
        [
          g.id,
          g.title,
          g.level,
          g.description,
          g.month,
          g.year,
          g.category,
          g.priority,
          g.status,
          g.progress,
          g.dueDate,
          g.startTime ?? "",
          g.endTime ?? "",
          g.completedAt ?? "",
          g.lastWorkedOn ?? "",
          g.createdAt,
          g.updatedAt,
          Array.isArray(g.tags) ? g.tags.join(";") : "",
          g.parentId ?? "",
          g.parentLevel ?? "",
        ]
          .map(escape)
          .join(","),
      );
    });

    const csv = rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  async importBackup(file: File) {
    const text = await file.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("Invalid JSON");
    }

    const candidate = parsed?.data ?? parsed;
    const normalized = this.normalizeImportedData(candidate);

    if (!confirm("Import will replace your current data. Continue?")) return;

    State.data = normalized;
    State.save();
    location.reload();
  },

  normalizeImportedData(candidate: unknown) {
    const defaults = State.getDefaultData();
    if (!candidate || typeof candidate !== "object") {
      throw new Error("Invalid data");
    }

    const data = candidate as Record<string, unknown>;
    const normalized = defaults as AppData & {
      intentions?: Record<string, unknown>;
    };
    normalized.goals = Array.isArray(data.goals) ? (data.goals as Goal[]) : [];
    // Legacy: intentions no longer used; preserve only if present.
    normalized.intentions =
      data.intentions && typeof data.intentions === "object"
        ? (data.intentions as Record<string, unknown>)
        : {};
    normalized.streak =
      data.streak && typeof data.streak === "object"
        ? (data.streak as typeof defaults.streak)
        : defaults.streak;
    normalized.achievements = Array.isArray(data.achievements)
      ? (data.achievements as string[])
      : [];
    normalized.weeklyReviews = Array.isArray(data.weeklyReviews)
      ? (data.weeklyReviews as WeeklyReview[])
      : [];
    normalized.brainDump = Array.isArray(data.brainDump)
      ? (data.brainDump as BrainDumpEntry[])
      : [];
    normalized.bodyDoubleHistory = Array.isArray(data.bodyDoubleHistory)
      ? (data.bodyDoubleHistory as BodyDoubleSession[])
      : [];

    normalized.preferences = {
      ...defaults.preferences,
      ...(data.preferences && typeof data.preferences === "object"
        ? (data.preferences as typeof defaults.preferences)
        : {}),
      nd: {
        ...defaults.preferences.nd,
        ...(data.preferences &&
        typeof data.preferences === "object" &&
        (data.preferences as any).nd &&
        typeof (data.preferences as any).nd === "object"
          ? (data.preferences as any).nd
          : {}),
      },
    };

    normalized.analytics =
      data.analytics && typeof data.analytics === "object"
        ? {
            ...defaults.analytics,
            ...(data.analytics as typeof defaults.analytics),
          }
        : defaults.analytics;

    normalized.createdAt =
      typeof (candidate as any).createdAt === "string"
        ? (candidate as any).createdAt
        : defaults.createdAt;
    normalized.version = defaults.version;

    return normalized;
  },

  resetPreferences() {
    if (!State.data) return;
    const defaults = State.getDefaultData();
    State.data.preferences = defaults.preferences;
    State.save();
    location.reload();
  },

  resetAllData() {
    localStorage.removeItem(CONFIG.STORAGE_KEY);
    location.reload();
  },
};
