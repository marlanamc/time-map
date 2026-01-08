// ===================================
// Year View Renderer
// ===================================
import { State } from '../../core/State';
import { Goals } from '../../core/Goals';
import { CONFIG } from '../../config';
import { buildAccentAttributes, getVisionAccent } from '../../utils/goalLinkage';
import type { UIElements } from '../../types';

export const YearRenderer = {
  render(elements: UIElements, escapeHtmlFn: (text: string) => string) {
    const container = elements.calendarGrid;
    if (!container) return;

    const year = State.viewingYear;
    const now = new Date();

    // Get Vision goals for this year
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31);
    const visionGoals = Goals.getForRange(yearStart, yearEnd)
      .filter(g => g.level === 'vision' && g.status !== 'done');

    let html = '<div class="year-view">';
    html += '<div class="year-view-layout">';

    // Vision section stays in the upper-left (compact column)
    if (visionGoals.length > 0) {
      html += `
        <aside class="year-vision-section year-vision-section--corner" aria-label="Vision goals">
          <div class="year-vision-header">
            <span class="vision-icon" aria-hidden="true">✨</span>
            <h3>Vision</h3>
          </div>
          <div class="year-vision-goals">
            ${visionGoals.map(g => `
              ${(() => {
                const accentAttrs = buildAccentAttributes(getVisionAccent(g));
                return `<button type="button" class="cosmic-card cosmic-card--vision cosmic-card--mini"${accentAttrs.dataAttr}${accentAttrs.styleAttr} data-goal-id="${g.id}">`;
              })()}
                <div class="cosmic-card-header cosmic-card-header--mini">
                  <div class="cosmic-card-label cosmic-card-label--mini">
                    <span class="cosmic-card-label-text">Vision</span>
                  </div>
                </div>
                <div class="cosmic-card-content cosmic-card-content--mini">
                  <div class="cosmic-card-title">${escapeHtmlFn(g.title)}</div>
                </div>
              </button>
            `).join('')}
          </div>
        </aside>
      `;
    }

    html += '<div class="year-grid">';

    for (let month = 0; month < 12; month++) {
      const monthGoals = Goals.getByMonth(month, year);
      const milestones = monthGoals.filter(g => g.level === 'milestone' && g.status !== 'done');
      const isCurrentMonth = month === now.getMonth() && year === now.getFullYear();
      const primaryMilestone = milestones[0];

      html += `
        <div class="year-month ${isCurrentMonth ? 'is-current' : ''}" data-month="${month}" data-year="${year}">
          <div class="year-month-header">
            <h3 class="year-month-name">${CONFIG.MONTHS[month]}</h3>
            <span class="year-month-count">${monthGoals.length}</span>
          </div>

          ${primaryMilestone ? `
            <button
              type="button"
              class="year-month-milestone"
              data-goal-id="${primaryMilestone.id}"
              title="${escapeHtmlFn(primaryMilestone.title)}"
            >🎯 ${escapeHtmlFn(primaryMilestone.title)}${milestones.length > 1 ? ` <span class="year-month-milestone-more">+${milestones.length - 1}</span>` : ''}</button>
          ` : ''}

          <div class="year-month-goals">
`;
      if (monthGoals.length > 0) {
        monthGoals.slice(0, 5).forEach(g => {
          html += `<div class="year-goal" data-goal-id="${g.id}">${escapeHtmlFn(g.title)}</div>`;
        });
        if (monthGoals.length > 5) {
          html += `<div class="year-goals-more">+${monthGoals.length - 5} more</div>`;
        }
      } else {
        html += '<div class="year-month-empty">No goals yet</div>';
      }
      html += `
          </div>
        </div>
      `;
    }

    html += '</div></div></div>';
    container.innerHTML = html;

    // Add click handlers for month cards
    container.querySelectorAll('.year-month').forEach((monthEl: Element) => {
      monthEl.addEventListener('click', (e) => {
        // Don't navigate if clicking on milestone badge
        if ((e.target as HTMLElement).closest('.milestone-badge')) return;

        const month = parseInt((monthEl as HTMLElement).dataset.month || '0');
        const year = parseInt((monthEl as HTMLElement).dataset.year || new Date().getFullYear().toString());
        State.setView('month');
        State.viewingMonth = month;
        State.viewingYear = year;
      });
    });

    // Add click handlers for vision cards and milestone badges
    container.querySelectorAll('[data-goal-id]').forEach((el: Element) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const goalId = (el as HTMLElement).dataset.goalId;
        if (goalId) {
          const event = new CustomEvent('goal-click', { detail: { goalId } });
          container.dispatchEvent(event);
        }
      });
    });
  }
};
