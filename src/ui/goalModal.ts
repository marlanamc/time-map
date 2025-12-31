import { State } from "../core/State";
import { Goals } from "../core/Goals";
import { CONFIG } from "../config";
import { TimeBreakdown } from "../utils/TimeBreakdown";
import { viewportManager } from "./viewport/ViewportManager";
import { haptics } from "../utils/haptics";
import type { UIElements, GoalLevel, Category, Priority } from "../types";

export type GoalModalContext = {
  elements: UIElements;
  goalModalLevel: GoalLevel;
  goalModalYear: number | null;
  closeGoalModal: () => void;
  render: () => void;
  showToast: (iconOrMessage: string, messageOrType?: string) => void;
  getLevelLabel: (
    level: GoalLevel,
    opts?: { lowercase?: boolean; plural?: boolean },
  ) => string;
};

export function setFieldVisibility(
  element: HTMLElement | null,
  visible: boolean,
) {
  if (!element) return;
  element.style.display = visible ? "grid" : "none";
}

export function closeGoalModal(ctx: GoalModalContext) {
  ctx.elements.goalModal?.classList.remove("active");
  ctx.elements.goalForm?.reset();
  ctx.goalModalYear = null;
}

export function populateMonthSelect(
  ctx: GoalModalContext,
  preselectedMonth: number | null = null,
  year: number | null = null,
) {
  const select = ctx.elements.goalMonth;
  if (!select) return;

  const now = new Date();
  const nowMonth = now.getMonth();
  const nowYear = now.getFullYear();

  const currentMonth = preselectedMonth ?? State.viewingMonth ?? nowMonth;
  const currentYear = year ?? ctx.goalModalYear ?? State.viewingYear ?? nowYear;

  select.innerHTML = CONFIG.MONTHS.map((name, idx) => {
    const timeLeft = TimeBreakdown.getSimpleTimeLeft(idx, currentYear);
    const isPast =
      currentYear < nowYear || (currentYear === nowYear && idx < nowMonth);
    return `<option value="${idx}" ${idx === currentMonth ? "selected" : ""} ${isPast ? 'class="past-month"' : ""}>${name} ${!isPast ? `(${timeLeft})` : "(past)"}</option>`;
  }).join("");

  select.value = String(currentMonth);

  select.onchange = () => updateGoalModalTimeBreakdown(ctx);
  setTimeout(() => updateGoalModalTimeBreakdown(ctx), 0);
}

export function updateGoalModalTimeBreakdown(ctx: GoalModalContext) {
  const level = ctx.goalModalLevel;
  if (!level) return;

  let breakdownContainer = document.getElementById("modalTimeBreakdown");
  if (!breakdownContainer) {
    breakdownContainer = document.createElement("div");
    breakdownContainer.id = "modalTimeBreakdown";
    breakdownContainer.className = "modal-time-breakdown";
    const firstFormGroup = ctx.elements.goalForm?.querySelector(".form-group");
    if (firstFormGroup) {
      const parent = firstFormGroup.parentNode;
      if (parent)
        parent.insertBefore(breakdownContainer, firstFormGroup.nextSibling);
    }
  }

  let html = "";
  const currentYear =
    ctx.goalModalYear ?? State.viewingYear ?? new Date().getFullYear();

  if (level === "intention") {
    html = TimeBreakdown.generateHTML(0, currentYear, false, "intention");
  } else if (level === "focus") {
    html = TimeBreakdown.generateHTML(0, currentYear, false, "focus");
  } else if (level === "vision") {
    html = TimeBreakdown.generateHTML(0, currentYear, false, "vision");
  } else if (level === "milestone") {
    const select = ctx.elements.goalMonth;
    if (!select) return;
    const selectedMonth = Number.parseInt(select.value, 10);
    if (!Number.isFinite(selectedMonth)) return;
    html = TimeBreakdown.generateHTML(selectedMonth, currentYear, false, "milestone");
  }

  breakdownContainer.innerHTML = html;
}

export function openGoalModal(
  ctx: GoalModalContext,
  level: GoalLevel = "milestone",
  preselectedMonth: number | null = null,
  preselectedYear: number | null = null,
): void {
  haptics.impact("light");
  ctx.goalModalLevel = level;
  ctx.goalModalYear =
    preselectedYear ?? State.viewingYear ?? new Date().getFullYear();

  const title = document.getElementById("goal-modal-title");
  const label = document.querySelector('label[for="goalTitle"]');

  if (title) {
    if (level === "vision") title.textContent = "Create New Vision";
    else if (level === "milestone") title.textContent = "Set New Milestone";
    else if (level === "focus") title.textContent = "Define New Focus";
    else if (level === "intention") title.textContent = "Set New Intention";
  }

  if (label) {
    if (level === "vision")
      label.textContent = "What is your vision for this year?";
    else if (level === "milestone")
      label.textContent = "What is your milestone for this month?";
    else if (level === "focus")
      label.textContent = "What is your focus for this week?";
    else if (level === "intention")
      label.textContent = "What is your intention for today?";
  }

  const monthGroup = document.querySelector(
    'label[for="goalMonth"]',
  )?.parentElement as HTMLElement;
  const monthLabel = document.querySelector(
    'label[for="goalMonth"]',
  ) as HTMLElement;
  const monthSelect = document.getElementById("goalMonth") as HTMLSelectElement;
  const categoryGroup = document.querySelector(
    'label[for="goalCategory"]',
  )?.parentElement as HTMLElement;

  const timeGroup = document
    .getElementById("goalStartTime")
    ?.closest(".form-row") as HTMLElement;
  const priorityGroup = document.querySelector(
    'label[for="goalPriority"]',
  )?.parentElement as HTMLElement;
  const yearGroup = document.getElementById("goalYearGroup") as HTMLElement | null;
  const yearInput = document.getElementById("goalYear") as HTMLInputElement | null;
  const startDateGroup = document.getElementById(
    "goalStartDateGroup",
  ) as HTMLElement | null;
  const startDateInput = document.getElementById(
    "goalStartDate",
  ) as HTMLInputElement | null;
  const startDateLabel = document.querySelector(
    'label[for="goalStartDate"]',
  ) as HTMLElement | null;
  const milestoneDurationGroup = document.getElementById(
    "milestoneDurationGroup",
  ) as HTMLElement | null;
  const milestoneDurationSelect = document.getElementById(
    "milestoneDurationMonths",
  ) as HTMLSelectElement | null;
  const focusDurationGroup = document.getElementById(
    "focusDurationGroup",
  ) as HTMLElement | null;
  const focusDurationSelect = document.getElementById(
    "focusDurationWeeks",
  ) as HTMLSelectElement | null;
  const submitBtn = document.querySelector(
    '#goalForm button[type="submit"]',
  ) as HTMLElement;

  if (submitBtn) {
    if (level === "vision") submitBtn.textContent = "Create Vision";
    else if (level === "milestone") submitBtn.textContent = "Set Milestone";
    else if (level === "focus") submitBtn.textContent = "Define Focus";
    else if (level === "intention") submitBtn.textContent = "Set Intention";
  }

  if (monthSelect) monthSelect.required = false;
  if (yearGroup) yearGroup.style.display = "none";
  if (startDateGroup) startDateGroup.style.display = "none";
  if (milestoneDurationGroup) milestoneDurationGroup.style.display = "none";
  if (focusDurationGroup) focusDurationGroup.style.display = "none";

  const toYmdLocal = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  if (yearInput) {
    yearInput.value = String(ctx.goalModalYear);
    yearInput.onchange = () => {
      const raw = Number.parseInt(yearInput.value, 10);
      if (Number.isFinite(raw)) {
        ctx.goalModalYear = raw;
        if (ctx.goalModalLevel === "milestone") {
          populateMonthSelect(ctx, preselectedMonth, raw);
        }
        updateGoalModalTimeBreakdown(ctx);
      }
    };
  }

  if (monthGroup && monthLabel && monthSelect) {
    if (level === "vision") {
      monthGroup.style.display = "none";
      setFieldVisibility(timeGroup, false);
      if (priorityGroup) priorityGroup.style.display = "block";
      if (categoryGroup) categoryGroup.style.display = "block";
      if (yearGroup) yearGroup.style.display = "block";
    } else if (level === "milestone") {
      monthGroup.style.display = "block";
      monthSelect.required = true;
      monthLabel.textContent = "Start month";
      populateMonthSelect(ctx, preselectedMonth, ctx.goalModalYear);
      setFieldVisibility(timeGroup, false);
      if (priorityGroup) priorityGroup.style.display = "block";
      if (categoryGroup) categoryGroup.style.display = "block";
      if (yearGroup) yearGroup.style.display = "block";
      if (milestoneDurationGroup) milestoneDurationGroup.style.display = "block";
      if (milestoneDurationSelect) milestoneDurationSelect.value = "1";
    } else if (level === "focus") {
      monthGroup.style.display = "none";
      setFieldVisibility(timeGroup, false);
      if (priorityGroup) priorityGroup.style.display = "block";
      if (categoryGroup) categoryGroup.style.display = "block";
      if (startDateGroup) startDateGroup.style.display = "block";
      if (startDateLabel) startDateLabel.textContent = "Week of";
      if (startDateInput) {
        const weekNum =
          State.viewingWeek ?? State.getWeekNumber(State.viewingDate ?? new Date());
        const weekStart = State.getWeekStart(
          State.viewingYear ?? new Date().getFullYear(),
          weekNum,
        );
        startDateInput.value = toYmdLocal(weekStart);
      }
      if (focusDurationGroup) focusDurationGroup.style.display = "block";
      if (focusDurationSelect) focusDurationSelect.value = "1";
    } else if (level === "intention") {
      monthGroup.style.display = "none";
      setFieldVisibility(timeGroup, true);
      if (priorityGroup) priorityGroup.style.display = "none";
      if (categoryGroup) categoryGroup.style.display = "none";
      if (startDateGroup) startDateGroup.style.display = "block";
      if (startDateLabel) startDateLabel.textContent = "Date";
      if (startDateInput)
        startDateInput.value = toYmdLocal(State.viewingDate ?? new Date());
    }
  }

  setTimeout(() => updateGoalModalTimeBreakdown(ctx), 0);

  ctx.elements.goalModal?.classList.add("active");

  if (viewportManager.isMobileViewport()) {
    setTimeout(() => {
      const firstInput = ctx.elements.goalModal?.querySelector(
        "input, select, textarea",
      ) as HTMLElement | null;
      if (firstInput) {
        firstInput.focus();
        setTimeout(() => {
          firstInput.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 100);
      }
    }, 300);

    const handleInputFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "SELECT" ||
          target.tagName === "TEXTAREA")
      ) {
        setTimeout(() => {
          target.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 150);
      }
    };

    const modal = ctx.elements.goalModal;
    if (modal) {
      modal.addEventListener("focusin", handleInputFocus);
      const originalClose = ctx.closeGoalModal.bind(ctx);
      ctx.closeGoalModal = () => {
        modal.removeEventListener("focusin", handleInputFocus);
        originalClose();
      };
    }
  }

  document.getElementById("goalTitle")?.focus();
}

export function handleGoalSubmit(ctx: GoalModalContext, e: Event) {
  e.preventDefault();

  const titleEl = document.getElementById("goalTitle") as HTMLInputElement | null;
  const monthEl = document.getElementById("goalMonth") as HTMLSelectElement | null;
  const yearEl = document.getElementById("goalYear") as HTMLInputElement | null;
  const startDateEl = document.getElementById(
    "goalStartDate",
  ) as HTMLInputElement | null;
  const milestoneDurationEl = document.getElementById(
    "milestoneDurationMonths",
  ) as HTMLSelectElement | null;
  const focusDurationEl = document.getElementById(
    "focusDurationWeeks",
  ) as HTMLSelectElement | null;
  const categoryEl = document.getElementById(
    "goalCategory",
  ) as HTMLSelectElement | null;
  const priorityEl = document.getElementById(
    "goalPriority",
  ) as HTMLSelectElement | null;
  const startTimeEl = document.getElementById(
    "goalStartTime",
  ) as HTMLInputElement | null;
  const endTimeEl = document.getElementById("goalEndTime") as HTMLInputElement | null;

  const title = titleEl?.value.trim() ?? "";
  if (!title) return;
  haptics.impact("medium");

  let month = NaN;
  let year = ctx.goalModalYear ?? State.viewingYear ?? new Date().getFullYear();
  let startDate: string | undefined;
  let durationMonths = NaN;
  let durationWeeks = NaN;
  let category: Category = null;
  let priority: Priority = "medium";
  let startTime: string | null = null;
  let endTime: string | null = null;

  if (
    monthEl &&
    (monthEl.parentElement as HTMLElement)?.style.display !== "none"
  ) {
    month = parseInt(monthEl.value, 10);
  }

  if (yearEl && (yearEl.parentElement as HTMLElement)?.style.display !== "none") {
    const yearRaw = parseInt(yearEl.value, 10);
    if (Number.isFinite(yearRaw)) year = yearRaw;
  }

  if (
    startDateEl &&
    (startDateEl.parentElement as HTMLElement)?.style.display !== "none"
  ) {
    const raw = startDateEl.value?.trim();
    startDate = raw ? raw : undefined;
  }

  if (
    milestoneDurationEl &&
    (milestoneDurationEl.parentElement as HTMLElement)?.style.display !== "none"
  ) {
    durationMonths = parseInt(milestoneDurationEl.value, 10);
  }

  if (
    focusDurationEl &&
    (focusDurationEl.parentElement as HTMLElement)?.style.display !== "none"
  ) {
    durationWeeks = parseInt(focusDurationEl.value, 10);
  }

  if (
    categoryEl &&
    (categoryEl.parentElement as HTMLElement)?.style.display !== "none"
  ) {
    const categoryRaw = categoryEl?.value;
    category =
      categoryRaw && categoryRaw in CONFIG.CATEGORIES
        ? (categoryRaw as Exclude<Category, null>)
        : null;
  }

  if (
    priorityEl &&
    (priorityEl.parentElement as HTMLElement)?.style.display !== "none"
  ) {
    const priorityRaw = priorityEl?.value;
    priority =
      priorityRaw === "low" ||
      priorityRaw === "medium" ||
      priorityRaw === "high" ||
      priorityRaw === "urgent"
        ? (priorityRaw as Priority)
        : "medium";
  }

  if (
    startTimeEl &&
    (startTimeEl.parentElement?.parentElement as HTMLElement)?.style.display !==
      "none"
  ) {
    startTime = startTimeEl?.value || null;
    endTime = endTimeEl?.value || null;
  }

  const goalData: any = {
    title,
    level: ctx.goalModalLevel,
    category,
    priority,
    startTime,
    endTime,
  };

  if (ctx.goalModalLevel === "vision") {
    goalData.year = year;
  }

  if (ctx.goalModalLevel === "milestone") {
    if (Number.isFinite(month)) goalData.month = month;
    if (Number.isFinite(year)) goalData.year = year;
    if (Number.isFinite(durationMonths)) goalData.durationMonths = durationMonths;
  }

  if (ctx.goalModalLevel === "focus") {
    if (startDate) goalData.startDate = startDate;
    if (Number.isFinite(durationWeeks)) goalData.durationWeeks = durationWeeks;
  }

  if (ctx.goalModalLevel === "intention") {
    if (startDate) goalData.startDate = startDate;
  }

  Goals.create(goalData);

  ctx.closeGoalModal();
  ctx.render();
  ctx.showToast("✨", `${ctx.getLevelLabel(ctx.goalModalLevel)} saved.`);
}

