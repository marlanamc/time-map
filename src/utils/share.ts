export type SharePayload = {
  title?: string;
  text?: string;
  url?: string;
};

export type ShareExecutionResult = "shared" | "cancelled" | "unsupported" | "failed";

/**
 * Build a friendly fallback string when we can't show the native share sheet.
 */
export function buildShareMessage(payload: SharePayload): string {
  const parts = [payload.title, payload.text, payload.url].filter(Boolean);
  return parts.join("\n\n");
}

/**
 * Try to open the native share sheet (if supported).
 */
export async function tryNativeShare(
  payload: SharePayload,
): Promise<ShareExecutionResult> {
  if (!("share" in navigator)) {
    return "unsupported";
  }

  try {
    await (navigator as any).share({
      title: payload.title,
      text: payload.text,
      url: payload.url,
    });
    return "shared";
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return "cancelled";
    }
    console.warn("[Share] Native share failed:", error);
    return "failed";
  }
}

/**
 * Copy share text to clipboard as a fallback.
 */
export async function copyShareText(text: string): Promise<boolean> {
  if (!text || !navigator.clipboard?.writeText) return false;

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.warn("[Share] Clipboard write failed:", error);
    return false;
  }
}
