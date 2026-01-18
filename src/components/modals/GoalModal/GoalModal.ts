import { State } from "../../../core/State";
import { Goals } from "../../../core/Goals";
import { CONFIG } from "../../../config";
import { TimeBreakdown } from "../../../utils/TimeBreakdown";
import { viewportManager } from "../../../ui/viewport/ViewportManager";
import { haptics } from "../../../utils/haptics";
import { focusTitleAtBlank, setInlineHelp, setTitleHelp } from "./domHelpers";
import { parseYmdLocal, toYmdLocal } from "./dateUtils";
import {
  getSelectedLinkFromUi,
  setFieldVisibility,
  setLinkageHelpVisible,
} from "./linkageHelpers";
import { renderLinkagePicker } from "../shared/LinkagePicker";
import { formatTimeContextFact, getTimeContextReframes } from "./timeContext";

import {
  renderEnergyMetaPanel,
  setupEnergyMetaPanel,
} from "../shared/EnergyMetaPanel";
import {
  renderActivityPicker,
  setupActivityPicker,
} from "../shared/ActivityPicker";
import { setupModalA11y, type ModalA11yCleanup } from "../shared/modalA11y";
import type {
  UIElements,
  GoalLevel,
  Category,
  Priority,
  GoalMeta,
} from "../../../types";

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

let pendingParentLink: { parentId: string; parentLevel: GoalLevel } | null =
  null;
let modalMetaDraft: GoalMeta = {};
let modalIconDraft: string | null = null;
let modalActivityId: string | null = null;
let modalLinkSelection: { parentId: string; parentLevel: GoalLevel } | null =
  null;
let milestoneTimeContextOpen = false;
let a11yCleanup: ModalA11yCleanup | null = null;

const LEVEL_DESCRIPTORS: Record<GoalLevel, string> = {
  vision: "Year direction",
  milestone: "Monthly chapter",
  focus: "Weekly emphasis",
  intention: "Daily touch",
};

const TITLE_PROMPTS: Record<GoalLevel, string> = {
  vision: "What is your vision for this year?",
  milestone: "What is your milestone for this month?",
  focus: "What is your focus for this week?",
  intention: "What is your intention for today?",
};

const ACTION_LABELS: Record<GoalLevel, string> = {
  vision: "Create Vision",
  milestone: "Set Milestone",
  focus: "Define Focus",
  intention: "Save Intention",
};

function populateContextSection(ctx: GoalModalContext) {
  const container = document.getElementById("goalTimeContextSection");
  if (!container) return;
  container.innerHTML = `<label class="flat-section-title">Time Context</label><div id="goalContextTime"></div>`;
  updateGoalModalTimeBreakdown(ctx);
}

function populateEnergySection(
  _ctx: GoalModalContext,
  level: GoalLevel,
  rerender: () => void,
) {
  const container = document.getElementById("goalEnergySection");
  if (!container) return;

  container.innerHTML = renderEnergyMetaPanel({
    level,
    meta: modalMetaDraft,
    icon: modalIconDraft ?? undefined,
  });
  setupEnergyMetaPanel(container, {
    level,
    meta: modalMetaDraft,
    icon: modalIconDraft ?? undefined,
    getMeta: () => modalMetaDraft,
    onChange: (nextMeta) => {
      modalMetaDraft = nextMeta;
    },
    onRequestRerender: rerender,
    onIconChange: (icon: string) => {
      modalIconDraft = icon;
    },
  });
}

function populateLinkSection(
  level: GoalLevel,
  visions: { id: string; title: string }[],
  milestones: { id: string; title: string }[],
  focuses: { id: string; title: string }[],
) {
  const linkContainer = document.getElementById("goalLinkageSection");
  if (!linkContainer) return;
  if (level === "vision") {
    linkContainer.innerHTML = "";
    linkContainer.style.display = "none";
    return;
  }
  linkContainer.style.display = "block";
  const linkHtml = renderLinkagePicker({
    level,
    visions,
    milestones,
    focuses,
    selected: modalLinkSelection,
  });
  linkContainer.innerHTML = linkHtml;
}

function moveInto(parent: HTMLElement | null, child: HTMLElement | null) {
  if (!parent || !child) return;
  if (child.parentElement === parent) return;
  parent.appendChild(child);
}

// Logic for moveCategoryOutsideAccordion removed. Flat layout handles this.

function populateDetailsSection(_level: GoalLevel) {
  const detailsBody = document.getElementById("goalDetailsSection");
  if (!detailsBody) return;

  detailsBody.innerHTML = `<label class="flat-section-title">Goal Details</label>`;

  const scopeRow = document.getElementById("goalScopeRow");
  moveInto(detailsBody, scopeRow);

  // Extract month group from the form-row that contains both month and category
  const monthCategoryRow = document
    .querySelector('label[for="goalMonth"]')
    ?.closest(".form-row") as HTMLElement | null;
  if (monthCategoryRow) {
    // Create a new form-row for just the month field
    const monthGroup = document.querySelector('label[for="goalMonth"]')
      ?.parentElement as HTMLElement | null;
    if (monthGroup) {
      const newRow = document.createElement("div");
      newRow.className = "form-row";
      newRow.appendChild(monthGroup);
      moveInto(detailsBody, newRow);
    }
  }

  const durationRow = document.getElementById("goalDurationRow");
  moveInto(detailsBody, durationRow);

  const timeRow = document
    .getElementById("goalStartTime")
    ?.closest(".form-row") as HTMLElement | null;
  moveInto(detailsBody, timeRow);

  const priorityGroup = document
    .getElementById("goalPriority")
    ?.closest(".form-group") as HTMLElement | null;
  moveInto(detailsBody, priorityGroup);

  const activityGroup = document.getElementById("goalActivityGroup");
  moveInto(detailsBody, activityGroup);
  if (activityGroup) {
    activityGroup.innerHTML = renderActivityPicker({ value: modalActivityId });
    setupActivityPicker(activityGroup, {
      value: modalActivityId,
      onChange: (nextValue) => {
        modalActivityId = nextValue;
      },
    });
  }
}

function syncEasyModeBadge() {
  // Easy mode feature removed
  const titleInput = document.getElementById(
    "goalTitle",
  ) as HTMLInputElement | null;
  const wrap = titleInput?.parentElement;
  if (!wrap) return;
  const existing = wrap.querySelector(
    ".goal-title-badge",
  ) as HTMLElement | null;
  existing?.remove();
}

export function closeGoalModal(ctx: GoalModalContext) {
  // Clean up accessibility handlers and restore focus
  if (a11yCleanup) {
    a11yCleanup();
    a11yCleanup = null;
  }
  ctx.elements.goalModal?.classList.remove("active");
  ctx.elements.goalForm?.reset();
  ctx.goalModalYear = null;
  pendingParentLink = null;
  const help = document.getElementById("goalTitleHelp");
  help?.remove();
  setInlineHelp(
    document.getElementById("milestoneDurationGroup"),
    "milestoneDurationHelp",
    null,
  );
  setLinkageHelpVisible(false);
  modalLinkSelection = null;
  modalMetaDraft = {};
  modalIconDraft = null;
  modalActivityId = null;
  syncEasyModeBadge();
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
    return `<option value="${idx}" ${idx === currentMonth ? "selected" : ""} ${
      isPast ? 'class="past-month"' : ""
    }>${name} ${!isPast ? `(${timeLeft})` : "(past)"}</option>`;
  }).join("");

  select.value = String(currentMonth);

  select.onchange = () => updateGoalModalTimeBreakdown(ctx);
  setTimeout(() => updateGoalModalTimeBreakdown(ctx), 0);
}

export function updateGoalModalTimeBreakdown(ctx: GoalModalContext) {
  const level = ctx.goalModalLevel;
  if (!level) return;
  const breakdownContainer = document.getElementById(
    "goalContextTime",
  ) as HTMLElement | null;
  if (!breakdownContainer) return;

  let html = "";
  const currentYear =
    ctx.goalModalYear ?? State.viewingYear ?? new Date().getFullYear();

  if (level === "intention") {
    html = "";
  } else if (level === "focus") {
    const startDateEl = document.getElementById(
      "goalStartDate",
    ) as HTMLInputElement | null;
    const startDate = startDateEl?.value
      ? parseYmdLocal(startDateEl.value)
      : null;
    const d = startDate ?? State.viewingDate ?? new Date();
    const wkNum = State.getWeekNumber(d);
    html = `
      <div class="time-context">
        <div class="time-context-subtitle">A quiet orientation to this week.</div>
        <div class="time-context-body">
          <div class="time-context-fact">This focus is for Week ${wkNum} (Mon–Sun).</div>
          <ul class="time-context-reframes">
            <li>One clear focus beats ten vague plans.</li>
          </ul>
          <div class="time-context-safety">This is here to help you orient, not to rush you.</div>
        </div>
      </div>
    `;
  } else if (level === "vision") {
    const { fact, bucketMonths } = formatTimeContextFact(currentYear);
    const reframes = getTimeContextReframes(bucketMonths);
    html = `
      <div class="time-context">
        <div class="time-context-subtitle">A quiet orientation to the year you’re in.</div>
        <div class="time-context-body">
          <div class="time-context-fact">${fact}</div>
          <ul class="time-context-reframes">
            ${reframes
              .slice(0, 2)
              .map((r) => `<li>${r}</li>`)
              .join("")}
          </ul>
          <div class="time-context-safety">This is here to help you orient, not to rush you.</div>
        </div>
      </div>
    `;
  } else if (level === "milestone") {
    const select = ctx.elements.goalMonth;
    const durationEl = document.getElementById(
      "milestoneDurationMonths",
    ) as HTMLSelectElement | null;
    if (!select) return;
    const selectedMonth = Number.parseInt(select.value, 10);
    const durationMonths = Math.max(
      1,
      Math.floor(Number(durationEl?.value ?? 1)),
    );
    if (!Number.isFinite(selectedMonth)) return;
    const start = new Date(currentYear, selectedMonth, 1);
    const end = new Date(
      currentYear,
      selectedMonth + durationMonths,
      0,
      23,
      59,
      59,
      999,
    );
    const days = Math.max(
      1,
      Math.round((end.getTime() - start.getTime()) / 86400000) + 1,
    );
    const weeks = Math.max(1, Math.round(days / 7));
    const fact =
      days <= 31
        ? `This milestone spans about ${days} days.`
        : `This milestone spans about ${weeks} weeks.`;
    html = `
      <div class="time-context">
        <button type="button" class="time-context-toggle" id="timeContextToggle" aria-expanded="${
          milestoneTimeContextOpen ? "true" : "false"
        }">
          <div class="time-context-subtitle">A quiet orientation to this chapter.</div>
        </button>
        ${
          milestoneTimeContextOpen
            ? `
              <div class="time-context-body">
                <div class="time-context-fact">${fact}</div>
                <ul class="time-context-reframes">
                  <li>This is a chapter, not the whole story.</li>
                  <li>Progress here can be uneven.</li>
                </ul>
                <div class="time-context-safety">This is here to help you orient, not to rush you.</div>
              </div>
            `
            : ""
        }
      </div>
    `;
  }

  breakdownContainer.innerHTML = html;
  breakdownContainer.toggleAttribute("hidden", !html);
}

export function openGoalModal(
  ctx: GoalModalContext,
  level: GoalLevel = "milestone",
  preselectedMonth: number | null = null,
  preselectedYear: number | null = null,
  link?: { parentId: string; parentLevel: GoalLevel } | null,
): void {
  const isFreshOpen = !ctx.elements.goalModal?.classList.contains("active");
  haptics.impact("light");
  ctx.goalModalLevel = level;
  ctx.goalModalYear =
    preselectedYear ?? State.viewingYear ?? new Date().getFullYear();
  pendingParentLink = link ?? null;
  if (isFreshOpen) {
    modalMetaDraft = {};
    modalIconDraft = null;
    modalActivityId = null;
    modalLinkSelection = null;
    milestoneTimeContextOpen = false;
  }
  const rerender = () =>
    openGoalModal(ctx, level, preselectedMonth, preselectedYear, link);

  const title = document.getElementById("goal-modal-title");

  if (title) {
    if (level === "vision") title.textContent = "Create New Vision";
    else if (level === "milestone") title.textContent = "Set New Milestone";
    else if (level === "focus") title.textContent = "Define New Focus";
    else if (level === "intention") title.textContent = "Set New Intention";
  }

  const descriptor = document.getElementById("goal-modal-level-descriptor");
  if (descriptor) {
    descriptor.textContent = LEVEL_DESCRIPTORS[level] ?? "";
  }

  const heroPrompt = TITLE_PROMPTS[level] ?? "";
  setTitleHelp(heroPrompt);

  const submitBtn = document.getElementById(
    "goalSubmitButton",
  ) as HTMLButtonElement | null;
  if (submitBtn) {
    submitBtn.textContent = ACTION_LABELS[level] ?? "Save";
  }

  const monthGroup = document.querySelector('label[for="goalMonth"]')
    ?.parentElement as HTMLElement;
  const monthLabel = document.querySelector(
    'label[for="goalMonth"]',
  ) as HTMLElement;
  const monthSelect = document.getElementById("goalMonth") as HTMLSelectElement;
  if (monthSelect) {
    monthSelect.classList.remove("error");
    monthSelect.removeAttribute("aria-invalid");
    const existing = monthSelect.parentElement?.querySelector(".form-error");
    existing?.remove();
  }
  const titleInput = document.getElementById("goalTitle") as HTMLInputElement;
  if (titleInput) {
    titleInput.classList.remove("error");
    titleInput.removeAttribute("aria-invalid");
    const existing = titleInput.parentElement?.querySelector(".form-error");
    existing?.remove();
    titleInput.addEventListener(
      "input",
      () => {
        titleInput.classList.remove("error");
        titleInput.removeAttribute("aria-invalid");
        titleInput.parentElement?.querySelector(".form-error")?.remove();
      },
      { once: true },
    );
  }

  const categoryGroup = document.querySelector('label[for="goalCategory"]')
    ?.parentElement as HTMLElement;
  const categoryLabel = document.querySelector(
    'label[for="goalCategory"]',
  ) as HTMLElement | null;

  const timeGroup = document
    .getElementById("goalStartTime")
    ?.closest(".form-row") as HTMLElement;
  const priorityGroup = document.querySelector('label[for="goalPriority"]')
    ?.parentElement as HTMLElement;
  const priorityLabel = document.querySelector(
    'label[for="goalPriority"]',
  ) as HTMLElement | null;
  const yearGroup = document.getElementById(
    "goalYearGroup",
  ) as HTMLElement | null;
  const yearInput = document.getElementById(
    "goalYear",
  ) as HTMLInputElement | null;
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
  const durationRow = document.getElementById(
    "goalDurationRow",
  ) as HTMLElement | null;

  if (monthSelect) monthSelect.required = false;
  if (yearGroup) yearGroup.style.display = "none";
  if (startDateGroup) startDateGroup.style.display = "none";
  if (milestoneDurationGroup) milestoneDurationGroup.style.display = "none";
  if (focusDurationGroup) focusDurationGroup.style.display = "none";
  if (durationRow) durationRow.style.display = "flex";

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

  const visions = Goals.getForRange(
    new Date(ctx.goalModalYear ?? new Date().getFullYear(), 0, 1),
    new Date(ctx.goalModalYear ?? new Date().getFullYear(), 11, 31),
  )
    .filter((g) => g.level === "vision" && g.status !== "done")
    .slice()
    .sort((a, b) => a.title.localeCompare(b.title))
    .map((g) => ({ id: g.id, title: g.title, icon: g.icon }));
  const milestones = Goals.getAll()
    .filter((g) => g.level === "milestone" && g.status !== "done")
    .slice()
    .sort((a, b) => a.title.localeCompare(b.title))
    .map((g) => ({ id: g.id, title: g.title, icon: g.icon }));

  const focuses = (() => {
    const viewingDate = State.viewingDate ?? new Date();
    const wk = State.getWeekNumber(viewingDate);
    const wy = State.getWeekYear(viewingDate);
    const ws = State.getWeekStart(wy, wk);
    const we = new Date(ws);
    we.setDate(we.getDate() + 6);
    return Goals.getForRange(ws, we)
      .filter((g) => g.level === "focus" && g.status !== "done")
      .slice()
      .sort((a, b) => a.title.localeCompare(b.title))
      .map((g) => ({ id: g.id, title: g.title, icon: g.icon }));
  })();

  if (!modalLinkSelection && pendingParentLink) {
    if (level === "milestone" && pendingParentLink.parentLevel === "vision")
      modalLinkSelection = pendingParentLink;
    if (level === "focus" && pendingParentLink.parentLevel === "milestone")
      modalLinkSelection = pendingParentLink;
    if (level === "intention" && pendingParentLink.parentLevel === "focus")
      modalLinkSelection = pendingParentLink;
  }

  populateLinkSection(level, visions, milestones, focuses);
  populateEnergySection(ctx, level, rerender);
  populateContextSection(ctx);
  populateDetailsSection(level);

  // --- Time Fields Placement & Visibility ---
  const heroDateSlot = document.getElementById("goalHeroDateSlot");
  const scopeRow = document.getElementById("goalScopeRow"); // Used as stash for unused fields

  // Helpers to safely move elements
  const stashField = (el: HTMLElement | null) => {
    if (el && scopeRow && el.parentElement !== scopeRow) {
      scopeRow.appendChild(el);
    }
    if (el) el.style.display = "none";
  };

  const showInHero = (el: HTMLElement | null, displayStyle = "block") => {
    if (el && heroDateSlot) {
      heroDateSlot.removeAttribute("hidden");
      heroDateSlot.appendChild(el);
      el.style.display = displayStyle;
    }
  };

  // 1. Reset/Stash everything first
  stashField(yearGroup);
  stashField(startDateGroup);
  stashField(monthGroup);
  stashField(milestoneDurationGroup);
  stashField(focusDurationGroup);
  setFieldVisibility(timeGroup, false);

  // 2. Configure based on level
  if (level === "vision") {
    showInHero(yearGroup); // Vision: Year

    if (categoryGroup) categoryGroup.style.display = "block";
    if (categoryLabel) categoryLabel.textContent = "Area of life (optional)";
    if (priorityGroup) priorityGroup.style.display = "none";
    if (priorityLabel) priorityLabel.textContent = "Priority";
  } else if (level === "milestone") {
    showInHero(monthGroup); // Milestone: Month
    showInHero(milestoneDurationGroup); // Milestone: Duration
    if (monthSelect) monthSelect.required = true;
    if (monthLabel) monthLabel.textContent = "Start month";

    populateMonthSelect(ctx, preselectedMonth, ctx.goalModalYear);

    if (milestoneDurationSelect) milestoneDurationSelect.value = "1";
    if (categoryGroup) categoryGroup.style.display = "block";
    if (categoryLabel) categoryLabel.textContent = "Category (optional)";
    if (priorityGroup) priorityGroup.style.display = "block";
    if (priorityLabel) priorityLabel.textContent = "Urgency (optional)";
    setInlineHelp(
      milestoneDurationGroup,
      "milestoneDurationHelp",
      "You can adjust this later.",
    );
  } else if (level === "focus") {
    showInHero(startDateGroup); // Focus: Week of
    showInHero(focusDurationGroup); // Focus: Duration

    if (startDateLabel) startDateLabel.textContent = "Week of";
    if (startDateInput) {
      const weekNum =
        State.viewingWeek ??
        State.getWeekNumber(State.viewingDate ?? new Date());
      const weekStart = State.getWeekStart(
        State.viewingYear ?? new Date().getFullYear(),
        weekNum,
      );
      startDateInput.value = toYmdLocal(weekStart);
    }

    if (focusDurationSelect) focusDurationSelect.value = "1";
    if (categoryGroup) categoryGroup.style.display = "block";
    if (categoryLabel) categoryLabel.textContent = "Category (optional)";
    if (priorityGroup) priorityGroup.style.display = "block";
    if (priorityLabel) priorityLabel.textContent = "Urgency (optional)";
  } else if (level === "intention") {
    showInHero(startDateGroup); // Intention: Date
    setFieldVisibility(timeGroup, true); // Intention: Time

    if (startDateLabel) startDateLabel.textContent = "Date";
    if (startDateInput)
      startDateInput.value = toYmdLocal(State.viewingDate ?? new Date());

    if (priorityGroup) priorityGroup.style.display = "none";
    if (priorityLabel) priorityLabel.textContent = "Priority";
    if (categoryGroup) categoryGroup.style.display = "none";
  }

  // Ensure hero slot is visible if it has children
  if (heroDateSlot && heroDateSlot.children.length > 0) {
    heroDateSlot.removeAttribute("hidden");
    // Add some spacing/layout styling class if needed
    heroDateSlot.classList.add("goal-hero-date-visible");
  } else {
    heroDateSlot?.setAttribute("hidden", "");
  }

  setTimeout(() => updateGoalModalTimeBreakdown(ctx), 0);

  ctx.elements.goalModal?.classList.add("active");
  syncEasyModeBadge();

  // Setup accessibility: ESC to close, focus trap, initial focus
  const modalEl = ctx.elements.goalModal;
  const modalContainer = modalEl?.querySelector(".modal") as HTMLElement | null;
  if (modalEl && modalContainer) {
    // Clean up previous setup if rerendering
    if (a11yCleanup) {
      a11yCleanup();
      a11yCleanup = null;
    }
    a11yCleanup = setupModalA11y({
      overlay: modalEl,
      modal: modalContainer,
      onClose: () => closeGoalModal(ctx),
      initialFocusSelector: "#goalTitle",
    });
  }

  // Bind inline interactions (suggestions, linkage, easy mode).
  const modal = ctx.elements.goalModal;
  if (modal) {
    modal
      .querySelectorAll<HTMLElement>("[data-action='suggest-title']")
      .forEach((btn) => {
        btn.onclick = (e) => {
          e.preventDefault();
          const template = (btn as HTMLElement).dataset.template ?? "";
          if (!template) return;
          focusTitleAtBlank(template);
        };
      });

    modal
      .querySelectorAll<HTMLElement>("[data-action='select-link']")
      .forEach((btn) => {
        btn.onclick = (e) => {
          e.preventDefault();
          const parentId = (btn as HTMLElement).dataset.parentId;
          const parentLevel = (btn as HTMLElement).dataset.parentLevel as
            | GoalLevel
            | undefined;
          if (!parentId || !parentLevel) return;
          modalLinkSelection = { parentId, parentLevel };
          setLinkageHelpVisible(false);
          openGoalModal(ctx, level, preselectedMonth, preselectedYear, link);
        };
      });

    modal
      .querySelectorAll<HTMLElement>("[data-action='clear-link']")
      .forEach((btn) => {
        btn.onclick = (e) => {
          e.preventDefault();
          modalLinkSelection = null;
          openGoalModal(ctx, level, preselectedMonth, preselectedYear, link);
        };
      });

    const linkSelect =
      modal.querySelector<HTMLSelectElement>("#goalLinkSelect");
    if (linkSelect) {
      linkSelect.onchange = () => {
        const raw = linkSelect.value?.trim();
        if (!raw) {
          modalLinkSelection = null;
          openGoalModal(ctx, level, preselectedMonth, preselectedYear, link);
          return;
        }
        const [parentLevel, parentId] = raw.split(":");
        if (!parentId) return;
        if (
          parentLevel === "vision" ||
          parentLevel === "milestone" ||
          parentLevel === "focus"
        ) {
          modalLinkSelection = {
            parentLevel: parentLevel as GoalLevel,
            parentId,
          };
          setLinkageHelpVisible(false);
        }
        openGoalModal(ctx, level, preselectedMonth, preselectedYear, link);
      };
    }

    // Milestone time context toggle
    const timeContextToggle = modal.querySelector("#timeContextToggle");
    if (timeContextToggle) {
      timeContextToggle.addEventListener("click", (e) => {
        e.preventDefault();
        milestoneTimeContextOpen = !milestoneTimeContextOpen;
        updateGoalModalTimeBreakdown(ctx);
      });
    }
  }

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
}

export function handleGoalSubmit(ctx: GoalModalContext, e: Event) {
  e.preventDefault();

  const titleEl = document.getElementById(
    "goalTitle",
  ) as HTMLInputElement | null;
  const monthEl = document.getElementById(
    "goalMonth",
  ) as HTMLSelectElement | null;
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
  const endTimeEl = document.getElementById(
    "goalEndTime",
  ) as HTMLInputElement | null;

  const title = titleEl?.value.trim() ?? "";
  if (!title) {
    if (titleEl) {
      haptics.impact("medium");
      titleEl.setAttribute("aria-invalid", "true");
      titleEl.classList.add("error");
      let errorMsg = titleEl.parentElement?.querySelector(
        ".form-error",
      ) as HTMLElement | null;
      if (!errorMsg) {
        errorMsg = document.createElement("div");
        errorMsg.className = "form-error";
        errorMsg.textContent = "Title is required";
        titleEl.parentElement?.appendChild(errorMsg);
      }
      titleEl.focus();
    }
    return;
  }
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

  if (
    yearEl &&
    (yearEl.parentElement as HTMLElement)?.style.display !== "none"
  ) {
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

  const selectedLink =
    getSelectedLinkFromUi(modalLinkSelection) ?? pendingParentLink;

  if (ctx.goalModalLevel === "milestone") {
    if (!selectedLink || selectedLink.parentLevel !== "vision") {
      setLinkageHelpVisible(true);
      ctx.showToast("🧭", "Choose a Vision so this milestone has an anchor.");
      return;
    }
  }

  if (ctx.goalModalLevel === "focus") {
    if (!selectedLink || selectedLink.parentLevel !== "milestone") {
      setLinkageHelpVisible(true);
      ctx.showToast("🧭", "A Focus must support a Milestone.");
      return;
    }
  }

  if (ctx.goalModalLevel === "intention" && selectedLink) {
    if (selectedLink.parentLevel !== "focus") {
      setLinkageHelpVisible(true);
      ctx.showToast("🧭", "An Intention must support a Focus.");
      return;
    }
  }

  const goalData: any = {
    title,
    level: ctx.goalModalLevel,
    category,
    priority,
    startTime,
    endTime,
  };
  goalData.activityId = modalActivityId ?? null;

  // Linkage (create-time)
  if (ctx.goalModalLevel === "milestone" || ctx.goalModalLevel === "focus") {
    goalData.parentId = selectedLink?.parentId ?? null;
    goalData.parentLevel = selectedLink?.parentLevel ?? null;
  }
  if (ctx.goalModalLevel === "intention") {
    if (selectedLink && selectedLink.parentLevel === "focus") {
      goalData.parentId = selectedLink.parentId;
      goalData.parentLevel = selectedLink.parentLevel;
    }
  }

  if (ctx.goalModalLevel === "vision") {
    goalData.year = year;
  }

  if (ctx.goalModalLevel === "milestone") {
    if (Number.isFinite(month)) goalData.month = month;
    if (Number.isFinite(year)) goalData.year = year;
    if (Number.isFinite(durationMonths))
      goalData.durationMonths = durationMonths;
  }

  if (ctx.goalModalLevel === "focus") {
    if (startDate) goalData.startDate = startDate;
    if (Number.isFinite(durationWeeks)) goalData.durationWeeks = durationWeeks;
  }

  if (ctx.goalModalLevel === "intention") {
    if (startDate) goalData.startDate = startDate;
  }

  if (modalIconDraft) {
    goalData.icon = modalIconDraft;
  }

  if (Object.keys(modalMetaDraft).length > 0) {
    goalData.meta = modalMetaDraft;
  }

  Goals.create(goalData);

  ctx.closeGoalModal();
  ctx.render();
  ctx.showToast("✨", `${ctx.getLevelLabel(ctx.goalModalLevel)} saved.`);
}

export class GoalModal {
  close(ctx: GoalModalContext): void {
    closeGoalModal(ctx);
  }

  populateMonthSelect(
    ctx: GoalModalContext,
    preselectedMonth: number | null = null,
    year: number | null = null,
  ): void {
    populateMonthSelect(ctx, preselectedMonth, year);
  }

  updateGoalModalTimeBreakdown(ctx: GoalModalContext): void {
    updateGoalModalTimeBreakdown(ctx);
  }

  open(
    ctx: GoalModalContext,
    level: GoalLevel = "milestone",
    preselectedMonth: number | null = null,
    preselectedYear: number | null = null,
    link?: { parentId: string; parentLevel: GoalLevel } | null,
  ): void {
    openGoalModal(ctx, level, preselectedMonth, preselectedYear, link);
  }

  handleSubmit(ctx: GoalModalContext, e: Event): void {
    handleGoalSubmit(ctx, e);
  }
}

export const goalModalManager = new GoalModal();
