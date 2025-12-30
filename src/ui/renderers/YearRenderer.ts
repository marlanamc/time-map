// ===================================
// Year View Renderer
// ===================================
import { State } from '../../core/State';
import { Goals } from '../../core/Goals';
import { CONFIG } from '../../config';
// import { TimeBreakdown } from '../../utils/TimeBreakdown'; // Unused for now
import type { UIElements } from '../../types';

export const YearRenderer = {
  render(elements: UIElements, escapeHtmlFn: (text: string) => string) {
    const container = elements.calendarGrid;
    if (!container) return;

    const year = State.viewingYear;
    const now = new Date();

    let html = '<div class="year-view"><div class="year-grid">';

    for (let month = 0; month < 12; month++) {
      const monthGoals = Goals.getByMonth(month, year);
      const isCurrentMonth = month === now.getMonth() && year === now.getFullYear();
      // const breakdown = TimeBreakdown.calculate(month, year); // Unused for now

      html += `
        <div class="year-month ${isCurrentMonth ? 'is-current' : ''}" data-month="${month}" data-year="${year}">
          <div class="year-month-header">
            <h3 class="year-month-name">${CONFIG.MONTHS[month]}</h3>
            <span class="year-month-count">${monthGoals.length}</span>
          </div>
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

    html += '</div></div>';
    container.innerHTML = html;

    // Add click handlers
    container.querySelectorAll('.year-month').forEach((monthEl: Element) => {
      monthEl.addEventListener('click', () => {
        const month = parseInt((monthEl as HTMLElement).dataset.month || '0');
        const year = parseInt((monthEl as HTMLElement).dataset.year || new Date().getFullYear().toString());
        State.setView('month');
        State.viewingMonth = month;
        State.viewingYear = year;
      });
    });
  }
};
