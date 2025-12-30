// ===================================
// Mobile Home View Renderer
// ===================================
import { State } from '../../core/State';
import { Goals } from '../../core/Goals';
import { TimeBreakdown } from '../../utils/TimeBreakdown';
import { CONFIG } from '../../config';
import type { UIElements } from '../../types';

export const HomeRenderer = {
  render(elements: UIElements, escapeHtmlFn: (text: string) => string, onGoalClick: (goalId: string) => void) {
    if (!State.data) return;

    // 1. Update Date
    if (elements.mobileDateDisplay) {
      elements.mobileDateDisplay.textContent = new Date().toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
    }

    // 2. Update Context
    if (elements.mobileNowContext) {
      const now = new Date();
      const hour = now.getHours();
      let context = "";
      if (hour < 12) context = "Good Morning";
      else if (hour < 18) context = "Good Afternoon";
      else context = "Good Evening";
      elements.mobileNowContext.textContent = context;
    }

    // 3. Update Time Stats
    if (elements.mobileTimeVis) {
      const breakdown = TimeBreakdown.calculate(State.viewingMonth, State.viewingYear);
      if (breakdown.isCurrentMonth) {
        elements.mobileTimeVis.innerHTML = `
          <div class="time-stat-mobile">
            <span class="stat-value">${breakdown.days}</span>
            <span class="stat-label">Days Left</span>
          </div>
        `;
      } else {
        elements.mobileTimeVis.innerHTML = '';
      }
    }

    // 4. Update Bloom Progress
    if (elements.mobileBloomText) {
      const stats = Goals.getStats();
      const completed = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
      elements.mobileBloomText.textContent = `${completed}% In Bloom`;
    }

    if (elements.mobileGardenBloom && elements.mobileGardenBloom.children.length === 0) {
      const desktopFlower = document.querySelector('.flower-container');
      if (desktopFlower) {
        elements.mobileGardenBloom.appendChild(desktopFlower.cloneNode(true));
      }
    }

    // 5. Update Affirmation
    if (elements.mobileAffirmationText) {
      const affirmation = elements.affirmationText?.textContent || "You are doing great.";
      elements.mobileAffirmationText.textContent = affirmation;
    }

    // 6. Update Goals By Level
    if (elements.mobileGoalsByLevel) {
      const today = new Date();
      const todayGoals = Goals.getForDate(today).filter(g => g.status !== 'done');

      const intentions = todayGoals.filter(g => g.level === 'intention');
      const focus = todayGoals.filter(g => g.level === 'focus');
      const milestones = todayGoals.filter(g => g.level === 'milestone');
      const visions = todayGoals.filter(g => g.level === 'vision');

      let html = '';

      const renderGoalSection = (goals: any[], levelKey: 'intention' | 'focus' | 'milestone' | 'vision', label: string) => {
        if (goals.length === 0) return '';
        
        let section = `
          <div class="goals-level-section">
            <div class="goals-level-header">
              <span class="goals-level-emoji">${CONFIG.LEVELS[levelKey].emoji}</span>
              <span class="goals-level-label">${label}</span>
              <span class="goals-level-count">${goals.length}</span>
            </div>
            <div class="goals-level-list">
        `;
        
        goals.slice(0, 5).forEach(g => {
          section += `
            <div class="mobile-goal-item" data-goal-id="${g.id}">
              <span class="goal-title">${escapeHtmlFn(g.title)}</span>
            </div>
          `;
        });
        
        if (goals.length > 5) {
          section += `<div class="goals-more">+${goals.length - 5} more</div>`;
        }
        
        section += `
            </div>
          </div>
        `;
        
        return section;
      };

      html += renderGoalSection(intentions, 'intention', 'Intentions');
      html += renderGoalSection(focus, 'focus', 'Focus');
      html += renderGoalSection(milestones, 'milestone', 'Milestones');
      html += renderGoalSection(visions, 'vision', 'Visions');

      if (html === '') {
        html = '<div class="empty-state-small">No active goals</div>';
      }

      elements.mobileGoalsByLevel.innerHTML = html;

      // Add click handlers
      elements.mobileGoalsByLevel.querySelectorAll('.mobile-goal-item[data-goal-id]').forEach((item: Element) => {
        item.addEventListener('click', () => {
          const goalId = (item as HTMLElement).dataset.goalId;
          if (goalId) {
            onGoalClick(goalId);
          }
        });
      });
    }

    // 7. Update Upcoming List
    if (elements.mobileUpcomingList) {
      const goals = Goals.getAll().filter(g => g.status !== 'done' && g.dueDate);
      goals.sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());
      const upcoming = goals.slice(0, 3);

      if (upcoming.length > 0) {
        elements.mobileUpcomingList.innerHTML = upcoming.map(g => `
          <div class="mobile-goal-item">
            <span class="goal-time">${new Date(g.dueDate!).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
            <span class="goal-title">${escapeHtmlFn(g.title)}</span>
          </div>
        `).join('');
      } else {
        elements.mobileUpcomingList.innerHTML = '<div class="empty-state-small">No upcoming deadlines</div>';
      }
    }
  }
};
