import { ND_CONFIG } from "../../../config/ndConfig";
import type { AccentTheme, GoalLevel, GoalMeta } from "../../../types";

const COMMON_EMOJIS = [
  "🌟",
  "🎯",
  "🔭",
  "🍎",
  "🏃",
  "🧘",
  "🏠",
  "🎨",
  "💻",
  "📚",
  "❤️",
  "💰",
  "🌱",
  "✈️",
  "🎵",
  "📷",
  "🚀",
  "🌈",
  "🔥",
  "⚡",
  "🧩",
  "🛠️",
  "🤝",
  "📣",
];

function renderColorPicker(selectedTheme?: AccentTheme): string {
  const options = Object.entries(ND_CONFIG.ACCENT_THEMES)
    .filter(([key]) => key !== "rainbow")
    .map(([key, meta]) => {
      const isSelected = selectedTheme === key;
      return `
        <button 
          type="button" 
          class="color-swatch${isSelected ? " is-selected" : ""}" 
          data-theme="${key}"
          title="${meta.label}"
          style="background-color: ${meta.color}"
        ></button>
      `;
    })
    .join("");

  return `
    <div class="form-group">
      <label class="flat-section-title">Visual Identity</label>
      <label>Accent Color</label>
      <div class="color-picker-grid" id="visionColorPicker">
        ${options}
      </div>
    </div>
  `;
}

function renderEmojiPicker(level: GoalLevel, currentIcon: string): string {
  const grid = COMMON_EMOJIS.map((emoji) => {
    const isSelected = currentIcon === emoji;
    return `
      <button 
        type="button" 
        class="emoji-swatch${isSelected ? " is-selected" : ""}" 
        data-emoji="${emoji}"
      >${emoji}</button>
    `;
  }).join("");

  const label = level.charAt(0).toUpperCase() + level.slice(1) + " Emoji";
  const isCustom = currentIcon !== "" && !COMMON_EMOJIS.includes(currentIcon);

  return `
    <div class="form-group">
      <label>${label}</label>
      <div class="emoji-picker-container">
        <div class="emoji-grid" id="${level}EmojiPicker">
          ${grid}
        </div>
        <div class="custom-emoji-row">
          <input 
            type="text" 
            id="${level}CustomEmoji" 
            class="modal-input custom-emoji-input" 
            placeholder="Or type/paste any emoji..." 
            value="${isCustom ? currentIcon : ""}"
            maxlength="10"
          />
        </div>
      </div>
    </div>
  `;
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

export function renderEnergyMetaPanel(opts: EnergyMetaPanelOptions): string {
  const { level, meta, icon } = opts;

  if (level === "vision") {
    return `
      ${renderEmojiPicker("vision", icon ?? "")}
      ${renderColorPicker(meta?.accentTheme)}
    `;
  }

  if (level === "milestone") {
    return `
      ${renderEmojiPicker("milestone", icon ?? "")}
    `;
  }

  if (level === "focus") {
    return `
      ${renderEmojiPicker("focus", icon ?? "")}
    `;
  }

  if (level === "intention") {
    return `
      ${renderEmojiPicker("intention", icon ?? "")}
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

  // Helper to setup emoji grid clicks and custom input
  const setupEmojiGrid = (level: string) => {
    const grid = container.querySelector(`#${level}EmojiPicker`);
    const customInput = container.querySelector<HTMLInputElement>(
      `#${level}CustomEmoji`,
    );

    const updateSelection = (emoji: string) => {
      onIconChange?.(emoji);
      // Update grid selection
      grid?.querySelectorAll(".emoji-swatch").forEach((b) => {
        const isMatch = (b as HTMLElement).dataset.emoji === emoji;
        b.classList.toggle("is-selected", isMatch);
      });
      // Update custom input if the emoji is NOT in the grid or it's empty
      if (customInput && emoji !== customInput.value) {
        if (COMMON_EMOJIS.includes(emoji)) {
          customInput.value = "";
        } else {
          customInput.value = emoji;
        }
      }
    };

    grid?.querySelectorAll(".emoji-swatch").forEach((btn) => {
      btn.addEventListener("click", () => {
        const emoji = (btn as HTMLElement).dataset.emoji;
        if (emoji) {
          updateSelection(emoji);
        }
      });
    });

    customInput?.addEventListener("input", () => {
      const emoji = customInput.value.trim();
      updateSelection(emoji);
    });
  };

  if (level === "vision") {
    const colorPicker = container.querySelector("#visionColorPicker");
    colorPicker?.querySelectorAll(".color-swatch").forEach((btn) => {
      btn.addEventListener("click", () => {
        const theme = (btn as HTMLElement).dataset.theme as AccentTheme;
        update({ accentTheme: theme }, false);
        // Update visualization
        colorPicker
          .querySelectorAll(".color-swatch")
          .forEach((b) => b.classList.remove("is-selected"));
        btn.classList.add("is-selected");
      });
    });

    setupEmojiGrid("vision");
    return;
  }

  if (level === "milestone") {
    setupEmojiGrid("milestone");
    return;
  }

  if (level === "focus") {
    setupEmojiGrid("focus");
    return;
  }

  if (level === "intention") {
    setupEmojiGrid("intention");
    return;
  }
}
