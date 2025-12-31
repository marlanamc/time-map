export type HapticImpact = "light" | "medium" | "heavy";

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export const haptics = {
  impact(kind: HapticImpact = "light"): void {
    try {
      if (prefersReducedMotion()) return;
      if (typeof navigator === "undefined") return;
      if (typeof navigator.vibrate !== "function") return;

      const pattern =
        kind === "heavy" ? 30 : kind === "medium" ? 18 : 10;
      navigator.vibrate(pattern);
    } catch {
      // ignore
    }
  },
};

