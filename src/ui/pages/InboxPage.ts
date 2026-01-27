import { State } from "../../core/State";
import { Goals } from "../../core/Goals";
import { Events } from "../../core/Events";
import { expandEventsForRange } from "../../utils/recurrence";
import { parseYmdLocal } from "../../utils/goalMeta";
import type { EnergyType, Goal, LinkTargetType } from "../../types";

const OVERLAY_ID = "inbox-page-overlay";
const PANEL_ID = "inbox-page-panel";

type RangeValue = number | "all";
const MAX_ALL_RANGE_DAYS = 365;
const RANGE_OPTIONS: { label: string; value: RangeValue }[] = [
  { label: "3 days", value: 3 },
  { label: "7 days", value: 7 },
  { label: "14 days", value: 14 },
  { label: "30 days", value: 30 },
  { label: "All", value: "all" },
];

const LINK_TARGET_LABELS: Record<LinkTargetType, string> = {
  vision: "Vision",
  milestone: "Milestone",
  focus: "Focus",
};

type InboxItem = {
  id: string;
  kind: "intention" | "event";
  date: string; // YYYY-MM-DD
  time: string | null; // HH:MM
  title: string;
  icon?: string;
  energyType?: EnergyType;
  linkLabel?: string;
};

let overlayElement: HTMLElement | null = null;
let currentRangeDays: RangeValue = 7;

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatYmd(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatMonthDay(date: Date): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

function formatRangeSummary(start: Date, rangeDays: RangeValue): string {
  const today = startOfDay(new Date());
  if (rangeDays === "all") {
    return `Showing ${formatMonthDay(start)} and beyond`;
  }
  const end = addDays(startOfDay(start), rangeDays);
  if (start.getTime() === today.getTime()) {
    return `Showing Today through Next ${rangeDays} days`;
  }
  return `Showing ${formatMonthDay(start)} through ${formatMonthDay(end)}`;
}

function formatDateHeading(dateKey: string): string {
  const parsed = parseYmd(dateKey);
  if (!parsed) return dateKey;
  const today = startOfDay(new Date());
  const tomorrow = addDays(today, 1);
  if (parsed.getTime() === today.getTime()) return "Today";
  if (parsed.getTime() === tomorrow.getTime()) return "Tomorrow";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(parsed);
}

function parseYmd(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [_, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatTimeKey(date: Date): string {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function formatFriendlyTime(value: string | null): string {
  if (!value) return "All day";
  const [hourText, minuteText] = value.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return "All day";
  const period = hour >= 12 ? "pm" : "am";
  const normalizedHour = hour % 12 === 0 ? 12 : hour % 12;
  const padded = String(minute).padStart(2, "0");
  return `${normalizedHour}:${padded} ${period}`;
}

function escapeHtml(input: string): string {
  const span = document.createElement("span");
  span.textContent = input;
  return span.innerHTML;
}

function ensureOverlay(): HTMLElement {
  if (overlayElement) return overlayElement;

  const overlay = document.createElement("div");
  overlay.id = OVERLAY_ID;
  overlay.className = "inbox-page-overlay";
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      closeOverlay();
    }
  });
  document.body.appendChild(overlay);
  overlayElement = overlay;
  return overlay;
}

function parseGoalStartDate(goal: Goal): Date | null {
  const candidate = goal.startDate ?? goal.commitment?.startDate ?? null;
  if (!candidate) return null;
  const parsed = parseYmdLocal(candidate);
  if (!parsed) return null;
  return startOfDay(parsed);
}

function makeLinkLabel(goal: Goal): string | undefined {
  const target = goal.linkTarget;
  if (!target?.id) return undefined;
  const linked = Goals.getById(target.id);
  if (!linked) return undefined;
  const label = LINK_TARGET_LABELS[target.type] ?? target.type;
  return `${linked.title} • ${label}`;
}

function getIntentionInstancesForRange(start: Date, end: Date): InboxItem[] {
  const items: InboxItem[] = [];
  const rangeStart = startOfDay(start);
  const rangeEnd = endOfDay(end);
  const intentions = Goals.getAll().filter(
    (goal) =>
      goal.level === "intention" &&
      !goal.archivedAt &&
      goal.status !== "done" &&
      goal.status !== "cancelled",
  );

  for (const goal of intentions) {
    const goalStart = parseGoalStartDate(goal);
    const anchor = goalStart ?? rangeStart;
    const effectiveStart = anchor.getTime() > rangeStart.getTime() ? anchor : rangeStart;
    const goalDue = goal.dueDate ? endOfDay(new Date(goal.dueDate)) : rangeEnd;
    const effectiveEnd = goalDue < rangeEnd ? goalDue : rangeEnd;
    if (effectiveEnd < effectiveStart) continue;

    const candidateDays = goal.commitment?.specificDays;
    const specificDays = Array.isArray(candidateDays)
      ? Array.from(new Set(candidateDays))
      : [];
    const normalizedDays = specificDays
      .map((day) => ((day % 7) + 7) % 7)
      .filter((value) => Number.isFinite(value) && value >= 0 && value <= 6);

    if (normalizedDays.length > 0) {
      let cursor = startOfDay(effectiveStart);
      while (cursor <= effectiveEnd) {
        if (rangeStart <= cursor && cursor <= rangeEnd) {
          if (normalizedDays.includes(cursor.getDay())) {
            const dateKey = formatYmd(cursor);
            items.push({
              id: `${goal.id}:${dateKey}`,
              kind: "intention",
              date: dateKey,
              time: goal.startTime?.trim() ? goal.startTime : null,
              title: goal.title,
              icon: goal.icon ?? "🌱",
              energyType: goal.commitment?.energyType,
              linkLabel: makeLinkLabel(goal),
            });
          }
        }
        cursor = addDays(cursor, 1);
      }
      continue;
    }

    if (goalStart && goalStart >= rangeStart && goalStart <= rangeEnd) {
      const dateKey = formatYmd(goalStart);
      items.push({
        id: `${goal.id}:${dateKey}`,
        kind: "intention",
        date: dateKey,
        time: goal.startTime?.trim() ? goal.startTime : null,
        title: goal.title,
        icon: goal.icon ?? "🌱",
        energyType: goal.commitment?.energyType,
        linkLabel: makeLinkLabel(goal),
      });
      continue;
    }

    if (goal.dueDate) {
      const due = startOfDay(new Date(goal.dueDate));
      if (due >= rangeStart && due <= rangeEnd) {
        const dateKey = formatYmd(due);
        items.push({
          id: `${goal.id}:${dateKey}`,
          kind: "intention",
          date: dateKey,
          time: goal.startTime?.trim() ? goal.startTime : null,
          title: goal.title,
          icon: goal.icon ?? "🌱",
          energyType: goal.commitment?.energyType,
          linkLabel: makeLinkLabel(goal),
        });
      }
    }
  }

  return items;
}

function getEventInstancesForRange(start: Date, end: Date): InboxItem[] {
  const events = Events.getForRange(start, end);
  const expanded = expandEventsForRange(events, start, end);
  return expanded.map((instance) => {
    const instanceDate = new Date(instance.startAt);
    const dateKey = formatYmd(instanceDate);
    return {
      id: `${instance.originalId}:${dateKey}`,
      kind: "event",
      date: dateKey,
      time: instance.allDay ? null : formatTimeKey(instanceDate),
      title: instance.title,
      icon: "📅",
      linkLabel: instance.description ?? undefined,
    };
  });
}

function buildInboxItems(viewDate: Date, rangeDays: RangeValue): InboxItem[] {
  const start = startOfDay(viewDate);
  const resolvedDays = rangeDays === "all" ? MAX_ALL_RANGE_DAYS : rangeDays;
  const end = addDays(start, resolvedDays);

  const intentionItems = getIntentionInstancesForRange(start, end);
  const eventItems = getEventInstancesForRange(start, end);
  const all = [...intentionItems, ...eventItems];

  all.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    if (a.time && b.time && a.time !== b.time) return a.time.localeCompare(b.time);
    if (a.time && !b.time) return -1;
    if (!a.time && b.time) return 1;
    return a.kind.localeCompare(b.kind);
  });

  return all;
}

function renderItemsHtml(items: InboxItem[]): string {
  if (items.length === 0) {
    return `
      <div class="inbox-empty-state">
        <p>No intentions or events scheduled for this range.</p>
      </div>
    `;
  }

  const groups = new Map<string, InboxItem[]>();
  for (const item of items) {
    const group = groups.get(item.date);
    if (group) {
      group.push(item);
    } else {
      groups.set(item.date, [item]);
    }
  }

  let html = "";
  for (const [date, group] of groups) {
    const groupRows = group
      .map((item) => {
        const timeLabel = formatFriendlyTime(item.time);
        const chips = [
          `<span class="inbox-chip inbox-chip-kind">${escapeHtml(item.kind === "intention" ? "Intention" : "Event")}</span>`,
          item.energyType
            ? `<span class="inbox-chip inbox-chip-energy">${escapeHtml(
                item.energyType.charAt(0).toUpperCase() + item.energyType.slice(1),
              )}</span>`
            : "",
        ]
          .filter(Boolean)
          .join("");
        return `
          <div class="inbox-item" role="listitem">
            <div class="inbox-item-time">${escapeHtml(timeLabel)}</div>
            <div class="inbox-item-main">
              <span class="inbox-item-icon" aria-hidden="true">${escapeHtml(item.icon ?? "🌱")}</span>
              <div>
                <div class="inbox-item-title">${escapeHtml(item.title)}</div>
                ${item.linkLabel ? `<p class="inbox-item-link">${escapeHtml(item.linkLabel)}</p>` : ""}
              </div>
            </div>
            <div class="inbox-item-meta">${chips}</div>
          </div>
        `;
      })
      .join("");

    html += `
      <section class="inbox-date-group">
        <div class="inbox-date-heading">${escapeHtml(formatDateHeading(date))}</div>
        <div class="inbox-items-list">${groupRows}</div>
      </section>
    `;
  }

  return html;
}

function renderRangeButtons(activeValue: RangeValue): string {
  return RANGE_OPTIONS.map((option) => `
    <button
      type="button"
      class="inbox-range-btn"
      data-range="${option.value}"
      aria-pressed="${option.value === activeValue}"
    >
      ${option.label}
    </button>
  `).join("");
}

function renderOverlayContent(viewDate: Date, rangeDays: RangeValue): void {
  const normalizedDate = startOfDay(viewDate);
  currentRangeDays = rangeDays;
  const items = buildInboxItems(normalizedDate, rangeDays);
  const summary = formatRangeSummary(normalizedDate, rangeDays);
  const overlay = ensureOverlay();
  overlay.innerHTML = `
    <div class="inbox-page-panel" id="${PANEL_ID}">
      <header class="inbox-page-header">
        <div>
          <p class="inbox-page-label">Inbox</p>
          <h2 class="inbox-page-title">Upcoming intentions and events</h2>
          <p class="inbox-range-summary">${escapeHtml(summary)}</p>
        </div>
        <button type="button" class="inbox-page-close" aria-label="Close" data-close="inbox">
          ×
        </button>
      </header>
      <div class="inbox-range-selector">
        <span class="inbox-range-label">Range</span>
        <div class="inbox-range-options">
          ${renderRangeButtons(rangeDays)}
        </div>
      </div>
      <div class="inbox-page-body">
        <div class="inbox-items" role="list">
          ${renderItemsHtml(items)}
        </div>
      </div>
    </div>
  `;

  overlay.querySelector("[data-close=\"inbox\"]")?.addEventListener("click", () => {
    closeOverlay();
  });

  overlay.querySelectorAll<HTMLButtonElement>('.inbox-range-btn').forEach((button) => {
    button.addEventListener("click", () => {
      const raw = button.dataset.range;
      if (!raw) return;
      const rangeValue: RangeValue = raw === "all" ? "all" : Number(raw);
      if (rangeValue !== "all" && !Number.isFinite(rangeValue)) return;
      renderOverlayContent(normalizedDate, rangeValue);
      requestAnimationFrame(() => overlay.classList.add("visible"));
    });
  });
}

function closeOverlay(): void {
  overlayElement?.classList.remove("visible");
}

export const InboxPage = {
  open(viewDate?: Date | null, rangeDays: RangeValue = currentRangeDays) {
    const targetDate = viewDate ? new Date(viewDate) : new Date(State.viewingDate);
    renderOverlayContent(targetDate, rangeDays);
    requestAnimationFrame(() => {
      overlayElement?.classList.add("visible");
    });
  },
  close() {
    closeOverlay();
  },
};
