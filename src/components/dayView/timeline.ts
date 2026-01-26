import { haptics } from "../../utils/haptics";
import { Goals } from "../../core/Goals";
import type { Category } from "../../types";
import type {
  DayViewOptions,
  DayViewCallbacks,
  DragData,
  UpdateGoalTimeCommand,
} from "./types";
import type { TimeSlotCalculator } from "./TimeSlotCalculator";
import { DragDropManager } from "./DragDropManager";
import { DayViewState } from "./DayViewState";

const DEBUG_DRAG_DROP =
  typeof window !== "undefined" && Boolean((window as any).__DRAG_DROP_DEBUG__);

function debugDropLog(
  message: string,
  context?: Record<string, unknown>,
): void {
  if (!DEBUG_DRAG_DROP) return;
  console.debug("[DayTimelineDrag]", message, context ?? {});
}

/**
 * Get the offset in minutes for collapsed past hours.
 * Returns 0 if past hours are expanded or offset is not set.
 * The CSS variable is only set when it's today and past hours are collapsed.
 */
function getPastHoursOffsetMinutes(
  container: HTMLElement,
  calculator: TimeSlotCalculator,
): number {
  const timelineContainer = container.querySelector(
    ".planner-timeline-container.day-timeline",
  ) as HTMLElement | null;
  if (!timelineContainer) return 0;

  // Only apply offset when past hours are collapsed
  const pastHoursExpanded = timelineContainer.dataset.pastHoursExpanded === "true";
  if (pastHoursExpanded) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/4467fe45-6449-42ed-a52d-b93a0f522e1a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'timeline.ts:41',message:'getPastHoursOffsetMinutes: Hours expanded, returning 0',data:{pastHoursExpanded},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    return 0;
  }

  // Read the CSS variable (only set when it's today and collapsed)
  const styles = getComputedStyle(timelineContainer);
  const raw = styles.getPropertyValue("--current-hour-pos").trim();
  if (!raw) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/4467fe45-6449-42ed-a52d-b93a0f522e1a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'timeline.ts:46',message:'getPastHoursOffsetMinutes: No CSS variable found',data:{raw},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    return 0;
  }

  const offsetPercent = parseFloat(raw);
  if (isNaN(offsetPercent) || offsetPercent <= 0) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/4467fe45-6449-42ed-a52d-b93a0f522e1a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'timeline.ts:49',message:'getPastHoursOffsetMinutes: Invalid offset percent',data:{offsetPercent},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    return 0;
  }

  // Convert percent to minutes using the calculator's plot range
  const plotRangeMin = calculator.getPlotRangeMin();
  const offsetMinutes = (offsetPercent / 100) * plotRangeMin;
  
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/4467fe45-6449-42ed-a52d-b93a0f522e1a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'timeline.ts:54',message:'getPastHoursOffsetMinutes: Calculated offset',data:{offsetPercent,plotRangeMin,offsetMinutes},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  // #endregion
  
  return offsetMinutes;
}

/**
 * Convert a Y position inside the day timeline into minutes.
 *
 * When past hours are collapsed, the visible area is shifted via CSS transform.
 * The pointer's Y position is relative to the visible viewport, so Y=0 corresponds
 * to visibleStart (not plotStart). We must map Y onto the visible range.
 *
 * When not collapsed, Y maps onto the full plot range as normal.
 */
function yToMinutesWithCollapsedSupport(
  y: number,
  rectHeight: number,
  calculator: TimeSlotCalculator,
  container: HTMLElement,
): number {
  const plotStart = calculator.getPlotStartMin();
  const plotEnd = calculator.getPlotEndMin();
  const plotRange = plotEnd - plotStart;

  if (rectHeight <= 0 || plotRange <= 0) {
    return plotStart;
  }

  const offsetMinutes = getPastHoursOffsetMinutes(container, calculator);

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/4467fe45-6449-42ed-a52d-b93a0f522e1a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'timeline.ts:78',message:'yToMinutesWithCollapsedSupport: Input values',data:{y,rectHeight,plotStart,plotEnd,plotRange,offsetMinutes},timestamp:Date.now(),sessionId:'debug-session',runId:'run4',hypothesisId:'A'})}).catch(()=>{});
  // #endregion

  if (offsetMinutes <= 0) {
    // Normal case: map Y linearly onto the full plot range
    const pct = Math.max(0, Math.min(1, y / rectHeight));
    const minutes = plotStart + pct * plotRange;
    const result = calculator.clamp(minutes, plotStart, plotEnd);

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/4467fe45-6449-42ed-a52d-b93a0f522e1a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'timeline.ts:84',message:'yToMinutesWithCollapsedSupport: Normal result',data:{result,pct,minutes},timestamp:Date.now(),sessionId:'debug-session',runId:'run4',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    return result;
  }

  // Collapsed case: the visible viewport starts at visibleStart
  // Y=0 at top of viewport corresponds to visibleStart, not plotStart.
  // Content is translated (not scaled), so keep the original plotRange scale.
  const pct = Math.max(0, Math.min(1, y / rectHeight));
  const minutes = plotStart + offsetMinutes + pct * plotRange;
  const result = calculator.clamp(minutes, plotStart, plotEnd);

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/4467fe45-6449-42ed-a52d-b93a0f522e1a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'timeline.ts:95',message:'yToMinutesWithCollapsedSupport: Collapsed result',data:{result,pct,minutes,offsetMinutes,plotRange},timestamp:Date.now(),sessionId:'debug-session',runId:'run4',hypothesisId:'A'})}).catch(()=>{});
  // #endregion

  return result;
}

/**
 * Convert minutes to percentage position (0-100) for CSS positioning.
 *
 * @param forTransformedContent - If true, returns percentage for elements INSIDE
 *   the transformed .planner-timeline-content (uses full plot range).
 *   If false, returns percentage for elements OUTSIDE the transform
 *   and anchors to the visible start when collapsed (content is translated but
 *   keeps the original scale).
 *
 * Drop preview/indicator: forTransformedContent = false (NOT transformed)
 * Timed task cards: forTransformedContent = true (IS transformed)
 */
function minutesToPercentWithCollapsedSupport(
  mins: number,
  calculator: TimeSlotCalculator,
  container: HTMLElement,
  forTransformedContent: boolean = false,
): number {
  const offsetMinutes = getPastHoursOffsetMinutes(container, calculator);
  const plotStart = calculator.getPlotStartMin();
  const plotEnd = calculator.getPlotEndMin();
  const plotRange = plotEnd - plotStart;

  // For transformed content OR when not collapsed, use full plot range
  if (forTransformedContent || offsetMinutes <= 0) {
    const result = plotRange > 0 ? ((mins - plotStart) / plotRange) * 100 : 0;

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/4467fe45-6449-42ed-a52d-b93a0f522e1a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'timeline.ts:150',message:'minutesToPercentWithCollapsedSupport: Full range result',data:{plotStart,plotRange,mins,result,forTransformedContent},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'C'})}).catch(()=>{});
    // #endregion

    return result;
  }

  // Collapsed case for non-transformed elements: anchor to the visible start
  // but keep the original plot range scale (content is translated, not rescaled)
  const visibleStart = plotStart + offsetMinutes;
  const result = plotRange > 0 ? ((mins - visibleStart) / plotRange) * 100 : 0;

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/4467fe45-6449-42ed-a52d-b93a0f522e1a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'timeline.ts:160',message:'minutesToPercentWithCollapsedSupport: Anchored collapsed result',data:{plotStart,visibleStart,plotRange,offsetMinutes,mins,result},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'C'})}).catch(()=>{});
  // #endregion

  return result;
}

export interface TimelineDeps {
  container: HTMLElement;
  calculator: TimeSlotCalculator;
  dragDropManager: DragDropManager;
  options: DayViewOptions;
  callbacks: DayViewCallbacks;
  state: DayViewState;
}

export interface TimelineRuntimeState {
  activeCommonTemplate: {
    title: string;
    category: string;
    duration: number;
  } | null;
  activeResize: {
    goalId: string;
    handle: "top" | "bottom";
    startMin: number;
    endMin: number;
    pointerId: number;
    dayBed: HTMLElement;
  } | null;
  swipeCleanup: (() => void) | null;
}

interface DropPreviewMetrics {
  dayBed: HTMLElement;
  rect: DOMRect;
  startMin: number;
  endMin: number;
  startPct: number;
  durPct: number;
  formattedTime: string;
  isInside: boolean;
}

interface TimelineViewportMetrics {
  offsetTop: number;
  height: number;
  containerHeight: number;
}

/**
 * The timeline content/grid starts below the pinned indicator (~88px).
 * Use this to normalize Y/percent math against the actual usable area
 * instead of the full container height.
 */
function getTimelineViewportMetrics(dayBed: HTMLElement): TimelineViewportMetrics {
  const containerRect = dayBed.getBoundingClientRect();
  const content =
    (dayBed.querySelector(".planner-timeline-content") as HTMLElement | null) ??
    (dayBed.querySelector(".day-bed-grid") as HTMLElement | null);

  const computedTopRaw = content
    ? getComputedStyle(content).top?.trim() ?? "0"
    : "0";
  const parsedTop = Number.parseFloat(computedTopRaw);
  const offsetTop = Number.isFinite(parsedTop) && parsedTop > 0 ? parsedTop : 0;

  const contentHeight =
    content?.getBoundingClientRect().height ??
    Math.max(1, containerRect.height - offsetTop);
  const height =
    contentHeight > 0 ? contentHeight : Math.max(1, containerRect.height);

  return {
    offsetTop,
    height,
    containerHeight: containerRect.height,
  };
}

function viewportPercentToContainerPercent(
  pctWithinViewport: number,
  viewport: TimelineViewportMetrics,
): number {
  const px = viewport.offsetTop + (pctWithinViewport / 100) * viewport.height;
  const containerHeight =
    viewport.containerHeight > 0 ? viewport.containerHeight : 1;
  return (px / containerHeight) * 100;
}

export function createTimelineRuntimeState(): TimelineRuntimeState {
  return {
    activeCommonTemplate: null,
    activeResize: null,
    swipeCleanup: null,
  };
}

function ensurePlannerDropIndicator(dayBed: HTMLElement): HTMLElement {
  let indicator = dayBed.querySelector(
    ".planner-drop-indicator",
  ) as HTMLElement | null;
  if (indicator) return indicator;
  indicator = document.createElement("div");
  indicator.className = "planner-drop-indicator";
  indicator.setAttribute("aria-hidden", "true");
  indicator.innerHTML = `
    <div class="planner-drop-indicator-line"></div>
    <div class="planner-drop-indicator-label"></div>
  `;
  dayBed.appendChild(indicator);
  return indicator;
}

function ensurePlannerDropPreview(dayBed: HTMLElement): HTMLElement {
  let preview = dayBed.querySelector(
    ".planner-drop-preview",
  ) as HTMLElement | null;
  if (preview) return preview;
  preview = document.createElement("div");
  preview.className = "planner-drop-preview";
  preview.setAttribute("aria-hidden", "true");
  preview.innerHTML = `<span class="planner-drop-preview-label"></span>`;
  dayBed.appendChild(preview);
  return preview;
}

function clearPlannerDropPreview(dayBed: HTMLElement): void {
  const preview = dayBed.querySelector(
    ".planner-drop-preview",
  ) as HTMLElement | null;
  if (preview) preview.remove();
}

function updatePlannerDropPreview(
  dayBed: HTMLElement,
  metrics: DropPreviewMetrics,
): void {
  const preview = ensurePlannerDropPreview(dayBed);
  preview.style.top = `${metrics.startPct}%`;
  preview.style.height = `${Math.max(metrics.durPct, 1.5)}%`;
  const label = preview.querySelector(
    ".planner-drop-preview-label",
  ) as HTMLElement | null;
  if (label) {
    label.textContent = metrics.formattedTime;
    // Ensure label is visible
    label.style.display = metrics.formattedTime ? 'block' : 'none';
  }
  
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/4467fe45-6449-42ed-a52d-b93a0f522e1a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'timeline.ts:285',message:'updatePlannerDropPreview: Setting preview',data:{startPct:metrics.startPct,durPct:metrics.durPct,formattedTime:metrics.formattedTime,hasLabel:!!label},timestamp:Date.now(),sessionId:'debug-session',runId:'run6',hypothesisId:'E'})}).catch(()=>{});
  // #endregion
}

function getTimelineDropMetrics(
  deps: TimelineDeps,
  clientX: number,
  clientY: number,
  durationMin: number,
  snapIntervalMinutes = 30,
): DropPreviewMetrics | null {
  const dayBed = deps.container.querySelector(
    ".day-timeline",
  ) as HTMLElement | null;
  if (!dayBed) return null;

  const rect = dayBed.getBoundingClientRect();
  if (rect.height <= 0) return null;

  const viewport = getTimelineViewportMetrics(dayBed);
  const scrollTop = dayBed.scrollTop;
  const rawY = clientY - rect.top + scrollTop - viewport.offsetTop;
  const y = Math.max(0, Math.min(rawY, viewport.height));

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/4467fe45-6449-42ed-a52d-b93a0f522e1a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'timeline.ts:281',message:'getTimelineDropMetrics: Y position calculation',data:{clientY,rectTop:rect.top,scrollTop,rawY,y,rectHeight:rect.height,viewportOffsetTop:viewport.offsetTop,viewportHeight:viewport.height},timestamp:Date.now(),sessionId:'debug-session',runId:'run4',hypothesisId:'A'})}).catch(()=>{});
  // #endregion

  const baseMinutes = yToMinutesWithCollapsedSupport(
    y,
    viewport.height,
    deps.calculator,
    deps.container,
  );

  const offsetMinutes = getPastHoursOffsetMinutes(deps.container, deps.calculator);
  const plotStart = deps.calculator.getPlotStartMin();
  const plotEnd = deps.calculator.getPlotEndMin();
  const visibleStart = offsetMinutes > 0 ? plotStart + offsetMinutes : plotStart;
  const visibleRange = offsetMinutes > 0 
    ? Math.max(1, plotEnd - visibleStart)
    : deps.calculator.getPlotRangeMin();
  const durationRange = deps.calculator.getPlotRangeMin() || 1;

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/4467fe45-6449-42ed-a52d-b93a0f522e1a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'timeline.ts:252',message:'getTimelineDropMetrics: Collapsed state and range calculations',data:{offsetMinutes,plotStart,plotEnd,visibleStart,visibleRange,durationRange,baseMinutes},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
  // #endregion

  const snappedMinutes = snapMinutesToInterval(baseMinutes, snapIntervalMinutes);
  const clampMin = visibleStart;
  const clampMax = deps.calculator.getPlotEndMin() - 15;
  
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/4467fe45-6449-42ed-a52d-b93a0f522e1a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'timeline.ts:308',message:'getTimelineDropMetrics: Before clamping',data:{baseMinutes,snappedMinutes,clampMin,clampMax,visibleStart,plotEnd:deps.calculator.getPlotEndMin(),ninePM:1260},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'D'})}).catch(()=>{});
  // #endregion

  const startMin = deps.calculator.clamp(
    snappedMinutes,
    clampMin,
    clampMax,
  );
  
  const endMin = Math.min(
    startMin + durationMin,
    deps.calculator.getPlotEndMin(),
  );
  // Drop preview is NOT inside transformed content, anchor to visible start using original scale
  const startPctWithinViewport = minutesToPercentWithCollapsedSupport(
    startMin,
    deps.calculator,
    deps.container,
    false, // forTransformedContent = false (drop preview is not transformed)
  );
  const startPct = viewportPercentToContainerPercent(
    startPctWithinViewport,
    viewport,
  );

  const durPx =
    ((endMin - startMin) / durationRange) * viewport.height;
  const durPct =
    viewport.containerHeight > 0
      ? (durPx / viewport.containerHeight) * 100
      : 0;

  const formattedTime = deps.calculator.format12h(startMin);
  
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/4467fe45-6449-42ed-a52d-b93a0f522e1a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'timeline.ts:365',message:'getTimelineDropMetrics: After clamping',data:{startMin,endMin,formattedTime,startPct,durPct,offsetMinutes,visibleStart,clamped:startMin !== snappedMinutes,isNinePM:startMin >= 1260},timestamp:Date.now(),sessionId:'debug-session',runId:'run6',hypothesisId:'E'})}).catch(()=>{});
  // #endregion
  const insideX = clientX >= rect.left && clientX <= rect.right;
  const insideY = clientY >= rect.top && clientY <= rect.bottom;
  const isInside = insideX && insideY;
  return {
    dayBed,
    rect,
    startMin,
    endMin,
    startPct,
    durPct,
    formattedTime,
    isInside,
  };
}

export function updateTimelineDragPreview(
  deps: TimelineDeps,
  clientX: number,
  clientY: number,
  durationMin: number = 60,
): boolean {
  const metrics = getTimelineDropMetrics(
    deps,
    clientX,
    clientY,
    durationMin,
    30,
  );
  const dayBed =
    metrics?.dayBed ??
    (deps.container.querySelector(".day-timeline") as HTMLElement | null);

  if (!metrics || !metrics.isInside) {
    if (dayBed) clearPlannerDropPreview(dayBed);
    return false;
  }

  const indicator = ensurePlannerDropIndicator(metrics.dayBed);
  indicator.style.top = `${metrics.startPct}%`;
  const label = indicator.querySelector(
    ".planner-drop-indicator-label",
  ) as HTMLElement | null;
  if (label) {
    label.textContent = metrics.formattedTime;
  }

  updatePlannerDropPreview(metrics.dayBed, metrics);
  return true;
}

export function clearTimelineDropUi(container: HTMLElement): void {
  const dayBed = container.querySelector(".day-timeline") as HTMLElement | null;
  if (!dayBed) return;
  dayBed.classList.remove("is-drop-target");
  const indicator = dayBed.querySelector(".planner-drop-indicator");
  if (indicator) indicator.remove();
  clearPlannerDropPreview(dayBed);
}

export function setupDragAndDrop(deps: TimelineDeps): HTMLElement | null {
  const container = deps.container;
  const dragDrop = deps.dragDropManager;
  dragDrop.clearDropZones();
  const goals = deps.state.currentGoals;

  const seedCards = container.querySelectorAll(
    ".day-goal-variant-seed[draggable='true']",
  ) as NodeListOf<HTMLElement>;
  seedCards.forEach((card) => {
    const goalId = card.dataset.goalId;
    if (!goalId) return;
    const goal = goals.find((g) => g.id === goalId);
    if (!goal) return;
    dragDrop.enableDraggable(card, {
      goalId,
      type: "seed",
      originalStartTime: goal.startTime ?? undefined,
      originalEndTime: goal.endTime ?? undefined,
    });
  });

  const planterCards = container.querySelectorAll(
    ".day-goal-variant-planter[draggable='true']",
  ) as NodeListOf<HTMLElement>;
  planterCards.forEach((card) => {
    const goalId = card.dataset.goalId;
    if (!goalId) return;
    const goal = goals.find((g) => g.id === goalId);
    if (!goal) return;
    dragDrop.enableDraggable(card, {
      goalId,
      type: "planter",
      originalStartTime: goal.startTime ?? undefined,
      originalEndTime: goal.endTime ?? undefined,
    });
  });

  const unscheduledItems = container.querySelectorAll(
    ".planner-unscheduled-item[data-goal-id]",
  ) as NodeListOf<HTMLElement>;
  unscheduledItems.forEach((item) => {
    const goalId = item.dataset.goalId;
    if (!goalId) return;
    const goal = goals.find((g) => g.id === goalId);
    if (!goal || goal.status === "done") return;
    dragDrop.enableDraggable(item, {
      goalId,
      type: "seed",
      originalStartTime: goal.startTime ?? undefined,
      originalEndTime: goal.endTime ?? undefined,
    });
  });

  const timedTasks = container.querySelectorAll(
    ".planner-timed-task[data-goal-id]",
  ) as NodeListOf<HTMLElement>;
  timedTasks.forEach((card) => {
    const goalId = card.dataset.goalId;
    if (!goalId) return;
    const goal = goals.find((g) => g.id === goalId);
    if (!goal || goal.status === "done") return;
    dragDrop.enableDraggable(card, {
      goalId,
      type: "planter",
      originalStartTime: goal.startTime ?? undefined,
      originalEndTime: goal.endTime ?? undefined,
    });
  });

  const dayBed = container.querySelector(".day-timeline") as HTMLElement | null;
  if (dayBed) {
    dragDrop.enableDropZone(dayBed, {
      element: dayBed,
      onDrop: (data, clientX, clientY) =>
        handleDrop(data, clientX, clientY, deps),
      onDragOver: () => {
        dayBed.classList.add("is-drop-target");
      },
      onDragLeave: () => {
        dayBed.classList.remove("is-drop-target");
      },
    });
  }

  return dayBed;
}

export function handleNativeDragStart(
  e: DragEvent,
  _deps: TimelineDeps,
  runtime: TimelineRuntimeState,
): void {
  const item = (e.target as HTMLElement | null)?.closest(
    ".intention-pill",
  ) as HTMLElement | null;
  if (!item || !e.dataTransfer) return;

  const title = item.dataset.title ?? "";
  const category = item.dataset.category ?? "";
  const duration = Number(item.dataset.duration ?? "60") || 60;

  runtime.activeCommonTemplate = { title, category, duration };
  item.classList.add("is-dragging");

  const payload = JSON.stringify({ title, category, duration });
  e.dataTransfer.effectAllowed = "copy";
  e.dataTransfer.setData("application/json", payload);
  e.dataTransfer.setData("text/plain", payload);
}

export function handleNativeDragEnd(
  e: DragEvent,
  deps: TimelineDeps,
  runtime: TimelineRuntimeState,
): void {
  const item = (e.target as HTMLElement | null)?.closest(
    ".intention-pill",
  ) as HTMLElement | null;
  if (item) item.classList.remove("is-dragging");
  runtime.activeCommonTemplate = null;
  clearTimelineDropUi(deps.container);
}

export function handleNativeDragOver(
  e: DragEvent,
  deps: TimelineDeps,
  runtime: TimelineRuntimeState,
): void {
  const dayBed = (e.target as HTMLElement | null)?.closest(
    ".day-timeline",
  ) as HTMLElement | null;
  if (!dayBed) return;

  e.preventDefault();
  const rect = dayBed.getBoundingClientRect();
  const viewport = getTimelineViewportMetrics(dayBed);
  const y = Math.max(
    0,
    Math.min(
      (e.clientY ?? rect.top) - rect.top - viewport.offsetTop,
      viewport.height,
    ),
  );

  const baseMinutes = yToMinutesWithCollapsedSupport(
    y,
    viewport.height,
    deps.calculator,
    deps.container,
  );

  const offsetMinutes = getPastHoursOffsetMinutes(deps.container, deps.calculator);
  const visibleStart = offsetMinutes > 0 
    ? deps.calculator.getPlotStartMin() + offsetMinutes
    : deps.calculator.getPlotStartMin();
  
  const startMin = deps.calculator.clamp(
    snapMinutesToInterval(baseMinutes, 15),
    visibleStart,
    deps.calculator.getPlotEndMin() - 15,
  );

  const pct = viewportPercentToContainerPercent(
    minutesToPercentWithCollapsedSupport(
      startMin,
      deps.calculator,
      deps.container,
    ),
    viewport,
  );
  const indicator = ensurePlannerDropIndicator(dayBed);
  indicator.style.top = `${pct}%`;
  const label = indicator.querySelector(
    ".planner-drop-indicator-label",
  ) as HTMLElement | null;
  if (label) {
    const title = runtime.activeCommonTemplate?.title
      ? `• ${runtime.activeCommonTemplate.title}`
      : "";
    label.textContent = `${deps.calculator.format12h(
      startMin,
    )} ${title}`.trim();
  }

  dayBed.classList.add("is-drop-target");
}

export function handleNativeDrop(e: DragEvent, deps: TimelineDeps): void {
  const dayBed = (e.target as HTMLElement | null)?.closest(
    ".day-timeline",
  ) as HTMLElement | null;
  if (!dayBed) return;

  // Guard: Only handle drops in the day view container
  // Check for day-view-container instead of the non-existent planner-sidebar-and-timeline
  if (!deps.container.classList.contains("day-view-container")) {
    console.warn("Drop event received outside Day view context");
    return;
  }

  e.preventDefault();
  e.stopPropagation();

  const dt = e.dataTransfer;
  if (!dt) return;

  // 1. Handle dragging existing goals (unscheduled or rescheduling)
  const rawDragData = dt.getData("application/x-goal-drag");
  if (rawDragData) {
    try {
      const data = JSON.parse(rawDragData);
      // Delegate to the main handleDrop logic used by mobile/pointer events
      handleDrop(data, e.clientX, e.clientY, deps);
      clearTimelineDropUi(deps.container);
      return;
    } catch (err) {
      console.error("Failed to parse dragged goal data", err);
    }
  }

  // 2. Handle creating NEW goals from templates (e.g. intentions pill)
  const currentDate = deps.state.currentDate;
  if (!currentDate) return;

  const raw = dt.getData("application/json") || dt.getData("text/plain") || "";
  let payload: { title: string; category: string; duration: number } | null =
    null;
  try {
    payload = JSON.parse(raw);
  } catch {
    payload = null;
  }
  if (!payload?.title) return;

  const rect = dayBed.getBoundingClientRect();
  const viewport = getTimelineViewportMetrics(dayBed);
  const y = Math.max(
    0,
    Math.min(
      (e.clientY ?? rect.top) - rect.top - viewport.offsetTop,
      viewport.height,
    ),
  );

  const baseMinutes = yToMinutesWithCollapsedSupport(
    y,
    viewport.height,
    deps.calculator,
    deps.container,
  );

  const offsetMinutes = getPastHoursOffsetMinutes(deps.container, deps.calculator);
  const visibleStart = offsetMinutes > 0 
    ? deps.calculator.getPlotStartMin() + offsetMinutes
    : deps.calculator.getPlotStartMin();

  const startMin = deps.calculator.clamp(
    snapMinutesToInterval(baseMinutes, 15),
    visibleStart,
    deps.calculator.getPlotEndMin() - 15,
  );

  const duration = Math.max(15, Math.floor(payload.duration || 60));
  const endMin = Math.min(startMin + duration, deps.calculator.getPlotEndMin());

  const startTime = deps.calculator.toTimeString(startMin);
  const endTime = deps.calculator.toTimeString(
    endMin > startMin
      ? endMin
      : Math.min(startMin + 15, deps.calculator.getPlotEndMin()),
  );

  const ymd = `${currentDate.getFullYear()}-${String(
    currentDate.getMonth() + 1,
  ).padStart(2, "0")}-${String(currentDate.getDate()).padStart(2, "0")}`;

  // Calculate scheduledAt for persistence
  const scheduledAt = new Date(currentDate);
  scheduledAt.setHours(
    Math.floor(startMin / 60),
    startMin % 60,
    0,
    0,
  );
  const scheduledAtIso = scheduledAt.toISOString();

  const coerceCategory = (value: string): Category | null => {
    switch (value) {
      case "career":
      case "health":
      case "finance":
      case "personal":
      case "creative":
        return value;
      default:
        return null;
    }
  };

  try {
    const newGoal = Goals.create({
      level: "intention",
      title: payload.title,
      category: coerceCategory(payload.category),
      startDate: ymd,
      startTime,
      endTime,
      scheduledAt: scheduledAtIso,
    });

    // Trigger a refresh to show the new goal immediately
    deps.callbacks.onShowToast?.("🌱", `Added: ${payload.title}`);

    // Dispatch a custom event to trigger refresh
    const refreshEvent = new CustomEvent("goalCreated", {
      detail: { goal: newGoal },
    });
    deps.container.dispatchEvent(refreshEvent);

    // Also trigger the general refresh mechanism
    const requestRefreshEvent = new CustomEvent("requestRefresh");
    deps.container.dispatchEvent(requestRefreshEvent);
    haptics.impact("medium");
  } catch (error: any) {
    console.error("Failed to create goal:", error);
    deps.callbacks.onShowToast?.("❌", "Failed to add intention");
  }

  clearTimelineDropUi(deps.container);
}

function snapMinutesToInterval(mins: number, interval: number): number {
  return Math.round(mins / interval) * interval;
}

export function setupSwipeToComplete(
  deps: TimelineDeps,
  runtime: TimelineRuntimeState,
): void {
  runtime.swipeCleanup?.();
  runtime.swipeCleanup = null;
  if (window.innerWidth > 600) return;

  const thresholdPx = 72;
  const maxSwipePx = 160;

  let activeCard: HTMLElement | null = null;
  let activeGoalId: string | null = null;
  let startX = 0;
  let startY = 0;
  let dx = 0;
  let dy = 0;
  let tracking = false;
  let swiping = false;

  const canStart = (target: Element | null) => {
    if (!target) return false;
    if (
      target.closest(".day-goal-checkbox") ||
      target.closest(".btn-zen-focus") ||
      target.closest(".btn-planner-remove") ||
      target.closest("button") ||
      target.closest("a") ||
      target.closest("input") ||
      target.closest("textarea") ||
      target.closest("select") ||
      target.closest(".resize-handle")
    ) {
      return false;
    }
    return true;
  };

  const reset = () => {
    if (activeCard) {
      activeCard.classList.remove(
        "is-swiping",
        "swipe-ready-complete",
        "swipe-ready-undo",
      );
      activeCard.style.removeProperty("--swipe-x");
    }
    activeCard = null;
    activeGoalId = null;
    tracking = false;
    swiping = false;
    dx = 0;
    dy = 0;
  };

  const animateBack = () => {
    if (!activeCard) return reset();
    activeCard.classList.add("swipe-animating");
    activeCard.style.setProperty("--swipe-x", "0px");
    window.setTimeout(() => {
      activeCard?.classList.remove("swipe-animating");
      reset();
    }, 180);
  };

  const onTouchStart = (e: TouchEvent) => {
    if (e.touches.length !== 1) return;
    if (!canStart(e.target as Element | null)) return;

    const card = (e.target as Element | null)?.closest(
      ".day-goal-card",
    ) as HTMLElement | null;
    const goalId = card?.dataset.goalId ?? null;
    if (!card || !goalId) return;

    tracking = true;
    swiping = false;
    activeCard = card;
    activeGoalId = goalId;

    const t = e.touches[0];
    startX = t.clientX;
    startY = t.clientY;
    dx = 0;
    dy = 0;
  };

  const onTouchMove = (e: TouchEvent) => {
    if (!tracking || !activeCard || !activeGoalId) return;
    if (e.touches.length !== 1) return reset();
    const t = e.touches[0];
    dx = t.clientX - startX;
    dy = t.clientY - startY;

    if (!swiping) {
      if (Math.abs(dy) > 18 && Math.abs(dy) > Math.abs(dx)) return reset();
      if (Math.abs(dx) < 12) return;
      if (Math.abs(dx) < Math.abs(dy) * 1.2) return;
      swiping = true;
      activeCard.classList.add("is-swiping");
    }

    e.preventDefault();
    const clamped = Math.max(-maxSwipePx, Math.min(maxSwipePx, dx));
    activeCard.style.setProperty("--swipe-x", `${clamped}px`);

    const goal = deps.state.currentGoals.find((g) => g.id === activeGoalId);
    const isDone = goal?.status === "done";
    const ready = Math.abs(clamped) >= thresholdPx;

    activeCard.classList.toggle(
      "swipe-ready-complete",
      ready && clamped > 0 && !isDone,
    );
    activeCard.classList.toggle(
      "swipe-ready-undo",
      ready && clamped < 0 && !!isDone,
    );
  };

  const onTouchEnd = () => {
    if (!tracking || !activeCard || !activeGoalId) return reset();
    if (!swiping) return reset();

    const goal = deps.state.currentGoals.find((g) => g.id === activeGoalId);
    const isDone = goal?.status === "done";

    const shouldComplete = dx >= thresholdPx && !isDone;
    const shouldUndo = dx <= -thresholdPx && !!isDone;

    if (shouldComplete) {
      deps.callbacks.onGoalUpdate(activeGoalId, { status: "done" });
      deps.callbacks.onShowToast?.("✅", "Completed");
      haptics.impact("medium");
      if (deps.callbacks.onCelebrate)
        deps.callbacks.onCelebrate("🎉", "Nice work!", "Intention complete.");
    } else if (shouldUndo) {
      deps.callbacks.onGoalUpdate(activeGoalId, { status: "in-progress" });
      deps.callbacks.onShowToast?.("↩️", "Marked active");
      haptics.impact("light");
    }

    animateBack();
  };

  deps.container.addEventListener("touchstart", onTouchStart, {
    passive: true,
  });
  deps.container.addEventListener("touchmove", onTouchMove, { passive: false });
  deps.container.addEventListener("touchend", onTouchEnd, { passive: true });
  deps.container.addEventListener("touchcancel", reset, { passive: true });

  runtime.swipeCleanup = () => {
    deps.container.removeEventListener("touchstart", onTouchStart);
    deps.container.removeEventListener("touchmove", onTouchMove);
    deps.container.removeEventListener("touchend", onTouchEnd);
    deps.container.removeEventListener("touchcancel", reset);
    reset();
  };
}

export function handlePointerDown(
  e: PointerEvent,
  deps: TimelineDeps,
  runtime: TimelineRuntimeState,
): void {
  const target = e.target as HTMLElement | null;
  const handle = target?.closest(
    ".planter-resize-handle",
  ) as HTMLElement | null;
  if (!handle) return;

  const card = handle.closest(
    ".planner-timed-task[data-goal-id]",
  ) as HTMLElement | null;
  const goalId = card?.dataset.goalId;
  if (!card || !goalId) return;

  const goal = deps.state.currentGoals.find((g) => g.id === goalId);
  if (!goal || goal.status === "done") return;

  const dayBed = deps.container.querySelector(
    ".day-timeline",
  ) as HTMLElement | null;
  if (!dayBed) return;
  const viewport = getTimelineViewportMetrics(dayBed);

  e.preventDefault();
  e.stopPropagation();

  const offsetMinutes = getPastHoursOffsetMinutes(deps.container, deps.calculator);
  const visibleStart = offsetMinutes > 0 
    ? deps.calculator.getPlotStartMin() + offsetMinutes
    : deps.calculator.getPlotStartMin();
  
  const startMinRaw =
    deps.calculator.parseTimeToMinutes(goal.startTime) ??
    deps.options.timeWindowStart ??
    480;
  const endMinRaw =
    deps.calculator.parseTimeToMinutes(goal.endTime) ?? startMinRaw + 60;
  const startMin = deps.calculator.clamp(
    startMinRaw,
    visibleStart,
    deps.calculator.getPlotEndMin() - 15,
  );
  const endMin = deps.calculator.clamp(
    endMinRaw,
    startMin + 15,
    deps.calculator.getPlotEndMin(),
  );

  const resizeType = (handle.dataset.resize === "top" ? "top" : "bottom") as
    | "top"
    | "bottom";
  runtime.activeResize = {
    goalId,
    handle: resizeType,
    startMin,
    endMin,
    pointerId: e.pointerId,
    dayBed,
  };

  handle.setPointerCapture(e.pointerId);
  document.body.classList.add("is-resizing");
  card.classList.add("is-resizing");
  handle.classList.add("is-resizing");

  const updatePreview = (minsStart: number, minsEnd: number) => {
    const plotRange = deps.calculator.getPlotRangeMin();

    // Card is INSIDE the transformed content, so use full plot range
    const topPct = minutesToPercentWithCollapsedSupport(
      minsStart,
      deps.calculator,
      deps.container,
      true, // forTransformedContent = true
    );
    const durPct = ((minsEnd - minsStart) / plotRange) * 100;

    // Apply the same tighter positioning adjustments
    const adjustedTop = Math.max(0, topPct - 0.1);
    const adjustedHeight = Math.max(1, durPct - 0.2);

    card.style.top = `${adjustedTop}%`;
    card.style.height = `${adjustedHeight}%`;
  };

  const onMove = (ev: PointerEvent) => {
    if (!runtime.activeResize) return;
    if (ev.pointerId !== runtime.activeResize.pointerId) return;

    const dayBedRect = runtime.activeResize.dayBed.getBoundingClientRect();
    const y = Math.max(
      0,
      Math.min(
        ev.clientY - dayBedRect.top - viewport.offsetTop,
        viewport.height,
      ),
    );

    const baseMinutes = yToMinutesWithCollapsedSupport(
      y,
      viewport.height,
      deps.calculator,
      deps.container,
    );

    const snapped = deps.calculator.snapToInterval(baseMinutes);
    const offsetMinutes = getPastHoursOffsetMinutes(deps.container, deps.calculator);
    const plotStart = deps.calculator.getPlotStartMin();
    const plotEnd = deps.calculator.getPlotEndMin();
    const visibleStart = offsetMinutes > 0 ? plotStart + offsetMinutes : plotStart;
    const minDur = 15;

    if (runtime.activeResize.handle === "top") {
      const nextStart = deps.calculator.clamp(
        snapped,
        visibleStart,
        runtime.activeResize.endMin - minDur,
      );
      runtime.activeResize.startMin = nextStart;
    } else {
      const nextEnd = deps.calculator.clamp(
        snapped,
        runtime.activeResize.startMin + minDur,
        plotEnd,
      );
      runtime.activeResize.endMin = nextEnd;
    }

    updatePreview(runtime.activeResize.startMin, runtime.activeResize.endMin);
  };

  const onUp = (ev: PointerEvent) => {
    if (!runtime.activeResize) return;
    if (ev.pointerId !== runtime.activeResize.pointerId) return;
    const active = runtime.activeResize;
    runtime.activeResize = null;

    try {
      handle.releasePointerCapture(ev.pointerId);
    } catch {
      // ignore
    }

    card.classList.remove("is-resizing");
    handle.classList.remove("is-resizing");
    document.body.classList.remove("is-resizing");

    const prevStartTime = goal.startTime;
    const prevEndTime = goal.endTime;
    const prevDueDate = goal.dueDate;
    const prevMonth = goal.month;
    const prevYear = goal.year;

    const newStartTime = deps.calculator.toTimeString(active.startMin);
    const newEndTime = deps.calculator.toTimeString(active.endMin);

    const command: UpdateGoalTimeCommand = {
      goalId,
      prevStartTime,
      prevEndTime,
      prevDueDate,
      prevMonth,
      prevYear,
      prevScheduledAt: goal.scheduledAt ?? null,
      newStartTime,
      newEndTime,
      newDueDate: deps.state.currentDate
        ? deps.state.currentDate.toISOString()
        : (goal.dueDate ?? new Date().toISOString()),
      newMonth: deps.state.currentDate
        ? deps.state.currentDate.getMonth()
        : goal.month,
      newYear: deps.state.currentDate
        ? deps.state.currentDate.getFullYear()
        : goal.year,
      description: "Resize task",
      execute: () => {
        deps.callbacks.onGoalUpdate(goalId, {
          startTime: newStartTime,
          endTime: newEndTime,
        });
      },
      undo: () => {
        deps.callbacks.onGoalUpdate(goalId, {
          startTime: prevStartTime ?? undefined,
          endTime: prevEndTime ?? undefined,
          dueDate: prevDueDate,
          month: prevMonth,
          year: prevYear,
          scheduledAt: command.prevScheduledAt ?? null,
        });
      },
    };

    deps.dragDropManager.executeCommand(command);
    deps.callbacks.onShowToast?.("⏱️", `${newStartTime}–${newEndTime}`);

    document.removeEventListener("pointermove", onMove);
    document.removeEventListener("pointerup", onUp);
    document.removeEventListener("pointercancel", onCancel);
  };

  const onCancel = (ev: PointerEvent) => {
    if (!runtime.activeResize) return;
    if (ev.pointerId !== runtime.activeResize.pointerId) return;
    runtime.activeResize = null;
    card.classList.remove("is-resizing");
    handle.classList.remove("is-resizing");
    document.body.classList.remove("is-resizing");
    document.removeEventListener("pointermove", onMove);
    document.removeEventListener("pointerup", onUp);
    document.removeEventListener("pointercancel", onCancel);
  };

  document.addEventListener("pointermove", onMove, { passive: true });
  document.addEventListener("pointerup", onUp, { passive: true });
  document.addEventListener("pointercancel", onCancel, { passive: true });
}

export function handleDrop(
  data: DragData,
  clientX: number,
  clientY: number,
  deps: TimelineDeps,
): void {
  debugDropLog("handleDrop invoked", {
    goalId: data.goalId,
    clientY,
    clientX,
    currentDate: deps.state.currentDate?.toISOString(),
  });
  if (!deps.state.currentDate) {
    return;
  }

  const goal = deps.state.currentGoals.find((g) => g.id === data.goalId);
  if (!goal) {
    debugDropLog("handleDrop goal missing", { goalId: data.goalId });
    return;
  }

  const prevStartMin = deps.calculator.parseTimeToMinutes(goal.startTime);
  const prevEndMin = deps.calculator.parseTimeToMinutes(goal.endTime);
  const durationMin =
    prevStartMin !== null && prevEndMin !== null && prevEndMin > prevStartMin
      ? prevEndMin - prevStartMin
      : 60;

  const metrics = getTimelineDropMetrics(
    deps,
    clientX,
    clientY,
    durationMin,
    30,
  );
  if (!metrics || !metrics.isInside) {
    return;
  }

  const timeWindowEnd = deps.calculator.getPlotEndMin();
  const minEnd = Math.min(metrics.startMin + 15, timeWindowEnd);
  const newEndMin = Math.max(metrics.endMin, minEnd);
  const newStartTime = deps.calculator.toTimeString(metrics.startMin);
  const newEndTime = deps.calculator.toTimeString(
    newEndMin > metrics.startMin ? newEndMin : minEnd,
  );

  const scheduledAt = new Date(deps.state.currentDate);
  scheduledAt.setHours(
    Math.floor(metrics.startMin / 60),
    metrics.startMin % 60,
    0,
    0,
  );
  const scheduledAtIso = scheduledAt.toISOString();

  const prevScheduledAt = goal.scheduledAt ?? null;

  debugDropLog("handleDrop scheduling", {
    goalId: data.goalId,
    prevStartTime: goal.startTime,
    prevEndTime: goal.endTime,
    newStartTime,
    newEndTime,
    durationMin,
    dropY: metrics.startMin,
  });

  const command: UpdateGoalTimeCommand = {
    goalId: data.goalId,
    prevStartTime: goal.startTime,
    prevEndTime: goal.endTime,
    prevDueDate: goal.dueDate,
    prevMonth: goal.month,
    prevYear: goal.year,
    prevScheduledAt,
    newStartTime,
    newEndTime,
    newDueDate: deps.state.currentDate.toISOString(),
    newMonth: deps.state.currentDate.getMonth(),
    newYear: deps.state.currentDate.getFullYear(),
    description: `Schedule goal at ${deps.calculator.format12h(
      metrics.startMin,
    )}`,
    execute: () => {
      deps.callbacks.onGoalUpdate(data.goalId, {
        startTime: newStartTime,
        endTime: newEndTime,
        dueDate: deps.state.currentDate!.toISOString(),
        month: deps.state.currentDate!.getMonth(),
        year: deps.state.currentDate!.getFullYear(),
        scheduledAt: scheduledAtIso,
      });
    },
    undo: () => {
      deps.callbacks.onGoalUpdate(data.goalId, {
        startTime: command.prevStartTime,
        endTime: command.prevEndTime,
        dueDate: command.prevDueDate,
        month: command.prevMonth,
        year: command.prevYear,
        scheduledAt: command.prevScheduledAt ?? null,
      });
    },
  };

  deps.dragDropManager.executeCommand(command);
  deps.callbacks.onShowToast?.(
    "🌱",
    `Planted at ${deps.calculator.format12h(metrics.startMin)}`,
  );
  haptics.impact("medium");
  clearTimelineDropUi(deps.container);
}
