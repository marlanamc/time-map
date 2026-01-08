export function getOrCreateAfter(
  el: HTMLElement,
  id: string,
  className: string
): HTMLElement {
  const existing = document.getElementById(id);
  if (existing) return existing;
  const container = document.createElement("div");
  container.id = id;
  container.className = className;
  el.insertAdjacentElement("afterend", container);
  return container;
}

export function setTitleHelp(text: string | null) {
  const titleInput = document.getElementById("goalTitle") as HTMLInputElement | null;
  if (!titleInput) return;
  const container = titleInput.parentElement;
  if (!container) return;
  const existing = document.getElementById("goalTitleHelp");
  if (!text) {
    existing?.remove();
    return;
  }
  const help = existing ?? document.createElement("div");
  help.id = "goalTitleHelp";
  help.className = "goal-title-help";
  help.textContent = text;
  if (!existing) container.appendChild(help);
}

export function setInlineHelp(
  el: HTMLElement | null,
  id: string,
  text: string | null
) {
  if (!el) return;
  const existing = document.getElementById(id);
  if (!text) {
    existing?.remove();
    return;
  }
  const help = existing ?? document.createElement("div");
  help.id = id;
  help.className = "field-help";
  help.textContent = text;
  if (!existing) el.appendChild(help);
}

export function focusTitleAtBlank(template: string) {
  const input = document.getElementById("goalTitle") as HTMLInputElement | null;
  if (!input) return;
  input.value = template;
  const idx = template.indexOf("___");
  if (idx >= 0) {
    const start = idx;
    const end = idx + 3;
    input.focus();
    input.setSelectionRange(start, end);
  } else {
    input.focus();
    input.setSelectionRange(template.length, template.length);
  }
}
