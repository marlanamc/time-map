import type { AppSettingsApi } from "../../features/featureLoaders";

type SettingsPanelCallbacks = {
  ensureAppSettings: () => Promise<AppSettingsApi>;
};

export class SettingsPanel {
  private callbacks: SettingsPanelCallbacks;
  private handleShow = async () => {
    try {
      const appSettings = await this.callbacks.ensureAppSettings();
      appSettings.showPanel();
    } catch {
      // Already logged/toasted by feature loader; swallow to avoid unhandled rejection.
    }
  };

  constructor(callbacks: SettingsPanelCallbacks) {
    this.callbacks = callbacks;
  }

  bindEvents() {
    document
      .getElementById("appSettingsBtn")
      ?.addEventListener("click", (event) => {
        event.preventDefault();
        void this.handleShow();
      });
  }

  show() {
    void this.handleShow();
  }
}
