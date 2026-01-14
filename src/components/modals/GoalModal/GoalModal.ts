import { State } from "../../../core/State";
import { Goals } from "../../../core/Goals";
import { CONFIG } from "../../../config";
import { ND_CONFIG } from "../../../config/ndConfig";
import { TimeBreakdown } from "../../../utils/TimeBreakdown";
import { viewportManager } from "../../../ui/viewport/ViewportManager";
import { haptics } from "../../../utils/haptics";
import {
  focusTitleAtBlank,
  getOrCreateAfter,
  setInlineHelp,
  setTitleHelp,
} from "./domHelpers";
import { parseYmdLocal, toYmdLocal } from "./dateUtils";
import {
  getSelectedLinkFromUi,
  setFieldVisibility,
  setLinkageHelpVisible,
} from "./linkageHelpers";
import { renderDisclosure, renderLinkageSelector } from "./renderers";
import { getSuggestionChips, renderSuggestionsBody } from "./suggestions";
import { formatTimeContextFact, getTimeContextReframes } from "./timeContext";
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
    opts?: { lowercase?: boolean; plural?: boolean },
  ) => string;
};

let pendingParentLink: { parentId: string; parentLevel: GoalLevel } | null = null;
let visionTimeContextOpen = false;
let milestoneTimeContextOpen = false;
let focusTimeContextOpen = false;
let suggestionsOpen = false;
let focusEasyMode = false;
let intentionOptionsOpen = false;

let modalLinkSelection: { parentId: string; parentLevel: GoalLevel } | null = null;

const LEVEL_DESCRIPTORS: Record<GoalLevel, string> = {
  vision: "Year direction",
  milestone: "Monthly chapter",
  focus: "Weekly emphasis",
  intention: "Daily touch",
};

export function closeGoalModal(ctx: GoalModalContext) {
  ctx.elements.goalModal?.classList.remove("active");
  ctx.elements.goalForm?.reset();
  ctx.goalModalYear = null;
  pendingParentLink = null;
  const help = document.getElementById("goalTitleHelp");
  help?.remove();
  document.getElementById("goalLinkageGroup")?.remove();
  document.getElementById("goalSuggestionsGroup")?.remove();
  document.getElementById("goalExtrasGroup")?.remove();
  document.getElementById("goalTinyGroup")?.remove();
  document.getElementById("visionAccentGroup")?.remove();
  document.getElementById("goalOptionsDisclosure")?.remove();
  setInlineHelp(document.getElementById("milestoneDurationGroup"), "milestoneDurationHelp", null);
  setLinkageHelpVisible(false);
  suggestionsOpen = false;
  focusEasyMode = false;
  intentionOptionsOpen = false;
  modalLinkSelection = null;
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
    const form = ctx.elements.goalForm;
    const anchor = (() => {
      if (!form) return null;
      if (level === "milestone") return document.getElementById("goalDurationRow");
      if (level === "focus") return document.getElementById("goalScopeRow");
      return form.querySelector(".form-group");
    })();
    if (anchor) {
      anchor.insertAdjacentElement("afterend", breakdownContainer);
    }
  }

  let html = "";
  const currentYear =
    ctx.goalModalYear ?? State.viewingYear ?? new Date().getFullYear();

  if (level === "intention") {
    html = "";
  } else if (level === "focus") {
    const startDateEl = document.getElementById("goalStartDate") as HTMLInputElement | null;
    const startDate = startDateEl?.value ? parseYmdLocal(startDateEl.value) : null;
    const d = startDate ?? (State.viewingDate ?? new Date());
    const wkNum = State.getWeekNumber(d);
    html = `
      <div class="time-context">
        <button type="button" class="time-context-toggle" id="timeContextToggle" aria-expanded="${focusTimeContextOpen ? "true" : "false"}">
          <div class="time-context-title">Time context (optional)</div>
          <div class="time-context-subtitle">A quiet orientation to this week.</div>
        </button>
        ${
          focusTimeContextOpen
            ? `
              <div class="time-context-body">
                <div class="time-context-fact">This focus is for Week ${wkNum} (Mon–Sun).</div>
                <ul class="time-context-reframes">
                  <li>One clear focus beats ten vague plans.</li>
                </ul>
                <div class="time-context-safety">This is here to help you orient, not to rush you.</div>
              </div>
            `
            : ""
        }
      </div>
    `;
  } else if (level === "vision") {
    const { fact, bucketMonths } = formatTimeContextFact(currentYear);
    const reframes = getTimeContextReframes(bucketMonths);
    html = `
      <div class="time-context">
        <button type="button" class="time-context-toggle" id="timeContextToggle" aria-expanded="${visionTimeContextOpen ? "true" : "false"}">
          <div class="time-context-title">Time context (optional)</div>
          <div class="time-context-subtitle">A quiet orientation to the year you’re in.</div>
        </button>
        ${
          visionTimeContextOpen
            ? `
              <div class="time-context-body">
                <div class="time-context-fact">${fact}</div>
                <ul class="time-context-reframes">
                  ${reframes.slice(0, 2).map((r) => `<li>${r}</li>`).join("")}
                </ul>
                <div class="time-context-safety">This is here to help you orient, not to rush you.</div>
              </div>
            `
            : ""
        }
      </div>
    `;
  } else if (level === "milestone") {
    const select = ctx.elements.goalMonth;
    const durationEl = document.getElementById("milestoneDurationMonths") as HTMLSelectElement | null;
    if (!select) return;
    const selectedMonth = Number.parseInt(select.value, 10);
    const durationMonths = Math.max(1, Math.floor(Number(durationEl?.value ?? 1)));
    if (!Number.isFinite(selectedMonth)) return;
    const start = new Date(currentYear, selectedMonth, 1);
    const end = new Date(currentYear, selectedMonth + durationMonths, 0, 23, 59, 59, 999);
    const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
    const weeks = Math.max(1, Math.round(days / 7));
    const fact = days <= 31 ? `This milestone spans about ${days} days.` : `This milestone spans about ${weeks} weeks.`;
    html = `
      <div class="time-context">
        <button type="button" class="time-context-toggle" id="timeContextToggle" aria-expanded="${milestoneTimeContextOpen ? "true" : "false"}">
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

  if (level === "vision" || level === "milestone" || level === "focus") {
    const toggle = breakdownContainer.querySelector<HTMLButtonElement>("#timeContextToggle");
    if (toggle) {
      toggle.onclick = (e) => {
        e.preventDefault();
        if (level === "vision") visionTimeContextOpen = !visionTimeContextOpen;
        if (level === "milestone") milestoneTimeContextOpen = !milestoneTimeContextOpen;
        if (level === "focus") focusTimeContextOpen = !focusTimeContextOpen;
        updateGoalModalTimeBreakdown(ctx);
      };
    }
  }
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
    if (level === "vision") visionTimeContextOpen = false;
    if (level === "milestone") milestoneTimeContextOpen = false;
    if (level === "focus") focusTimeContextOpen = false;
    suggestionsOpen = false;
    focusEasyMode = false;
    intentionOptionsOpen = false;
    modalLinkSelection = null;
  }

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

  setTitleHelp(
    level === "vision"
      ? "One sentence is enough. You can change this later."
      : level === "focus"
        ? "Aim for 1–3 Focus items. Smaller is okay."
        : level === "intention"
          ? "This can be small. Even a 2-minute task counts."
          : null,
  );

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
  const categoryLabel = document.querySelector(
    'label[for="goalCategory"]',
  ) as HTMLElement | null;

  const timeGroup = document
    .getElementById("goalStartTime")
    ?.closest(".form-row") as HTMLElement;
  const priorityGroup = document.querySelector(
    'label[for="goalPriority"]',
  )?.parentElement as HTMLElement;
  const priorityLabel = document.querySelector(
    'label[for="goalPriority"]',
  ) as HTMLElement | null;
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
  const durationRow = document.getElementById("goalDurationRow") as HTMLElement | null;

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

  // Linkage + suggestions containers (insert after title group).
  const firstFormGroup = ctx.elements.goalForm?.querySelector(".form-group") as HTMLElement | null;
  if (firstFormGroup) {
    const visions = Goals.getForRange(
      new Date((ctx.goalModalYear ?? new Date().getFullYear()), 0, 1),
      new Date((ctx.goalModalYear ?? new Date().getFullYear()), 11, 31),
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

    // Seed selection from context link (if compatible) only if user hasn't chosen yet.
    if (!modalLinkSelection && pendingParentLink) {
      if (level === "milestone" && pendingParentLink.parentLevel === "vision") modalLinkSelection = pendingParentLink;
      if (level === "focus" && (pendingParentLink.parentLevel === "milestone" || pendingParentLink.parentLevel === "vision")) modalLinkSelection = pendingParentLink;
      if (level === "intention" && (pendingParentLink.parentLevel === "focus" || pendingParentLink.parentLevel === "vision")) modalLinkSelection = pendingParentLink;
    }

    // Remove any previous containers
    document.getElementById("goalLinkageGroup")?.remove();
    document.getElementById("goalSuggestionsGroup")?.remove();
    document.getElementById("goalExtrasGroup")?.remove();
    document.getElementById("goalTinyGroup")?.remove();

    // Suggestions (optional)
    const suggestionChips = getSuggestionChips(level);
    const suggestionsBody = renderSuggestionsBody({
      level,
      suggestionChips,
      focusEasyMode,
    });

    const suggestionsGroup = getOrCreateAfter(
      firstFormGroup,
      "goalSuggestionsGroup",
      "modal-inline-section",
    );
    if (level === "milestone" || level === "focus" || level === "intention") {
      const titleText =
        level === "focus" ? "Suggestions (optional)" : "Suggestions (optional)";
      const subtitleText =
        "Pick one, then edit it to sound like you.";
      suggestionsGroup.innerHTML = renderDisclosure({
        id: "goalSuggestionsDisclosure",
        title: titleText,
        subtitle: subtitleText,
        open: suggestionsOpen,
        bodyHtml: suggestionsBody,
      });
    } else {
      suggestionsGroup.innerHTML = "";
    }

    // Linkage selector
    if (level === "milestone" || level === "focus" || level === "intention") {
      const linkageHtml = renderLinkageSelector({
        level,
        visions,
        milestones,
        focuses,
        selected: modalLinkSelection,
      });
      if (linkageHtml) {
        const linkageGroup = getOrCreateAfter(
          suggestionsGroup,
          "goalLinkageGroup",
          "modal-inline-section",
        );
        linkageGroup.outerHTML = linkageHtml;
      }
    }

    // Focus extras
    if (level === "focus") {
      const extras = getOrCreateAfter(
        document.getElementById("goalLinkageGroup") ?? suggestionsGroup,
        "goalExtrasGroup",
        "modal-inline-section",
      );
      extras.innerHTML = `
        <div class="form-group">
          <label class="toggle-label">
            <input type="checkbox" id="focusEasyMode"${focusEasyMode ? " checked" : ""}>
            Easy mode week
          </label>
          <div class="field-help">Lower the bar on purpose.</div>
        </div>
        <div class="form-group">
          <label for="focusLowEnergy">Low-energy version (optional)</label>
          <textarea id="focusLowEnergy" rows="2" placeholder="If the week gets messy, what’s the smallest version that still counts?"></textarea>
          <div class="field-help">If the week gets messy, what’s the smallest version that still counts?</div>
        </div>
      `;
    }

    // Intention tiny version field
    if (level === "intention") {
      const tiny = getOrCreateAfter(
        document.getElementById("goalLinkageGroup") ?? suggestionsGroup,
        "goalTinyGroup",
        "modal-inline-section",
      );
      tiny.innerHTML = `
        <div class="form-group">
          <label for="intentionTiny">Tiny version (optional)</label>
          <input type="text" id="intentionTiny" placeholder="If this feels like too much, what’s the smallest version?">
          <div class="field-help">If this feels like too much, what’s the smallest version?</div>
        </div>
      `;
    }

    // Vision accent selector (applies to linked milestones/focus/intentions)
    if (level === "vision") {
      const accentGroup = getOrCreateAfter(
        suggestionsGroup,
        "visionAccentGroup",
        "modal-inline-section",
      );
      const options = Object.entries(ND_CONFIG.ACCENT_THEMES)
        .filter(([key]) => key !== "rainbow")
        .map(([key, meta]) => `<option value="${key}">${meta.label}</option>`)
        .join("");
      accentGroup.innerHTML = `
        <div class="form-group">
          <label for="visionAccent">Vision color (optional)</label>
          <select id="visionAccent" class="modal-select">
            <option value="">Default</option>
            ${options}
          </select>
          <div class="field-help">This color carries through linked milestones, focus, and intentions.</div>
        </div>
      `;
    }
  }

  if (monthGroup && monthLabel && monthSelect) {
    if (level === "vision") {
      monthGroup.style.display = "none";
      setFieldVisibility(timeGroup, false);
      // Vision is an anchor, not a ranked task.
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
      setInlineHelp(milestoneDurationGroup, "milestoneDurationHelp", "You can adjust this later.");
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
          State.viewingWeek ?? State.getWeekNumber(State.viewingDate ?? new Date());
        const weekStart = State.getWeekStart(
          State.viewingYear ?? new Date().getFullYear(),
          weekNum,
        );
        startDateInput.value = toYmdLocal(weekStart);
      }
      if (focusDurationGroup) focusDurationGroup.style.display = "block";
      if (focusDurationSelect) focusDurationSelect.value = "1";
      if (priorityLabel) priorityLabel.textContent = "Urgency (optional)";
    } else if (level === "intention") {
      monthGroup.style.display = "none";
      setFieldVisibility(timeGroup, false); // Hide time fields - they'll be in "More options"
      if (priorityGroup) priorityGroup.style.display = "none";
      if (categoryGroup) categoryGroup.style.display = "none";
      if (startDateGroup) startDateGroup.style.display = "block";
      if (startDateLabel) startDateLabel.textContent = "Date";
      if (startDateInput)
        startDateInput.value = toYmdLocal(State.viewingDate ?? new Date());
      if (priorityLabel) priorityLabel.textContent = "Priority";

      // Create "More options" disclosure that wraps optional fields
      if (startDateGroup) {
        const optionsDisclosure = getOrCreateAfter(
          startDateGroup,
          "goalOptionsDisclosure",
          "modal-inline-section",
        );

      // Build the disclosure body HTML with time fields
      const timeFieldsHtml = `
        <div class="form-row">
          <div class="form-group">
            <label for="goalStartTime">Start Time</label>
            <input type="time" id="goalStartTimeClone" />
          </div>
          <div class="form-group">
            <label for="goalEndTime">End Time</label>
            <input type="time" id="goalEndTimeClone" />
          </div>
        </div>
      `;

      // Create containers for sections that will be moved inside
      const bodyContent = `
        <div class="options-disclosure-content">
          ${timeFieldsHtml}
          <div id="goalOptionsTimeFields"></div>
          <div id="goalOptionsSuggestions"></div>
          <div id="goalOptionsLinkage"></div>
          <div id="goalOptionsTiny"></div>
        </div>
      `;

      optionsDisclosure.innerHTML = renderDisclosure({
        id: "goalOptionsDisclosure",
        title: "More options",
        subtitle: "Time, suggestions, and connections",
        open: intentionOptionsOpen,
        bodyHtml: bodyContent,
      });

      // Move existing sections into the disclosure
      const suggestionsGroup = document.getElementById("goalSuggestionsGroup");
      const linkageGroup = document.getElementById("goalLinkageGroup");
      const tinyGroup = document.getElementById("goalTinyGroup");
      const suggestionsdest = document.getElementById("goalOptionsSuggestions");
      const linkageDest = document.getElementById("goalOptionsLinkage");
      const tinyDest = document.getElementById("goalOptionsTiny");

      if (suggestionsGroup && suggestionsdest) {
        suggestionsdest.appendChild(suggestionsGroup);
      }
      if (linkageGroup && linkageDest) {
        linkageDest.appendChild(linkageGroup);
      }
      if (tinyGroup && tinyDest) {
        tinyDest.appendChild(tinyGroup);
      }

      // Sync time field values from original fields to cloned fields
      const originalStartTime = document.getElementById("goalStartTime") as HTMLInputElement | null;
      const originalEndTime = document.getElementById("goalEndTime") as HTMLInputElement | null;
      const clonedStartTime = document.getElementById("goalStartTimeClone") as HTMLInputElement | null;
      const clonedEndTime = document.getElementById("goalEndTimeClone") as HTMLInputElement | null;

      if (originalStartTime && clonedStartTime) {
        clonedStartTime.value = originalStartTime.value;
        clonedStartTime.oninput = () => {
          if (originalStartTime) originalStartTime.value = clonedStartTime.value;
        };
      }
      if (originalEndTime && clonedEndTime) {
        clonedEndTime.value = originalEndTime.value;
        clonedEndTime.oninput = () => {
          if (originalEndTime) originalEndTime.value = clonedEndTime.value;
        };
      }
      }
    }
  }

  setTimeout(() => updateGoalModalTimeBreakdown(ctx), 0);

  ctx.elements.goalModal?.classList.add("active");

  // Bind inline interactions (suggestions, linkage, easy mode).
  const modal = ctx.elements.goalModal;
  if (modal) {
    modal.querySelectorAll<HTMLElement>("[data-action='toggle-disclosure']").forEach((btn) => {
      btn.onclick = (e) => {
        e.preventDefault();
        const target = (btn as HTMLElement).dataset.target;
        if (target === "goalOptionsDisclosure") {
          intentionOptionsOpen = !intentionOptionsOpen;
        } else if (target === "goalSuggestionsDisclosure") {
          suggestionsOpen = !suggestionsOpen;
        }
        openGoalModal(ctx, level, preselectedMonth, preselectedYear, link);
      };
    });

    modal.querySelectorAll<HTMLElement>("[data-action='suggest-title']").forEach((btn) => {
      btn.onclick = (e) => {
        e.preventDefault();
        const template = (btn as HTMLElement).dataset.template ?? "";
        if (!template) return;
        focusTitleAtBlank(template);
      };
    });

    modal.querySelectorAll<HTMLElement>("[data-action='select-link']").forEach((btn) => {
      btn.onclick = (e) => {
        e.preventDefault();
        const parentId = (btn as HTMLElement).dataset.parentId;
        const parentLevel = (btn as HTMLElement).dataset.parentLevel as GoalLevel | undefined;
        if (!parentId || !parentLevel) return;
        modalLinkSelection = { parentId, parentLevel };
        setLinkageHelpVisible(false);
        openGoalModal(ctx, level, preselectedMonth, preselectedYear, link);
      };
    });

    modal.querySelectorAll<HTMLElement>("[data-action='clear-link']").forEach((btn) => {
      btn.onclick = (e) => {
        e.preventDefault();
        modalLinkSelection = null;
        openGoalModal(ctx, level, preselectedMonth, preselectedYear, link);
      };
    });

    const linkSelect = modal.querySelector<HTMLSelectElement>("#goalLinkSelect");
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
        if (parentLevel === "vision" || parentLevel === "milestone" || parentLevel === "focus") {
          modalLinkSelection = { parentLevel: parentLevel as GoalLevel, parentId };
          setLinkageHelpVisible(false);
        }
        openGoalModal(ctx, level, preselectedMonth, preselectedYear, link);
      };
    }

    const easyModeEl = modal.querySelector<HTMLInputElement>("#focusEasyMode");
    if (easyModeEl) {
      easyModeEl.onchange = () => {
        focusEasyMode = !!easyModeEl.checked;
        // Show a small badge near the title input when enabled.
        const titleInput = document.getElementById("goalTitle") as HTMLInputElement | null;
        const wrap = titleInput?.parentElement;
        if (wrap) {
          const existing = wrap.querySelector(".goal-title-badge") as HTMLElement | null;
          if (focusEasyMode) {
            const badge = existing ?? document.createElement("div");
            badge.className = "goal-title-badge";
            badge.textContent = "Easy mode";
            if (!existing) wrap.appendChild(badge);
          } else {
            existing?.remove();
          }
        }
        openGoalModal(ctx, level, preselectedMonth, preselectedYear, link);
      };
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
  const visionAccentEl = document.getElementById("visionAccent") as HTMLSelectElement | null;

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

  const selectedLink = getSelectedLinkFromUi(modalLinkSelection) ?? pendingParentLink;

  if (ctx.goalModalLevel === "milestone") {
    if (!selectedLink || selectedLink.parentLevel !== "vision") {
      setLinkageHelpVisible(true);
      ctx.showToast("🧭", "Choose a Vision so this milestone has an anchor.");
      return;
    }
  }

  if (ctx.goalModalLevel === "focus") {
    const ok =
      !!selectedLink &&
      (selectedLink.parentLevel === "milestone" ||
        selectedLink.parentLevel === "vision");
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
  const meta: GoalMeta = {};
  let hasMeta = false;

  // Linkage (create-time)
  if (ctx.goalModalLevel === "milestone" || ctx.goalModalLevel === "focus") {
    goalData.parentId = selectedLink?.parentId ?? null;
    goalData.parentLevel = selectedLink?.parentLevel ?? null;
  }
  if (ctx.goalModalLevel === "intention") {
    if (selectedLink && (selectedLink.parentLevel === "focus" || selectedLink.parentLevel === "vision")) {
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
  }

  if (ctx.goalModalLevel === "milestone") {
    if (Number.isFinite(month)) goalData.month = month;
    if (Number.isFinite(year)) goalData.year = year;
    if (Number.isFinite(durationMonths)) goalData.durationMonths = durationMonths;
  }

  if (ctx.goalModalLevel === "focus") {
    if (startDate) goalData.startDate = startDate;
    if (Number.isFinite(durationWeeks)) goalData.durationWeeks = durationWeeks;
    const lowEnergy = (document.getElementById("focusLowEnergy") as HTMLTextAreaElement | null)?.value?.trim() ?? "";
    if (lowEnergy) {
      meta.lowEnergyVersion = lowEnergy;
      hasMeta = true;
    }
    if (focusEasyMode) {
      meta.easyMode = true;
      hasMeta = true;
    }
  }

  if (ctx.goalModalLevel === "intention") {
    if (startDate) goalData.startDate = startDate;
    const tiny = (document.getElementById("intentionTiny") as HTMLInputElement | null)?.value?.trim() ?? "";
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
