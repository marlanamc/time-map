/**
 * Badging Service
 * Handles the App Badging API to show pending item counts on the app icon.
 */

export const BadgingService = {
  /**
   * Set the app badge to a specific number
   */
  async set(count: number) {
    if ("setAppBadge" in navigator) {
      try {
        if (count > 0) {
          await (navigator as any).setAppBadge(count);
          console.log(`[Badging] Set badge to ${count}`);
        } else {
          await (navigator as any).clearAppBadge();
          console.log("[Badging] Cleared badge");
        }
      } catch (error) {
        console.warn("[Badging] Failed to set badge:", error);
      }
    }
  },

  /**
   * Clear the app badge
   */
  async clear() {
    if ("clearAppBadge" in navigator) {
      try {
        await (navigator as any).clearAppBadge();
        console.log("[Badging] Cleared badge");
      } catch (error) {
        console.warn("[Badging] Failed to clear badge:", error);
      }
    }
  },

  /**
   * Check if badging is supported
   */
  isSupported(): boolean {
    return "setAppBadge" in navigator;
  },
};
