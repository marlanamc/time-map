import type { GoalLevel } from "../../../types";

export function getSelectedLinkFromUi(
  modalLinkSelection: { parentId: string; parentLevel: GoalLevel } | null
): { parentId: string; parentLevel: GoalLevel } | null {
  const select = document.getElementById("goalLinkSelect") as HTMLSelectElement | null;
  if (select) {
    const raw = select.value?.trim();
    if (!raw) return null;
    const [level, id] = raw.split(":");
    if (!id) return null;
    if (level === "vision" || level === "milestone" || level === "focus") {
      return { parentLevel: level as GoalLevel, parentId: id };
    }
    return null;
  }
  return modalLinkSelection;
}

export function setLinkageHelpVisible(visible: boolean) {
  const help = document.getElementById("goalLinkageHelp");
  if (help) help.toggleAttribute("hidden", !visible);
}

export function setFieldVisibility(
  element: HTMLElement | null,
  visible: boolean
) {
  if (!element) return;
  element.style.display = visible ? "grid" : "none";
}
