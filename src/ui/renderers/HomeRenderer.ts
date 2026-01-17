// ===================================
// Mobile Home View Renderer
// ===================================
import { State } from '../../core/State';
import { Goals } from '../../core/Goals';
import { TimeBreakdown } from '../../utils/TimeBreakdown';
import { CONFIG } from '../../config';
import type { UIElements } from '../../types';

const LEVEL_DESCRIPTORS = {
  vision: "Year direction",
  milestone: "Monthly chapter",
  focus: "Weekly emphasis",
  intention: "Daily touch",
} as const;

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

    // 2. Update Context (weekday)
    const now = new Date();
    if (elements.mobileNowContext) {
      const weekday = now.toLocaleDateString("en-US", { weekday: "long" });
      elements.mobileNowContext.textContent = weekday;
    }

    // 3. Update Time Stats
    if (elements.mobileTimeVis) {
      const dateLabel = now.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
      });
      const weekday = now.toLocaleDateString("en-US", { weekday: "long" });
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear() + 1, 0, 1);
      const ratio = Math.min(
        1,
        Math.max(
          0,
          (now.getTime() - start.getTime()) / (end.getTime() - start.getTime())
        )
      );
      const yearPercent = Math.round(ratio * 100);

      elements.mobileTimeVis.innerHTML = `
        <div class="here-hero">
          <div class="here-date">
            <div class="here-weekday">${weekday.toUpperCase()}</div>
            <div class="here-weekday-secondary">${weekday}</div>
            <div class="here-date-large">${dateLabel}</div>
          </div>
          <div class="here-bloom">
            <div class="here-bud"></div>
            <div class="here-stem"></div>
          </div>
          <div class="here-label">Year Position</div>
          <div class="here-value">${yearPercent}%</div>
        </div>
      `;
    }

    // Hide the legacy time stats row inside the hero for this layout
    if (elements.mobileTimeStats) {
      elements.mobileTimeStats.innerHTML = "";
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

    // 6. Update Upcoming List
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
