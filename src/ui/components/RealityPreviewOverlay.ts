import type { CalendarEvent, Goal } from "../../types";
import { Goals } from "../../core/Goals";
import { Events } from "../../core/Events";
import {
  calculateWeeklyTimeCommitment,
  DEFAULT_WEEKLY_AVAILABLE_MINUTES,
} from "../../core/TimeCostCalculator";
import { getVisionAccent } from "../../utils/goalLinkage";

const OVERLAY_ID = "reality-preview-overlay";

let canvasElement: HTMLElement | null = null;
let overlayElement: HTMLElement | null = null;

function handleOverlayPointer(event: PointerEvent): void {
  if (!overlayElement) return;
  const card = overlayElement.querySelector(".reality-preview-card");
  if (card && card.contains(event.target as Node)) {
    return;
  }
  hide();
}

function ensureOverlay(): HTMLElement {
  if (overlayElement) return overlayElement;

  const overlay = document.createElement("div");
  overlay.id = OVERLAY_ID;
  overlay.className = "reality-preview-overlay";
  overlay.setAttribute("aria-live", "polite");
  overlay.addEventListener("pointerdown", handleOverlayPointer);
  overlayElement = overlay;
  return overlay;
}

function formatMinutes(totalMinutes: number): string {
  if (!totalMinutes || totalMinutes <= 0) {
    return "0 min";
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  return `${minutes} min`;
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekEnd(date: Date): Date {
  const start = getWeekStart(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

function getEventDurationMinutes(event: CalendarEvent): number {
  const start = new Date(event.startAt).getTime();
  const end = event.endAt ? new Date(event.endAt).getTime() : start;
  const diff = Math.max(0, end - start);
  return Math.ceil(diff / (1000 * 60));
}

function formatEventTime(event: CalendarEvent): string {
  if (event.allDay) return "All day";
  const options: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "2-digit",
  };
  const start = new Date(event.startAt);
  const startLabel = start.toLocaleTimeString("en-US", options);
  if (event.endAt) {
    const end = new Date(event.endAt);
    const endLabel = end.toLocaleTimeString("en-US", options);
    return `${startLabel} → ${endLabel}`;
  }
  return startLabel;
}

function escapeHtml(text: string): string {
  const span = document.createElement("span");
  span.textContent = text;
  return span.innerHTML;
}

function renderBudgetSection(goalMinutes: number, eventMinutes: number): string {
  const totalCommitted = goalMinutes + eventMinutes;
  const remainingMinutes = Math.max(
    0,
    DEFAULT_WEEKLY_AVAILABLE_MINUTES - totalCommitted,
  );
  const committedPercent = Math.min(
    100,
    Math.round(
      (Math.min(DEFAULT_WEEKLY_AVAILABLE_MINUTES, totalCommitted) /
        DEFAULT_WEEKLY_AVAILABLE_MINUTES) *
        100,
    ),
  );

  return `
    <div class="reality-preview-budget">
      <div class="reality-preview-budget-header">
        <span class="reality-preview-budget-label">Weekly budget</span>
        <strong>${formatMinutes(DEFAULT_WEEKLY_AVAILABLE_MINUTES)}</strong>
      </div>
      <div class="reality-preview-budget-meter">
        <span
          class="reality-preview-budget-meter-fill"
          style="width:${committedPercent}%"
        ></span>
      </div>
      <div class="reality-preview-budget-breakdown">
        <div>
          <span class="reality-preview-budget-breakdown-label">Committed</span>
          <strong>${formatMinutes(totalCommitted)}</strong>
        </div>
        <div>
          <span class="reality-preview-budget-breakdown-label">Remaining</span>
          <strong>${formatMinutes(remainingMinutes)}</strong>
        </div>
      </div>
      <div class="reality-preview-budget-legend">
        <span class="budget-chip">Goals: ${formatMinutes(goalMinutes)}</span>
        <span class="budget-chip">Events: ${formatMinutes(eventMinutes)}</span>
      </div>
    </div>
  `;
}

function renderBlockedEventsSection(events: CalendarEvent[]): string {
  if (events.length === 0) {
    return `
      <div class="reality-preview-events">
        <p class="reality-preview-events-title">Blocked time</p>
        <p class="reality-preview-events-empty">No blocked time logged for this week.</p>
      </div>
    `;
  }

  const listItems = events
    .slice(0, 3)
    .map(
      (event) => `
        <div class="reality-preview-event">
          <span class="reality-preview-event-title">${escapeHtml(event.title)}</span>
          <span class="reality-preview-event-time">${formatEventTime(event)}</span>
        </div>
      `,
    )
    .join("");

  const moreText =
    events.length > 3
      ? `<p class="reality-preview-events-more">+${events.length - 3} more blocked events</p>`
      : "";

  return `
    <div class="reality-preview-events">
      <p class="reality-preview-events-title">Blocked time</p>
      <div class="reality-preview-events-list">
        ${listItems}
      </div>
      ${moreText}
    </div>
  `;
}

const WEEKLY_CAP_MINUTES = 420; // 7 hours
const MONTHLY_CAP_MINUTES = WEEKLY_CAP_MINUTES * 4;
const YEARLY_CAP_MINUTES = WEEKLY_CAP_MINUTES * 52;

type PreviewBand = {
  label: string;
  type: "year" | "month" | "week" | "now";
  meter: number;
};

function getCommitmentMinutes(goal: Goal): number {
  if (!goal.commitment) return 0;
  return goal.commitment.frequency * goal.commitment.duration;
}

function describeMinutes(minutes: number): string {
  if (!minutes || minutes <= 0) return "0 min";
  return formatMinutes(minutes);
}

function getMeterValue(value: number, cap: number): number {
  if (cap <= 0) return 0;
  return Math.min(1, value / cap);
}

function buildBands(goal: Goal): string {
  const weeklyMinutes = getCommitmentMinutes(goal);
  const monthlyMinutes = weeklyMinutes * 4;
  const yearlyMinutes = weeklyMinutes * 52;
  const bands: PreviewBand[] = [
    {
      label: "NOW",
      type: "now",
      meter: getMeterValue(weeklyMinutes, WEEKLY_CAP_MINUTES),
    },
    {
      label: "THIS WEEK",
      type: "week",
      meter: getMeterValue(weeklyMinutes, WEEKLY_CAP_MINUTES),
    },
    {
      label: "THIS MONTH",
      type: "month",
      meter: getMeterValue(monthlyMinutes, MONTHLY_CAP_MINUTES),
    },
    {
      label: "THIS YEAR",
      type: "year",
      meter: getMeterValue(yearlyMinutes, YEARLY_CAP_MINUTES),
    },
  ];

  return bands
    .map(
      (band) => `
      <div class="reality-preview-band" data-band="${band.type}">
        <div class="reality-preview-band-row">
          <span class="reality-preview-band-label">${band.label}</span>
        </div>
        <div class="reality-preview-band-meter">
          <span class="reality-preview-band-meter-fill" style="width:${band.meter * 100}%"></span>
        </div>
      </div>
    `,
    )
    .join("");
}

function buildSoftBlocks(goal: Goal): string {
  const commitment = goal.commitment;
  if (!commitment) {
    return '<div class="reality-preview-soft-block-empty">No commitment yet. Plan first to see how it fits.</div>';
  }

  const blockLabel = `${commitment.frequency} × ${commitment.duration} min`;
  return `
      <div class="reality-preview-soft-block">
        <div>
          <span class="reality-preview-soft-block-title">Soft blocks</span>
          <p class="reality-preview-soft-block-copy">
            ${blockLabel} • ${commitment.energyType} energy • ${commitment.horizon} horizon
          </p>
        </div>
        <span class="reality-preview-soft-block-pill">${describeMinutes(
          getCommitmentMinutes(goal),
        )} / week</span>
    </div>
  `;
}

function getLoggedMinutes(goal: Goal): number {
  if (!goal.timeLog || goal.timeLog.length === 0) return 0;
  return goal.timeLog.reduce((sum, entry) => sum + entry.minutes, 0);
}

function renderOverlay(goal: Goal): void {
  const overlay = ensureOverlay();
  const accent = getVisionAccent(goal)?.color ?? "var(--accent)";
  overlay.style.setProperty("--preview-accent", accent);
  const rewardMinutes = getLoggedMinutes(goal);
  const weeklyMinutes =
    goal.commitment?.frequency && goal.commitment?.duration
      ? goal.commitment.frequency * goal.commitment.duration
      : 0;
  const energyLabel = goal.commitment?.energyType ?? "Any energy";
  const horizonLabel = goal.commitment?.horizon ?? "Open horizon";
  const commitmentSummary = calculateWeeklyTimeCommitment(Goals.getAll());
  const totalGoalMinutes = commitmentSummary.totalMinutes;
  const weekStart = getWeekStart(new Date());
  const weekEnd = getWeekEnd(new Date());
  const weekEvents = Events.getForRange(weekStart, weekEnd);
  const eventMinutes = weekEvents.reduce(
    (sum, event) => sum + getEventDurationMinutes(event),
    0,
  );
  const budgetSection = renderBudgetSection(totalGoalMinutes, eventMinutes);
  const blockedEventsSection = renderBlockedEventsSection(weekEvents);

  overlay.innerHTML = `
    <div class="reality-preview-card">
      <div class="reality-preview-card-header">
        <div>
          <p class="reality-preview-title">Reality Preview</p>
          <p class="reality-preview-subtitle">This would live here.</p>
        </div>
        <button
          type="button"
          class="reality-preview-close-btn"
          aria-label="Close reality preview"
        >
          ×
        </button>
      </div>
      <div class="reality-preview-bands">
        ${buildBands(goal)}
      </div>
      ${budgetSection}
      ${blockedEventsSection}
      <div class="reality-preview-soft-blocks">
        ${buildSoftBlocks(goal)}
      </div>
      <div class="reality-preview-stats">
        <div>
          <span class="reality-preview-stat-label">Logged time</span>
          <strong>${formatMinutes(rewardMinutes)}</strong>
        </div>
        <div>
          <span class="reality-preview-stat-label">Weekly commitment</span>
          <strong>${weeklyMinutes > 0 ? formatMinutes(weeklyMinutes) : "No plan"}</strong>
        </div>
        <div>
          <span class="reality-preview-stat-label">Energy • Horizon</span>
          <strong>${energyLabel} • ${horizonLabel}</strong>
        </div>
      </div>
      <p class="reality-preview-note">
        Soft blocks show how this goal could sit inside your calendar without
        asking you to act right now.
      </p>
    </div>
  `;

  const closeBtn = overlay.querySelector(
    ".reality-preview-close-btn",
  ) as HTMLButtonElement | null;

  closeBtn?.addEventListener("click", (event) => {
    event.stopPropagation();
    RealityPreviewOverlay.hide();
  });
}

function ensureCanvasAttached(): void {
  const overlay = ensureOverlay();
  const target = document.body;
  if (!target.contains(overlay)) {
    target.appendChild(overlay);
  }
}

export const RealityPreviewOverlay = {
  attach(canvas: HTMLElement): void {
    canvasElement = canvas;
    ensureCanvasAttached();
  },

  show(goal: Goal): void {
    if (!canvasElement) return;
    renderOverlay(goal);
    ensureCanvasAttached();
    const overlay = ensureOverlay();
    requestAnimationFrame(() => {
      overlay.classList.add("visible");
    });
  },

  hide(): void {
    const overlay = overlayElement;
    if (!overlay) return;
    overlay.classList.remove("visible");
  },
};
