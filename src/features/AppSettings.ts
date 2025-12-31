// ===================================
// App Settings Panel Module
// ===================================
import { State } from '../core/State';
import { CONFIG, VIEWS } from '../config';
import { NDSupport } from './NDSupport';
import { UI } from '../ui/UIManager';
import type { AppData, ViewType, Goal, WeeklyReview, BrainDumpEntry, BodyDoubleSession } from '../types';

// Callback interface for UI interactions
interface AppSettingsCallbacks {
  onShowToast?: (message: string, type?: string) => void;
  onScheduleRender?: () => void;
  onShowKeyboardShortcuts?: () => void;
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
              ${isMobile ? "" : `
                <div class="setting-row">
                  <label for="settingsDefaultView">Default view</label>
                  <select id="settingsDefaultView">
                    <option value="year" ${prefs.defaultView === VIEWS.YEAR ? "selected" : ""}>Year</option>
                    <option value="month" ${prefs.defaultView === VIEWS.MONTH ? "selected" : ""}>Month</option>
                    <option value="week" ${prefs.defaultView === VIEWS.WEEK ? "selected" : ""}>Week</option>
                    <option value="day" ${prefs.defaultView === VIEWS.DAY ? "selected" : ""}>Day</option>
                  </select>
                </div>
              `}
              <div class="setting-row checkbox-row">
                <label>
                  <input type="checkbox" id="settingsFocusMode" ${prefs.focusMode ? "checked" : ""}>
                  Start in Focus (reduce visual noise)
                </label>
              </div>
              ${isMobile ? "" : `
                <div class="setting-row">
                  <label>Help</label>
                  <button class="btn btn-ghost" id="settingsShortcutsBtn">Keyboard shortcuts</button>
                </div>
              `}
            </div>

            ${isMobile ? "" : `
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
            `}

            <div class="settings-section">
              <h3>Accessibility & Overwhelm Support</h3>
              <div class="setting-row">
                <label>Support settings</label>
                <button class="btn btn-ghost" id="openNdSettingsBtn">Open</button>
              </div>
            </div>

            ${isMobile ? "" : `
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
            `}

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

    const swVersionEl = modal.querySelector("#settingsSwVersion") as HTMLElement | null;
    if (swVersionEl) {
      try {
        swVersionEl.textContent = localStorage.getItem("gardenFence.swVersion") || "—";
      } catch {
        swVersionEl.textContent = "—";
      }
    }

    const clearCacheBtn = modal.querySelector("#clearCacheBtn") as HTMLButtonElement | null;
    clearCacheBtn?.addEventListener("click", async () => {
      if (!confirm("Clear offline cache and reload?")) return;
      if (clearCacheBtn) {
        clearCacheBtn.disabled = true;
        clearCacheBtn.textContent = "Clearing...";
      }

      const clearViaWindow = async () => {
        if (!("caches" in window)) throw new Error("Cache storage not available");
        const keys = await caches.keys();
        await Promise.all(
          keys.filter((k) => k.startsWith("garden-fence-")).map((k) => caches.delete(k)),
        );
      };

      try {
        if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
          const controller = navigator.serviceWorker.controller;
          const result = await new Promise<"ok" | "fail" | "timeout">((resolve) => {
            let timeoutId: number | null = null;
            const onMessage = (event: MessageEvent) => {
              const type = event?.data?.type;
              if (type === "CACHES_CLEARED") finish("ok");
              if (type === "CACHES_CLEAR_FAILED") finish("fail");
            };
            const finish = (value: "ok" | "fail" | "timeout") => {
              if (timeoutId) window.clearTimeout(timeoutId);
              timeoutId = null;
              navigator.serviceWorker.removeEventListener("message", onMessage);
              resolve(value);
            };
            timeoutId = window.setTimeout(() => finish("timeout"), 4000);
            navigator.serviceWorker.addEventListener("message", onMessage);
            controller.postMessage({ type: "CLEAR_CACHES" });
          });

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

    modal
      .querySelector("#downloadBackupBtn")
      ?.addEventListener("click", () => {
        this.downloadBackup();
        callbacks.onShowToast?.("⬇️", "Backup downloaded");
      });

    const importFile = modal.querySelector("#importBackupFile") as HTMLInputElement | null;
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
          "Reset preferences back to defaults? Your anchors and history will stay.",
        )
      )
        return;
      this.resetPreferences();
    });

    modal.querySelector("#resetAllBtn")?.addEventListener("click", () => {
      if (!confirm("This will permanently delete ALL data on this device. Continue?"))
        return;
      if (!confirm("Last check: delete everything?")) return;
      this.resetAllData();
    });

    modal.querySelector("#saveAppSettings")?.addEventListener("click", () => {
      const defaultView = (modal.querySelector("#settingsDefaultView") as HTMLSelectElement | null)?.value;
      const startFocusMode = !!(modal.querySelector("#settingsFocusMode") as HTMLInputElement)?.checked;
      const showHeader = !!(modal.querySelector("#settingsShowHeader") as HTMLInputElement)?.checked;
      const showControlBar = !!(modal.querySelector("#settingsShowControlBar") as HTMLInputElement)?.checked;
      const showSidebar = !!(modal.querySelector("#settingsShowSidebar") as HTMLInputElement)?.checked;
      const showNowPanel = !!(modal.querySelector("#settingsShowNowPanel") as HTMLInputElement)?.checked;
      const showAffirmation = !!(modal.querySelector("#settingsShowAffirmation") as HTMLInputElement)?.checked;
      const showWhatsNext = !!(modal.querySelector("#settingsShowWhatsNext") as HTMLInputElement)?.checked;
      const showAchievements = !!(modal.querySelector("#settingsShowAchievements") as HTMLInputElement)?.checked;

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
        UI.setFocusMode(startFocusMode, { silent: true });

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

        State.save();
      }
      NDSupport.applyAccessibilityPreferences();
      UI.applyLayoutVisibility?.();
      UI.applySidebarVisibility?.();
      UI.syncViewButtons();
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
    const normalized = defaults as AppData & { intentions?: Record<string, unknown> };
    normalized.goals = Array.isArray(data.goals) ? data.goals as Goal[] : [];
    // Legacy: intentions no longer used; preserve only if present.
    normalized.intentions =
      data.intentions && typeof data.intentions === "object"
        ? data.intentions as Record<string, unknown>
        : {};
    normalized.streak =
      data.streak && typeof data.streak === "object"
        ? data.streak as typeof defaults.streak
        : defaults.streak;
    normalized.achievements = Array.isArray(data.achievements)
      ? data.achievements as string[]
      : [];
    normalized.weeklyReviews = Array.isArray(data.weeklyReviews)
      ? data.weeklyReviews as WeeklyReview[]
      : [];
    normalized.brainDump = Array.isArray(data.brainDump)
      ? data.brainDump as BrainDumpEntry[]
      : [];
    normalized.bodyDoubleHistory = Array.isArray(data.bodyDoubleHistory)
      ? data.bodyDoubleHistory as BodyDoubleSession[]
      : [];

    normalized.preferences = {
      ...defaults.preferences,
      ...(data.preferences && typeof data.preferences === "object"
        ? data.preferences as typeof defaults.preferences
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
        ? { ...defaults.analytics, ...(data.analytics as typeof defaults.analytics) }
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
