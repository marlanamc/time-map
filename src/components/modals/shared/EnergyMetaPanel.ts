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
};

export type EnergyMetaPanelSetupOptions = EnergyMetaPanelOptions & {
  onChange: (nextMeta: GoalMeta) => void;
  getMeta: () => GoalMeta;
  onRequestRerender?: () => void;
};

export function renderEnergyMetaPanel(opts: EnergyMetaPanelOptions): string {
  const { level, meta } = opts;

  if (level === "vision") {
    const options = themeOptions()
      .map(({ value, label }) => {
        const selected = meta?.accentTheme === value ? "selected" : "";
        return `<option value="${value}" ${selected}>${label}</option>`;
      })
      .join("");
    return `
      <div class="form-group">
        <label for="visionAccent">Vision color (optional)</label>
        <select id="visionAccent" class="modal-select">
          <option value=""${meta?.accentTheme ? "" : " selected"}>Default</option>
          ${options}
        </select>
        <div class="field-help">This color carries through linked milestones, focus, and intentions.</div>
      </div>
    `;
  }

  if (level === "focus") {
    return `
      <div class="form-group">
        <label class="toggle-label">
          <input type="checkbox" id="focusEasyMode"${meta?.easyMode ? " checked" : ""} />
          Easy mode week
        </label>
        <div class="field-help">Lower the bar on purpose.</div>
      </div>
      <div class="form-group">
        <label for="focusLowEnergy">Low-energy version (optional)</label>
        <textarea id="focusLowEnergy" rows="2" placeholder="If the week gets messy, what’s the smallest version that still counts?">${escapeHtml(
          meta?.lowEnergyVersion ?? "",
        )}</textarea>
        <div class="field-help">If the week gets messy, what’s the smallest version that still counts?</div>
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
          placeholder="If this feels like too much, what’s the smallest version?"
        />
        <div class="field-help">If this feels like too much, what’s the smallest version?</div>
      </div>
    `;
  }

  return "";
}

function normalizeValue(value: string | boolean | undefined): string | boolean | undefined {
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
      result[key] = updated as any;
    }
  });
  return result;
}

export function setupEnergyMetaPanel(
  container: HTMLElement | null,
  opts: EnergyMetaPanelSetupOptions,
): void {
  if (!container) return;
  const { level, onChange, getMeta, onRequestRerender } = opts;

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
    accent?.addEventListener("change", () => {
      update(
        {
          accentTheme: accent.value ? (accent.value as AccentTheme) : undefined,
        },
        false,
      );
    });
    return;
  }

  if (level === "focus") {
    const easyMode = container.querySelector<HTMLInputElement>("#focusEasyMode");
    const lowEnergy = container.querySelector<HTMLTextAreaElement>("#focusLowEnergy");

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
