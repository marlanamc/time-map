// ===================================
// Living Garden Renderer - A Unified Ecosystem
// ===================================
import { State } from "../../core/State";
import { Goals } from "../../core/Goals";
import { WeekReflections } from "../../core/WeekReflections";
import { eventBus } from "../../core/EventBus";

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

const reflectionCache = new Map<string, WeekReflection | null>();

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
    const focusesInWeek = Goals.getForRange(weekStart, weekEnd).filter(
      (g) => g.level === "focus" && g.status !== "done",
    );
    const intentionsInWeek = Goals.getForRange(weekStart, weekEnd).filter(
      (g) => g.level === "intention",
    );

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
      // Desktop: The Living Garden
      container.className = "garden-view-container living-garden";
      container.innerHTML = `
        <div class="living-garden-container">
          <header class="living-garden-header">
            <h1 class="living-garden-title">Your Living Garden</h1>
            <div class="living-garden-summary">
              ${visions.length} vision${visions.length === 1 ? "" : "s"} • 
              ${milestonesToday.length} active milestone${milestonesToday.length === 1 ? "" : "s"} • 
              ${intentionsInWeek.length} intention${intentionsInWeek.length === 1 ? "" : "s"} this week
            </div>
          </header>

          ${
            visions.length === 0
              ? `
            <div class="living-garden-empty">
              <div class="living-garden-empty-icon">🌱</div>
              <h2 style="color: #000 !important;">Start your garden</h2>
              <p style="color: #1e293b !important;">Every great garden begins with a single vision. Plant yours and watch it grow.</p>
              ${onAddGoal ? `<button class="living-garden-btn-primary" data-action="add-vision">Plant Your First Vision</button>` : ""}
            </div>
          `
              : `
            <div class="living-garden-ecosystem">
              ${ecosystem
                .map(
                  (plot) => `
                <div class="living-garden-plot ${plot.isAlive ? "is-thriving" : "is-dormant"}" 
                     style="${plot.accent ? `--garden-accent: ${plot.accent.color}; --garden-accent-gradient: ${plot.accent.gradient || ""};` : ""}"
                     data-vision-id="${escapeHtmlFn(plot.vision.id)}">
                  
                  <!-- Vision Tree -->
                  <div class="living-garden-tree">
                    <div class="living-garden-trunk">
                      <div class="living-garden-vision">
                        ${plot.vision.icon ? `<span class="living-garden-emoji">${escapeHtmlFn(plot.vision.icon)}</span>` : ""}
                        <span class="living-garden-vision-text">${escapeHtmlFn(plot.vision.title)}</span>
                      </div>
                    </div>
                    
                    ${
                      plot.isAlive
                        ? `
                      <div class="living-garden-branches">
                        ${
                          plot.milestones.length > 0
                            ? `
                          <div class="living-garden-branch living-garden-branch--milestones">
                            <div class="living-garden-branch-label">Milestones</div>
                            <div class="living-garden-branch-items">
                              ${plot.milestones
                                .map(
                                  (milestone) => `
                                <div class="living-garden-branch-item" data-action="open-goal" data-goal-id="${escapeHtmlFn(milestone.id)}">
                                  ${milestone.icon ? `<span class="living-garden-emoji">${escapeHtmlFn(milestone.icon)}</span>` : ""}
                                  <span>${escapeHtmlFn(milestone.title)}</span>
                                </div>
                              `,
                                )
                                .join("")}
                            </div>
                          </div>
                        `
                            : ""
                        }
                        
                        ${
                          plot.focuses.length > 0
                            ? `
                          <div class="living-garden-branch living-garden-branch--focuses">
                            <div class="living-garden-branch-label">Weekly Focus</div>
                            <div class="living-garden-branch-items">
                              ${plot.focuses
                                .map(
                                  (focus) => `
                                <div class="living-garden-branch-item" data-action="open-goal" data-goal-id="${escapeHtmlFn(focus.id)}">
                                  ${focus.icon ? `<span class="living-garden-emoji">${escapeHtmlFn(focus.icon)}</span>` : ""}
                                  <span>${escapeHtmlFn(focus.title)}</span>
                                </div>
                              `,
                                )
                                .join("")}
                            </div>
                          </div>
                        `
                            : ""
                        }
                        
                        ${
                          plot.intentions.length > 0
                            ? `
                          <div class="living-garden-branch living-garden-branch--intentions">
                            <div class="living-garden-branch-label">This Week's Intentions</div>
                            <div class="living-garden-branch-items">
                              ${plot.intentions
                                .map(
                                  (intention) => `
                                <div class="living-garden-branch-item ${intention.status === "done" ? "is-complete" : ""}" 
                                     data-action="open-goal" data-goal-id="${escapeHtmlFn(intention.id)}">
                                  ${intention.icon ? `<span class="living-garden-emoji">${escapeHtmlFn(intention.icon)}</span>` : ""}
                                  <span>${escapeHtmlFn(intention.title)}</span>
                                </div>
                              `,
                                )
                                .join("")}
                            </div>
                          </div>
                        `
                            : ""
                        }
                      </div>
                    `
                        : `
                      <div class="living-garden-dormant-state">
                        <div class="living-garden-dormant-icon">🌱</div>
                        <p>This vision is waiting for care</p>
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
                </div>
              `,
                )
                .join("")}
            </div>

            <!-- Garden Actions -->
            <div class="living-garden-actions">
              <div class="living-garden-actions-left">
                ${
                  onAddGoal
                    ? `
                  <button class="living-garden-btn-primary" data-action="add-vision">
                    <span class="living-garden-btn-icon">🌱</span>
                    Plant New Vision
                  </button>
                `
                    : ""
                }
              </div>
              <div class="living-garden-actions-right">
                <button class="living-garden-btn-secondary living-garden-btn--reflection" data-action="toggle-reflection">
                  <span class="living-garden-btn-icon">🧭</span>
                  Weekly Reflection
                </button>
              </div>
            </div>

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
                    <h4>What needs more sunlight?</h4>
                    <div class="living-garden-reflection-options">
                      ${[
                        "More time ⏰",
                        "Better tools 🛠️",
                        "Different approach 💡",
                        "Rest and recovery 😴",
                      ]
                        .map((opt) => {
                          const selected =
                            cachedReflection?.answers?.q2 === opt;
                          return `<button class="living-garden-reflection-option ${selected ? "is-selected" : ""}" 
                                       data-action="set-reflection" data-q="q2" data-value="${escapeHtmlFn(opt)}">${opt}</button>`;
                        })
                        .join("")}
                    </div>
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
          `
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
              eventBus.emit("ui:toast", {
                icon: "🌱",
                message: "Reflection saved.",
              });
              eventBus.emit("view:changed", { transition: false });
            },
          );
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
