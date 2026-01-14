import { State } from "../../../core/State";
import { Goals } from "../../../core/Goals";
import { CONFIG } from "../../../config";
import { ND_CONFIG } from "../../../config/ndConfig";
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
import { getSuggestionChips, renderSuggestionsBody } from "./suggestions";
import { formatTimeContextFact, getTimeContextReframes } from "./timeContext";
import {
  renderAccordionSection,
  setupAccordionSectionToggles,
} from "../shared/AccordionSection";
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
  AccentTheme,
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
    opts?: { lowercase?: boolean; plural?: boolean }
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

const SECTION_IDS = {
  context: "goalContextSection",
  energy: "goalEnergySection",
  link: "goalLinkSection",
  details: "goalDetailsSection",
} as const;

const sectionStates: Record<keyof typeof SECTION_IDS, boolean> = {
  context: false,
  energy: false,
  link: false,
  details: false,
};

let moreOptionsExpanded = false;

const LEVEL_DESCRIPTORS: Record<GoalLevel, string> = {
  vision: "Year direction",
  milestone: "Monthly chapter",
  focus: "Weekly emphasis",
  intention: "Daily touch",
};

const SECTION_TITLES: Record<
  keyof typeof SECTION_IDS,
  { title: string; subtitle?: string }
> = {
  context: {
    title: "Time context",
  },
  energy: {
    title: "Easy mode",
  },
  link: {
    title: "Connect to",
    subtitle: "Link to existing goal",
  },
  details: {
    title: "More details",
  },
};

function renderMoreOptionsButton(): string {
  return `
    <button
      type="button"
      class="goal-more-options-btn"
      id="goalMoreOptionsBtn"
      aria-expanded="${moreOptionsExpanded}"
    >
      ${moreOptionsExpanded ? "Fewer options" : "More options"}
    </button>
  `;
}

function renderAccordionSections() {
  const container = document.getElementById("goalAccordionContainer");
  if (!container) return;

  // Always show Link section (essential)
  const linkSection = renderAccordionSection({
    id: SECTION_IDS.link,
    title: SECTION_TITLES.link.title,
    subtitle: SECTION_TITLES.link.subtitle,
    open: sectionStates.link,
    bodyHtml: `<div id="goalLinkBody"></div>`,
  });

  // Optional sections (hidden by default, shown when "More options" is expanded)
  const optionalSections = moreOptionsExpanded
    ? [
        renderAccordionSection({
          id: SECTION_IDS.context,
          title: SECTION_TITLES.context.title,
          subtitle: SECTION_TITLES.context.subtitle,
          open: sectionStates.context,
          bodyHtml: `<div id="goalContextTime"></div><div id="goalSuggestionsBody"></div>`,
        }),
        renderAccordionSection({
          id: SECTION_IDS.energy,
          title: SECTION_TITLES.energy.title,
          subtitle: SECTION_TITLES.energy.subtitle,
          open: sectionStates.energy,
          bodyHtml: `<div id="goalEnergyBody"></div>`,
        }),
        renderAccordionSection({
          id: SECTION_IDS.details,
          title: SECTION_TITLES.details.title,
          subtitle: SECTION_TITLES.details.subtitle,
          open: sectionStates.details,
          bodyHtml: `<div id="goalDetailsBody"></div>`,
        }),
      ].join("")
    : "";

  container.innerHTML = [
    linkSection,
    renderMoreOptionsButton(),
    `<div id="goalMoreOptionsContainer" ${
      moreOptionsExpanded ? "" : "hidden"
    }>${optionalSections}</div>`,
  ].join("");
}

function populateContextSection(
  ctx: GoalModalContext,
  level: GoalLevel,
  suggestionChips: ReturnType<typeof getSuggestionChips>,
  focusEasyMode: boolean
) {
  const suggestionsEl = document.getElementById("goalSuggestionsBody");
  const bodyHtml =
    level === "vision"
      ? ""
      : renderSuggestionsBody({ level, suggestionChips, focusEasyMode });
  if (suggestionsEl) {
    suggestionsEl.innerHTML = bodyHtml;
  }
  updateGoalModalTimeBreakdown(ctx);
}

function populateEnergySection(
  _ctx: GoalModalContext,
  level: GoalLevel,
  rerender: () => void
) {
  const container = document.getElementById("goalEnergyBody");
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
  focuses: { id: string; title: string }[]
) {
  const linkContainer = document.getElementById("goalLinkBody");
  if (!linkContainer) return;
  if (level === "vision") {
    linkContainer.innerHTML = "";
    return;
  }
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

function moveCategoryOutsideAccordion() {
  // Move category field to be visible immediately after title input
  const categoryGroup = document.querySelector('label[for="goalCategory"]')
    ?.parentElement as HTMLElement | null;
  const categoryLabel = document.querySelector(
    'label[for="goalCategory"]'
  ) as HTMLElement | null;
  const goalHero = document.getElementById("goalHero");
  const accordionContainer = document.getElementById("goalAccordionContainer");

  if (categoryGroup && goalHero && categoryLabel) {
    // Update label to remove "(optional)"
    categoryLabel.textContent = "Category";

    // Create a container for category right after goal-hero
    let categoryContainer = document.getElementById("goalCategoryContainer");
    if (!categoryContainer) {
      categoryContainer = document.createElement("div");
      categoryContainer.id = "goalCategoryContainer";
      categoryContainer.className = "goal-category-inline";
      if (accordionContainer && accordionContainer.parentElement) {
        accordionContainer.parentElement.insertBefore(
          categoryContainer,
          accordionContainer
        );
      } else if (goalHero.parentElement) {
        goalHero.parentElement.insertBefore(
          categoryContainer,
          goalHero.nextSibling
        );
      }
    }

    // Move category group into the container
    moveInto(categoryContainer, categoryGroup);
  }
}

function populateDetailsSection(_level: GoalLevel) {
  const detailsBody = document.getElementById("goalDetailsBody");
  if (!detailsBody) return;

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
  const titleInput = document.getElementById(
    "goalTitle"
  ) as HTMLInputElement | null;
  const wrap = titleInput?.parentElement;
  if (!wrap) return;
  const existing = wrap.querySelector(
    ".goal-title-badge"
  ) as HTMLElement | null;
  if (modalMetaDraft.easyMode) {
    if (!existing) {
      const badge = document.createElement("div");
      badge.className = "goal-title-badge";
      badge.textContent = "Easy mode";
      wrap.appendChild(badge);
    }
  } else {
    existing?.remove();
  }
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
    null
  );
  setLinkageHelpVisible(false);
  Object.keys(sectionStates).forEach((key) => {
    sectionStates[key as keyof typeof sectionStates] = false;
  });
  modalLinkSelection = null;
  modalMetaDraft = {};
  modalIconDraft = null;
  modalActivityId = null;
  moreOptionsExpanded = false;
  syncEasyModeBadge();
}

export function populateMonthSelect(
  ctx: GoalModalContext,
  preselectedMonth: number | null = null,
  year: number | null = null
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
    "goalContextTime"
  ) as HTMLElement | null;
  if (!breakdownContainer) return;

  let html = "";
  const currentYear =
    ctx.goalModalYear ?? State.viewingYear ?? new Date().getFullYear();

  if (level === "intention") {
    html = "";
  } else if (level === "focus") {
    const startDateEl = document.getElementById(
      "goalStartDate"
    ) as HTMLInputElement | null;
    const startDate = startDateEl?.value
      ? parseYmdLocal(startDateEl.value)
      : null;
    const d = startDate ?? State.viewingDate ?? new Date();
    const wkNum = State.getWeekNumber(d);
    html = `
      <div class="time-context">
        <div class="time-context-title">Time context</div>
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
        <div class="time-context-title">Time context</div>
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
      "milestoneDurationMonths"
    ) as HTMLSelectElement | null;
    if (!select) return;
    const selectedMonth = Number.parseInt(select.value, 10);
    const durationMonths = Math.max(
      1,
      Math.floor(Number(durationEl?.value ?? 1))
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
      999
    );
    const days = Math.max(
      1,
      Math.round((end.getTime() - start.getTime()) / 86400000) + 1
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
          <div class="time-context-title">Time context (optional)</div>
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
  link?: { parentId: string; parentLevel: GoalLevel } | null
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
    Object.keys(sectionStates).forEach((key) => {
      sectionStates[key as keyof typeof sectionStates] = false;
    });
    modalLinkSelection = null;
    milestoneTimeContextOpen = false;
    moreOptionsExpanded = false;
  }
  const rerender = () =>
    openGoalModal(ctx, level, preselectedMonth, preselectedYear, link);

  const title = document.getElementById("goal-modal-title");
  const label = document.querySelector('label[for="goalTitle"]');

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

  setTitleHelp(null);

  const monthGroup = document.querySelector('label[for="goalMonth"]')
    ?.parentElement as HTMLElement;
  const monthLabel = document.querySelector(
    'label[for="goalMonth"]'
  ) as HTMLElement;
  const monthSelect = document.getElementById("goalMonth") as HTMLSelectElement;
  const categoryGroup = document.querySelector('label[for="goalCategory"]')
    ?.parentElement as HTMLElement;
  const categoryLabel = document.querySelector(
    'label[for="goalCategory"]'
  ) as HTMLElement | null;

  const timeGroup = document
    .getElementById("goalStartTime")
    ?.closest(".form-row") as HTMLElement;
  const priorityGroup = document.querySelector('label[for="goalPriority"]')
    ?.parentElement as HTMLElement;
  const priorityLabel = document.querySelector(
    'label[for="goalPriority"]'
  ) as HTMLElement | null;
  const yearGroup = document.getElementById(
    "goalYearGroup"
  ) as HTMLElement | null;
  const yearInput = document.getElementById(
    "goalYear"
  ) as HTMLInputElement | null;
  const startDateGroup = document.getElementById(
    "goalStartDateGroup"
  ) as HTMLElement | null;
  const startDateInput = document.getElementById(
    "goalStartDate"
  ) as HTMLInputElement | null;
  const startDateLabel = document.querySelector(
    'label[for="goalStartDate"]'
  ) as HTMLElement | null;
  const milestoneDurationGroup = document.getElementById(
    "milestoneDurationGroup"
  ) as HTMLElement | null;
  const milestoneDurationSelect = document.getElementById(
    "milestoneDurationMonths"
  ) as HTMLSelectElement | null;
  const focusDurationGroup = document.getElementById(
    "focusDurationGroup"
  ) as HTMLElement | null;
  const focusDurationSelect = document.getElementById(
    "focusDurationWeeks"
  ) as HTMLSelectElement | null;
  const submitBtn = document.querySelector(
    '#goalForm button[type="submit"]'
  ) as HTMLElement;
  const durationRow = document.getElementById(
    "goalDurationRow"
  ) as HTMLElement | null;

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
    new Date(ctx.goalModalYear ?? new Date().getFullYear(), 11, 31)
  )
    .filter((g) => g.level === "vision" && g.status !== "done")
    .slice()
    .sort((a, b) => a.title.localeCompare(b.title))
    .map((g) => ({ id: g.id, title: g.title }));

  const milestones = Goals.getAll()
    .filter((g) => g.level === "milestone" && g.status !== "done")
    .slice()
    .sort((a, b) => a.title.localeCompare(b.title))
    .map((g) => ({ id: g.id, title: g.title }));

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
      .map((g) => ({ id: g.id, title: g.title }));
  })();

  if (!modalLinkSelection && pendingParentLink) {
    if (level === "milestone" && pendingParentLink.parentLevel === "vision")
      modalLinkSelection = pendingParentLink;
    if (
      level === "focus" &&
      (pendingParentLink.parentLevel === "milestone" ||
        pendingParentLink.parentLevel === "vision")
    )
      modalLinkSelection = pendingParentLink;
    if (
      level === "intention" &&
      (pendingParentLink.parentLevel === "focus" ||
        pendingParentLink.parentLevel === "vision")
    )
      modalLinkSelection = pendingParentLink;
  }

  renderAccordionSections();
  const accordionContainer = document.getElementById("goalAccordionContainer");
  setupAccordionSectionToggles(accordionContainer, (id, open) => {
    const entry = (
      Object.entries(SECTION_IDS) as [keyof typeof SECTION_IDS, string][]
    ).find(([, value]) => value === id);
    if (!entry) return;
    const [key] = entry;
    sectionStates[key] = open;
    openGoalModal(ctx, level, preselectedMonth, preselectedYear, link);
  });

  // Setup "More options" button toggle
  const moreOptionsBtn = document.getElementById("goalMoreOptionsBtn");
  if (moreOptionsBtn) {
    moreOptionsBtn.onclick = () => {
      moreOptionsExpanded = !moreOptionsExpanded;
      const container = document.getElementById("goalMoreOptionsContainer");

      if (moreOptionsExpanded) {
        // Re-render to create optional sections
        renderAccordionSections();

        // Re-setup accordion toggles for all sections
        const updatedAccordionContainer = document.getElementById(
          "goalAccordionContainer"
        );
        if (updatedAccordionContainer) {
          setupAccordionSectionToggles(
            updatedAccordionContainer,
            (id, open) => {
              const entry = (
                Object.entries(SECTION_IDS) as [
                  keyof typeof SECTION_IDS,
                  string
                ][]
              ).find(([, value]) => value === id);
              if (!entry) return;
              const [key] = entry;
              sectionStates[key] = open;
              openGoalModal(
                ctx,
                level,
                preselectedMonth,
                preselectedYear,
                link
              );
            }
          );
        }

        // Populate optional sections now that they exist
        populateContextSection(
          ctx,
          level,
          getSuggestionChips(level),
          !!modalMetaDraft.easyMode
        );
        populateEnergySection(ctx, level, rerender);
        populateDetailsSection(level);

        // Update button reference and state
        const updatedBtn = document.getElementById("goalMoreOptionsBtn");
        if (updatedBtn) {
          updatedBtn.setAttribute("aria-expanded", "true");
          updatedBtn.textContent = "Fewer options";
        }
        if (container) {
          container.hidden = false;
        }
      } else {
        // Just hide the container
        if (container) {
          container.hidden = true;
        }
        if (moreOptionsBtn) {
          moreOptionsBtn.setAttribute("aria-expanded", "false");
          moreOptionsBtn.textContent = "More options";
        }
      }
    };
  }

  // Move category field outside accordion to show immediately
  moveCategoryOutsideAccordion();

  populateContextSection(
    ctx,
    level,
    getSuggestionChips(level),
    !!modalMetaDraft.easyMode
  );
  populateEnergySection(ctx, level, rerender);
  populateLinkSection(level, visions, milestones, focuses);
  populateDetailsSection(level);

  const heroDateSlot = document.getElementById("goalHeroDateSlot");
  const scopeRow = document.getElementById("goalScopeRow");
  if (startDateGroup) {
    if (level === "intention" && heroDateSlot) {
      heroDateSlot.removeAttribute("hidden");
      heroDateSlot.appendChild(startDateGroup);
      startDateGroup.style.display = "block";
      if (startDateLabel) startDateLabel.textContent = "Date";
    } else {
      heroDateSlot?.setAttribute("hidden", "");
      scopeRow?.appendChild(startDateGroup);
      startDateGroup.style.display = level === "focus" ? "block" : "none";
      if (startDateLabel)
        startDateLabel.textContent =
          level === "focus" ? "Week of" : "Start date";
    }
  }

  if (level === "vision") {
    monthGroup.style.display = "none";
    setFieldVisibility(timeGroup, false);
    if (priorityGroup) priorityGroup.style.display = "none";
    if (categoryGroup) categoryGroup.style.display = "block";
    if (categoryLabel) categoryLabel.textContent = "Area of life (optional)";
    if (yearGroup) yearGroup.style.display = "block";
    if (priorityLabel) priorityLabel.textContent = "Priority";
  } else if (level === "milestone") {
    monthGroup.style.display = "block";
    monthSelect.required = true;
    monthLabel.textContent = "Start month";
    populateMonthSelect(ctx, preselectedMonth, ctx.goalModalYear);
    setFieldVisibility(timeGroup, false);
    if (priorityGroup) priorityGroup.style.display = "block";
    if (categoryGroup) categoryGroup.style.display = "block";
    if (categoryLabel) categoryLabel.textContent = "Category (optional)";
    if (yearGroup) yearGroup.style.display = "block";
    if (milestoneDurationGroup) milestoneDurationGroup.style.display = "block";
    if (milestoneDurationSelect) milestoneDurationSelect.value = "1";
    if (priorityLabel) priorityLabel.textContent = "Urgency (optional)";
    setInlineHelp(
      milestoneDurationGroup,
      "milestoneDurationHelp",
      "You can adjust this later."
    );
  } else if (level === "focus") {
    monthGroup.style.display = "none";
    setFieldVisibility(timeGroup, false);
    if (priorityGroup) priorityGroup.style.display = "block";
    if (categoryGroup) categoryGroup.style.display = "block";
    if (categoryLabel) categoryLabel.textContent = "Category (optional)";
    if (startDateGroup) startDateGroup.style.display = "block";
    if (startDateLabel) startDateLabel.textContent = "Week of";
    if (startDateInput) {
      const weekNum =
        State.viewingWeek ??
        State.getWeekNumber(State.viewingDate ?? new Date());
      const weekStart = State.getWeekStart(
        State.viewingYear ?? new Date().getFullYear(),
        weekNum
      );
      startDateInput.value = toYmdLocal(weekStart);
    }
    if (focusDurationGroup) focusDurationGroup.style.display = "block";
    if (focusDurationSelect) focusDurationSelect.value = "1";
    if (priorityLabel) priorityLabel.textContent = "Urgency (optional)";
  } else if (level === "intention") {
    monthGroup.style.display = "none";
    setFieldVisibility(timeGroup, true);
    if (priorityGroup) priorityGroup.style.display = "none";
    if (categoryGroup) categoryGroup.style.display = "none";
    if (startDateGroup) startDateGroup.style.display = "block";
    if (startDateLabel) startDateLabel.textContent = "Date";
    if (startDateInput)
      startDateInput.value = toYmdLocal(State.viewingDate ?? new Date());
    if (priorityLabel) priorityLabel.textContent = "Priority";
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
        "input, select, textarea"
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
    "goalTitle"
  ) as HTMLInputElement | null;
  const monthEl = document.getElementById(
    "goalMonth"
  ) as HTMLSelectElement | null;
  const yearEl = document.getElementById("goalYear") as HTMLInputElement | null;
  const startDateEl = document.getElementById(
    "goalStartDate"
  ) as HTMLInputElement | null;
  const milestoneDurationEl = document.getElementById(
    "milestoneDurationMonths"
  ) as HTMLSelectElement | null;
  const focusDurationEl = document.getElementById(
    "focusDurationWeeks"
  ) as HTMLSelectElement | null;
  const categoryEl = document.getElementById(
    "goalCategory"
  ) as HTMLSelectElement | null;
  const priorityEl = document.getElementById(
    "goalPriority"
  ) as HTMLSelectElement | null;
  const startTimeEl = document.getElementById(
    "goalStartTime"
  ) as HTMLInputElement | null;
  const endTimeEl = document.getElementById(
    "goalEndTime"
  ) as HTMLInputElement | null;
  const visionAccentEl = document.getElementById(
    "visionAccent"
  ) as HTMLSelectElement | null;
  const visionIconEl = document.getElementById(
    "visionIcon"
  ) as HTMLInputElement | null;

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

  if (ctx.goalModalLevel === "focus" && selectedLink) {
    const ok =
      selectedLink.parentLevel === "milestone" ||
      selectedLink.parentLevel === "vision";
    if (!ok) {
      setLinkageHelpVisible(true);
      ctx.showToast("🧭", "Choose what this focus supports.");
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
  const meta: GoalMeta = {};
  let hasMeta = false;

  // Linkage (create-time)
  if (ctx.goalModalLevel === "milestone" || ctx.goalModalLevel === "focus") {
    goalData.parentId = selectedLink?.parentId ?? null;
    goalData.parentLevel = selectedLink?.parentLevel ?? null;
  }
  if (ctx.goalModalLevel === "intention") {
    if (
      selectedLink &&
      (selectedLink.parentLevel === "focus" ||
        selectedLink.parentLevel === "vision" ||
        selectedLink.parentLevel === "milestone")
    ) {
      goalData.parentId = selectedLink.parentId;
      goalData.parentLevel = selectedLink.parentLevel;
    }
  }

  if (ctx.goalModalLevel === "vision") {
    goalData.year = year;
    const accentRaw = visionAccentEl?.value?.trim() ?? "";
    if (accentRaw && (accentRaw as AccentTheme) in ND_CONFIG.ACCENT_THEMES) {
      meta.accentTheme = accentRaw as AccentTheme;
      hasMeta = true;
    }

    // Handle icon - use modalIconDraft or fall back to input value
    const iconValue = modalIconDraft ?? visionIconEl?.value?.trim() ?? "";
    if (iconValue) {
      goalData.icon = iconValue;
    }
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
    const lowEnergy =
      (
        document.getElementById("focusLowEnergy") as HTMLTextAreaElement | null
      )?.value?.trim() ?? "";
    if (lowEnergy) {
      meta.lowEnergyVersion = lowEnergy;
      hasMeta = true;
    }
    const focusEasyModeEl = document.getElementById(
      "focusEasyMode"
    ) as HTMLInputElement | null;
    if (focusEasyModeEl?.checked) {
      meta.easyMode = true;
      hasMeta = true;
    }
  }

  if (ctx.goalModalLevel === "intention") {
    if (startDate) goalData.startDate = startDate;
    const tiny =
      (
        document.getElementById("intentionTiny") as HTMLInputElement | null
      )?.value?.trim() ?? "";
    if (tiny) {
      meta.tinyVersion = tiny;
      hasMeta = true;
    }
  }

  if (hasMeta) {
    goalData.meta = meta;
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
    year: number | null = null
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
    link?: { parentId: string; parentLevel: GoalLevel } | null
  ): void {
    openGoalModal(ctx, level, preselectedMonth, preselectedYear, link);
  }

  handleSubmit(ctx: GoalModalContext, e: Event): void {
    handleGoalSubmit(ctx, e);
  }
}

export const goalModalManager = new GoalModal();
