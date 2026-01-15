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
  icon?: string;
};

export type EnergyMetaPanelSetupOptions = EnergyMetaPanelOptions & {
  onChange: (nextMeta: GoalMeta) => void;
  getMeta: () => GoalMeta;
  onRequestRerender?: () => void;
  onIconChange?: (icon: string) => void;
};

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
      <div class="form-group">
        <label for="visionIcon">Vision emoji (optional)</label>
        <div class="vision-icon-input-group">
          <input
            type="text"
            id="visionIcon"
            class="modal-input"
            placeholder="✨"
            maxlength="2"
            value="${escapeHtml(icon ?? "")}"
            inputmode="emoji"
            pattern="[\\p{Emoji}]{1,2}"
            title="Click to open emoji keyboard"
          />
          <button type="button" class="vision-emoji-keyboard-btn" aria-label="Open emoji keyboard">
            😊
          </button>
        </div>
        <div class="vision-icon-presets">
          <button type="button" class="icon-preset-btn" data-icon="✨">✨</button>
          <button type="button" class="icon-preset-btn" data-icon="🎯">🎯</button>
          <button type="button" class="icon-preset-btn" data-icon="🚀">🚀</button>
          <button type="button" class="icon-preset-btn" data-icon="💎">💎</button>
          <button type="button" class="icon-preset-btn" data-icon="🌟">🌟</button>
          <button type="button" class="icon-preset-btn" data-icon="🔥">🔥</button>
          <button type="button" class="icon-preset-btn" data-icon="🎨">🎨</button>
          <button type="button" class="icon-preset-btn" data-icon="🌱">🌱</button>
        </div>
      </div>
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
          meta?.lowEnergyVersion ?? ""
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

  return "";
}

function normalizeValue(
  value: string | boolean | undefined
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
  opts: EnergyMetaPanelSetupOptions
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

    accent?.addEventListener("change", () => {
      update(
        {
          accentTheme: accent.value ? (accent.value as AccentTheme) : undefined,
        },
        false
      );
    });

    iconInput?.addEventListener("input", () => {
      onIconChange?.(iconInput.value);
    });

    const emojiKeyboardBtn = container.querySelector(
      ".vision-emoji-keyboard-btn"
    ) as HTMLElement;

    emojiKeyboardBtn?.addEventListener("click", () => {
      if (iconInput) {
        iconInput.focus();
        (iconInput as any).showPicker?.();
      }
    });

    container.querySelectorAll(".icon-preset-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const icon = (btn as HTMLElement).dataset.icon;
        if (iconInput && icon) {
          iconInput.value = icon;
          onIconChange?.(icon);
        }
      });
    });

    return;
  }

  if (level === "focus") {
    const easyMode =
      container.querySelector<HTMLInputElement>("#focusEasyMode");
    const lowEnergy =
      container.querySelector<HTMLTextAreaElement>("#focusLowEnergy");

    easyMode?.addEventListener("change", () => {
      update({ easyMode: easyMode.checked ? true : undefined }, true);
    });

    lowEnergy?.addEventListener("input", () => {
      update({ lowEnergyVersion: lowEnergy.value }, false);
    });
    return;
  }

  if (level === "intention") {
    const tiny = container.querySelector<HTMLInputElement>("#intentionTiny");
    tiny?.addEventListener("input", () => {
      update({ tinyVersion: tiny.value }, false);
    });
  }
}
