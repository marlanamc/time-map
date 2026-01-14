/**
 * QuickAdd - Fast intention creation overlay
 *
 * Responsibilities:
 * - Display lightweight overlay for quick intention entry
 * - Create intention goals with minimal friction
 * - Provide keyboard shortcuts (Enter to save, Esc to cancel)
 */

import { Goals } from '../../core/Goals';
import { State } from "../../core/State";
import type { Category, GoalLevel, GoalMeta } from "../../types";
import { CONFIG } from "../../config";
import {
  renderAccordionSection,
  setupAccordionSectionToggles,
} from "../../components/modals/shared/AccordionSection";
import { renderLinkagePicker } from "../../components/modals/shared/LinkagePicker";
import {
  renderEnergyMetaPanel,
  setupEnergyMetaPanel,
} from "../../components/modals/shared/EnergyMetaPanel";
import {
  setupActivityPicker,
} from "../../components/modals/shared/ActivityPicker";

export interface QuickAddCallbacks {
  onRender: () => void;
  onToast: (icon: string, message: string) => void;
  onCelebrate: (icon: string, title: string, message: string) => void;
}

export type QuickAddOptions = {
  /** Defaults to today (local). */
  startDate?: string;
  /** Optional linkage for the created intention. */
  parentId?: string | null;
  parentLevel?: GoalLevel | null;
  /** UI copy overrides (kept lightweight). */
  label?: string;
  placeholder?: string;
  prefillTitle?: string;
  showTinyField?: boolean;
  tinyLabel?: string;
  tinyPlaceholder?: string;
};

class QuickAddManager {
  private callbacks: QuickAddCallbacks | null = null;
  private quickAddMetaDraft: GoalMeta = {};
  private quickAddActivityId: string | null = null;
  private quickAddLinkSelection: { parentId: string; parentLevel: GoalLevel } | null = null;
  private quickAddCategory: Category | null = null;

  /**
   * Set callbacks for QuickAdd interactions
   */
  setCallbacks(callbacks: QuickAddCallbacks): void {
    this.callbacks = callbacks;
  }

  /**
   * Show the Quick Add overlay
   */
  show(opts?: QuickAddOptions): void {
    if (!this.callbacks) {
      console.error('QuickAdd callbacks not set');
      return;
    }

    const overlay = document.createElement("div");
    overlay.className = "quick-add-overlay";

    const label = opts?.label ?? "Quick intention";
    const placeholder = opts?.placeholder ?? "What's one small thing?";
    overlay.innerHTML = `
      <div class="quick-add-container">
        <div class="quick-add-header">
          <span class="quick-add-emoji">🌱</span>
          <span class="quick-add-label">${label}</span>
        </div>
        <input type="text" id="quickAddInput" placeholder="${placeholder}" autocomplete="off" autocapitalize="sentences" spellcheck="true" autofocus>
        <div id="quickAddAccordionContainer" class="quick-add-accordion"></div>
        <div class="quick-add-tip">Press Enter to save • Esc to cancel</div>
      </div>
    `;

    document.body.appendChild(overlay);
    const input = overlay.querySelector("#quickAddInput") as HTMLInputElement;
    if (opts?.prefillTitle) input.value = opts.prefillTitle;
    input.focus();

    const accordionContainer = overlay.querySelector("#quickAddAccordionContainer") as HTMLElement | null;
    if (accordionContainer) {
      accordionContainer.innerHTML = renderAccordionSection({
        id: "quickAddMoreSection",
        title: "More (optional)",
        subtitle: "Details and context",
        bodyHtml: `
          <div id="quickAddLinkContainer"></div>
          <div id="quickAddEnergyContainer"></div>
          <div id="quickAddDetailsContainer"></div>
        `,
      });
      setupAccordionSectionToggles(accordionContainer);
      refreshMoreSection();
    }

    this.quickAddMetaDraft = {};
    this.quickAddActivityId = null;
    this.quickAddCategory = null;
    this.quickAddLinkSelection =
      opts?.parentId && opts.parentLevel
        ? { parentId: opts.parentId, parentLevel: opts.parentLevel }
        : null;

    const getVisions = () => {
      const year = State.viewingYear ?? new Date().getFullYear();
      return Goals.getForRange(new Date(year, 0, 1), new Date(year, 11, 31))
        .filter((g) => g.level === "vision" && g.status !== "done")
        .slice()
        .sort((a, b) => a.title.localeCompare(b.title))
        .map((g) => ({ id: g.id, title: g.title }));
    };

    const getMilestones = () =>
      Goals.getAll()
        .filter((g) => g.level === "milestone" && g.status !== "done")
        .slice()
        .sort((a, b) => a.title.localeCompare(b.title))
        .map((g) => ({ id: g.id, title: g.title }));

    const getFocuses = () => {
      const viewingDate = State.viewingDate ?? new Date();
      const wk = State.getWeekNumber(viewingDate);
      const wy = State.getWeekYear(viewingDate);
      const ws = State.getWeekStart(wy, wk);
      const we = new Date(ws);
      we.setDate(we.getDate() + 6);
      return Goals.getForRange(ws, we)
        .filter((g) => g.level === "focus" && g.status !== "done")
        .slice()
        .sort((a, b) => a.title.localeCompare(b.title))
        .map((g) => ({ id: g.id, title: g.title }));
    };

    const renderCategorySelect = () => {
      const options = Object.entries(CONFIG.CATEGORIES)
        .map(([key, meta]) => `<option value="${key}">${meta.label}</option>`)
        .join("");
      return `
        <div class="form-group">
          <label for="quickAddCategory">Category (optional)</label>
          <select id="quickAddCategory" class="modal-select">
            <option value=""${this.quickAddCategory ? "" : " selected"}>No category</option>
            ${options}
          </select>
        </div>
        <div class="form-group" id="quickAddActivitySlot"></div>
      `;
    };

    const attachLinkHandlers = (container: HTMLElement) => {
      container.querySelectorAll<HTMLElement>("[data-action='select-link']").forEach((btn) => {
        btn.onclick = (e) => {
          e.preventDefault();
          const parentId = (btn as HTMLElement).dataset.parentId;
          const parentLevel = (btn as HTMLElement).dataset.parentLevel as GoalLevel | undefined;
          if (!parentId || !parentLevel) return;
          this.quickAddLinkSelection = { parentId, parentLevel };
          refreshMoreSection();
        };
      });
      container.querySelectorAll<HTMLElement>("[data-action='clear-link']").forEach((btn) => {
        btn.onclick = (e) => {
          e.preventDefault();
          this.quickAddLinkSelection = null;
          refreshMoreSection();
        };
      });
      const linkSelect = container.querySelector<HTMLSelectElement>("#goalLinkSelect");
      if (linkSelect) {
        linkSelect.onchange = () => {
          const raw = linkSelect.value?.trim();
          if (!raw) {
            this.quickAddLinkSelection = null;
            refreshMoreSection();
            return;
          }
          const [parentLevel, parentId] = raw.split(":");
          if (!parentId) return;
          if (parentLevel === "vision" || parentLevel === "milestone" || parentLevel === "focus") {
            this.quickAddLinkSelection = { parentLevel: parentLevel as GoalLevel, parentId };
          }
          refreshMoreSection();
        };
      }
    };

    const refreshMoreSection = () => {
      const linkContainer = overlay.querySelector("#quickAddLinkContainer") as HTMLElement | null;
      if (linkContainer) {
        linkContainer.innerHTML = renderLinkagePicker({
          level: "intention",
          visions: getVisions(),
          milestones: getMilestones(),
          focuses: getFocuses(),
          selected: this.quickAddLinkSelection,
        });
        attachLinkHandlers(linkContainer);
      }

      const energyContainer = overlay.querySelector("#quickAddEnergyContainer") as HTMLElement | null;
      if (energyContainer) {
        energyContainer.innerHTML = renderEnergyMetaPanel({
          level: "intention",
          meta: this.quickAddMetaDraft,
        });
        setupEnergyMetaPanel(energyContainer, {
          level: "intention",
          meta: this.quickAddMetaDraft,
          getMeta: () => this.quickAddMetaDraft,
          onChange: (nextMeta) => {
            this.quickAddMetaDraft = nextMeta;
          },
          onRequestRerender: refreshMoreSection,
        });
      }

      const detailsContainer = overlay.querySelector("#quickAddDetailsContainer") as HTMLElement | null;
      if (detailsContainer) {
        detailsContainer.innerHTML = renderCategorySelect();
        const categorySelect = detailsContainer.querySelector<HTMLSelectElement>("#quickAddCategory");
        if (categorySelect) {
          categorySelect.value = this.quickAddCategory ?? "";
          categorySelect.onchange = () => {
            const raw = categorySelect.value;
            this.quickAddCategory =
              raw && raw in CONFIG.CATEGORIES ? (raw as Category) : null;
          };
        }
        const activitySlot = detailsContainer.querySelector("#quickAddActivitySlot");
        setupActivityPicker(activitySlot, {
          value: this.quickAddActivityId,
          onChange: (nextValue) => {
            this.quickAddActivityId = nextValue;
          },
        });
      }
    };

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && input.value.trim()) {
        this.save(input.value.trim(), {
          startDate: opts?.startDate,
          parentId: opts?.parentId,
          parentLevel: opts?.parentLevel,
        });
        overlay.remove();
      }
      if (e.key === "Escape") {
        overlay.remove();
      }
    });

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.remove();
    });
  }

  /**
   * Save a quick intention
   */
  private save(
    title: string,
    opts?: {
      startDate?: string;
      parentId?: string | null;
      parentLevel?: GoalLevel | null;
    },
  ): void {
    if (!this.callbacks) return;

    const selectedLink =
      this.quickAddLinkSelection ??
      (opts?.parentId
        ? { parentId: opts.parentId, parentLevel: opts.parentLevel ?? null }
        : null);
    const meta: GoalMeta | undefined =
      Object.keys(this.quickAddMetaDraft).length > 0 ? { ...this.quickAddMetaDraft } : undefined;

    Goals.create({
      title,
      level: "intention",
      description: "",
      startDate: opts?.startDate,
      parentId: selectedLink?.parentId ?? null,
      parentLevel: selectedLink?.parentLevel ?? null,
      meta,
      category: this.quickAddCategory ?? undefined,
      activityId: this.quickAddActivityId ?? null,
    });

    this.callbacks.onRender();
    this.callbacks.onToast("🌱", "Saved.");
    this.callbacks.onCelebrate("✨", "Captured", "One small step is enough.");
  }
}

// Export singleton instance
export const quickAdd = new QuickAddManager();
export default quickAdd;
