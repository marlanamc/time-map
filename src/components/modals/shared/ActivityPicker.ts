import { CONFIG } from "../../../config/constants";

type ActivityOption = {
  id: string;
  label: string;
  emoji: string;
};

function formatLabel(id: string): string {
  return id
    .split("-")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function activityOptions(): ActivityOption[] {
  return Object.entries(CONFIG.ACTIVITY_EMOJIS).map(([id, emoji]) => ({
    id,
    label: formatLabel(id),
    emoji,
  }));
}

export type ActivityPickerOptions = {
  value?: string | null;
};

export type ActivityPickerSetupOptions = ActivityPickerOptions & {
  onChange: (value: string | null) => void;
};

export function renderActivityPicker(opts: ActivityPickerOptions): string {
  const { value } = opts;
  const options = activityOptions()
    .map(
      ({ id, label, emoji }) =>
        `<option value="${id}"${value === id ? " selected" : ""}>${emoji} ${label}</option>`,
    )
    .join("");
  return `
    <label for="goalActivitySelect">Activity (optional)</label>
    <select id="goalActivitySelect" class="modal-select">
      <option value=""${value ? "" : " selected"}>None</option>
      ${options}
    </select>
  `;
}

export function setupActivityPicker(
  container: HTMLElement | null,
  opts: ActivityPickerSetupOptions,
): void {
  if (!container) return;
  const select = container.querySelector<HTMLSelectElement>("#goalActivitySelect");
  if (!select) return;
  select.onchange = () => {
    const raw = select.value?.trim() ?? "";
    opts.onChange(raw || null);
  };
}
