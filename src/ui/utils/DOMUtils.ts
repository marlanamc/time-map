// ===================================
// DOM Utilities - Pure Helper Functions
// ===================================
import DOMPurify from "dompurify";

/**
 * Escape HTML to prevent XSS attacks
 * Use this for plain text that should never contain HTML
 */
export function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Sanitize HTML to allow safe HTML elements while removing dangerous ones
 * Use this for user-generated content that may contain formatting (like descriptions)
 * Allows: basic formatting (b, i, em, strong), links, lists, paragraphs
 * Removes: scripts, event handlers, iframes, forms, etc.
 */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "b",
      "i",
      "em",
      "strong",
      "u",
      "p",
      "br",
      "ul",
      "ol",
      "li",
      "a",
      "span",
      "div",
    ],
    ALLOWED_ATTR: ["href", "target", "rel", "class"],
    ALLOW_DATA_ATTR: false,
    ADD_ATTR: ["target"], // Allow target for links
    // Force all links to open in new tab with noopener
    FORCE_BODY: true,
  });
}

/**
 * Safely set innerHTML with sanitization
 * Use this instead of directly setting innerHTML with user content
 */
export function safeInnerHTML(element: HTMLElement, html: string): void {
  element.innerHTML = sanitizeHtml(html);
}

/**
 * Create an HTML string with escaped user content
 * Template tag function for safe HTML construction
 *
 * Usage:
 *   const html = safeHtml`<div class="title">${userTitle}</div>`;
 *
 * All interpolated values are automatically escaped.
 */
export function safeHtml(
  strings: TemplateStringsArray,
  ...values: (string | number | null | undefined)[]
): string {
  return strings.reduce((result, str, i) => {
    const value = values[i - 1];
    const escapedValue =
      value === null || value === undefined
        ? ""
        : escapeHtml(String(value));
    return result + escapedValue + str;
  });
}

/**
 * Create an element with safe text content
 */
export function createSafeElement<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  textContent?: string,
  attributes?: Record<string, string>
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tagName);
  if (textContent !== undefined) {
    element.textContent = textContent;
  }
  if (attributes) {
    for (const [key, value] of Object.entries(attributes)) {
      element.setAttribute(key, value);
    }
  }
  return element;
}

/**
 * Format a date string to a readable format
 * @param dateString - ISO date string or date string
 * @returns Formatted date string (e.g., "Jan 15, 2024")
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Format minutes to a human-readable duration
 * @param minutes - Number of minutes
 * @returns Formatted duration (e.g., "2h 30m" or "45m")
 */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}
