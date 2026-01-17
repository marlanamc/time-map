// ===================================
// UI Bridge - Gradual migration from UIManager to modular architecture
// ===================================
import { UI as OriginalUI } from "./UIManager";
import { StateController } from "../core/StateController";
import { errorHandler } from "../core/ErrorHandling";

// Create a new UI instance that wraps the original but adds new capabilities
export const UI = {
  // Delegate all existing methods to original UI
  ...OriginalUI,

  // Add new modular capabilities
  stateController: null as StateController | null,

  // Initialize new modular components
  async initModular() {
    try {
      // Initialize state controller
      this.stateController = new StateController();
      await this.stateController.init();

      // Set up error handling
      errorHandler.onError((error) => {
        OriginalUI.showToast?.("⚠️", error.userMessage);
      });

      console.log("✓ Modular UI components initialized");
    } catch (error) {
      console.error("Failed to initialize modular components:", error);
      errorHandler.handleError({
        type: "unknown" as any,
        severity: "medium" as any,
        code: "MODULAR_INIT_FAILED",
        message: error instanceof Error ? error.message : String(error),
        userMessage: "Some features may not work properly",
        recoverable: true,
        timestamp: new Date(),
      });
    }
  },

  // Enhanced sync status with modular state
  updateSyncStatus(
    status: "syncing" | "synced" | "error" | "local" | "offline",
  ) {
    OriginalUI.updateSyncStatus?.(status);

    // Also update state controller if available
    if (this.stateController) {
      const syncStatus = this.stateController.getSyncStatus();
      console.log("Sync status from modular:", syncStatus);
    }
  },

  // Enhanced error handling
  showToast(icon: string, message: string, options?: any) {
    OriginalUI.showToast?.(icon, message, options);
  },

  // Cleanup method for modular components
  async cleanup() {
    if (this.stateController) {
      await this.stateController.cleanup();
      this.stateController = null;
    }

    // Original UI cleanup may not exist, so call it safely
    if ("cleanup" in OriginalUI && typeof OriginalUI.cleanup === "function") {
      (OriginalUI.cleanup as any)();
    }
  },
};
