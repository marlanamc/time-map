/**
 * CustomizationPanel - Slide-in panel for editing custom intentions
 * @remarks Provides CRUD interface for managing user's custom intentions
 * @remarks Uses progressive disclosure (accordions) for calm UX
 */

import type { CustomIntention, Category } from "../../types";
import { IntentionsManager } from "../../core/IntentionsManager";
import { CONFIG } from "../../config/constants";
import { UI } from "../../ui/UIManager";
import { refreshIntentionsGrid } from "./IntentionsGrid";
import { Goals } from "../../core/Goals";
import { State } from "../../core/State";
import {
  renderAccordionSection,
  setupAccordionSectionToggles,
} from "../modals/shared/AccordionSection";

// Track accordion states across panel opens
let addSectionOpen = true; // Default open on first visit
let listSectionOpen = false;
let hasOpenedOnce = false;

/**
 * Escape HTML to prevent XSS
 * @param text - Text to escape
 * @returns Escaped text
 */
function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Render the Add form body content (used inside accordion)
 */
function renderAddFormBody(): string {
  return `
    <div class="form-group">
      <label for="intention-title">Title</label>
      <input
        type="text"
        id="intention-title"
        maxlength="50"
        required
      />
    </div>

    <div class="form-group">
      <label for="intention-emoji">Emoji</label>
      <div class="emoji-picker-control">
        <input
          type="text"
          id="intention-emoji"
          placeholder="Icon"
          maxlength="2"
        />
        <button type="button" class="emoji-picker-btn" aria-label="Choose emoji">
          😊
        </button>
      </div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label for="intention-category">Category</label>
        <select id="intention-category">
          ${renderCategoryOptions()}
        </select>
      </div>

      <div class="form-group">
        <label for="intention-duration">Duration (min)</label>
        <input
          type="number"
          id="intention-duration"
          placeholder="60"
          min="5"
          max="480"
          step="5"
          required
        />
      </div>
    </div>

    <div class="form-group">
      <label for="intention-vision">Link to Vision (optional)</label>
      <select id="intention-vision">
        <option value="">No specific vision</option>
        ${renderVisionOptions()}
      </select>
    </div>

    <div class="intention-form-actions">
      <button type="button" class="btn btn-primary btn-add-intention-submit">
        + Add quick intention
      </button>
      <button type="button" class="btn btn-ghost btn-form-reset">
        Clear
      </button>
    </div>
  `;
}

/**
 * Render the list section body content (used inside accordion)
 */
function renderListBody(items: CustomIntention[]): string {
  return `
    <div class="intentions-list-hint">Drag to reorder</div>
    <div class="intentions-sortable-list" data-sortable="true">
      ${renderSortableIntentions(items)}
    </div>
  `;
}

/**
 * Render the customization panel
 * @param intentions - Current intentions to display
 * @returns HTML string for the panel
 */
export function renderCustomizationPanel(
  intentions?: CustomIntention[]
): string {
  const items = intentions || IntentionsManager.getSorted();

  // On first open, show Add section. Otherwise, show list if items exist.
  if (!hasOpenedOnce) {
    addSectionOpen = true;
    listSectionOpen = items.length > 0;
    hasOpenedOnce = true;
  }

  const addAccordion = renderAccordionSection({
    id: "panelAddSection",
    title: "Add a quick intention",
    subtitle: "Create a new template",
    open: addSectionOpen,
    bodyHtml: renderAddFormBody(),
  });

  const listAccordion = renderAccordionSection({
    id: "panelListSection",
    title: `Your quick intentions`,
    subtitle:
      items.length > 0 ? `${items.length} templates` : "No templates yet",
    open: listSectionOpen,
    bodyHtml: renderListBody(items),
  });

  return `
    <div class="modal-overlay intentions-modal-overlay" data-panel-visible="false">
      <div class="modal intentions-modal" role="dialog" aria-labelledby="intentions-modal-title" aria-modal="true">
        <div class="modal-header">
          <div class="modal-header-content">
            <h2 id="intentions-modal-title" class="modal-title">Quick intentions</h2>
            <p class="modal-subtitle">Templates for your daily planning</p>
          </div>
          <button type="button" class="modal-close" aria-label="Close" data-action="close-modal">
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <div class="modal-body">
          <div class="intentions-accordion-container" id="panelAccordionContainer">
            ${addAccordion}
            ${listAccordion}
          </div>
        </div>

        <div class="modal-actions">
          <button type="button" class="btn btn-ghost btn-panel-cancel" data-action="close-modal">
            Cancel
          </button>
          <button type="button" class="btn btn-primary btn-panel-save">
            Done
          </button>
        </div>
      </div>
    </div>

    <!-- Emoji picker dropdown (hidden by default) -->
    <div class="emoji-picker-dropdown" hidden>
      ${renderEmojiPicker()}
    </div>

  `;
}

/**
 * Render category options for dropdown
 * @returns HTML string for <option> elements
 */
function renderCategoryOptions(): string {
  const categories = Object.keys(CONFIG.CATEGORIES) as Array<
    keyof typeof CONFIG.CATEGORIES
  >;

  return categories
    .map((cat) => {
      const config = CONFIG.CATEGORIES[cat];
      return `<option value="${cat}">${config.emoji} ${config.label}</option>`;
    })
    .join("");
}

/**
 * Render vision options for dropdown
 * @returns HTML string for <option> elements
 */
function renderVisionOptions(): string {
  const year = State.viewingYear ?? new Date().getFullYear();
  const visions = Goals.getAll()
    .filter(g => g.level === "vision" && g.year === year)
    .sort((a, b) => a.title.localeCompare(b.title));

  return visions
    .map((vision) => {
      const emoji = vision.icon || "🌟";
      return `<option value="${vision.id}">${emoji} ${escapeHtml(vision.title)}</option>`;
    })
    .join("");
}

/**
 * Render emoji picker grid
 * @returns HTML string for emoji picker
 */
function renderEmojiPicker(): string {
  const commonEmojis = [
    "🎯",
    "💼",
    "📧",
    "📚",
    "✍️",
    "💡",
    "🧘",
    "🏃",
    "🍎",
    "☕",
    "🎨",
    "🎵",
    "📱",
    "💻",
    "🗣️",
    "👥",
    "🏠",
    "🌟",
    "⚡",
    "🔥",
    "📝",
    "📊",
    "🎓",
    "🔬",
    "🛠️",
    "🎯",
    "🌱",
    "🧠",
    "❤️",
    "✨",
    "🚀",
    "⏰",
    "📅",
    "🎉",
    "🎁",
    "🏆",
    "💪",
    "🙏",
    "😊",
    "🌈",
  ];

  return `
    <div class="emoji-picker-grid">
      ${commonEmojis
        .map(
          (emoji) => `
        <button type="button" class="emoji-option" data-emoji="${emoji}">
          ${emoji}
        </button>
      `
        )
        .join("")}
    </div>
  `;
}

/**
 * Render sortable intentions list
 * @param intentions - Intentions to render
 * @returns HTML string for sortable list
 */
function renderSortableIntentions(intentions: CustomIntention[]): string {
  if (intentions.length === 0) {
    return `
      <div class="intentions-empty">
        <p>No quick intentions yet. Add your first one above!</p>
      </div>
    `;
  }

  return intentions
    .map((intention, index) => renderSortableIntention(intention, index))
    .join("");
}

/**
 * Render a single sortable intention item
 * @param intention - Intention to render
 * @param index - Position in list
 * @returns HTML string for intention item
 */
function renderSortableIntention(
  intention: CustomIntention,
  index: number
): string {
  const emoji =
    intention.emoji ||
    CONFIG.CATEGORIES[intention.category as keyof typeof CONFIG.CATEGORIES]
      ?.emoji ||
    "📍";
  const categoryLabel =
    CONFIG.CATEGORIES[intention.category as keyof typeof CONFIG.CATEGORIES]
      ?.label || "General";

  return `
    <div
      class="sortable-intention-item"
      draggable="true"
      data-intention-id="${intention.id}"
      data-order="${index}"
    >
      <button type="button" class="drag-handle" aria-label="Drag to reorder">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="4" cy="4" r="1.5" fill="currentColor"/>
          <circle cx="4" cy="8" r="1.5" fill="currentColor"/>
          <circle cx="4" cy="12" r="1.5" fill="currentColor"/>
          <circle cx="12" cy="4" r="1.5" fill="currentColor"/>
          <circle cx="12" cy="8" r="1.5" fill="currentColor"/>
          <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
        </svg>
      </button>

      <div class="intention-item-content">
        <div class="intention-item-header">
          <span class="intention-item-emoji">${emoji}</span>
          <span class="intention-item-title">${escapeHtml(
            intention.title
          )}</span>
        </div>
        <div class="intention-item-meta">
          <span class="meta-category">${categoryLabel}</span>
          <span class="meta-duration">${intention.duration}m</span>
        </div>
      </div>

    <div class="intention-item-actions">
      <button
        type="button"
        class="btn-edit-intention"
        data-intention-id="${intention.id}"
        aria-label="Edit ${escapeHtml(intention.title)}"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M11.333 2L14 4.667l-9.334 9.333H2v-2.667L11.333 2z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <button
        type="button"
        class="btn-delete-intention"
        data-intention-id="${intention.id}"
        aria-label="Delete ${escapeHtml(intention.title)}"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M5 4h6M4 4h8l-1 10H5L4 4zM6 4V2h4v2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>
  </div>
`;
}

/**
 * Open the customization panel
 * @param container - Root container element
 */
export function openCustomizationPanel(container: HTMLElement): void {
  const overlay = container.querySelector(
    ".intentions-modal-overlay"
  ) as HTMLElement;
  if (!overlay) return;

  const modal = overlay.querySelector(
    ".intentions-modal"
  ) as HTMLElement | null;

  // Prevent body scroll
  document.body.style.overflow = "hidden";

  overlay.dataset.panelVisible = "true";
  overlay.classList.add("active");
  modal?.classList.add("active");

  // Set up accordion toggles
  const accordionContainer = overlay.querySelector(
    "#panelAccordionContainer"
  ) as HTMLElement | null;
  setupAccordionSectionToggles(accordionContainer, (id, open) => {
    if (id === "panelAddSection") {
      addSectionOpen = open;
    } else if (id === "panelListSection") {
      listSectionOpen = open;
    }
  });

  // Focus the first input if add section is open
  if (addSectionOpen) {
    const firstInput = overlay.querySelector(
      "#intention-title"
    ) as HTMLInputElement;
    if (firstInput) {
      setTimeout(() => firstInput.focus(), 300); // After animation
    }
  }

  // Trap focus within modal
  trapFocus(overlay);
}

/**
 * Clear the add form and reset editing state
 */
function clearAddForm(
  container: HTMLElement,
  editingIdRef: { current: string | null }
): void {
  const titleInput = container.querySelector(
    "#intention-title"
  ) as HTMLInputElement;
  const emojiInput = container.querySelector(
    "#intention-emoji"
  ) as HTMLInputElement;
  const categorySelect = container.querySelector(
    "#intention-category"
  ) as HTMLSelectElement;
  const durationInput = container.querySelector(
    "#intention-duration"
  ) as HTMLInputElement;
  const visionSelect = container.querySelector(
    "#intention-vision"
  ) as HTMLSelectElement;

  if (titleInput) titleInput.value = "";
  if (emojiInput) emojiInput.value = "";
  if (categorySelect) categorySelect.selectedIndex = 0;
  if (durationInput) durationInput.value = "";
  if (visionSelect) visionSelect.selectedIndex = 0;

  editingIdRef.current = null;

  // Reset button text
  const addBtn = container.querySelector(
    ".btn-add-intention-submit"
  ) as HTMLElement;
  if (addBtn) {
    addBtn.textContent = "+ Add quick intention";
  }
}

/**
 * Close the customization panel
 * @param container - Root container element
 * @param shouldSave - Whether to save changes
 */
export function closeCustomizationPanel(
  container: HTMLElement,
  shouldSave: boolean = false
): void {
  const overlay = container.querySelector(
    ".intentions-modal-overlay"
  ) as HTMLElement;
  if (!overlay) return;

  const modal = overlay.querySelector(
    ".intentions-modal"
  ) as HTMLElement | null;

  if (shouldSave) {
    // Changes are already saved via IntentionsManager throughout editing
    UI.showToast("Quick intentions saved!", "success");
  }

  // Restore body scroll
  document.body.style.overflow = "";

  overlay.dataset.panelVisible = "false";
  overlay.classList.remove("active");
  modal?.classList.remove("active");

  // Clear form with a dummy ref (actual ref managed by setupCustomizationPanel)
  clearAddForm(overlay, { current: null });
}

/**
 * Trap focus within an element (for accessibility)
 * @param element - Element to trap focus within
 */
function trapFocus(element: HTMLElement): void {
  const focusableElements = element.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const firstFocusable = focusableElements[0] as HTMLElement;
  const lastFocusable = focusableElements[
    focusableElements.length - 1
  ] as HTMLElement;

  element.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;

    if (e.shiftKey) {
      // Shift + Tab
      if (document.activeElement === firstFocusable) {
        e.preventDefault();
        lastFocusable.focus();
      }
    } else {
      // Tab
      if (document.activeElement === lastFocusable) {
        e.preventDefault();
        firstFocusable.focus();
      }
    }
  });

  // Close on Escape
  element.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      // Find parent container (day view)
      const container = element.closest(".planner-day-view") as HTMLElement;
      if (container) {
        closeCustomizationPanel(container, false);
      }
    }
  });
}

/**
 * Set up event listeners for customization panel
 * @param container - Container element
 * @param onIntentionsChanged - Callback when intentions are modified
 */
export function setupCustomizationPanel(
  container: HTMLElement,
  onIntentionsChanged?: () => void
): void {
  let draggedElement: HTMLElement | null = null;
  const editingIdRef = { current: null as string | null };

  // Open panel button (handled in IntentionsGrid setup)
  // Close panel
  container.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;

    // Close button (modal-close or btn-panel-cancel)
    const closeBtn = target.closest(
      '.modal-close, .btn-panel-cancel, [data-action="close-modal"]'
    ) as HTMLElement;
    if (closeBtn) {
      closeCustomizationPanel(container, false);
      return;
    }

    // Save button
    const saveBtn = target.closest(".btn-panel-save") as HTMLElement;
    if (saveBtn) {
      closeCustomizationPanel(container, true);
      if (onIntentionsChanged) onIntentionsChanged();
      return;
    }

    // Overlay click to close (click on overlay background, not on modal)
    const overlay = target.closest(".intentions-modal-overlay") as HTMLElement;
    if (overlay && target === overlay) {
      closeCustomizationPanel(container, false);
      return;
    }

    // Form reset button
    const resetBtn = target.closest(".btn-form-reset") as HTMLElement;
    if (resetBtn) {
      clearAddForm(container, editingIdRef);
      return;
    }
  });

  // Add new intention
  container.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const addBtn = target.closest(".btn-add-intention-submit") as HTMLElement;
    if (!addBtn) return;

    const titleInput = container.querySelector(
      "#intention-title"
    ) as HTMLInputElement;
    const emojiInput = container.querySelector(
      "#intention-emoji"
    ) as HTMLInputElement;
    const categorySelect = container.querySelector(
      "#intention-category"
    ) as HTMLSelectElement;
    const durationInput = container.querySelector(
      "#intention-duration"
    ) as HTMLInputElement;
    const visionSelect = container.querySelector(
      "#intention-vision"
    ) as HTMLSelectElement;

    if (!titleInput) return;

    // Validation
    if (!titleInput.value.trim()) {
      UI.showToast("⚠️ Please enter a title", "error");
      titleInput.focus();
      return;
    }

    if (!durationInput.value || parseInt(durationInput.value) < 5) {
      UI.showToast("⚠️ Duration must be at least 5 minutes", "error");
      durationInput.focus();
      return;
    }

    // Check if we're editing an existing intention
    if (editingIdRef.current) {
      // Update existing intention
      const updates: Partial<CustomIntention> = {
        title: titleInput.value.trim(),
        category: categorySelect.value as Category,
        duration: parseInt(durationInput.value),
        emoji: emojiInput.value.trim() || undefined,
        visionId: visionSelect.value || undefined,
      };

      if (IntentionsManager.update(editingIdRef.current, updates)) {
        UI.showToast("✅ Quick intention updated!", "success");

        // Clear form
        clearAddForm(container, editingIdRef);

        // Refresh the sortable list in the customization panel
        refreshIntentionsList(container);

        // Refresh the main intentions grid in the sidebar without closing the panel
        refreshIntentionsGrid(container);

        // Optionally notify parent component, but don't trigger full re-render
        // if (onIntentionsChanged) onIntentionsChanged();
      } else {
        UI.showToast("❌ Failed to update quick intention", "error");
      }
    } else {
      const created = IntentionsManager.add(
        titleInput.value.trim(),
        categorySelect.value as Category,
        parseInt(durationInput.value),
        emojiInput.value.trim() || undefined,
        visionSelect.value || undefined
      );

      if (created) {
        UI.showToast("✅ Quick intention added!", "success");

        // Clear form
        clearAddForm(container, editingIdRef);

        // Refresh the sortable list in the customization panel
        refreshIntentionsList(container);

        // Refresh the main intentions grid in the sidebar without closing the panel
        refreshIntentionsGrid(container);

        // Optionally notify parent component, but don't trigger full re-render
        // if (onIntentionsChanged) onIntentionsChanged();
      } else {
        UI.showToast("❌ Failed to add quick intention", "error");
      }
    }
  });

  // Edit intention (populate form)
  container.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const editBtn = target.closest(".btn-edit-intention") as HTMLElement;
    if (!editBtn) return;

    const intentionId = editBtn.dataset.intentionId;
    if (!intentionId) return;

    const intention = IntentionsManager.getById(intentionId);
    if (!intention) return;

    // Ensure Add section is open
    const addToggle = container.querySelector(
      '[data-accordion-id="panelAddSection"]'
    ) as HTMLButtonElement | null;
    const addBody = container.querySelector(
      "#panelAddSection-body"
    ) as HTMLElement | null;
    if (
      addToggle &&
      addBody &&
      addToggle.getAttribute("aria-expanded") === "false"
    ) {
      addToggle.setAttribute("aria-expanded", "true");
      addBody.hidden = false;
      addSectionOpen = true;
    }

    // Populate form
    const titleInput = container.querySelector(
      "#intention-title"
    ) as HTMLInputElement;
    const emojiInput = container.querySelector(
      "#intention-emoji"
    ) as HTMLInputElement;
    const categorySelect = container.querySelector(
      "#intention-category"
    ) as HTMLSelectElement;
    const durationInput = container.querySelector(
      "#intention-duration"
    ) as HTMLInputElement;
    const visionSelect = container.querySelector(
      "#intention-vision"
    ) as HTMLSelectElement;

    if (titleInput) titleInput.value = intention.title;
    if (emojiInput) emojiInput.value = intention.emoji || "";
    if (categorySelect) {
      if (intention.category) {
        categorySelect.value = intention.category;
      } else {
        categorySelect.selectedIndex = 0;
      }
    }
    if (durationInput) durationInput.value = intention.duration.toString();
    if (visionSelect) {
      if (intention.visionId) {
        visionSelect.value = intention.visionId;
      } else {
        visionSelect.selectedIndex = 0;
      }
    }

    // Track that we're editing this intention
    editingIdRef.current = intentionId;

    // Update button text to indicate editing
    const addBtn = container.querySelector(
      ".btn-add-intention-submit"
    ) as HTMLElement;
    if (addBtn) {
      addBtn.innerHTML =
        '<span aria-hidden="true">✏️</span> Update quick intention';
    }

    // Focus title input
    titleInput?.focus();
  });

  // Delete intention
  container.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const deleteBtn = target.closest(".btn-delete-intention") as HTMLElement;
    if (!deleteBtn) return;

    e.stopPropagation();
    const intentionId = deleteBtn.dataset.intentionId;
    if (!intentionId) return;

    // Simple confirmation dialog
    const confirmed = window.confirm
      ? window.confirm("Delete this quick intention?")
      : true;
    if (!confirmed) return;

    // Temporary fix: If IDs don't match, reset intentions to get consistent IDs
    const currentIntentions = IntentionsManager.getSorted();
    const intentionExists = currentIntentions.some((i) => i.id === intentionId);
    if (!intentionExists) {
      console.log("⚠️ Intention ID mismatch detected! Resetting intentions...");
      IntentionsManager.reset();

      // Refresh the UI with the new consistent IDs
      refreshIntentionsList(container);
      refreshIntentionsGrid(container);
      UI.showToast("🔄 Intentions reset for consistency", "info");
      return;
    }

    if (IntentionsManager.delete(intentionId)) {
      UI.showToast("🗑️ Quick intention removed", "success");

      // Refresh the sortable list in the customization panel
      refreshIntentionsList(container);

      // Refresh the main intentions grid in the sidebar without closing the panel
      refreshIntentionsGrid(container);

      // Optionally notify parent component, but don't trigger full re-render
      // if (onIntentionsChanged) onIntentionsChanged();
    } else {
      UI.showToast("❌ Failed to delete quick intention", "error");
    }
  });

  // Emoji picker
  container.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;

    // Toggle emoji picker
    const pickerBtn = target.closest(".emoji-picker-btn") as HTMLElement;
    if (pickerBtn) {
      const picker = container.querySelector(
        ".emoji-picker-dropdown"
      ) as HTMLElement;
      if (picker) {
        picker.hidden = !picker.hidden;

        // Position near button
        const rect = pickerBtn.getBoundingClientRect();
        picker.style.position = "fixed";
        picker.style.top = `${rect.bottom + 4}px`;
        picker.style.left = `${rect.left}px`;
      }
      return;
    }

    // Select emoji
    const emojiOption = target.closest(".emoji-option") as HTMLElement;
    if (emojiOption) {
      const emoji = emojiOption.dataset.emoji;
      const emojiInput = container.querySelector(
        "#intention-emoji"
      ) as HTMLInputElement;
      if (emojiInput && emoji) {
        emojiInput.value = emoji;
      }

      const picker = container.querySelector(
        ".emoji-picker-dropdown"
      ) as HTMLElement;
      if (picker) picker.hidden = true;
      return;
    }
  });

  // Close emoji picker when clicking outside
  document.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const picker = container.querySelector(
      ".emoji-picker-dropdown"
    ) as HTMLElement;
    const pickerBtn = container.querySelector(
      ".emoji-picker-btn"
    ) as HTMLElement;

    if (
      picker &&
      !picker.hidden &&
      !picker.contains(target) &&
      target !== pickerBtn
    ) {
      picker.hidden = true;
    }
  });

  // Drag and drop reordering
  container.addEventListener("dragstart", (e) => {
    const target = e.target as HTMLElement;
    const item = target.closest(".sortable-intention-item") as HTMLElement;
    if (!item) return;

    draggedElement = item;
    item.classList.add("dragging");

    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/html", item.innerHTML);
    }
  });

  container.addEventListener("dragover", (e) => {
    e.preventDefault();
    if (!draggedElement) return;

    const target = e.target as HTMLElement;
    const item = target.closest(".sortable-intention-item") as HTMLElement;
    if (!item || item === draggedElement) return;

    const list = item.parentElement;
    if (!list) return;

    const rect = item.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;

    if (e.clientY < midpoint) {
      list.insertBefore(draggedElement, item);
    } else {
      list.insertBefore(draggedElement, item.nextSibling);
    }
  });

  container.addEventListener("dragend", (_e) => {
    if (!draggedElement) return;

    draggedElement.classList.remove("dragging");

    // Update order in IntentionsManager
    const list = container.querySelector(
      ".intentions-sortable-list"
    ) as HTMLElement;
    if (list) {
      const items = Array.from(
        list.querySelectorAll(".sortable-intention-item")
      ) as HTMLElement[];
      const newOrder = items
        .map((item) => item.dataset.intentionId)
        .filter((id) => id) as string[];

      IntentionsManager.reorder(newOrder);

      // Refresh the sortable list in the customization panel
      refreshIntentionsList(container);

      // Refresh the main intentions grid in the sidebar without closing the panel
      refreshIntentionsGrid(container);

      // Optionally notify parent component, but don't trigger full re-render
      // if (onIntentionsChanged) onIntentionsChanged();
    }

    draggedElement = null;
  });
}

/**
 * Refresh the intentions list in the panel
 * @param container - Container element
 */
function refreshIntentionsList(container: HTMLElement): void {
  const list = container.querySelector(
    ".intentions-sortable-list"
  ) as HTMLElement;
  if (!list) return;

  const intentions = IntentionsManager.getSorted();
  list.innerHTML = renderSortableIntentions(intentions);

  // Update the accordion subtitle with the count
  const listSubtitle = container.querySelector(
    "#panelListSection .modal-disclosure-subtitle"
  ) as HTMLElement;
  if (listSubtitle) {
    listSubtitle.textContent =
      intentions.length > 0
        ? `${intentions.length} templates`
        : "No templates yet";
  }
}
