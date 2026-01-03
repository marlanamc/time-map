/**
 * SidebarSection - Generic collapsible section wrapper
 * @remarks Provides collapsible functionality with state persistence
 */

/**
 * Render a collapsible sidebar section
 * @param id - Unique section ID for state persistence
 * @param title - Section title
 * @param content - HTML content for the section
 * @param iconEmoji - Optional emoji icon
 * @param badge - Optional badge count
 * @param isCollapsed - Whether the section is currently collapsed
 * @param actions - Optional action buttons HTML (e.g., Edit button)
 * @returns HTML string for the section
 */
export function renderSidebarSection(
  id: string,
  title: string,
  content: string,
  options?: {
    iconEmoji?: string;
    badge?: number;
    isCollapsed?: boolean;
    actions?: string;
  }
): string {
  const { iconEmoji, badge, isCollapsed = false, actions = '' } = options || {};

  const collapsedClass = isCollapsed ? 'collapsed' : '';
  const icon = iconEmoji ? `<span class="section-icon" aria-hidden="true">${iconEmoji}</span>` : '';
  const badgeHtml = badge !== undefined && badge > 0
    ? `<span class="section-badge" aria-label="${badge} items">${badge}</span>`
    : '';

  return `
    <div class="sidebar-section ${collapsedClass}" data-section-id="${id}">
      <button
        type="button"
        class="section-header"
        data-section-toggle="${id}"
        aria-expanded="${!isCollapsed}"
        aria-controls="section-content-${id}"
      >
        <span class="section-title-wrapper">
          ${icon}
          <span class="section-title">${title}</span>
          ${badgeHtml}
        </span>
        <span class="section-toggle-icon" aria-hidden="true">
          ${isCollapsed ? '›' : '⌄'}
        </span>
      </button>
      ${actions ? `<div class="section-actions">${actions}</div>` : ''}
      <div
        id="section-content-${id}"
        class="section-content"
        ${isCollapsed ? 'hidden' : ''}
      >
        ${content}
      </div>
    </div>
  `;
}

/**
 * Get section collapse state from localStorage
 * @param sectionId - Section ID
 * @returns True if collapsed, false if expanded
 */
export function getSectionState(sectionId: string): boolean {
  try {
    const states = localStorage.getItem('gardenFence.sidebarSectionStates');
    if (!states) return false; // Default to expanded

    const parsed = JSON.parse(states);
    return parsed[sectionId] === true; // true = collapsed
  } catch {
    return false;
  }
}

/**
 * Save section collapse state to localStorage
 * @param sectionId - Section ID
 * @param isCollapsed - True if collapsed, false if expanded
 */
export function setSectionState(sectionId: string, isCollapsed: boolean): void {
  try {
    const states = localStorage.getItem('gardenFence.sidebarSectionStates');
    const parsed = states ? JSON.parse(states) : {};

    parsed[sectionId] = isCollapsed;

    localStorage.setItem('gardenFence.sidebarSectionStates', JSON.stringify(parsed));
  } catch (error) {
    console.error('Failed to save section state:', error);
  }
}

/**
 * Toggle section collapse state
 * @param sectionId - Section ID
 * @returns New collapsed state (true if now collapsed)
 */
export function toggleSection(sectionId: string): boolean {
  const currentState = getSectionState(sectionId);
  const newState = !currentState;
  setSectionState(sectionId, newState);
  return newState;
}

/**
 * Set up event listeners for sidebar section toggles
 * @param container - Container element with sections
 */
export function setupSectionToggles(container: HTMLElement): void {
  container.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const toggleBtn = target.closest('[data-section-toggle]') as HTMLElement;

    if (!toggleBtn) return;

    const sectionId = toggleBtn.dataset.sectionToggle;
    if (!sectionId) return;

    const section = container.querySelector(`.sidebar-section[data-section-id="${sectionId}"]`) as HTMLElement;
    if (!section) return;

    // Toggle state
    const isCollapsed = toggleSection(sectionId);

    // Update UI
    const content = section.querySelector('.section-content') as HTMLElement;
    const toggleIcon = toggleBtn.querySelector('.section-toggle-icon');

    if (isCollapsed) {
      section.classList.add('collapsed');
      content.hidden = true;
      toggleBtn.setAttribute('aria-expanded', 'false');
      if (toggleIcon) toggleIcon.textContent = '›';
    } else {
      section.classList.remove('collapsed');
      content.hidden = false;
      toggleBtn.setAttribute('aria-expanded', 'true');
      if (toggleIcon) toggleIcon.textContent = '⌄';
    }
  });
}
