import type { Goal } from "../../types";
import { CardComponent } from "./CardComponent";
import { TimeSlotCalculator } from "./TimeSlotCalculator";
import { TimelineGrid } from "./TimelineGrid";
import { renderIntentionsGrid } from "./IntentionsGrid";
import { renderCustomizationPanel } from "./CustomizationPanel";
import { State } from "../../core/State";
import type { EventInstance } from "../../utils/recurrence";
import { expandEventsForRange } from "../../utils/recurrence";
import { formatCountdown, formatTo12Hour } from "../../utils/time";
import { getGoalEmoji } from "../../utils/goalVisuals";
import type { TimelineItem, PositionedTimelineItem } from "./types";

/**
 * Renderer for the Planner-style day view
 * @remarks Displays goals in a planner layout with a sidebar showing task cloud,
 * ongoing tasks, and upcoming tasks, alongside a timeline view for scheduled items.
 */
export class PlannerDayViewRenderer {
  private container: HTMLElement;
  private calculator: TimeSlotCalculator;
  private timelineGrid: TimelineGrid;
  private todayEvents: EventInstance[] = [];
  private activeDate: Date | null = null;
  private pastHoursExpanded: boolean = false;

  /**
   * Generate SVG icon markup
   * @param name - The icon type to generate
   * @returns SVG markup as a string
   * @private
   */
  private icon(name: "plus" | "eye" | "minus" | "calendar"): string {
    if (name === "plus") {
      return `
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
      `;
    }
    if (name === "minus") {
      return `
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
      `;
    }
    if (name === "calendar") {
      return `
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <rect x="3" y="4" width="18" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="2" />
          <path d="M16 2v4M8 2v4M3 10h18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
      `;
    }
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" fill="none" stroke="currentColor" stroke-width="2" />
        <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2" />
      </svg>
    `;
  }

  /**
   * Creates a new PlannerDayViewRenderer instance
   * @param container - The DOM element that will contain the planner view
   * @param _cardComponent - Card component for rendering (unused but kept for interface compatibility)
   * @param calculator - Time slot calculator for timeline positioning
   * @param timelineGrid - Timeline grid renderer
   */
  constructor(
    container: HTMLElement,
    _cardComponent: CardComponent,
    calculator: TimeSlotCalculator,
    timelineGrid: TimelineGrid,
  ) {
    this.container = container;
    this.calculator = calculator;
    this.timelineGrid = timelineGrid;
  }

  /**
   * Render the initial planner view
   * @param date - The date to display
   * @param allGoals - All goals in the system (will be filtered for this date)
   * @param contextGoals - Optional Vision/Milestone/Focus goals to display in sidebar
   * @remarks Creates a complete planner layout with sidebar sections and a timeline.
   */
  renderInitial(
    date: Date,
    allGoals: Goal[],
    contextGoals?: { vision: Goal[]; milestone: Goal[]; focus: Goal[] },
  ): void {
    this.activeDate = date;
    const dayGoals = allGoals
      .filter((g) => this.isGoalForDate(g, date))
      .filter((g) => g.level === "intention");

    // Split goals
    const sortDoneLast = (a: Goal, b: Goal) =>
      Number(a.status === "done") - Number(b.status === "done");

    const scheduled = dayGoals
      .filter((g) => this.isGoalScheduledForDate(g, date))
      .slice()
      .sort(sortDoneLast);

    const unscheduled = dayGoals
      .filter((g) => !this.isGoalScheduledForDate(g, date))
      .slice()
      .sort(sortDoneLast);

    const todayIntentions = dayGoals.slice().sort((a, b) => {
      const aDone = Number(a.status === "done");
      const bDone = Number(b.status === "done");
      if (aDone !== bDone) return aDone - bDone;

      const aHasTime = Number(this.isGoalScheduledForDate(a, date));
      const bHasTime = Number(this.isGoalScheduledForDate(b, date));
      if (aHasTime !== bHasTime) return bHasTime - aHasTime;

      const aStart = this.getScheduledStartMin(a, date) ?? 9999;
      const bStart = this.getScheduledStartMin(b, date) ?? 9999;
      if (aStart !== bStart) return aStart - bStart;

      return a.title.localeCompare(b.title);
    });

    // Format date as "Monday, December 29th"
    const weekday = date.toLocaleDateString("en-US", { weekday: "long" });
    const month = date.toLocaleDateString("en-US", { month: "long" });
    const day = date.getDate();
    const ordinal =
      day % 10 === 1 && day !== 11
        ? "st"
        : day % 10 === 2 && day !== 12
          ? "nd"
          : day % 10 === 3 && day !== 13
            ? "rd"
            : "th";
    const dayName = `${weekday}, ${month} ${day}${ordinal}`;

    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);
    const eventsToday = State.data?.events
      ? expandEventsForRange(State.data.events, dayStart, dayEnd)
      : [];
    this.todayEvents = eventsToday;
    const formatEventTime = (iso: string, allDay: boolean) => {
      if (allDay) return "All day";
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    };

    // 1. Prepare items for unified layout
    const timelineItems: TimelineItem[] = [];

    // Add scheduled goals
    scheduled.forEach((goal) => {
      const startMin = this.getScheduledStartMin(goal, date);
      if (startMin === null) return;

      const duration = this.calculator.parseTimeToMinutes(goal.endTime)
        ? this.calculator.parseTimeToMinutes(goal.endTime)! - startMin
        : 60;
      const endMin = Math.max(startMin + 15, startMin + duration);

      timelineItems.push({
        startMin,
        endMin,
        data: goal,
        type: "goal",
      });
    });

    // Add external events
    this.todayEvents.forEach((ev) => {
      if (ev.allDay) return;
      const start = new Date(ev.startAt);
      const end = ev.endAt ? new Date(ev.endAt) : new Date(start);
      const startMin = start.getHours() * 60 + start.getMinutes();
      const endMin = Math.max(
        startMin + 15,
        end.getHours() * 60 + end.getMinutes(),
      );

      timelineItems.push({
        startMin,
        endMin,
        data: ev,
        type: "event",
      });
    });

    // 2. Calculate unified layout
    const positionedItems = this.calculator.calculateLayout(timelineItems);

    const html = `
          <div class="day-view planner-day-view">
            <aside class="planner-sidebar">
              <div class="planner-sidebar-header">
                <h3>${dayName}</h3>
              <div class="planner-sidebar-actions">
                <div class="planner-date-nav" role="group" aria-label="Day navigation">
                  <button class="btn-icon btn-planner-prev" type="button" aria-label="Previous day" title="Previous day">‹</button>
                  <button class="btn-icon btn-planner-next" type="button" aria-label="Next day" title="Next day">›</button>
                </div>
                <button class="btn-icon btn-planner-event" type="button" aria-label="Add event" title="Add event">
                  ${this.icon("calendar")}
                </button>
                <button class="btn-icon btn-planner-add" type="button" aria-label="Add task" title="Add task">
                  ${this.icon("plus")}
                </button>
              </div>
            </div>

            ${contextGoals ? this.renderContextSection(contextGoals) : ""}

            ${
              eventsToday.length > 0
                ? `
            <div class="planner-sidebar-section">
              <div class="section-title">Today's events</div>
              <div class="sidebar-list">
                ${eventsToday
                  .slice(0, 8)
                  .map(
                    (ev) => `
                      <button type="button" class="planner-event-item" data-action="edit-event" data-event-id="${
                        ev.originalId
                      }">
                        <div class="planner-event-title">${ev.title}</div>
                        <div class="planner-event-meta">${formatEventTime(
                          ev.startAt,
                          ev.allDay,
                        )}${
                          ev.endAt && !ev.allDay
                            ? `–${formatEventTime(ev.endAt, false)}`
                            : ""
                        }</div>
                      </button>
                    `,
                  )
                  .join("")}
                ${
                  eventsToday.length > 8
                    ? `<div class="empty-list">+${
                        eventsToday.length - 8
                      } more</div>`
                    : ""
                }
              </div>
            </div>
            `
                : ""
            }

            <div class="planner-sidebar-section">
              <div class="section-title">Today’s intentions</div>
              <div class="sidebar-list">
                ${todayIntentions
                  .map((g) => this.renderSidebarItem(g, Boolean(g.startTime)))
                  .join("")}
                ${
                  todayIntentions.length === 0
                    ? '<div class="empty-list">No intentions yet</div>'
                    : ""
                }
              </div>
            </div>

          <div class="planner-sidebar-section">
            <div class="sidebar-section-header">
              <div class="sidebar-section-left">
                <span class="sidebar-section-title">Quick intentions</span>
                <button
                  type="button"
                  class="sidebar-section-action-btn"
                  data-action="customize"
                  aria-label="Edit quick intentions"
                  title="Edit quick intentions"
                >
                  ✏️
                </button>
              </div>
            </div>
            ${renderIntentionsGrid()}
          </div>
        </aside>

        <main class="planner-main">
          ${
            unscheduled.length > 0
              ? `
            <div class="planner-unscheduled-section">
              <div class="planner-unscheduled-header">
                <h4 class="planner-unscheduled-title">Unscheduled</h4>
              </div>
              <div class="planner-unscheduled-list">
                ${unscheduled
                  .map((g) => this.renderUnscheduledTask(g))
                  .join("")}
              </div>
            </div>
          `
              : ""
          }
          <div class="planner-timeline-container day-timeline" data-past-hours-expanded="${this.pastHoursExpanded}">
            ${this.renderPastHoursToggle()}
            ${this.renderTopCurrentTime()}
            ${this.timelineGrid.render(this.activeDate, this.pastHoursExpanded)}
            <div class="planner-timeline-content">
              ${positionedItems
                .map((item) =>
                  item.type === "goal"
                    ? this.renderTimedTask(item as any, date)
                    : this.renderTimelineEvent(item as any),
                )
                .join("")}
            </div>
          </div>
        </main>
      </div>
      ${renderCustomizationPanel()}
    `;

    this.container.innerHTML = html;
    this.container.className = "day-view-container planner-style";
    
    // Set up past hours toggle
    this.setupPastHoursToggle();
    
    // Update current time indicator position after render
    const timelineContainer = this.container.querySelector('.planner-timeline-container') as HTMLElement | null;
    if (timelineContainer) {
      this.updateCurrentTimeIndicatorPosition(timelineContainer);
    }
  }
  
  /**
   * Set up the past hours toggle button
   */
  private setupPastHoursToggle(): void {
    const toggleBtn = this.container.querySelector(
      '[data-action="toggle-past-hours"]'
    ) as HTMLElement | null;
    
    if (!toggleBtn) return;
    
    toggleBtn.addEventListener('click', () => {
      this.pastHoursExpanded = !this.pastHoursExpanded;
      const timelineContainer = this.container.querySelector(
        ".planner-timeline-container"
      ) as HTMLElement | null;
      const gridEl = this.container.querySelector(
        ".day-bed-grid"
      ) as HTMLElement | null;
      
      if (timelineContainer) {
        timelineContainer.dataset.pastHoursExpanded = String(this.pastHoursExpanded);
        toggleBtn.setAttribute('aria-expanded', String(this.pastHoursExpanded));
        
        // Update CSS variable for grid positioning when collapsing/expanding
        // Show one hour before current time
        // Use minutesToPercent to match the indicator calculation
        if (!this.pastHoursExpanded && this.activeDate && this.isToday(this.activeDate)) {
          const now = new Date();
          const currentHour = now.getHours();
          const hourBeforeCurrent = currentHour - 1;
          const hourBeforeMinutes = hourBeforeCurrent * 60;
          const hourBeforePercent = this.calculator.minutesToPercent(hourBeforeMinutes);
          
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/4467fe45-6449-42ed-a52d-b93a0f522e1a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PlannerDayViewRenderer.ts:setupPastHoursToggle',message:'Grid transform calculation - using minutesToPercent',data:{now:now.toISOString(),currentHour,hourBeforeCurrent,hourBeforeMinutes,hourBeforePercent,cssVarValue:hourBeforePercent.toFixed(4),pastHoursExpanded:this.pastHoursExpanded},timestamp:Date.now(),sessionId:'debug-session',runId:'run4',hypothesisId:'F'})}).catch(()=>{});
          // #endregion
          
          timelineContainer.style.setProperty(
            '--current-hour-pos',
            hourBeforePercent.toFixed(4)
          );
        } else {
          timelineContainer.style.removeProperty('--current-hour-pos');
        }
        
        // Update current time indicator position
        this.updateCurrentTimeIndicatorPosition(timelineContainer);
        
        const toggleText = toggleBtn.querySelector('.past-hours-toggle-text');
        const toggleIcon = toggleBtn.querySelector('.past-hours-toggle-icon');
        
        if (toggleText) {
          toggleText.textContent = this.pastHoursExpanded 
            ? "Hide earlier hours" 
            : "Show earlier hours";
        }
        if (toggleIcon) {
          toggleIcon.textContent = this.pastHoursExpanded ? "⌄" : "›";
        }
        
        // Update the grid element classes
        if (gridEl && this.activeDate) {
          this.timelineGrid.updateElement(gridEl, this.activeDate, this.pastHoursExpanded);
        }
        
        // Update timeline content items visibility
        const contentItems = timelineContainer.querySelectorAll(
          '.planner-timeline-content [data-is-past="true"]'
        );
        contentItems.forEach((item) => {
          const itemEl = item as HTMLElement;
          if (this.pastHoursExpanded) {
            itemEl.style.display = '';
            itemEl.style.opacity = '1';
          } else {
            itemEl.style.display = 'none';
            itemEl.style.opacity = '0';
          }
        });
      }
    });
  }
  
  /**
   * @deprecated Scroll-to-time feature removed - current time indicator is now pinned at top
   */
  private scrollToCurrentHour_DEPRECATED(): void {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/4467fe45-6449-42ed-a52d-b93a0f522e1a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PlannerDayViewRenderer.ts:338',message:'scrollToCurrentHour called',data:{hasActiveDate:!!this.activeDate},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    requestAnimationFrame(() => {
      const timelineContainer = this.container.querySelector(
        ".planner-timeline-container"
      ) as HTMLElement | null;
      
      if (!timelineContainer || !this.activeDate) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/4467fe45-6449-42ed-a52d-b93a0f522e1a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PlannerDayViewRenderer.ts:349',message:'scrollToCurrentHour early return: missing elements',data:{hasTimelineContainer:!!timelineContainer,hasActiveDate:!!this.activeDate},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        return;
      }
      
      // Find the actual scrollable container (canvas-container or main-content)
      let scrollContainer: HTMLElement | null = this.container.closest(".canvas-container");
      if (!scrollContainer) {
        scrollContainer = this.container.closest(".main-content");
      }
      if (!scrollContainer) {
        // Fallback to planner-main if parent containers not found
        scrollContainer = this.container.querySelector(".planner-main");
      }
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/4467fe45-6449-42ed-a52d-b93a0f522e1a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PlannerDayViewRenderer.ts:360',message:'scroll container lookup',data:{hasScrollContainer:!!scrollContainer,scrollContainerClass:scrollContainer?.className,scrollContainerScrollTop:scrollContainer?.scrollTop,scrollContainerScrollHeight:scrollContainer?.scrollHeight,scrollContainerClientHeight:scrollContainer?.clientHeight},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      
      if (!scrollContainer) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/4467fe45-6449-42ed-a52d-b93a0f522e1a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PlannerDayViewRenderer.ts:365',message:'no scroll container found',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        return;
      }
      
      const currentHour = this.activeDate.getHours();
      
      // Find the current hour element in the timeline grid
      const gridEl = timelineContainer.querySelector(".day-bed-grid") as HTMLElement | null;
      if (!gridEl) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/4467fe45-6449-42ed-a52d-b93a0f522e1a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PlannerDayViewRenderer.ts:445',message:'no grid element found',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
        // #endregion
        return;
      }
      
      // Find the hour element for the current hour
      const currentHourEl = gridEl.querySelector(
        `.bed-hour[data-hour="${currentHour}"]`
      ) as HTMLElement | null;
      
      if (!currentHourEl) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/4467fe45-6449-42ed-a52d-b93a0f522e1a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PlannerDayViewRenderer.ts:453',message:'current hour element not found',data:{currentHour},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
        // #endregion
        return;
      }
      
      // Get positions relative to the scroll container
      const scrollContainerRect = scrollContainer.getBoundingClientRect();
      const timelineRect = timelineContainer.getBoundingClientRect();
      const currentHourRect = currentHourEl.getBoundingClientRect();
      
      // Find the toggle button and current time indicator to account for their heights
      const toggleBtn = timelineContainer.querySelector(
        '.past-hours-toggle'
      ) as HTMLElement | null;
      const currentTimeIndicator = timelineContainer.querySelector(
        '.current-time-top-indicator'
      ) as HTMLElement | null;
      
      const toggleBtnHeight = toggleBtn ? toggleBtn.getBoundingClientRect().height : 0;
      const currentTimeHeight = currentTimeIndicator ? currentTimeIndicator.getBoundingClientRect().height : 0;
      const totalTopSpace = toggleBtnHeight + currentTimeHeight + 8; // 8px spacing
      
      // Calculate where we want the current hour to be (directly under the current time indicator)
      // The current hour's top position relative to the scroll container viewport
      const currentHourTopRelativeToViewport = currentHourRect.top - scrollContainerRect.top;
      
      // We want the hour positioned at: toggle button + current time indicator + spacing from the top of the timeline
      // The timeline's top relative to the scroll container viewport
      const timelineTopRelativeToViewport = timelineRect.top - scrollContainerRect.top;
      const targetPosition = timelineTopRelativeToViewport + totalTopSpace;
      
      // Calculate how much we need to scroll to position the hour at the target
      const scrollNeeded = currentHourTopRelativeToViewport - targetPosition;
      
      // Calculate the new scroll position
      const scrollPosition = scrollContainer.scrollTop + scrollNeeded;
      
      // Clamp to valid scroll range
      const maxScroll = scrollContainer.scrollHeight - scrollContainer.clientHeight;
      const clampedScrollPosition = Math.max(0, Math.min(scrollPosition, maxScroll));
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/4467fe45-6449-42ed-a52d-b93a0f522e1a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PlannerDayViewRenderer.ts:465',message:'scroll calculation using hour element',data:{currentHour,toggleBtnHeight,currentTimeHeight,totalTopSpace,timelineTopRelativeToViewport,targetPosition,currentHourTopRelativeToViewport,scrollNeeded,scrollPosition,maxScroll,clampedScrollPosition,scrollContainerScrollTop:scrollContainer.scrollTop,scrollContainerClientHeight:scrollContainer.clientHeight,scrollContainerScrollHeight:scrollContainer.scrollHeight,currentHourRectTop:currentHourRect.top,scrollContainerRectTop:scrollContainerRect.top},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
      // #endregion
      
      // Scroll the actual scrollable container to position current hour at top
      scrollContainer.scrollTo({
        top: clampedScrollPosition,
        behavior: "smooth",
      });
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/4467fe45-6449-42ed-a52d-b93a0f522e1a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PlannerDayViewRenderer.ts:475',message:'scrollTo called',data:{scrollTop:Math.max(0,scrollPosition),behavior:'smooth',scrollContainerClass:scrollContainer.className},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
      // #endregion
      
      // Check scroll position after a delay
      setTimeout(() => {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/4467fe45-6449-42ed-a52d-b93a0f522e1a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PlannerDayViewRenderer.ts:480',message:'scroll position after delay',data:{actualScrollTop:scrollContainer.scrollTop,expectedScrollTop:clampedScrollPosition,currentHourRectTop:currentHourRect.top,scrollContainerRectTop:scrollContainerRect.top},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
        // #endregion
      }, 500);
    });
  }
  
  /**
   * Render the toggle button for past hours
   */
  private renderPastHoursToggle(): string {
    if (!this.activeDate || !this.isToday(this.activeDate)) {
      return "";
    }

    // Use real current time, not activeDate's time-of-day
    const now = new Date();
    const currentHour = now.getHours();
    if (currentHour <= 8) {
      // No past hours to collapse if current hour is 8 AM or earlier
      return "";
    }

    const toggleText = this.pastHoursExpanded
      ? "Hide earlier hours"
      : "Show earlier hours";
    const toggleIcon = this.pastHoursExpanded ? "⌄" : "›";

    return `
      <button
        type="button"
        class="past-hours-toggle"
        data-action="toggle-past-hours"
        aria-label="${toggleText}"
        aria-expanded="${this.pastHoursExpanded}">
        <span class="past-hours-toggle-icon">${toggleIcon}</span>
        <span class="past-hours-toggle-text">${toggleText}</span>
      </button>
    `;
  }

  /**
   * Render the current time indicator at a fixed location; its actual position
   * is computed after measuring the timeline grid.
   */
  private renderTopCurrentTime(): string {
    if (!this.activeDate || !this.isToday(this.activeDate)) {
      return "";
    }

    const now = new Date();
    const currentTimeMinutes = now.getHours() * 60 + now.getMinutes();
    const timeLabel = this.calculator.format12h(currentTimeMinutes);

    return `
      <div class="current-time-top-indicator" data-pinned="true">
        <div class="current-time-line"></div>
        <div class="current-time-dot"></div>
        <span class="current-time-label">${timeLabel}</span>
      </div>
    `;
  }
  
  /**
   * Check if a date is today
   */
  private isToday(date: Date): boolean {
    const today = new Date();
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    );
  }

  private getCurrentTimeMinutes(): number | null {
    if (!this.activeDate || !this.isToday(this.activeDate)) {
      return null;
    }
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  }

  /**
   * Update the current time indicator so it aligns with the measured hour grid position.
   */
  private updateCurrentTimeIndicatorPosition(timelineContainer: HTMLElement): void {
    if (!this.activeDate || !this.isToday(this.activeDate)) {
      return;
    }

    const indicator = timelineContainer.querySelector(
      ".current-time-top-indicator"
    ) as HTMLElement | null;
    const gridEl = timelineContainer.querySelector(".day-bed-grid") as HTMLElement | null;
    if (!indicator || !gridEl) {
      return;
    }

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const totalMinutes = currentHour * 60 + currentMinute;
    const timeLabel = this.calculator.format12h(totalMinutes);

    const currentHourEl = gridEl.querySelector(
      `.bed-hour[data-hour="${currentHour}"]`
    ) as HTMLElement | null;
    if (!currentHourEl) {
      return;
    }

    const timelineRect = timelineContainer.getBoundingClientRect();
    const currentHourRect = currentHourEl.getBoundingClientRect();
    const nextHourEl =
      currentHour < 23
        ? (gridEl.querySelector(
            `.bed-hour[data-hour="${currentHour + 1}"]`
          ) as HTMLElement | null)
        : null;

    let hourHeight = 0;
    if (nextHourEl) {
      hourHeight = nextHourEl.getBoundingClientRect().top - currentHourRect.top;
    } else {
      const gridRect = gridEl.getBoundingClientRect();
      const totalHours = Math.max(
        gridEl.querySelectorAll(".bed-hour").length,
        1
      );
      hourHeight = gridRect.height / totalHours;
    }

    if (hourHeight <= 0) {
      hourHeight = 1;
    }

    const minuteOffset = (currentMinute / 60) * hourHeight;
    const topPx = currentHourRect.top - timelineRect.top + minuteOffset;

    indicator.style.top = `${topPx}px`;

    const labelEl = indicator.querySelector(
      ".current-time-label"
    ) as HTMLElement | null;
    if (labelEl) {
      labelEl.textContent = timeLabel;
    }
  }

  /**
   * Update the planner view with new data
   * @param date - The date to display
   * @param allGoals - All goals in the system
   * @param contextGoals - Optional Vision/Milestone/Focus goals to display in sidebar
   * @remarks Performs selective update to preserve expand/collapse state when possible
   */
  update(
    date: Date,
    allGoals: Goal[],
    contextGoals?: { vision: Goal[]; milestone: Goal[]; focus: Goal[] },
  ): void {
    // Store expand/collapse state before re-rendering
    const expandState = this.captureExpandState();

    // Re-render
    this.renderInitial(date, allGoals, contextGoals);

    // Restore expand/collapse state
    this.restoreExpandState(expandState);
  }

  /**
   * Update a single goal
   * @param _date - The date to display (for context, unused in current implementation)
   * @param goalId - The ID of the goal to update
   * @param goal - The updated goal data
   */
  updateGoal(_date: Date, goalId: string, goal: Goal): void {
    // Find and update the goal in the current view
    const elements = this.container.querySelectorAll(
      `[data-goal-id="${goalId}"]`,
    );

    elements.forEach((element) => {
      const htmlElement = element as HTMLElement;

      // Update checkbox status
      const checkbox = element.querySelector(".day-goal-checkbox");
      if (checkbox) {
        checkbox.classList.toggle("checked", goal.status === "done");
      }

      // Update card completion status
      element.classList.toggle("completed", goal.status === "done");

      // For timed tasks, update position if time changed
      if (
        element.classList.contains("planner-timed-task") &&
        goal.startTime &&
        goal.endTime
      ) {
        const startMin =
          this.calculator.parseTimeToMinutes(goal.startTime) || 0;
        const endMin =
          this.calculator.parseTimeToMinutes(goal.endTime) || startMin + 60;
        const duration = endMin - startMin;

        // Calculate tighter positioning - account for card borders and padding
        const top = this.calculator.minutesToPercent(startMin);
        const durPct = (duration / this.calculator.getPlotRangeMin()) * 100;

        // Apply a small adjustment to fit within hour boundaries better
        const adjustedTop = Math.max(0, top - 0.1); // Slight upward adjustment
        const adjustedHeight = Math.max(1, durPct - 0.2); // Reduce height slightly

        htmlElement.style.top = `${adjustedTop}%`;
        htmlElement.style.height = `${adjustedHeight}%`;
      }
    });

    // If this is a new goal that wasn't visible before, do a full re-render
    if (elements.length === 0) {
      // Get current goals from the parent state or trigger a refresh
      const event = new CustomEvent("requestRefresh", { detail: { goalId } });
      this.container.dispatchEvent(event);
    }
  }

  /**
   * Capture expand/collapse state before re-rendering
   * @returns Object containing expand state information
   * @private
   */
  private captureExpandState(): Map<string, boolean> {
    const state = new Map<string, boolean>();

    // Capture collapsed sections
    const collapsedSections = this.container.querySelectorAll(
      ".planner-sidebar-section.collapsed",
    );
    collapsedSections.forEach((section) => {
      const sectionId = section.getAttribute("data-section-id") || "default";
      state.set(sectionId, true);
    });

    return state;
  }

  /**
   * Restore expand/collapse state after re-rendering
   * @param state - Expand state information from captureExpandState
   * @private
   */
  private restoreExpandState(state: Map<string, boolean>): void {
    state.forEach((isCollapsed, sectionId) => {
      if (isCollapsed) {
        const section =
          this.container.querySelector(`[data-section-id="${sectionId}"]`) ||
          this.container.querySelector(".planner-sidebar-section");
        if (section) {
          section.classList.add("collapsed");
        }
      }
    });
  }
  private renderSidebarItem(goal: Goal, showTime: boolean = false): string {
    const emoji = getGoalEmoji(goal);
    const startTime = formatTo12Hour(goal.startTime);
    const endTime = formatTo12Hour(goal.endTime);
    const timeStr =
      showTime && startTime
        ? `<span class="sidebar-item-time">${startTime}${
            endTime ? ` - ${endTime}` : ""
          }</span>`
        : "";

    return `
      <div class="day-goal-card sidebar-item ${
        goal.status === "done" ? "completed" : ""
      }" data-goal-id="${goal.id}">
        <div class="day-goal-checkbox ${
          goal.status === "done" ? "checked" : ""
        }"></div>
        <span class="sidebar-item-emoji">${emoji}</span>
        <span class="sidebar-item-title">${goal.title}</span>
        ${timeStr}
      </div>
    `;
  }

  /**
   * Render an unscheduled task (no time assigned)
   * @param goal - The goal to render
   * @returns HTML string for the unscheduled task card
   * @private
   */
  private renderUnscheduledTask(goal: Goal): string {
    const emoji = getGoalEmoji(goal);
    const colorClass = goal.category ? `cat-${goal.category}` : "cat-default";

    return `
      <div class="planner-unscheduled-item ${colorClass}" data-goal-id="${
        goal.id
      }">
        <div class="day-goal-checkbox ${
          goal.status === "done" ? "checked" : ""
        }"></div>
        <div class="unscheduled-task-content">
          <span class="unscheduled-task-emoji">${emoji}</span>
          <span class="unscheduled-task-title">${goal.title}</span>
        </div>
        <div class="unscheduled-task-actions">
          <button class="btn-icon btn-schedule-task" type="button" data-goal-id="${
            goal.id
          }" aria-label="Schedule" title="Schedule">${this.icon(
            "plus",
          )}</button>
          <button class="btn-zen-focus btn-icon" type="button" data-goal-id="${
            goal.id
          }" aria-label="Focus" title="Focus">${this.icon("eye")}</button>
        </div>
      </div>
    `;
  }

  /**
   * Render a timed task on the timeline
   * @param item - The positioned item to render
   * @returns HTML string for the timed task card
   * @private
   */
  private renderTimedTask(item: PositionedTimelineItem, date: Date): string {
    const goal = item.data as Goal;

    // Calculate tighter positioning - account for card borders and padding
    const top = item.startPct;
    const durPct = item.durPct;

    // Apply a small adjustment to fit within hour boundaries better
    const adjustedTop = Math.max(0, top - 0.1); // Slight upward adjustment
    const adjustedHeight = Math.max(1, durPct - 0.2); // Reduce height slightly

    const emoji = getGoalEmoji(goal);
    const colorClass = goal.category ? `cat-${goal.category}` : "cat-default";
    const startTimeForMeta =
      goal.startTime ?? this.formatTimeFromScheduled(goal, date);
    const countdownLabel = this.getCountdownLabelForTime(startTimeForMeta);
    const countdownHtml = countdownLabel
      ? `<span class="timeline-countdown" aria-hidden="true">${countdownLabel}</span>`
      : "";
    const resizeHandles =
      goal.status !== "done"
        ? `
          <div class="planter-resize-handle planter-resize-handle-top" data-resize="top"></div>
          <div class="planter-resize-handle planter-resize-handle-bottom" data-resize="bottom"></div>
        `
        : "";

    const itemHour = Math.floor(item.startMin / 60);
    const currentMinutes = this.getCurrentTimeMinutes();
    const minutesSinceEnd =
      currentMinutes !== null ? currentMinutes - item.endMin : null;
    const isPast =
      minutesSinceEnd !== null ? minutesSinceEnd > 60 : false;
    
    return `
        <div class="day-goal-card planner-timed-task day-goal-variant-planter ${colorClass}" 
             tabindex="0" 
             style="top: ${adjustedTop}%; height: ${adjustedHeight}%; --lane: ${item.lane}; --lanes: ${item.totalLanes};" 
             data-goal-id="${goal.id}"
             data-hour="${itemHour}"
             data-is-past="${isPast}">
        ${resizeHandles}
        <div class="day-goal-checkbox ${
          goal.status === "done" ? "checked" : ""
        }"></div>
        <div class="timed-task-content">
          <span class="timed-task-emoji">${emoji}</span>
          <span class="timed-task-title">${goal.title}</span>
        </div>
        <div class="timed-task-actions">
          <button class="btn-zen-focus btn-icon" type="button" data-goal-id="${
            goal.id
          }" aria-label="Focus" title="Focus">${this.icon("eye")}</button>
          <button class="btn-icon btn-planner-remove" type="button" data-goal-id="${
            goal.id
          }" aria-label="Remove from timeline" title="Remove from timeline">${this.icon(
            "minus",
          )}</button>
        </div>
      ${countdownHtml}
    </div>
    `;
  }

  private isGoalScheduledForDate(goal: Goal, date: Date): boolean {
    return Boolean(this.getScheduledDate(goal, date));
  }

  private getScheduledDate(goal: Goal, date: Date): Date | null {
    if (goal.scheduledAt) {
      const parsed = new Date(goal.scheduledAt);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }

    if (!goal.startTime) return null;
    const baseDate = goal.dueDate ? new Date(goal.dueDate) : new Date(date);
    if (Number.isNaN(baseDate.getTime())) return null;

    const [hours, minutes] = goal.startTime
      .split(":")
      .map((segment) => Number(segment));
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;

    const scheduled = new Date(baseDate);
    scheduled.setHours(hours, minutes, 0, 0);
    return scheduled;
  }

  private getScheduledStartMin(goal: Goal, date: Date): number | null {
    const scheduled = this.getScheduledDate(goal, date);
    if (!scheduled) return null;
    return scheduled.getHours() * 60 + scheduled.getMinutes();
  }

  private formatTimeFromScheduled(goal: Goal, date: Date): string | null {
    const scheduled = this.getScheduledDate(goal, date);
    if (!scheduled) return null;
    const hours = scheduled.getHours();
    const minutes = scheduled.getMinutes();
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  private renderTimelineEvent(item: PositionedTimelineItem): string {
    const event = item.data as EventInstance;

    const startMin = item.startMin;
    const endMin = item.endMin;

    const top = item.startPct;
    const durPct = item.durPct;
    const adjustedHeight = Math.max(1, durPct - 0.2);

    const startLabel = this.calculator.format12h(startMin);
    const endLabel = this.calculator.format12h(endMin);
    const timeLabel = `${startLabel} - ${endLabel}`;
    const countdownLabel = this.getCountdownLabelFromIso(event.startAt);
    const countdownHtml = countdownLabel
      ? `<span class="timeline-countdown" aria-hidden="true">${countdownLabel}</span>`
      : "";

    const itemHour = Math.floor(item.startMin / 60);
    const currentMinutes = this.getCurrentTimeMinutes();
    const minutesSinceEnd =
      currentMinutes !== null ? currentMinutes - item.endMin : null;
    const isPast =
      minutesSinceEnd !== null ? minutesSinceEnd > 60 : false;

    return `
      <div
        class="planner-event-card"
        style="top: ${top}%; height: ${adjustedHeight}%; --lane: ${item.lane}; --lanes: ${item.totalLanes};"
        data-action="edit-event"
        data-event-id="${event.originalId}"
        data-hour="${itemHour}"
        data-is-past="${isPast}"
      >
        <span class="planner-event-time">${timeLabel}</span>
        <span class="planner-event-title">${event.title}</span>
        ${countdownHtml}
      </div>
    `;
  }

  private getCountdownLabelForTime(time?: string | null): string | null {
    const target = this.buildDateFromTime(time);
    return this.getCountdownLabel(target);
  }

  private getCountdownLabelFromIso(iso: string): string | null {
    if (!iso) return null;
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) return null;
    return this.getCountdownLabel(parsed);
  }

  private buildDateFromTime(time?: string | null): Date | null {
    if (!time || !this.activeDate) return null;
    const match = /^(\d{1,2}):(\d{2})$/.exec(time);
    if (!match) return null;
    const [hourText, minuteText] = match.slice(1);
    const hour = Number(hourText);
    const minute = Number(minuteText);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
    const result = new Date(this.activeDate);
    result.setHours(hour, minute, 0, 0);
    return result;
  }

  private getCountdownLabel(target: Date | null): string | null {
    if (!target) return null;
    const now = new Date();
    const diffMinutes = Math.round((target.getTime() - now.getTime()) / 60000);
    const clamped = Math.max(0, diffMinutes);
    return formatCountdown(clamped);
  }

  /**
   * Check if a goal belongs to a specific date
   * @param goal - The goal to check
   * @param date - The target date
   * @returns True if the goal's due date matches the target date
   * @private
   */
  private isGoalForDate(goal: Goal, date: Date): boolean {
    if (goal.dueDate) {
      const dueDate = new Date(goal.dueDate);
      return dueDate.toDateString() === date.toDateString();
    }
    return false;
  }

  /**
   * Render the context section showing Vision/Milestone/Focus goals
   * @param contextGoals - Object containing vision, milestone, and focus goals
   * @returns HTML string for the context section
   * @private
   */
  private renderContextSection(contextGoals: {
    vision: Goal[];
    milestone: Goal[];
    focus: Goal[];
  }): string {
    const renderIconOnly = (goals: Goal[], fallbackIcon: string) => {
      if (goals.length === 0) return "";
      const primary = goals[0];
      const icon = primary.icon || fallbackIcon;
      return `
        <button type="button" class="year-vision-icon-only" data-goal-id="${
          primary.id
        }" aria-label="${this.escapeHtml(primary.title)}">
          <span class="vision-icon-large">${icon}</span>
        </button>
      `;
    };

    const visionHtml = renderIconOnly(contextGoals.vision, "✨");
    const milestoneHtml = renderIconOnly(contextGoals.milestone, "🎯");
    const focusHtml = renderIconOnly(contextGoals.focus, "🌿");

    if (!visionHtml && !milestoneHtml && !focusHtml) return "";

    return `
      <div class="planner-sidebar-section planner-context-section">
        <div class="planner-context-banner year-vision-banner--pill">
          ${visionHtml}
          ${milestoneHtml}
          ${focusHtml}
        </div>
      </div>
    `;
  }

  /**
   * Escape HTML special characters
   * @param text - Text to escape
   * @returns Escaped text
   * @private
   */
  private escapeHtml(text: string): string {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}
