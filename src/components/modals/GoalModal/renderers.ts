import type { GoalLevel } from "../../../types";

export function renderDisclosure(opts: {
  id: string;
  title: string;
  subtitle: string;
  open: boolean;
  bodyHtml: string;
}): string {
  const { id, title, subtitle, open, bodyHtml } = opts;
  return `
    <div class="modal-disclosure" id="${id}">
      <button type="button" class="modal-disclosure-toggle" data-action="toggle-disclosure" data-target="${id}" aria-expanded="${open ? "true" : "false"}">
        <div class="modal-disclosure-title">${title}</div>
        <div class="modal-disclosure-subtitle">${subtitle}</div>
      </button>
      ${open ? `<div class="modal-disclosure-body">${bodyHtml}</div>` : ""}
    </div>
  `;
}

export function renderLinkageSelector(opts: {
  level: GoalLevel;
  visions: { id: string; title: string }[];
  milestones: { id: string; title: string }[];
  focuses: { id: string; title: string }[];
  selected: { parentId: string; parentLevel: GoalLevel } | null;
}): string {
  const { level, visions, milestones, focuses, selected } = opts;

  if (level === "milestone") {
    const usePills = visions.length > 0 && visions.length <= 6;
    return `
      <div class="form-group modal-linkage" id="goalLinkageGroup">
        <label>Which Vision does this support?</label>
        ${usePills
          ? `<div class="modal-pill-row">
              ${visions
                .map((v) => {
                  const isSelected = selected?.parentId === v.id && selected?.parentLevel === "vision";
                  return `<button type="button" class="modal-pill${isSelected ? " is-selected" : ""}" data-action="select-link" data-parent-level="vision" data-parent-id="${v.id}">${v.title}</button>`;
                })
                .join("")}
            </div>`
          : `<select id="goalLinkSelect" class="modal-select">
              <option value="" ${!selected ? "selected" : ""}>Select a Vision</option>
              ${visions
                .map((v) => {
                  const isSelected = selected?.parentId === v.id && selected?.parentLevel === "vision";
                  return `<option value="vision:${v.id}" ${isSelected ? "selected" : ""}>${v.title}</option>`;
                })
                .join("")}
            </select>`}
        <div class="goal-linkage-help" id="goalLinkageHelp" hidden>Choose a Vision so this milestone has an anchor.</div>
      </div>
    `;
  }

  if (level === "focus") {
    const candidates = [...milestones.map((m) => ({ ...m, level: "milestone" as const })), ...visions.map((v) => ({ ...v, level: "vision" as const }))];
    const usePills = candidates.length > 0 && candidates.length <= 6;
    return `
      <div class="form-group modal-linkage" id="goalLinkageGroup">
        <label>What does this Focus support?</label>
        ${usePills
          ? `<div class="modal-pill-row">
              ${candidates
                .map((c) => {
                  const isSelected = selected?.parentId === c.id && selected?.parentLevel === c.level;
                  const prefix = c.level === "milestone" ? "Milestone" : "Vision";
                  return `<button type="button" class="modal-pill${isSelected ? " is-selected" : ""}" data-action="select-link" data-parent-level="${c.level}" data-parent-id="${c.id}">${prefix}: ${c.title}</button>`;
                })
                .join("")}
            </div>`
          : `<select id="goalLinkSelect" class="modal-select">
              <option value="" ${!selected ? "selected" : ""}>Select a Milestone or Vision</option>
              ${milestones.length > 0 ? `<optgroup label="Milestones">${milestones.map((m) => `<option value="milestone:${m.id}" ${selected?.parentId === m.id && selected?.parentLevel === "milestone" ? "selected" : ""}>${m.title}</option>`).join("")}</optgroup>` : ""}
              ${visions.length > 0 ? `<optgroup label="Visions">${visions.map((v) => `<option value="vision:${v.id}" ${selected?.parentId === v.id && selected?.parentLevel === "vision" ? "selected" : ""}>${v.title}</option>`).join("")}</optgroup>` : ""}
            </select>`}
        <div class="goal-linkage-help" id="goalLinkageHelp" hidden>Choose a Milestone or Vision so this focus has context.</div>
      </div>
    `;
  }

  if (level === "intention") {
    const usePills = focuses.length + visions.length <= 6 && (focuses.length + visions.length) > 0;
    const noneSelected = !selected;
    return `
      <div class="form-group modal-linkage" id="goalLinkageGroup">
        <label>Link to something (optional)</label>
        ${usePills
          ? `<div class="modal-pill-row">
              <button type="button" class="modal-pill${noneSelected ? " is-selected" : ""}" data-action="clear-link">None</button>
              ${focuses
                .map((f) => {
                  const isSelected = selected?.parentId === f.id && selected?.parentLevel === "focus";
                  return `<button type="button" class="modal-pill${isSelected ? " is-selected" : ""}" data-action="select-link" data-parent-level="focus" data-parent-id="${f.id}">Focus: ${f.title}</button>`;
                })
                .join("")}
              ${visions
                .map((v) => {
                  const isSelected = selected?.parentId === v.id && selected?.parentLevel === "vision";
                  return `<button type="button" class="modal-pill${isSelected ? " is-selected" : ""}" data-action="select-link" data-parent-level="vision" data-parent-id="${v.id}">Vision: ${v.title}</button>`;
                })
                .join("")}
            </div>`
          : `<select id="goalLinkSelect" class="modal-select">
              <option value="" ${noneSelected ? "selected" : ""}>None (life task)</option>
              ${focuses.length > 0 ? `<optgroup label="Focus">${focuses.map((f) => `<option value="focus:${f.id}" ${selected?.parentId === f.id && selected?.parentLevel === "focus" ? "selected" : ""}>${f.title}</option>`).join("")}</optgroup>` : ""}
              ${visions.length > 0 ? `<optgroup label="Vision">${visions.map((v) => `<option value="vision:${v.id}" ${selected?.parentId === v.id && selected?.parentLevel === "vision" ? "selected" : ""}>${v.title}</option>`).join("")}</optgroup>` : ""}
            </select>`}
        <div class="goal-linkage-badge" id="goalLinkageBadge"${noneSelected ? "" : " hidden"}>Life task (still valid)</div>
      </div>
    `;
  }

  return "";
}
