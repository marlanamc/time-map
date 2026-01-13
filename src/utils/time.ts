/**
 * Time formatting helpers shared across components
 */

/**
 * Convert an HH:MM time string to a 12-hour label.
 * @param time - Time string in HH:MM (24h) format
 * @returns Human friendly 12-hour string or null if invalid
 */
export function formatTo12Hour(time?: string | null): string | null {
  if (!time) return null;
  const [hourText, minuteText] = time.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;

  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${minute.toString().padStart(2, "0")} ${period}`;
}

/**
 * Format a start/end time range using 12-hour labels.
 * @param start - Start time (HH:MM)
 * @param end - End time (HH:MM)
 * @returns Formatted range string, falling back to the available value
 */
export function formatTimeRange(start?: string | null, end?: string | null): string {
  const startLabel = formatTo12Hour(start);
  const endLabel = formatTo12Hour(end);
  if (startLabel && endLabel) {
    return `${startLabel} - ${endLabel}`;
  }
  if (startLabel) return startLabel;
  if (endLabel) return endLabel;
  return "";
}

/**
 * Format a countdown in minutes (e.g., time until an event).
 * @param minutes - Minutes remaining
 * @returns Human readable label
 */
export function formatCountdown(minutes: number): string {
  const normalized = Math.max(0, Math.round(minutes));
  if (normalized === 0) {
    return "0m";
  }

  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;

  if (hours > 0 && mins > 0) {
    return `${hours}h ${mins}m`;
  }

  if (hours > 0) {
    return `${hours}h`;
  }

  return `${mins}m`;
}
