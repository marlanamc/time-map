// ===================================
// Living Garden Renderer - A Unified Ecosystem
// ===================================
import { State } from "../../core/State";
import { Goals } from "../../core/Goals";
import { WeekReflections } from "../../core/WeekReflections";
import { eventBus } from "../../core/EventBus";
import { Analytics } from "../../core/Analytics";

import type { Goal, GoalLevel, UIElements, WeekReflection } from "../../types";
import { getVisionAccent } from "../../utils/goalLinkage";

type AddGoalLinkedOpts = {
  level: Extract<GoalLevel, "milestone" | "focus">;
  parentId: string;
  parentLevel: GoalLevel;
  preselectedMonth?: number | null;
  preselectedYear?: number | null;
};

let reflectionOpen = false;
let contextExpanded = false;
let showStats = false;

const reflectionCache = new Map<string, WeekReflection | null>();

function getPrimaryFocus(
  focusesInWeek: Goal[],
  intentionsInWeek: Goal[],
  viewDate: Date,
): { type: "focus" | "intention" | "empty"; goal?: Goal } {
  // Priority 1: Current week's focus
  if (focusesInWeek.length > 0) {
    return { type: "focus", goal: focusesInWeek[0] };
  }

  // Priority 2: Today's first unscheduled intention
  const today = viewDate.toDateString();
  const todayIntentions = intentionsInWeek.filter(
    (i) =>
      !i.startTime &&
      i.dueDate &&
      new Date(i.dueDate).toDateString() === today &&
      i.status !== "done",
  );

  if (todayIntentions.length > 0) {
    return { type: "intention", goal: todayIntentions[0] };
  }

  // Priority 3: Empty state
  return { type: "empty" };
}

function getWeekRangeFor(date: Date): {
  weekStart: Date;
  weekEnd: Date;
  weekNum: number;
  weekYear: number;
} {
  const weekNum = State.getWeekNumber(date);
  const weekYear = State.getWeekYear(date);
  const weekStart = State.getWeekStart(weekYear, weekNum);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  return { weekStart, weekEnd, weekNum, weekYear };
}

function getVisionIdForGoal(goal: Goal): string | null {
  let cur: Goal | null = goal;
  const seen = new Set<string>();
  while (cur && !seen.has(cur.id)) {
    if (cur.level === "vision") return cur.id;
    seen.add(cur.id);
    cur = cur.parentId ? (Goals.getById(cur.parentId) ?? null) : null;
  }
  return null;
}

export const LivingGardenRenderer = {
  render(
    elements: UIElements,
    escapeHtmlFn: (text: string) => string,
    onGoalClick: (goalId: string) => void,
    onAddGoal?: (level: GoalLevel) => void,
    onAddGoalLinked?: (opts: AddGoalLinkedOpts) => void,
  ) {
    if (!State.data) return;

    const container = elements.calendarGrid;
    if (!container) return;

    const viewDate = State.viewingDate ?? new Date();
    const { weekStart, weekEnd, weekNum, weekYear } = getWeekRangeFor(viewDate);

    const visions = Goals.getForRange(
      new Date(weekYear, 0, 1),
      new Date(weekYear, 11, 31),
    ).filter((g) => g.level === "vision" && g.status !== "done");

    const milestonesToday = Goals.getForRange(viewDate, viewDate).filter(
      (g) => g.level === "milestone" && g.status !== "done",
    );
    // Check milestones for the entire year (like visions)
    const milestonesInYear = Goals.getForRange(
      new Date(weekYear, 0, 1),
      new Date(weekYear, 11, 31),
    ).filter((g) => g.level === "milestone" && g.status !== "done");
    const focusesInWeek = Goals.getForRange(weekStart, weekEnd).filter(
      (g) => g.level === "focus" && g.status !== "done",
    );
    const intentionsInWeek = Goals.getForRange(weekStart, weekEnd).filter(
      (g) => g.level === "intention",
    );

    // Calculate stats only when needed (not by default)
    const getStatsWhenNeeded = () => {
      const statsOverview = Analytics.getOverview();
      const intentionsCompletedThisWeek = intentionsInWeek.filter(
        (i) => i.status === "done",
      ).length;
      const completionRate =
        intentionsInWeek.length > 0
          ? Math.round(
              (intentionsCompletedThisWeek / intentionsInWeek.length) * 100,
            )
          : 0;
      return { statsOverview, intentionsCompletedThisWeek, completionRate };
    };

    // Build ecosystem data
    const ecosystem = visions.map((vision) => {
      const accent = getVisionAccent(vision);
      const visionMilestones = milestonesToday.filter(
        (m) =>
          m.parentId === vision.id && (m.parentLevel ?? "vision") === "vision",
      );
      const visionFocuses = focusesInWeek.filter(
        (f) => f.parentId === vision.id && f.parentLevel === "vision",
      );
      const visionIntentions = intentionsInWeek.filter(
        (i) => getVisionIdForGoal(i) === vision.id,
      );

      // Add milestone-linked focuses and intentions
      visionMilestones.forEach((milestone) => {
        const milestoneFocuses = focusesInWeek.filter(
          (f) => f.parentId === milestone.id && f.parentLevel === "milestone",
        );
        visionFocuses.push(...milestoneFocuses);

        const milestoneIntentions = intentionsInWeek.filter((i) => {
          const ancestor = i.parentId ? Goals.getById(i.parentId) : null;
          return (
            ancestor?.parentId === milestone.id &&
            ancestor.parentLevel === "milestone"
          );
        });
        visionIntentions.push(...milestoneIntentions);
      });

      return {
        vision,
        accent,
        milestones: visionMilestones,
        focuses: visionFocuses,
        intentions: visionIntentions,
        isAlive:
          visionMilestones.length > 0 ||
          visionFocuses.length > 0 ||
          visionIntentions.length > 0,
      };
    });

    const reflectionId = WeekReflections.getId(weekYear, weekNum);
    const cachedReflection = reflectionCache.get(reflectionId);
    if (!reflectionCache.has(reflectionId)) {
      reflectionCache.set(reflectionId, null);
      void WeekReflections.get(weekYear, weekNum).then((rec) => {
        reflectionCache.set(reflectionId, rec);
        if (State.currentView === "garden") {
          eventBus.emit("view:changed", { transition: false });
        }
      });
    }

    // Determine primary focus
    const primaryFocus = getPrimaryFocus(
      focusesInWeek,
      intentionsInWeek,
      viewDate,
    );

    // Get first vision and milestone for context (simplified)
    const firstVision = visions[0] || null;
    const firstMilestone =
      firstVision && milestonesToday.length > 0
        ? milestonesToday.filter(
            (m) =>
              m.parentId === firstVision.id &&
              (m.parentLevel ?? "vision") === "vision",
          )[0] || null
        : null;

    // Mobile detection
    const isMobile = typeof window !== "undefined" && window.innerWidth <= 600;

    if (isMobile) {
      container.className =
        "garden-view-container living-garden living-garden--mobile";
      // For now, use the existing mobile plots
      container.innerHTML = `
        <div class="living-garden-mobile">
          <div class="living-garden-header">
            <h1 class="living-garden-title">Your Garden</h1>
          </div>
          ${
            visions.length === 0
              ? `
            <div class="living-garden-empty">
              <div class="living-garden-empty-icon">🌱</div>
              <h2 style="color: #000 !important;">Start your garden</h2>
              <p style="color: #1e293b !important;">Plant one vision to begin growing something meaningful.</p>
              ${onAddGoal ? `<button class="living-garden-btn-primary" data-action="add-vision">Plant Your First Vision</button>` : ""}
            </div>
          `
              : `
            <div class="living-garden-plots">
              ${ecosystem
                .map(
                  (plot) => `
                <div class="living-garden-plot" style="${plot.accent ? `--garden-accent: ${plot.accent.color};` : ""}">
                  <div class="living-garden-plot-header">
                    <div class="living-garden-plot-title">
                      ${plot.vision.icon ? `<span class="living-garden-emoji">${escapeHtmlFn(plot.vision.icon)}</span>` : ""}
                      <span>${escapeHtmlFn(plot.vision.title)}</span>
                    </div>
                    <div class="living-garden-plot-life ${plot.isAlive ? "is-alive" : "is-dormant"}">
                      ${plot.isAlive ? "🌿" : "🌱"}
                    </div>
                  </div>
                  ${
                    plot.isAlive
                      ? `
                    <div class="living-garden-plot-growth">
                      ${
                        plot.milestones.length > 0
                          ? `
                        <div class="living-garden-sprouts">
                          ${plot.milestones
                            .slice(0, 2)
                            .map(
                              (m) => `
                            <div class="living-garden-sprout" data-action="open-goal" data-goal-id="${escapeHtmlFn(m.id)}">
                              ${m.icon ? `<span class="living-garden-emoji">${escapeHtmlFn(m.icon)}</span>` : ""}
                              <span>${escapeHtmlFn(m.title)}</span>
                            </div>
                          `,
                            )
                            .join("")}
                          ${plot.milestones.length > 2 ? `<div class="living-garden-more">+${plot.milestones.length - 2} more</div>` : ""}
                        </div>
                      `
                          : ""
                      }
                      ${
                        plot.focuses.length > 0
                          ? `
                        <div class="living-garden-buds">
                          ${plot.focuses
                            .slice(0, 2)
                            .map(
                              (f) => `
                            <div class="living-garden-bud" data-action="open-goal" data-goal-id="${escapeHtmlFn(f.id)}">
                              ${f.icon ? `<span class="living-garden-emoji">${escapeHtmlFn(f.icon)}</span>` : ""}
                              <span>${escapeHtmlFn(f.title)}</span>
                            </div>
                          `,
                            )
                            .join("")}
                          ${plot.focuses.length > 2 ? `<div class="living-garden-more">+${plot.focuses.length - 2} more</div>` : ""}
                        </div>
                      `
                          : ""
                      }
                      ${
                        plot.intentions.length > 0
                          ? `
                        <div class="living-garden-leaves">
                          ${plot.intentions
                            .slice(0, 3)
                            .map(
                              (i) => `
                            <div class="living-garden-leaf ${i.status === "done" ? "is-bloomed" : ""}" data-action="open-goal" data-goal-id="${escapeHtmlFn(i.id)}">
                              ${i.icon ? `<span class="living-garden-emoji">${escapeHtmlFn(i.icon)}</span>` : ""}
                              <span>${escapeHtmlFn(i.title)}</span>
                            </div>
                          `,
                            )
                            .join("")}
                          ${plot.intentions.length > 3 ? `<div class="living-garden-more">+${plot.intentions.length - 3} more</div>` : ""}
                        </div>
                      `
                          : ""
                      }
                    </div>
                  `
                      : `
                    <div class="living-garden-plot-dormant">
                      <p>This vision is dormant. Add a milestone or focus to help it grow.</p>
                      ${
                        onAddGoalLinked
                          ? `
                        <button class="living-garden-btn-secondary" data-action="add-milestone" data-vision-id="${escapeHtmlFn(plot.vision.id)}">Plant a Milestone</button>
                      `
                          : ""
                      }
                    </div>
                  `
                  }
                </div>
              `,
                )
                .join("")}
            </div>
          `
          }
        </div>
      `;
      } else {
        // Desktop: ADHD-Friendly Living Garden
        container.className = "garden-view-container living-garden";

        // Only show summary message when there's nothing set
        const activeMilestones = milestonesToday.length;
        const hasIntentions = intentionsInWeek.length > 0;
        const hasFocuses = focusesInWeek.length > 0;
        const hasVisions = visions.length > 0;
        let headerSummary = "";
        
        if (activeMilestones === 0 && !hasIntentions) {
          headerSummary = "No active milestones • No intentions this week";
        }
        
        const headerMarkup = `
          <header class="living-garden-header glassPanel">
            <h1 class="living-garden-title">Your Living Garden</h1>
            ${headerSummary ? `<div class="living-garden-summary glassPill">${headerSummary}</div>` : ""}
          </header>
        `;

        // Build hero section content - only show when there's nothing set
        // Check if there are any active goals: visions, milestones (for year), focuses, or intentions
        const hasMilestones = milestonesInYear.length > 0;
        const hasActivity = hasVisions || hasMilestones || hasFocuses || hasIntentions;
        let heroSection = "";
        
        if (!hasActivity) {
          let heroContent = "";
          let primaryCTA = "";

          const heroGoal = primaryFocus.goal;
          if (heroGoal) {
            const heroGoalTitle = escapeHtmlFn(heroGoal.title);
            heroContent = `<p class="living-garden-focus-text">${heroGoalTitle}</p>`;
            const heroGoalId = escapeHtmlFn(heroGoal.id);
            primaryCTA = `<button class="living-garden-btn-primary glassButton" data-action="open-goal" data-goal-id="${heroGoalId}">
              <span class="btn-icon">🌱</span>
              Plant today's seed
            </button>`;
          } else {
            heroContent = `<p class="living-garden-focus-text">No focus set for this week</p>`;
            primaryCTA = onAddGoal
              ? `<button class="living-garden-btn-primary glassButton" data-action="add-focus">
              <span class="btn-icon">🌱</span>
              Plant today's seed
            </button>`
              : "";
          }
          
          heroSection = `
            <section class="living-garden-hero">
              <div class="living-garden-hero-card glassPanel">
                <h2 class="living-garden-hero-title">Today's focus</h2>
                <div class="living-garden-hero-content">
                  ${heroContent}
                </div>
                ${primaryCTA}
              </div>
            </section>
          `;
        }
      
      // Build context panel (collapsible)
      let contextPanel = "";
      if (firstVision || firstMilestone) {
        contextPanel = `
          <section class="living-garden-context ${contextExpanded ? "" : "is-collapsed"}" data-collapsed="${!contextExpanded}">
            <div class="living-garden-context-card glassPanel">
              <h3 class="living-garden-context-title">Vision & Milestones</h3>
              <div class="living-garden-context-content">
                ${firstVision ? `<div class="living-garden-vision-item" data-action="open-goal" data-goal-id="${escapeHtmlFn(firstVision.id)}">🌿 Vision: ${escapeHtmlFn(firstVision.title)}</div>` : ""}
                ${firstMilestone ? `<div class="living-garden-milestone-item" data-action="open-goal" data-goal-id="${escapeHtmlFn(firstMilestone.id)}">☑ Milestone: ${escapeHtmlFn(firstMilestone.title)}</div>` : ""}
              </div>
              ${!cachedReflection ? `<button class="living-garden-btn-secondary" data-action="toggle-reflection">Weekly Reflection ✨</button>` : ""}
            </div>
          </section>
        `;
      }
      
      // Stats (hidden by default, only shown when showStats is true)
      const stats = showStats ? getStatsWhenNeeded() : null;
      const statsSection = stats
        ? `
          <section class="living-garden-stats is-visible">
            <div class="living-garden-stat-card">
              <span class="living-garden-stat-value">${stats.intentionsCompletedThisWeek}</span>
              <span class="living-garden-stat-label">Done this week</span>
            </div>
            <div class="living-garden-stat-card">
              <span class="living-garden-stat-value">${stats.completionRate}%</span>
              <span class="living-garden-stat-label">Completion Rate</span>
            </div>
            <div class="living-garden-stat-card">
              <span class="living-garden-stat-value">${stats.statsOverview.currentStreak}🔥</span>
              <span class="living-garden-stat-label">Current Streak</span>
            </div>
            <button class="living-garden-stats-close" data-action="hide-stats">×</button>
          </section>
        `
        : "";
      
      container.innerHTML = `
        ${headerMarkup}
        <div class="living-garden-container">
          ${heroSection}
          
          <!-- Progressive disclosure link -->
          ${firstVision || firstMilestone ? `<button class="living-garden-context-trigger glassPill" data-action="toggle-context">See the bigger picture →</button>` : ""}
          
          ${contextPanel}
          
          ${statsSection}

          <!-- Reflection Panel -->
          ${
            reflectionOpen
              ? `
            <div class="living-garden-reflection">
              <div class="living-garden-reflection-header">
                <h3>Weekly Garden Reflection</h3>
                <button class="living-garden-reflection-close" data-action="toggle-reflection">×</button>
              </div>
              <div class="living-garden-reflection-body">
                <div class="living-garden-reflection-question">
                  <h4>How did your garden grow this week?</h4>
                  <div class="living-garden-reflection-options">
                    ${[
                      "Flourishing 🌸",
                      "Steady growth 🌿",
                      "Some challenges 🍂",
                      "Dormant period ❄️",
                    ]
                      .map((opt) => {
                        const selected =
                          cachedReflection?.answers?.q1 === opt;
                        return `<button class="living-garden-reflection-option ${selected ? "is-selected" : ""}" 
                                     data-action="set-reflection" data-q="q1" data-value="${escapeHtmlFn(opt)}">${opt}</button>`;
                      })
                      .join("")}
                  </div>
                </div>
                <div class="living-garden-reflection-question">
                  <h4>How aligned do you feel with your visions?</h4>
                  <div class="living-garden-alignment-score">
                    ${[1, 2, 3, 4, 5]
                      .map((score) => {
                        const selected =
                          (cachedReflection?.answers?.alignmentScore || 0) ===
                          score;
                        return `<button class="living-garden-score-btn ${selected ? "is-selected" : ""}" 
                                      data-action="set-reflection" data-q="alignmentScore" data-value="${score}">
                                ${score}
                              </button>`;
                      })
                      .join("")}
                  </div>
                </div>

                <div class="living-garden-reflection-question">
                  <h4>What were your biggest wins this week?</h4>
                  <textarea class="living-garden-reflection-input" 
                            data-action="input-reflection" data-q="wins" 
                            placeholder="List your accomplishments...">${escapeHtmlFn(cachedReflection?.answers?.wins || "")}</textarea>
                </div>

                <div class="living-garden-reflection-question">
                  <h4>Growth note (What did you learn?)</h4>
                  <textarea class="living-garden-reflection-input" 
                            data-action="input-reflection" data-q="growthNote" 
                            placeholder="Reflect on challenges and learnings...">${escapeHtmlFn(cachedReflection?.answers?.growthNote || "")}</textarea>
                </div>

                <div class="living-garden-reflection-question">
                  <h4>Priorities for next week</h4>
                  <textarea class="living-garden-reflection-input" 
                            data-action="input-reflection" data-q="nextWeekPriorities" 
                            placeholder="What will you focus on next?">${escapeHtmlFn(cachedReflection?.answers?.nextWeekPriorities || "")}</textarea>
                </div>
                <div class="living-garden-reflection-actions">
                  <span class="living-garden-reflection-note">Saved locally for this week</span>
                  <button class="living-garden-btn-ghost" data-action="clear-reflection">Clear</button>
                </div>
              </div>
            </div>
          `
              : ""
          }
        </div>
      `;

      container
        .querySelector<HTMLElement>("[data-action='clear-reflection']")
        ?.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          reflectionCache.set(reflectionId, null);
          void WeekReflections.clear(weekYear, weekNum).then(() => {
            eventBus.emit("ui:toast", {
              icon: "🧹",
              message: "Reflection cleared.",
            });
            eventBus.emit("view:changed", { transition: false });
          });
        });
    }

    // Context toggle handler (desktop only)
    if (!isMobile) {
      container
        .querySelector<HTMLElement>("[data-action='toggle-context']")
        ?.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          contextExpanded = !contextExpanded;
          eventBus.emit("view:changed", { transition: false });
        });

      // Stats hide handler
      container
        .querySelector<HTMLElement>("[data-action='hide-stats']")
        ?.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          showStats = false;
          eventBus.emit("view:changed", { transition: false });
        });
    }

    // Common event handlers for both Mobile and Desktop
    container
      .querySelectorAll<HTMLElement>("[data-action='add-vision']")
      .forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          onAddGoal?.("vision");
        });
      });

    container
      .querySelectorAll<HTMLElement>("[data-action='add-focus']")
      .forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          onAddGoal?.("focus");
        });
      });

    container
      .querySelectorAll<HTMLElement>("[data-action='add-milestone']")
      .forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const visionId = (btn as HTMLElement).dataset.visionId;
          if (!visionId || !onAddGoalLinked) return;
          onAddGoalLinked({
            level: "milestone",
            parentId: visionId,
            parentLevel: "vision",
            preselectedMonth: viewDate.getMonth(),
            preselectedYear: viewDate.getFullYear(),
          });
        });
      });

    container
      .querySelectorAll<HTMLElement>("[data-action='open-goal']")
      .forEach((el) => {
        el.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const goalId = (el as HTMLElement).dataset.goalId;
          if (goalId) onGoalClick(goalId);
        });
      });

    container
      .querySelector<HTMLElement>("[data-action='toggle-reflection']")
      ?.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        reflectionOpen = !reflectionOpen;
        eventBus.emit("view:changed", { transition: false });
      });

    container
      .querySelectorAll<HTMLElement>("[data-action='set-reflection']")
      .forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const q = (btn as HTMLElement).dataset.q as "q1" | "q2" | undefined;
          const value = (btn as HTMLElement).dataset.value;
          if (!q || !value) return;
          const nextAnswers: WeekReflection["answers"] = {
            ...(cachedReflection?.answers ?? {}),
            [q]: value,
          };
          reflectionCache.set(
            reflectionId,
            cachedReflection
              ? { ...cachedReflection, answers: nextAnswers }
              : {
                  id: reflectionId,
                  weekYear,
                  weekNum,
                  createdAt: Date.now(),
                  answers: nextAnswers,
                },
          );
          void WeekReflections.upsert(weekYear, weekNum, nextAnswers).then(
            () => {
              // No toast for every click since we save on every selection
              eventBus.emit("view:changed", { transition: false });
            },
          );
        });
      });

    container
      .querySelectorAll<HTMLTextAreaElement>("[data-action='input-reflection']")
      .forEach((input) => {
        let timeout: any;
        input.addEventListener("input", () => {
          clearTimeout(timeout);
          timeout = setTimeout(() => {
            const q = input.dataset.q as string;
            const value = input.value;
            if (!q) return;

            const nextAnswers: WeekReflection["answers"] = {
              ...(cachedReflection?.answers ?? {}),
              [q]: value,
            };
            reflectionCache.set(
              reflectionId,
              cachedReflection
                ? { ...cachedReflection, answers: nextAnswers }
                : {
                    id: reflectionId,
                    weekYear,
                    weekNum,
                    createdAt: Date.now(),
                    answers: nextAnswers,
                  },
            );
            void WeekReflections.upsert(weekYear, weekNum, nextAnswers);
          }, 500);
        });
      });

    container
      .querySelector<HTMLElement>("[data-action='clear-reflection']")
      ?.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        reflectionCache.set(reflectionId, null);
        void WeekReflections.clear(weekYear, weekNum).then(() => {
          eventBus.emit("ui:toast", {
            icon: "🧹",
            message: "Reflection cleared.",
          });
          eventBus.emit("view:changed", { transition: false });
        });
      });
  },
};
