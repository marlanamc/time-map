import type { GoalLevel } from "../../../types";

type GoalSummary = { id: string; title: string };
type LinkageCandidate = GoalSummary & { level: GoalLevel };

export type LinkagePickerSelection = { parentId: string; parentLevel: GoalLevel } | null;

export type LinkagePickerOptions = {
  level: GoalLevel;
  visions: GoalSummary[];
  milestones: GoalSummary[];
  focuses: GoalSummary[];
  selected: LinkagePickerSelection;
};

const LEVEL_LABELS: Record<Exclude<GoalLevel, "vision">, string> = {
  milestone: "Which Vision does this support?",
  focus: "What does this Focus support?",
  intention: "Link to something (optional)",
};

const HELP_TEXTS: Partial<Record<Exclude<GoalLevel, "vision">, string>> = {
  milestone: "Choose a Vision so this milestone has an anchor.",
  focus: "Choose a Milestone or Vision so this focus has context.",
};

const INTENTION_BADGE_TEXT = "Life task (still valid)";

function buildCandidates(opts: LinkagePickerOptions): LinkageCandidate[] {
  const { level, visions, milestones, focuses } = opts;
  if (level === "milestone") {
    return visions.map((vision) => ({ ...vision, level: "vision" }));
  }
  if (level === "focus") {
    return [
      ...milestones.map((milestone) => ({ ...milestone, level: "milestone" })),
      ...visions.map((vision) => ({ ...vision, level: "vision" })),
    ];
  }
  if (level === "intention") {
    return [
      ...focuses.map((focus) => ({ ...focus, level: "focus" })),
      ...milestones.map((milestone) => ({ ...milestone, level: "milestone" })),
      ...visions.map((vision) => ({ ...vision, level: "vision" })),
    ];
  }
  return [];
}

function shouldUsePills(level: GoalLevel, candidates: LinkageCandidate[]): boolean {
  return candidates.length > 0 && candidates.length <= 6;
}

function buildOptionValue(candidate: LinkageCandidate): string {
  return `${candidate.level}:${candidate.id}`;
}

function renderCandidateButton(candidate: LinkageCandidate, selected: LinkagePickerSelection): string {
  const isSelected =
    !!selected && selected.parentId === candidate.id && selected.parentLevel === candidate.level;
  const prefix =
    candidate.level === "milestone"
      ? "Milestone"
      : candidate.level === "vision"
        ? "Vision"
        : "Focus";
  const label =
    candidate.level === "focus"
      ? candidate.title
      : `${prefix}: ${candidate.title}`;
  return `
    <button
      type="button"
      class="modal-pill${isSelected ? " is-selected" : ""}"
      data-action="select-link"
      data-parent-level="${candidate.level}"
      data-parent-id="${candidate.id}"
    >
      ${label}
    </button>
  `;
}

function renderPills(candidates: LinkageCandidate[], selected: LinkagePickerSelection, level: GoalLevel): string {
  const noneSelected = !selected;
  const buttons = candidates.map((candidate) => renderCandidateButton(candidate, selected)).join("");
  const noneButton =
    level === "intention"
      ? `
        <button
          type="button"
          class="modal-pill${noneSelected ? " is-selected" : ""}"
          data-action="clear-link"
        >
          None (life task)
        </button>
      `
      : "";
  const spacer = noneButton || buttons ? `<div class="modal-pill-row">${noneButton}${buttons}</div>` : "";
  return spacer;
}

function renderSelect(opts: LinkagePickerOptions, candidates: LinkageCandidate[], selected: LinkagePickerSelection): string {
  const { level } = opts;
  const noneSelected = !selected;

  const milestoneOptions = candidates
    .filter((c) => c.level === "milestone")
    .map((candidate) => {
      const isSelected =
        !!selected && selected.parentId === candidate.id && selected.parentLevel === candidate.level;
      return `<option value="${buildOptionValue(candidate)}"${isSelected ? " selected" : ""}>${candidate.title}</option>`;
    })
    .join("");

  const focusOptions = candidates
    .filter((c) => c.level === "focus")
    .map((candidate) => {
      const isSelected =
        !!selected && selected.parentId === candidate.id && selected.parentLevel === candidate.level;
      return `<option value="${buildOptionValue(candidate)}"${isSelected ? " selected" : ""}>${candidate.title}</option>`;
    })
    .join("");

  const visionOptions = candidates
    .filter((c) => c.level === "vision")
    .map((candidate) => {
      const isSelected =
        !!selected && selected.parentId === candidate.id && selected.parentLevel === candidate.level;
      return `<option value="${buildOptionValue(candidate)}"${isSelected ? " selected" : ""}>${candidate.title}</option>`;
    })
    .join("");

  if (level === "milestone") {
    return `
      <select id="goalLinkSelect" class="modal-select">
        <option value=""${noneSelected ? " selected" : ""}>Select a Vision</option>
        ${visionOptions}
      </select>
    `;
  }

  if (level === "focus") {
    return `
      <select id="goalLinkSelect" class="modal-select">
        <option value=""${noneSelected ? " selected" : ""}>Select a Milestone or Vision</option>
        ${milestoneOptions ? `<optgroup label="Milestones">${milestoneOptions}</optgroup>` : ""}
        ${visionOptions ? `<optgroup label="Visions">${visionOptions}</optgroup>` : ""}
      </select>
    `;
  }

  return `
    <select id="goalLinkSelect" class="modal-select">
      <option value=""${noneSelected ? " selected" : ""}>None (life task)</option>
      ${focusOptions ? `<optgroup label="Focus">${focusOptions}</optgroup>` : ""}
      ${milestoneOptions ? `<optgroup label="Milestones">${milestoneOptions}</optgroup>` : ""}
      ${visionOptions ? `<optgroup label="Vision">${visionOptions}</optgroup>` : ""}
    </select>
  `;
}

export function renderLinkagePicker(opts: LinkagePickerOptions): string {
  const { level, selected } = opts;
  if (level === "vision") return "";

  const candidates = buildCandidates(opts);
  const usePills = shouldUsePills(level, candidates);
  const label = LEVEL_LABELS[level];
  const help = HELP_TEXTS[level]
    ? `<div class="goal-linkage-help" id="goalLinkageHelp" hidden>${HELP_TEXTS[level]}</div>`
    : "";
  const badge =
    level === "intention"
      ? `<div class="goal-linkage-badge" id="goalLinkageBadge"${!selected ? "" : " hidden"}>${INTENTION_BADGE_TEXT}</div>`
      : "";

  const body = usePills
    ? renderPills(candidates, selected, level)
    : renderSelect(opts, candidates, selected);

  return `
    <div class="form-group modal-linkage" id="goalLinkageGroup">
      <label>${label}</label>
      ${body}
      ${help}
      ${badge}
    </div>
  `;
}
