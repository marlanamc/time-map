import { Toast } from "../../components/feedback/Toast";
import type { UIElements } from "../../types";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type InstallPromptHandlerOptions = {
  elements: UIElements;
  onSyncIssuesBadge: () => void;
};

export class InstallPromptHandler {
  private deferredInstallPrompt: BeforeInstallPromptEvent | null = null;
  private elements: UIElements;
  private onSyncIssuesBadge: () => void;

  constructor(options: InstallPromptHandlerOptions) {
    this.elements = options.elements;
    this.onSyncIssuesBadge = options.onSyncIssuesBadge;
  }

  setup() {
    const installBtn = document.getElementById("installAppBtn");
    if (!installBtn) return;

    const supportPanelToggleBtn = document.getElementById(
      "supportPanelToggleBtn"
    );
    const supportPanelToggleBtnMobile = document.getElementById(
      "supportPanelToggleBtnMobile"
    );
    const supportPanelBtn = document.getElementById("supportPanelBtn");
    const toggleBtns = [
      supportPanelToggleBtn,
      supportPanelToggleBtnMobile,
      supportPanelBtn,
    ].filter(Boolean) as HTMLElement[];

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
      toggleBtns.forEach((btn) =>
        btn.classList.toggle("install-available", available)
      );

      if (available) installBtn.removeAttribute("hidden");
      else installBtn.setAttribute("hidden", "");
    };

    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      this.deferredInstallPrompt = e as BeforeInstallPromptEvent;
      setInstallAvailable(true);

      const lastToastAt = readNumber(INSTALL_TOAST_LAST_SHOWN_KEY);
      const dismissedAt = readNumber(INSTALL_PROMPT_DISMISSED_AT_KEY);
      const now = Date.now();
      const canToast =
        now - lastToastAt > INSTALL_TOAST_COOLDOWN_MS &&
        now - dismissedAt > INSTALL_TOAST_COOLDOWN_MS;
      if (canToast) {
        Toast.show(
          this.elements,
          "📲",
          "Install is available in Support Tools."
        );
        writeNow(INSTALL_TOAST_LAST_SHOWN_KEY);
      }
    });

    window.addEventListener("appinstalled", () => {
      this.deferredInstallPrompt = null;
      setInstallAvailable(false);
      Toast.show(this.elements, "✅", "App installed.");
    });

    this.onSyncIssuesBadge();
  }

  async promptInstall() {
    const installBtn = document.getElementById("installAppBtn");
    const deferred = this.deferredInstallPrompt;
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
            String(Date.now())
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
      this.deferredInstallPrompt = null;
      installBtn?.setAttribute("hidden", "");
    }
  }
}
