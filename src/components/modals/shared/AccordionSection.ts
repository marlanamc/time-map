export type AccordionSectionOptions = {
  id: string;
  title: string;
  subtitle?: string;
  bodyHtml: string;
  open?: boolean;
  bodyId?: string;
  toggleAttributes?: Record<string, string>;
};

export function renderAccordionSection(opts: AccordionSectionOptions): string {
  const { id, title, subtitle, bodyHtml, open = false, bodyId } = opts;
  const resolvedBodyId = bodyId ?? `${id}-body`;
  const toggleAttributes = opts.toggleAttributes ?? {};
  const toggleAttributesString = Object.entries(toggleAttributes)
    .map(([key, value]) => `${key}="${value}"`)
    .join(" ");
  const toggleAttributesMarkup = toggleAttributesString ? ` ${toggleAttributesString}` : "";
  return `
    <div class="modal-disclosure" id="${id}">
      <button
        type="button"
        class="modal-disclosure-toggle"
        data-accordion-id="${id}"
        aria-expanded="${open ? "true" : "false"}"
        aria-controls="${resolvedBodyId}"${toggleAttributesMarkup}
      >
        <div class="modal-disclosure-title">${title}</div>
        ${subtitle ? `<div class="modal-disclosure-subtitle">${subtitle}</div>` : ""}
      </button>
      <div class="modal-disclosure-body" id="${resolvedBodyId}"${open ? "" : " hidden"}>
        ${bodyHtml}
      </div>
    </div>
  `;
}

export function setupAccordionSectionToggles(
  container: HTMLElement | null,
  onToggle?: (id: string, open: boolean) => void,
): void {
  if (!container) return;
  const toggles = container.querySelectorAll<HTMLButtonElement>("[data-accordion-id]");
  toggles.forEach((toggle) => {
    const handleToggle = () => {
      const id = toggle.dataset.accordionId;
      const bodyId = toggle.getAttribute("aria-controls");
      if (!id || !bodyId) return;
      const isOpen = toggle.getAttribute("aria-expanded") === "true";
      const nextOpen = !isOpen;
      toggle.setAttribute("aria-expanded", String(nextOpen));
      const body = document.getElementById(bodyId);
      if (body) body.hidden = !nextOpen;
      if (onToggle) onToggle(id, nextOpen);
    };
    toggle.onclick = (e) => {
      e.preventDefault();
      handleToggle();
    };
    toggle.onkeydown = (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleToggle();
      }
    };
  });
}
