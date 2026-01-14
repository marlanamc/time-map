/**
 * CustomizationPanel - Slide-in panel for editing custom intentions
 * @remarks Provides CRUD interface for managing user's custom intentions
 */

import type { CustomIntention, Category } from "../../types";
import { IntentionsManager } from "../../core/IntentionsManager";
import { CONFIG } from "../../config/constants";
import { UI } from "../../ui/UIManager";
import { refreshIntentionsGrid } from "./IntentionsGrid";

/**
 * Escape HTML to prevent XSS
 * @param text - Text to escape
 * @returns Escaped text
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Render the customization panel
 * @param intentions - Current intentions to display
 * @returns HTML string for the panel
 */
export function renderCustomizationPanel(intentions?: CustomIntention[]): string {
  const items = intentions || IntentionsManager.getSorted();

  return `
    <div class="customization-panel-backdrop" data-panel-visible="false">
      <div class="customization-panel" role="dialog" aria-labelledby="panel-title" aria-modal="true">
        <div class="panel-header">
          <h2 id="panel-title" class="panel-title">Customize quick intentions</h2>
          <button
            type="button"
            class="panel-close-btn"
            aria-label="Close customization panel"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>

        <div class="panel-content">
          <section class="intention-form">
            <header class="form-section-heading">
              <h3 class="form-section-title">Add New Quick Intention</h3>
            </header>
            <div class="form-grid">
              <div class="form-field">
                <label for="intention-title" class="form-label">Title</label>
                <input
                  type="text"
                  id="intention-title"
                  class="form-input"
                  placeholder="e.g., Deep work, Email admin"
                  maxlength="50"
                  required
                />
              </div>

              <div class="form-field form-field-emoji">
                <label for="intention-emoji" class="form-label">Emoji</label>
                <div class="emoji-picker-control">
                  <input
                    type="text"
                    id="intention-emoji"
                    class="form-input emoji-input"
                    placeholder="🎯"
                    maxlength="2"
                  />
                  <button type="button" class="emoji-picker-btn" aria-label="Choose emoji">
                    😊
                  </button>
                </div>
              </div>

              <div class="form-field">
                <label for="intention-category" class="form-label">Category</label>
                <select id="intention-category" class="form-select">
                  ${renderCategoryOptions()}
                </select>
              </div>

              <div class="form-field">
                <label for="intention-duration" class="form-label">Duration (minutes)</label>
                <input
                  type="number"
                  id="intention-duration"
                  class="form-input"
                  placeholder="60"
                  min="5"
                  max="480"
                  step="5"
                  required
                />
              </div>
            </div>

            <div class="form-actions">
              <button type="button" class="btn-add-intention-submit">
                <span aria-hidden="true">+</span>
                Add quick intention
              </button>
            </div>
          </section>

          <section class="intentions-list-section">
            <div class="intentions-list-header">
              <h3 class="form-section-title">Your Quick Intentions</h3>
              <span class="intentions-count">${items.length}</span>
            </div>
            <div class="intentions-sortable-list" data-sortable="true">
              ${renderSortableIntentions(items)}
            </div>
          </section>
        </div>

        <div class="panel-footer">
          <button type="button" class="panel-btn panel-btn-secondary btn-panel-cancel">
            Cancel
          </button>
          <button type="button" class="panel-btn panel-btn-primary btn-panel-save">
            Save Changes
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
    .join('');
}

/**
 * Render emoji picker grid
 * @returns HTML string for emoji picker
 */
function renderEmojiPicker(): string {
  const commonEmojis = [
    '🎯', '💼', '📧', '📚', '✍️', '💡', '🧘', '🏃', '🍎', '☕',
    '🎨', '🎵', '📱', '💻', '🗣️', '👥', '🏠', '🌟', '⚡', '🔥',
    '📝', '📊', '🎓', '🔬', '🛠️', '🎯', '🌱', '🧠', '❤️', '✨',
    '🚀', '⏰', '📅', '🎉', '🎁', '🏆', '💪', '🙏', '😊', '🌈'
  ];

  return `
    <div class="emoji-picker-grid">
      ${commonEmojis.map(emoji => `
        <button type="button" class="emoji-option" data-emoji="${emoji}">
          ${emoji}
        </button>
      `).join('')}
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
    .join('');
}

/**
 * Render a single sortable intention item
 * @param intention - Intention to render
 * @param index - Position in list
 * @returns HTML string for intention item
 */
function renderSortableIntention(intention: CustomIntention, index: number): string {
  const emoji = intention.emoji || CONFIG.CATEGORIES[intention.category as keyof typeof CONFIG.CATEGORIES]?.emoji || '📍';
  const categoryLabel = CONFIG.CATEGORIES[intention.category as keyof typeof CONFIG.CATEGORIES]?.label || 'General';

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
          <span class="intention-item-title">${escapeHtml(intention.title)}</span>
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
  const backdrop = container.querySelector('.customization-panel-backdrop') as HTMLElement;
  if (!backdrop) return;

  const panel = backdrop.querySelector('.customization-panel') as HTMLElement | null;

  backdrop.dataset.panelVisible = 'true';
  backdrop.classList.add('visible');
  panel?.classList.add('visible');

  // Focus the first input
  const firstInput = backdrop.querySelector('#intention-title') as HTMLInputElement;
  if (firstInput) {
    setTimeout(() => firstInput.focus(), 300); // After animation
  }

  // Trap focus within panel
  trapFocus(backdrop);
}

/**
 * Close the customization panel
 * @param container - Root container element
 * @param shouldSave - Whether to save changes
 */
export function closeCustomizationPanel(container: HTMLElement, shouldSave: boolean = false): void {
  const backdrop = container.querySelector('.customization-panel-backdrop') as HTMLElement;
  if (!backdrop) return;

  const panel = backdrop.querySelector('.customization-panel') as HTMLElement | null;

  if (shouldSave) {
    // Changes are already saved via IntentionsManager throughout editing
    UI.showToast('✅ Quick intentions saved!', 'success');
  }

  backdrop.dataset.panelVisible = 'false';
  backdrop.classList.remove('visible');
  panel?.classList.remove('visible');

    // Clear form
    const form = backdrop.querySelector('.intention-form') as HTMLElement;
    if (form) {
      const titleInput = form.querySelector('#intention-title') as HTMLInputElement;
      const emojiInput = form.querySelector('#intention-emoji') as HTMLInputElement;
      const categorySelect = form.querySelector('#intention-category') as HTMLSelectElement;
      const durationInput = form.querySelector('#intention-duration') as HTMLInputElement;

      if (titleInput) titleInput.value = '';
      if (emojiInput) emojiInput.value = '';
      if (categorySelect) categorySelect.selectedIndex = 0;
      if (durationInput) durationInput.value = '';

      // Reset button text
      const addBtn = form.querySelector('.btn-add-intention-submit') as HTMLElement;
      if (addBtn) {
        addBtn.innerHTML = '<span aria-hidden="true">+</span> Add quick intention';
      }
    }
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
  const lastFocusable = focusableElements[focusableElements.length - 1] as HTMLElement;

  element.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;

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
  element.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const container = element.closest('.planner-day-view') as HTMLElement;
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
  let editingIntentionId: string | null = null;

  // Open panel button (handled in IntentionsGrid setup)
  // Close panel
  container.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    // Close button
    const closeBtn = target.closest('.panel-close-btn, .btn-panel-cancel') as HTMLElement;
    if (closeBtn) {
      closeCustomizationPanel(container, false);
      return;
    }

    // Save button
    const saveBtn = target.closest('.btn-panel-save') as HTMLElement;
    if (saveBtn) {
      closeCustomizationPanel(container, true);
      if (onIntentionsChanged) onIntentionsChanged();
      return;
    }

    // Backdrop click to close
    const backdrop = target.closest('.customization-panel-backdrop') as HTMLElement;
    if (backdrop && target === backdrop) {
      closeCustomizationPanel(container, false);
      return;
    }
  });

  // Add new intention
  container.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const addBtn = target.closest('.btn-add-intention-submit') as HTMLElement;
    if (!addBtn) return;

    const form = container.querySelector('.intention-form') as HTMLElement;
    if (!form) return;

    const titleInput = form.querySelector('#intention-title') as HTMLInputElement;
    const emojiInput = form.querySelector('#intention-emoji') as HTMLInputElement;
    const categorySelect = form.querySelector('#intention-category') as HTMLSelectElement;
    const durationInput = form.querySelector('#intention-duration') as HTMLInputElement;

    // Validation
    if (!titleInput.value.trim()) {
      UI.showToast('⚠️ Please enter a title', 'error');
      titleInput.focus();
      return;
    }

    if (!durationInput.value || parseInt(durationInput.value) < 5) {
      UI.showToast('⚠️ Duration must be at least 5 minutes', 'error');
      durationInput.focus();
      return;
    }

    // Check if we're editing an existing intention
    if (editingIntentionId) {
      // Update existing intention
      const updates: Partial<CustomIntention> = {
        title: titleInput.value.trim(),
        category: categorySelect.value as Category,
        duration: parseInt(durationInput.value),
        emoji: emojiInput.value.trim() || undefined,
      };

      if (IntentionsManager.update(editingIntentionId, updates)) {
        UI.showToast('✅ Quick intention updated!', 'success');

        // Clear form
        titleInput.value = '';
        emojiInput.value = '';
        categorySelect.selectedIndex = 0;
        durationInput.value = '';
        editingIntentionId = null;

        // Reset button text
        const addBtn = container.querySelector('.btn-add-intention-submit') as HTMLElement;
        if (addBtn) {
          addBtn.innerHTML = '<span aria-hidden="true">+</span> Add quick intention';
        }

        // Refresh the sortable list in the customization panel
        refreshIntentionsList(container);

        // Refresh the main intentions grid in the sidebar without closing the panel
        refreshIntentionsGrid(container);

        // Optionally notify parent component, but don't trigger full re-render
        // if (onIntentionsChanged) onIntentionsChanged();
      } else {
        UI.showToast('❌ Failed to update quick intention', 'error');
      }
    } else {
      const created = IntentionsManager.add(
        titleInput.value.trim(),
        categorySelect.value as Category,
        parseInt(durationInput.value),
        emojiInput.value.trim() || undefined
      );

      if (created) {
        UI.showToast('✅ Quick intention added!', 'success');

        // Clear form
        titleInput.value = '';
        emojiInput.value = '';
        categorySelect.selectedIndex = 0;
        durationInput.value = '';
        editingIntentionId = null;

        // Refresh the sortable list in the customization panel
        refreshIntentionsList(container);

        // Refresh the main intentions grid in the sidebar without closing the panel
        refreshIntentionsGrid(container);

        // Optionally notify parent component, but don't trigger full re-render
        // if (onIntentionsChanged) onIntentionsChanged();
      } else {
        UI.showToast('❌ Failed to add quick intention', 'error');
      }
    }
  });

  // Edit intention (populate form)
  container.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
  const editBtn = target.closest('.btn-edit-intention') as HTMLElement;
  if (!editBtn) return;

    const intentionId = editBtn.dataset.intentionId;
    if (!intentionId) return;

    const intention = IntentionsManager.getById(intentionId);
    if (!intention) return;

    // Populate form
    const form = container.querySelector('.intention-form') as HTMLElement;
    if (!form) return;

    const titleInput = form.querySelector('#intention-title') as HTMLInputElement;
    const emojiInput = form.querySelector('#intention-emoji') as HTMLInputElement;
    const categorySelect = form.querySelector('#intention-category') as HTMLSelectElement;
    const durationInput = form.querySelector('#intention-duration') as HTMLInputElement;

    if (titleInput) titleInput.value = intention.title;
    if (emojiInput) emojiInput.value = intention.emoji || '';
    if (categorySelect) {
      if (intention.category) {
        categorySelect.value = intention.category;
      } else {
        categorySelect.selectedIndex = 0;
      }
    }
    if (durationInput) durationInput.value = intention.duration.toString();

    // Track that we're editing this intention
    editingIntentionId = intentionId;

    // Update button text to indicate editing
    const addBtn = container.querySelector('.btn-add-intention-submit') as HTMLElement;
    if (addBtn) {
      const plusSpan = addBtn.querySelector('span[aria-hidden="true"]');
      if (plusSpan) {
        addBtn.innerHTML = '<span aria-hidden="true">✏️</span> Update quick intention';
      }
    }

    // Focus title input
    titleInput?.focus();
    titleInput?.select();
  });

  // Delete intention
  container.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const deleteBtn = target.closest('.btn-delete-intention') as HTMLElement;
    if (!deleteBtn) return;

    e.stopPropagation();
    const intentionId = deleteBtn.dataset.intentionId;
    if (!intentionId) return;

      const confirmed = window.confirm
        ? window.confirm('Delete this quick intention?')
        : true;
    if (!confirmed) return;

    if (IntentionsManager.delete(intentionId)) {
      UI.showToast('🗑️ Quick intention removed', 'success');

      // Refresh the sortable list in the customization panel
      refreshIntentionsList(container);

      // Refresh the main intentions grid in the sidebar without closing the panel
      refreshIntentionsGrid(container);

      // Optionally notify parent component, but don't trigger full re-render
      // if (onIntentionsChanged) onIntentionsChanged();
    } else {
      UI.showToast('❌ Failed to delete quick intention', 'error');
    }
  });

  // Emoji picker
  container.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    // Toggle emoji picker
    const pickerBtn = target.closest('.emoji-picker-btn') as HTMLElement;
    if (pickerBtn) {
      const picker = container.querySelector('.emoji-picker-dropdown') as HTMLElement;
      if (picker) {
        picker.hidden = !picker.hidden;

        // Position near button
        const rect = pickerBtn.getBoundingClientRect();
        picker.style.position = 'fixed';
        picker.style.top = `${rect.bottom + 4}px`;
        picker.style.left = `${rect.left}px`;
      }
      return;
    }

    // Select emoji
    const emojiOption = target.closest('.emoji-option') as HTMLElement;
    if (emojiOption) {
      const emoji = emojiOption.dataset.emoji;
      const emojiInput = container.querySelector('#intention-emoji') as HTMLInputElement;
      if (emojiInput && emoji) {
        emojiInput.value = emoji;
      }

      const picker = container.querySelector('.emoji-picker-dropdown') as HTMLElement;
      if (picker) picker.hidden = true;
      return;
    }
  });

  // Close emoji picker when clicking outside
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const picker = container.querySelector('.emoji-picker-dropdown') as HTMLElement;
    const pickerBtn = container.querySelector('.emoji-picker-btn') as HTMLElement;

    if (picker && !picker.hidden && !picker.contains(target) && target !== pickerBtn) {
      picker.hidden = true;
    }
  });

  // Drag and drop reordering
  container.addEventListener('dragstart', (e) => {
    const target = e.target as HTMLElement;
    const item = target.closest('.sortable-intention-item') as HTMLElement;
    if (!item) return;

    draggedElement = item;
    item.classList.add('dragging');

    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/html', item.innerHTML);
    }
  });

  container.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (!draggedElement) return;

    const target = e.target as HTMLElement;
    const item = target.closest('.sortable-intention-item') as HTMLElement;
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

  container.addEventListener('dragend', (_e) => {
    if (!draggedElement) return;

    draggedElement.classList.remove('dragging');

    // Update order in IntentionsManager
    const list = container.querySelector('.intentions-sortable-list') as HTMLElement;
    if (list) {
      const items = Array.from(list.querySelectorAll('.sortable-intention-item')) as HTMLElement[];
      const newOrder = items
        .map(item => item.dataset.intentionId)
        .filter(id => id) as string[];

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
  const list = container.querySelector('.intentions-sortable-list') as HTMLElement;
  if (!list) return;

  const intentions = IntentionsManager.getSorted();
  list.innerHTML = renderSortableIntentions(intentions);

  // Update count
  const count = container.querySelector('.intentions-count') as HTMLElement;
  if (count) {
    count.textContent = intentions.length.toString();
  }
}
