import type { GoalLevel } from "../../../types";

type SuggestionGroup = {
  label: string;
  items: string[];
};

type SuggestionChips =
  | string[]
  | {
      easy?: string[];
      groups: SuggestionGroup[];
    }
  | null;

export function getSuggestionChips(level: GoalLevel): SuggestionChips {
  if (level === "milestone") {
    return [
      "This month’s chapter is: ___",
      "A realistic win for this month: ___",
      "Make it easier to ___",
      "By the end of this month, I want to ___",
      "Reduce friction around ___",
      "Set up a system for ___",
      "Follow through on ___",
      "Close the loop on ___",
    ];
  }
  if (level === "focus") {
    const easy = [
      "Stabilize the basics",
      "Protect energy",
      "Minimum viable progress",
    ];
    const groups = [
      {
        label: "Move one thing forward",
        items: [
          "Take one concrete step",
          "Reduce friction",
          "Make one decision I’ve been avoiding",
        ],
      },
      {
        label: "Build stability",
        items: ["Keep the basics steady", "Protect sleep", "Do the week on easy mode"],
      },
      {
        label: "Clear a bottleneck",
        items: ["Follow up on one thing", "Schedule the appointment", "Handle the paperwork"],
      },
      {
        label: "Make room",
        items: ["Create time for ___", "Declutter one surface", "Reset the space"],
      },
    ];
    return { easy, groups };
  }
  if (level === "intention") {
    const groups = [
      {
        label: "Admin / follow-through",
        items: ["Reply to one message", "Open the document", "Find the phone number", "Schedule it"],
      },
      {
        label: "Home / reset",
        items: ["Put 5 items away", "Take out trash", "Clear one surface"],
      },
      {
        label: "Body / basics",
        items: ["Drink water", "10-minute walk", "Prep something easy to eat"],
      },
    ];
    return { groups };
  }
  return null;
}

export function renderSuggestionsBody(opts: {
  level: GoalLevel;
  suggestionChips: SuggestionChips;
  focusEasyMode: boolean;
}): string {
  const { level, suggestionChips, focusEasyMode } = opts;

  if (!suggestionChips) return "";
  if (level === "milestone" && Array.isArray(suggestionChips)) {
    return `<div class="modal-chip-row">
      ${suggestionChips
        .map((t) => `<button type="button" class="modal-chip" data-action="suggest-title" data-template="${t.replaceAll("\"", "&quot;")}">${t}</button>`)
        .join("")}
    </div>`;
  }
  if (level === "focus" && typeof suggestionChips === "object" && "groups" in suggestionChips) {
    const easy = focusEasyMode
      ? `
        <div class="modal-suggest-group">
          <div class="modal-suggest-label">Easy mode</div>
          <div class="modal-chip-row">
            ${suggestionChips.easy
              ?.map((t) => `<button type="button" class="modal-chip" data-action="suggest-title" data-template="${t.replaceAll("\"", "&quot;")}">${t}</button>`)
              .join("") ?? ""}
          </div>
        </div>`
      : "";
    return `
      ${easy}
      ${suggestionChips.groups
        .map(
          (g) => `
            <div class="modal-suggest-group">
              <div class="modal-suggest-label">${g.label}</div>
              <div class="modal-chip-row">
                ${g.items
                  .map((t) => `<button type="button" class="modal-chip" data-action="suggest-title" data-template="${t.replaceAll("\"", "&quot;")}">${t}</button>`)
                  .join("")}
              </div>
            </div>
          `,
        )
        .join("")}
    `;
  }
  if (level === "intention" && typeof suggestionChips === "object" && "groups" in suggestionChips) {
    return `
      ${suggestionChips.groups
        .map(
          (g) => `
            <div class="modal-suggest-group">
              <div class="modal-suggest-label">${g.label}</div>
              <div class="modal-chip-row">
                ${g.items
                  .map((t) => `<button type="button" class="modal-chip" data-action="suggest-title" data-template="${t.replaceAll("\"", "&quot;")}">${t}</button>`)
                  .join("")}
              </div>
            </div>
          `,
        )
        .join("")}
    `;
  }
  return "";
}
