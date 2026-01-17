import { ND_CONFIG } from "../../../config/ndConfig";
import type { AccentTheme, GoalLevel, GoalMeta } from "../../../types";

type Option = {
  value: string;
  label: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function themeOptions(): Option[] {
  return Object.entries(ND_CONFIG.ACCENT_THEMES)
    .filter(([key]) => key !== "rainbow")
    .map(([key, meta]) => ({
      value: key,
      label: meta.label,
    }));
}

export type EnergyMetaPanelOptions = {
  level: GoalLevel;
  meta?: GoalMeta;
  icon?: string; // Add icon separately since it's on Goal, not in GoalMeta
};

export type EnergyMetaPanelSetupOptions = EnergyMetaPanelOptions & {
  onChange: (nextMeta: GoalMeta) => void;
  getMeta: () => GoalMeta;
  onRequestRerender?: () => void;
  onIconChange?: (icon: string) => void; // Add icon change handler
};

function renderEmojiInput(id: string, label: string, value: string): string {
  return `
    <div class="form-group">
      <label for="${id}">${label}</label>
      <div class="vision-icon-input-group">
        <input
          type="text"
          id="${id}"
          class="modal-input vision-emoji-input"
          placeholder="Tap to choose emoji"
          maxlength="10"
          value="${escapeHtml(value)}"
          readonly
          aria-label="Tap to open emoji keyboard"
        />
      </div>
      <p class="vision-icon-hint">Tap the field, then use the emoji key on your keyboard</p>
    </div>
  `;
}

export function renderEnergyMetaPanel(opts: EnergyMetaPanelOptions): string {
  const { level, meta, icon } = opts;

  if (level === "vision") {
    const options = themeOptions()
      .map(({ value, label }) => {
        const selected = meta?.accentTheme === value ? "selected" : "";
        return `<option value="${value}" ${selected}>${label}</option>`;
      })
      .join("");
    return `
      ${renderEmojiInput("visionIcon", "Vision emoji (optional)", icon ?? "")}
      <div class="form-group">
        <label for="visionAccent">Vision color (optional)</label>
        <select id="visionAccent" class="modal-select">
          <option value=""${
            meta?.accentTheme ? "" : " selected"
          }>Default</option>
          ${options}
        </select>
      </div>
    `;
  }

  if (level === "focus") {
    return `
      ${renderEmojiInput("focusIcon", "Focus emoji (optional)", icon ?? "")}
      <div class="form-group">
        <label class="toggle-label">
          <input type="checkbox" id="focusEasyMode"${
            meta?.easyMode ? " checked" : ""
          } />
          Easy mode week
        </label>
      </div>
      <div class="form-group">
        <label for="focusLowEnergy">Low-energy version (optional)</label>
        <textarea id="focusLowEnergy" rows="2">${escapeHtml(
          meta?.lowEnergyVersion ?? "",
        )}</textarea>
      </div>
    `;
  }

  if (level === "intention") {
    return `
      <div class="form-group">
        <label for="intentionTiny">Tiny version (optional)</label>
        <input
          type="text"
          id="intentionTiny"
          value="${escapeHtml(meta?.tinyVersion ?? "")}"
        />
      </div>
    `;
  }

  if (level === "milestone") {
    return `
      ${renderEmojiInput(
        "milestoneIcon",
        "Milestone emoji (optional)",
        icon ?? "",
      )}
    `;
  }

  return "";
}

function normalizeValue(
  value: string | boolean | undefined,
): string | boolean | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length === 0 ? undefined : trimmed;
  }
  if (value === false) {
    return undefined;
  }
  return value;
}

function mergeMeta(base: GoalMeta, updates: Partial<GoalMeta>): GoalMeta {
  const result: GoalMeta = { ...base };
  (Object.keys(updates) as (keyof GoalMeta)[]).forEach((key) => {
    const updated = normalizeValue(updates[key]);
    if (updated === undefined) {
      delete result[key];
    } else {
      (result as any)[key] = updated;
    }
  });
  return result;
}

export function setupEnergyMetaPanel(
  container: HTMLElement | null,
  opts: EnergyMetaPanelSetupOptions,
): void {
  if (!container) return;
  const { level, onChange, getMeta, onRequestRerender, onIconChange } = opts;

  const update = (updates: Partial<GoalMeta>, rerender = false) => {
    const baseMeta = getMeta();
    const nextMeta = mergeMeta(baseMeta, updates);
    onChange(nextMeta);
    if (rerender) {
      onRequestRerender?.();
    }
  };

  if (level === "vision") {
    const accent = container.querySelector<HTMLSelectElement>("#visionAccent");
    const iconInput = container.querySelector<HTMLInputElement>("#visionIcon");

    // Handle accent theme change
    accent?.addEventListener("change", () => {
      update(
        {
          accentTheme: accent.value ? (accent.value as AccentTheme) : undefined,
        },
        false,
      );
    });

    setupEmojiField(iconInput, onIconChange);
    return;
  }

  if (level === "milestone") {
    const iconInput =
      container.querySelector<HTMLInputElement>("#milestoneIcon");
    setupEmojiField(iconInput, onIconChange);
    return;
  }

  if (level === "focus") {
    const easyMode =
      container.querySelector<HTMLInputElement>("#focusEasyMode");
    const lowEnergy =
      container.querySelector<HTMLTextAreaElement>("#focusLowEnergy");
    const iconInput = container.querySelector<HTMLInputElement>("#focusIcon");

    easyMode?.addEventListener("change", () => {
      update({ easyMode: easyMode.checked ? true : undefined }, true);
    });

    lowEnergy?.addEventListener("input", () => {
      update({ lowEnergyVersion: lowEnergy.value }, false);
    });

    setupEmojiField(iconInput, onIconChange);
    return;
  }

  if (level === "intention") {
    const tiny = container.querySelector<HTMLInputElement>("#intentionTiny");
    tiny?.addEventListener("input", () => {
      update({ tinyVersion: tiny.value }, false);
    });
  }
}

function setupEmojiField(
  iconInput: HTMLInputElement | null,
  onIconChange?: (icon: string) => void,
) {
  if (iconInput) {
    // Remove readonly on focus to allow input
    iconInput.addEventListener("focus", () => {
      iconInput.removeAttribute("readonly");
    });

    // Re-add readonly on blur to maintain tap-to-open behavior
    iconInput.addEventListener("blur", () => {
      iconInput.setAttribute("readonly", "");
    });

    // Handle icon input change
    iconInput.addEventListener("input", () => {
      onIconChange?.(iconInput.value);
    });
  }
}
