// ===================================
// Living Garden Renderer - A Unified Ecosystem
// ===================================
import { State } from "../../core/State";
import { Goals } from "../../core/Goals";
import { WeekReflections } from "../../core/WeekReflections";
import { eventBus } from "../../core/EventBus";
import type {
  Goal,
  GoalLevel,
  UIElements,
  WeekReflection,
  GardenLevelEmojis,
} from "../../types";
import { getVisionAccent } from "../../utils/goalLinkage";
import { GoalDetailRenderer } from "./GoalDetailRenderer";

type AddGoalLinkedOpts = {
  level: Extract<GoalLevel, "milestone" | "focus">;
  parentId: string;
  parentLevel: GoalLevel;
  preselectedMonth?: number | null;
  preselectedYear?: number | null;
};

let reflectionOpen = false;
let activeGoalId: string | null = null;
const microWinPulseId: string | null = null;

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

/** Build breadcrumb trail by walking up the parentId chain */
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
    const _milestonesInYear = Goals.getForRange(
      new Date(weekYear, 0, 1),
      new Date(weekYear, 11, 31),
    ).filter((g) => g.level === "milestone" && g.status !== "done");
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

    // Get custom emoji preferences with defaults
    const emojiPrefs: GardenLevelEmojis =
      State.data?.preferences?.gardenLevelEmojis ?? {};
    const levelEmojis = {
      milestone: emojiPrefs.milestone ?? "🎯",
      focus: emojiPrefs.focus ?? "🌿",
      intention: emojiPrefs.intention ?? "🌱",
    };

    const getGrowthMeta = (plot: (typeof ecosystem)[number]) => {
      const totalIntentions = plot.intentions.length;
      const doneIntentions = plot.intentions.filter(
        (i) => i.status === "done",
      ).length;
      const completionRate =
        totalIntentions > 0
          ? Math.round((doneIntentions / totalIntentions) * 100)
          : 0;

      const focusCount = plot.focuses.length;
      const _milestoneCount = plot.milestones.length;

      // Dynamic labels based on actual state
      if (!plot.isAlive) {
        return {
          icon: levelEmojis.intention,
          label: "Waiting to bloom",
          sublabel: "Add your first milestone",
          growthState: "dormant",
          completionRate,
        };
      }

      if (completionRate >= 75) {
        return {
          icon: "🌸",
          label: "Flourishing",
          sublabel: `${doneIntentions} intention${doneIntentions !== 1 ? "s" : ""} complete`,
          growthState: "blooming",
          completionRate,
        };
      }

      if (completionRate >= 35) {
        return {
          icon: levelEmojis.focus,
          label: "Taking root",
          sublabel: `${focusCount} focus${focusCount !== 1 ? "es" : ""} active`,
          growthState: "growing",
          completionRate,
        };
      }

      return {
        icon: levelEmojis.intention,
        label: "Just planted",
        sublabel: `${totalIntentions - doneIntentions} to go`,
        growthState: "sprouting",
        completionRate,
      };
    };

    const renderLaneColumn = (
      label: string,
      level: GoalLevel,
      items: Goal[],
      _visionId: string,
    ) => {
      const visible = items.slice(0, 2);
      const chips =
        visible.length > 0
          ? visible
              .map(
                (item) => `
              <div class="living-garden-chip ${item.status === "done" ? "is-complete" : ""} ${microWinPulseId === item.id ? "is-pulsing" : ""}" data-action="open-goal" data-goal-id="${escapeHtmlFn(item.id)}">
                ${item.icon ? `<span class="living-garden-emoji">${escapeHtmlFn(item.icon)}</span>` : ""}
                <div class="living-garden-chip-text">
                  <span class="living-garden-chip-title">${escapeHtmlFn(item.title)}</span>
                  <span class="living-garden-chip-meta">${label}</span>
                </div>
              </div>
            `,
              )
              .join("")
          : `<div class="living-garden-chip living-garden-chip--empty">Ready to plant</div>`;
      return `
        <div class="living-garden-lane-column" data-level="${level}">
          <div class="living-garden-lane-label">${label}</div>
          <div class="living-garden-lane-chips">
            ${chips}
          </div>
        </div>
      `;
    };

    const renderLane = (plot: (typeof ecosystem)[number]) => {
      const growth = getGrowthMeta(plot);
      const accentStyle = plot.accent
        ? `--garden-accent: ${plot.accent.color}; --garden-accent-gradient: linear-gradient(120deg, ${plot.accent.color} 0%, ${plot.accent.color}22 100%);`
        : "";

      // Dynamic sublabel based on actual content
      const laneSublabel = plot.isAlive
        ? `${plot.milestones.length} milestone${plot.milestones.length !== 1 ? "s" : ""}, ${plot.focuses.length} focus${plot.focuses.length !== 1 ? "es" : ""}`
        : "Start your journey";

      return `
        <div class="living-garden-lane" style="${accentStyle}" data-vision-id="${escapeHtmlFn(plot.vision.id)}" data-growth="${growth.growthState}">
          <div class="living-garden-lane-header">
            <button class="living-garden-lane-title" data-action="open-goal" data-goal-id="${escapeHtmlFn(plot.vision.id)}">
              ${plot.vision.icon ? `<span class="living-garden-emoji">${escapeHtmlFn(plot.vision.icon)}</span>` : ""}
              <div>
                <div class="living-garden-lane-name">${escapeHtmlFn(plot.vision.title)}</div>
                <div class="living-garden-lane-sub">${laneSublabel}</div>
              </div>
            </button>
            <div class="living-garden-lane-growth">
              <span class="living-garden-lane-growth-icon">${growth.icon}</span>
              <div class="living-garden-lane-growth-text">
                <span>${growth.label}</span>
                <small>${growth.sublabel}</small>
              </div>
            </div>
          </div>
          <div class="living-garden-lane-body">
            <div class="living-garden-lane-spine"></div>
            <div class="living-garden-lane-columns">
              ${renderLaneColumn("Milestones", "milestone", plot.milestones, plot.vision.id)}
              ${renderLaneColumn("Focuses", "focus", plot.focuses, plot.vision.id)}
              ${renderLaneColumn("Intentions", "intention", plot.intentions, plot.vision.id)}
            </div>
          </div>
          ${
            !plot.isAlive && onAddGoalLinked
              ? `<div class="living-garden-lane-actions">
                  <button class="living-garden-btn-secondary" data-action="add-milestone" data-vision-id="${escapeHtmlFn(plot.vision.id)}">Plant a milestone</button>
                </div>`
              : ""
          }
        </div>
      `;
    };

    const lanesMarkup =
      visions.length === 0
        ? `
        <div class="living-garden-empty">
          <div class="living-garden-empty-icon">🌱</div>
          <h2>Ready to plant a vision?</h2>
          <p>Pick one area to nurture this week. We’ll connect milestones, focuses, and intentions for you.</p>
          ${
            onAddGoal
              ? `<div class="living-garden-empty-actions">
                  <button class="living-garden-btn-primary" data-action="add-vision">Plant your first vision</button>
                  <button class="living-garden-btn-secondary" data-action="add-focus">Start with a focus</button>
                </div>`
              : ""
          }
        </div>
      `
        : `
        <div class="living-garden-lanes ${isMobile ? "living-garden-lanes--mobile" : ""}">
          ${ecosystem.map((plot) => renderLane(plot)).join("")}
        </div>
      `;

    const reflectionSection =
      reflectionOpen && !isMobile
        ? `
        <div class="living-garden-reflection">
          <div class="living-garden-reflection-header">
            <h3>Weekly Garden Reflection</h3>
            <button class="living-garden-reflection-close" data-action="toggle-reflection">×</button>
          </div>
          <div class="living-garden-reflection-body">
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
        : "";

    const currentActiveGoal = activeGoalId ? Goals.getById(activeGoalId) : null;
    if (activeGoalId && !currentActiveGoal) {
      activeGoalId = null;
    }

    if (activeGoalId && currentActiveGoal) {
      const year = State.viewingYear;
      const detailMarkup = GoalDetailRenderer.buildMarkup(currentActiveGoal, escapeHtmlFn, {
        showAddChildAction: Boolean(onAddGoalLinked || onAddGoal),
      });
      container.className = `garden-view-container living-garden${isMobile ? " living-garden--mobile" : ""}`;
      container.innerHTML = `
        <div class="garden-view">
          <div class="week-view-header">
            <h2 class="week-view-title">${year} Garden</h2>
          </div>
          <div class="living-garden-container living-garden-container--bare">
            ${detailMarkup}
          </div>
        </div>
      `;

      const detailRoot = container.querySelector(".living-garden-detail") as HTMLElement | null;
      if (detailRoot) {
        GoalDetailRenderer.hydrate(detailRoot, {
          onOpenGoal: (goalId) => {
            activeGoalId = goalId;
            eventBus.emit("view:changed", { transition: false });
          },
          onOpenGoalEdit: (goalId) => {
            onGoalClick(goalId);
          },
          onAddChildGoal: (opts) => {
            if (opts.childLevel === "intention") {
              onAddGoal?.("intention");
              return;
            }
            if (!onAddGoalLinked) {
              onAddGoal?.(opts.childLevel);
              return;
            }
            onAddGoalLinked({
              level: opts.childLevel,
              parentId: opts.parentId,
              parentLevel: opts.parentLevel,
              preselectedMonth: viewDate.getMonth(),
              preselectedYear: viewDate.getFullYear(),
            });
          },
          onClose: () => {
            activeGoalId = null;
            eventBus.emit("view:changed", { transition: false });
          },
        });
      }

      return;
    }

    const viewingYear = State.viewingYear;
    container.className = `garden-view-container living-garden${isMobile ? " living-garden--mobile" : ""}`;
    container.innerHTML = `
      <div class="garden-view">
        <div class="week-view-header">
          <h2 class="week-view-title">${viewingYear} Garden</h2>
        </div>
        <div class="living-garden-container living-garden-container--bare">
          ${lanesMarkup}
          ${!isMobile ? reflectionSection : ""}
        </div>
      </div>
    `;

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

    // Handle add-child button clicks from empty state
    container
      .querySelectorAll<HTMLElement>("[data-action='add-child']")
      .forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const parentId = btn.dataset.parentId;
          const parentLevel = btn.dataset.parentLevel as GoalLevel;
          const childLevel = btn.dataset.childLevel as "milestone" | "focus";
          if (!parentId || !childLevel || !onAddGoalLinked) return;
          onAddGoalLinked({
            level: childLevel,
            parentId,
            parentLevel,
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
          if (goalId) {
            activeGoalId = goalId;
            eventBus.emit("view:changed", { transition: false });
          }
        });
      });

    container
      .querySelector<HTMLElement>("[data-action='goal-back']")
      ?.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        activeGoalId = null;
        eventBus.emit("view:changed", { transition: false });
      });

    container
      .querySelector<HTMLElement>("[data-action='open-goal-edit']")
      ?.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const goalId = (e.currentTarget as HTMLElement).dataset.goalId;
        if (goalId) onGoalClick(goalId);
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
