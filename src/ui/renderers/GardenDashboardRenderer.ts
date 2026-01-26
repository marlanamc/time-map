import { State } from "../../core/State";
import { Goals } from "../../core/Goals";
import { eventBus } from "../../core/EventBus";
import type { UIElements } from "../../types";
import { NDSupport } from "../../features/ndSupport";
import { getVisionAccent } from "../../utils/goalLinkage";
import { isIntentionActiveOnDate } from "../../utils/intentionVisibility";
import { GoalEstablishment } from "../../features/garden/GoalEstablishment";

/**
 * GardenDashboardRenderer (V3: Grounding & Focus)
 *
 * A centered, calming "Now & Next" dashboard.
 * - Center Stage: The single most important thing right now.
 * - Drawer: The "Map" (Goal Tree) accessible but tucked away.
 * - Tools: Non-intrusive floating buttons.
 */

let isDrawerOpen = false;

export const GardenDashboardRenderer = {
  render(
    elements: UIElements,
    escapeHtmlFn: (text: string) => string,
    onGoalClick: (goalId: string) => void,
    _onAddGoal?: (level: any) => void,
  ) {
    if (!State.data) return;
    const container = elements.calendarGrid;
    if (!container) return;

    // Preserve base class and add garden-specific classes
    container.classList.add("garden-view-wrapper");
    container.classList.remove("year-view-container", "month-view-container", "week-view-container");
    if (!container.classList.contains("calendar-grid")) {
      container.classList.add("calendar-grid");
    }

    // 1. Data Prep
    const allGoals = Goals.getAll();
    const today = new Date();
    const isTimerRunning = NDSupport.getBodyDoubleRemaining() !== null;

    // --- Header: Time Orientation ---
    const renderHeader = () => {
      const dateStr = today.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      });
      // e.g. "Morning", "Afternoon", "Evening" derived from hour
      const hour = today.getHours();
      let timeOfDay = "Day";
      if (hour < 12) timeOfDay = "Morning";
      else if (hour < 17) timeOfDay = "Afternoon";
      else timeOfDay = "Evening";

      return `
        <div class="garden-header">
            <button class="map-toggle-btn" data-action="toggle-drawer">
                <span class="icon">🗺️</span> Map
            </button>
            <div class="date-display">
                <span class="date-title">${dateStr}</span>
                <span class="date-subtitle">Good ${timeOfDay}</span>
            </div>
            <div class="header-spacer" aria-hidden="true"></div>
        </div>
      `;
    };

    // --- Drawer: The Map ---
    const renderDrawer = () => {
      const visions = allGoals.filter(
        (g) => g.level === "vision" && g.status !== "archived",
      );

      return `
        <div class="garden-drawer">
            <div class="drawer-header">
                <span class="drawer-title">Your Ecosystem</span>
                <button class="drawer-close" data-action="toggle-drawer">×</button>
            </div>
            <div class="drawer-content">
                ${visions
                  .map((v) => {
                    const milestones = allGoals.filter(
                      (m) => m.parentId === v.id && m.status !== "archived",
                    );
                    const accent = getVisionAccent(v);
                    return `
                    <div class="map-tree-item" style="--node-accent: ${accent}">
                        <div class="map-vision" data-action="open-goal" data-id="${v.id}">
                            ${v.icon || "🌳"} ${escapeHtmlFn(v.title)}
                        </div>
                        ${milestones
                          .map(
                            (m) => `
                            <div class="map-milestone">• ${escapeHtmlFn(m.title)}</div>
                        `,
                          )
                          .join("")}
                    </div>
                `;
                  })
                  .join("")}
                
                <button class="btn-secondary" style="width: 100%; margin-top: 1rem" data-action="add-vision">
                    + New Vision
                </button>
            </div>
        </div>
      `;
    };

    // --- Center Stage: The Focus ---
    const renderCenterStage = () => {
      // Priority 1: Missing Grounding (Year -> Month -> Week -> Day context)
      // Only show if timer NOT running
      const { missingType, contextFact } =
        GoalEstablishment.checkMissingGoals();

      if (missingType && !isTimerRunning) {
        let prompt = "What is your focus?";
        const placeholder = "Type here...";
        let addAction = "";
        let contextLabel = "Grounding";

        switch (missingType) {
          case "year-ahead":
            prompt = "What is your guiding star for 2026?";
            contextLabel = "Yearly Vision";
            addAction = "add-vision-quick";
            break;
          case "month-ahead":
            prompt = "What is the main milestone for this month?";
            contextLabel = "Monthly Milestone";
            addAction = "add-milestone-quick";
            break;
          case "week-ahead":
            // Adjust prompt based on day of week
            const day = today.getDay();

            if (day === 6) {
              // Saturday
              prompt = "What will be your main focus next week?";
              contextLabel = "Plan Ahead";
            } else if (day === 0) {
              // Sunday
              prompt = "What's your main focus for the coming week?";
              contextLabel = "Weekly Focus";
            } else {
              prompt = "What is your main focus for this week?";
              contextLabel = "Weekly Focus";
            }
            addAction = "add-focus-quick";
            break;
          case "morning-of":
            prompt = "What is the one thing you must do today?";
            contextLabel = "Daily Intention";
            addAction = "add-intention-quick";
            break;
        }

        return `
            <div class="focus-card">
                <div class="focus-context-label">${contextLabel}</div>
                <h1 class="focus-title">${prompt}</h1>
                <p style="color: var(--text-secondary)">${contextFact}</p>
                <div class="grounding-input-group">
                    <input type="text" id="grounding-input" class="grounding-input" placeholder="${placeholder}" autofocus />
                    <button class="grounding-submit-btn" data-action="${addAction}">➜</button>
                </div>
            </div>
        `;
      }

      // Priority 2: Active Timer
      if (isTimerRunning) {
        // Find what we are working on (active goal)
        const activeGoal = allGoals.find((g) => g.status === "in-progress");
        const remaining = NDSupport.getBodyDoubleRemaining() || 0;
        const mins = Math.floor(remaining / 60);
        const secs = remaining % 60;
        const timeStr = `${mins}:${secs.toString().padStart(2, "0")}`;

        return `
            <div class="focus-card">
                 <div class="focus-context-label">Now Focus</div>
                 <h1 class="focus-title">${activeGoal ? escapeHtmlFn(activeGoal.title) : "Deep Work"}</h1>
                 
                 <div class="active-timer-display">
                    <div class="timer-digits">${timeStr}</div>
                 </div>

                 <div class="action-area">
                    <button class="btn-secondary" data-action="stop-timer">Pause</button>
                    ${activeGoal ? `<button class="btn-engaging" data-action="complete-goal" data-id="${activeGoal.id}">✓ Done</button>` : ""}
                 </div>
            </div>
        `;
      }

      // Priority 3: Ready to Start (Next up)
      // Find an intention
      const intentions = allGoals.filter(
        (g) =>
          g.level === "intention" &&
          g.status !== "done" &&
          g.status !== "archived" &&
          isIntentionActiveOnDate(g, today),
      );
      const nextGoal =
        intentions.find((g) => g.status === "in-progress") || intentions[0];

      if (nextGoal) {
        return `
                <div class="focus-card">
                    <div class="focus-context-label">Up Next</div>
                    <h1 class="focus-title">${escapeHtmlFn(nextGoal.title)}</h1>
                    <div class="focus-status">Ready</div>

                    <div class="action-area">
                        <button class="btn-engaging" data-action="start-preset" data-id="${nextGoal.id}" data-minutes="25">
                            ⚡ Start (25m)
                        </button>
                         <button class="btn-secondary" data-action="start-preset" data-id="${nextGoal.id}" data-minutes="5">
                            Just 5m
                        </button>
                    </div>
                </div>
            `;
      }

      // Fallback: Empty State
      return `
            <div class="focus-card">
                <div style="font-size: 3rem">🌱</div>
                <h1 class="focus-title">Quiet in the Garden</h1>
                <p>No immediate tasks. Breathe.</p>
                <button class="btn-engaging" data-action="add-intention">
                    + New Intention
                </button>
            </div>
        `;
    };

    // --- Next Steps List ---
    const renderNextSteps = () => {
      if (isTimerRunning) return ""; // Hide distractions when focused
      const intentions = allGoals
        .filter(
          (g) =>
            g.level === "intention" &&
            g.status !== "done" &&
            g.status !== "archived" &&
            isIntentionActiveOnDate(g, today),
        )
        .slice(0, 3);

      if (intentions.length <= 1) return ""; // Don't show if only 1 (it's in center)

      return `
            <div class="next-steps-container">
                <span class="section-label">On Deck</span>
                <div class="next-steps-list">
                    ${intentions
                      .slice(1)
                      .map(
                        (g) => `
                        <div class="next-step-item" data-action="open-goal" data-id="${g.id}">
                            <div class="next-step-scaffold"></div>
                            <span class="next-step-text">${escapeHtmlFn(g.title)}</span>
                        </div>
                    `,
                      )
                      .join("")}
                </div>
            </div>
        `;
    };

    // --- Tools ---
    const renderTools = () => `
        <div class="floating-tools">
            <button class="tool-fab" data-action="breathe" title="Breathe">🌬️</button>
            <button class="tool-fab" data-action="dopamine" title="Dopamine">🍬</button>
            <button class="tool-fab" data-action="brain-dump" title="Brain Dump">🧠</button>
        </div>
    `;

    // --- Assembly ---
    container.innerHTML = `
        <div class="garden-view-container ${isDrawerOpen ? "drawer-open" : ""}">
            ${renderDrawer()}

            <div class="garden-center-stage">
                ${renderHeader()}
                <div class="focus-card-container">
                    ${renderCenterStage()}
                    ${renderNextSteps()}
                </div>
                ${renderTools()}
            </div>
        </div>
    `;

    // --- Event Listeners ---

    // Drawer Toggle
    container
      .querySelectorAll('[data-action="toggle-drawer"]')
      .forEach((el) => {
        el.addEventListener("click", () => {
          isDrawerOpen = !isDrawerOpen;
          eventBus.emit("view:changed", { transition: false });
        });
      });

    // Goals interaction
    container.querySelectorAll('[data-action="open-goal"]').forEach((el) => {
      el.addEventListener("click", (e) => {
        const id = (e.currentTarget as HTMLElement).dataset.id;
        if (id) onGoalClick(id);
      });
    });

    // Timer Logic
    if (isTimerRunning) {
      const timerEl = container.querySelector(".timer-digits");
      if (timerEl) {
        const interval = setInterval(() => {
          const rem = NDSupport.getBodyDoubleRemaining();
          if (rem === null) {
            clearInterval(interval);
            eventBus.emit("view:changed", { transition: false });
            return;
          }
          const m = Math.floor(rem / 60);
          const s = rem % 60;
          timerEl.textContent = `${m}:${s.toString().padStart(2, "0")}`;
        }, 1000);
      }
    }

    // Start Timer
    container.querySelectorAll('[data-action="start-preset"]').forEach((el) => {
      el.addEventListener("click", (e) => {
        const btn = e.currentTarget as HTMLElement;
        const id = btn.dataset.id;
        const mins = parseInt(btn.dataset.minutes || "25");
        if (id) {
          Goals.update(id, { status: "in-progress" });
          NDSupport.startBodyDouble(mins);
          eventBus.emit("view:changed", { transition: false });
        }
      });
    });

    // Stop Timer
    container
      .querySelector('[data-action="stop-timer"]')
      ?.addEventListener("click", () => {
        NDSupport.startBodyDouble(0.001); // Kill it
        setTimeout(
          () => eventBus.emit("view:changed", { transition: false }),
          50,
        );
      });

    // Complete Goal
    container
      .querySelector('[data-action="complete-goal"]')
      ?.addEventListener("click", (e) => {
        const id = (e.currentTarget as HTMLElement).dataset.id;
        if (id) {
          Goals.update(id, {
            status: "done",
            completedAt: new Date().toISOString(),
            progress: 100,
          });
          NDSupport.startBodyDouble(0.001);
          showCelebration();
          setTimeout(
            () => eventBus.emit("view:changed", { transition: false }),
            1500,
          );
        }
      });

    // Quick Add Handlers
    const handleAdd = (level: any, inputId: string = "#grounding-input") => {
      console.log("handleAdd called with level:", level);
      const input = container.querySelector(inputId) as HTMLInputElement;
      console.log("input element:", input);
      console.log("input value:", input?.value);
      if (!input || !input.value.trim()) {
        console.log("No input or empty value, returning");
        return;
      }
      console.log("Creating goal:", input.value.trim(), "with level:", level);
      Goals.create({ title: input.value.trim(), level });
      eventBus.emit("view:changed", { transition: false });
    };

    container
      .querySelector('[data-action="add-vision-quick"]')
      ?.addEventListener("click", () => handleAdd("vision"));
    container
      .querySelector('[data-action="add-milestone-quick"]')
      ?.addEventListener("click", () => handleAdd("milestone"));
    container
      .querySelector('[data-action="add-focus-quick"]')
      ?.addEventListener("click", () => {
        console.log("add-focus-quick clicked");
        handleAdd("focus");
      });
    container
      .querySelector('[data-action="add-intention-quick"]')
      ?.addEventListener("click", () => {
        console.log("add-intention-quick clicked");
        handleAdd("intention");
      });

    // Handle Enter key on input
    const gInput = container.querySelector(
      "#grounding-input",
    ) as HTMLInputElement;
    if (gInput) {
      gInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          const btn = gInput.nextElementSibling as HTMLElement;
          btn?.click();
        }
      });
    }

    // Tools
    container
      .querySelector('[data-action="breathe"]')
      ?.addEventListener("click", () => showBreathingExercise());
    container
      .querySelector('[data-action="dopamine"]')
      ?.addEventListener("click", () => NDSupport.showDopamineMenu());

    // Brain Dump
    container
      .querySelector('[data-action="brain-dump"]')
      ?.addEventListener("click", () => {
        const overlay = document.createElement("div");
        overlay.className = "celebration-overlay"; // Reuse overlay base
        overlay.innerHTML = `
            <div class="focus-card" style="width: 100%; max-width: 500px">
                <h2>Brain Dump</h2>
                <textarea id="bd-text" style="width:100%; height:150px; background:var(--surface-2); border:1px solid var(--divider); border-radius:var(--radius-md); padding:1rem; color:var(--text-primary); resize:none" placeholder="Get it out of your head..."></textarea>
                <div class="action-area">
                    <button class="btn-secondary" id="bd-cancel">Close</button>
                    <button class="btn-engaging" id="bd-save">Save to Inbox</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        (overlay.querySelector("#bd-text") as HTMLElement)?.focus();

        overlay
          .querySelector("#bd-cancel")
          ?.addEventListener("click", () => overlay.remove());
        overlay.querySelector("#bd-save")?.addEventListener("click", () => {
          const val = (overlay.querySelector("#bd-text") as HTMLTextAreaElement)
            .value;
          if (val.trim()) {
            NDSupport.addToBrainDump(val.trim());
            // Show brief success feedback
            const btn = overlay.querySelector("#bd-save") as HTMLElement;
            btn.textContent = "Saved!";
            btn.style.background = "var(--success)";
            setTimeout(() => overlay.remove(), 800);
          }
        });
      });

    // Helper: Reuse existing celebration/breathing if possible, or redefine simply
    // (copying simplified versions to ensure self-containment)
    function showCelebration() {
      const overlay = document.createElement("div");
      overlay.className = "celebration-overlay";
      overlay.innerHTML = `<div class="celebration-content"><div style="font-size:5rem">🌸</div></div>`;
      document.body.appendChild(overlay);
      setTimeout(() => overlay.remove(), 1500);
    }

    function showBreathingExercise() {
      // Reuse the logic from previous version or simplified
      const overlay = document.createElement("div");
      overlay.className = "breathing-overlay";
      overlay.innerHTML = `
            <div class="breathing-container">
                <div class="breathing-circle" style="animation: breathe-anim 4s infinite alternate"></div>
                <h2>Breathe</h2>
                <button id="close-breathe" class="btn-secondary" style="color:white; border-color:white; margin-top:20px">Done</button>
            </div>
         `;
      document.body.appendChild(overlay);
      overlay
        .querySelector("#close-breathe")
        ?.addEventListener("click", () => overlay.remove());
    }
  },
};
