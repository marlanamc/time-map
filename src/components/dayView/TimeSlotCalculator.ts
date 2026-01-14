import type { Goal } from "../../types";
import type { TimedGoal, PositionedGoal, TimeSlot } from "./types";

export class TimeSlotCalculator {
  private plotStartMin: number;
  private plotEndMin: number;
  private plotRangeMin: number;
  private maxLanes: number;
  private snapInterval: number;

  constructor(
    timeWindowStart: number = 480, // 8 AM
    timeWindowEnd: number = 1320, // 10 PM
    maxLanes: number = 4,
    snapInterval: number = 5
  ) {
    this.plotStartMin = timeWindowStart;
    this.plotEndMin = timeWindowEnd;
    this.plotRangeMin = timeWindowEnd - timeWindowStart;
    this.maxLanes = maxLanes;
    this.snapInterval = snapInterval;
  }

  getPlotRangeMin(): number {
    return this.plotRangeMin;
  }

  getPlotStartMin(): number {
    return this.plotStartMin;
  }

  getPlotEndMin(): number {
    return this.plotEndMin;
  }

  /**
   * Parse time string (HH:MM) to minutes from midnight
   */
  parseTimeToMinutes(time: string | null | undefined): number | null {
    if (!time) return null;
    const [hRaw, mRaw] = time.split(":");
    const hours = Number.parseInt(hRaw ?? "", 10);
    const minutes = Number.parseInt(mRaw ?? "", 10);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
    return hours * 60 + minutes;
  }

  /**
   * Convert minutes from midnight to time string (HH:MM)
   */
  toTimeString(mins: number): string {
    const hh = Math.floor(mins / 60);
    const mm = mins % 60;
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  }

  /**
   * Convert minutes to 12-hour format (e.g., "2:30 PM")
   */
  format12h(mins: number): string {
    const h24 = Math.floor(mins / 60) % 24;
    const mm = mins % 60;
    const suffix = h24 < 12 ? "AM" : "PM";
    const h12 = h24 % 12 || 12;
    return `${h12}:${String(mm).padStart(2, "0")} ${suffix}`;
  }

  /**
   * Clamp value between min and max
   */
  clamp(n: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, n));
  }

  /**
   * Snap minutes to grid interval
   */
  snapToInterval(mins: number): number {
    return Math.round(mins / this.snapInterval) * this.snapInterval;
  }

  /**
   * Convert Y position in pixels to minutes
   */
  yToMinutes(y: number, containerHeight: number): number {
    const pct = containerHeight > 0 ? y / containerHeight : 0;
    let minutes = this.plotStartMin + pct * this.plotRangeMin;
    minutes = this.snapToInterval(minutes);
    return this.clamp(minutes, this.plotStartMin, this.plotEndMin - 15);
  }

  /**
   * Convert minutes to percentage position (0-100)
   */
  minutesToPercent(mins: number): number {
    return ((mins - this.plotStartMin) / this.plotRangeMin) * 100;
  }

  /**
   * Get goals that have start times (scheduled goals)
   */
  getTimedGoals(goals: Goal[]): TimedGoal[] {
    return goals
      .map((goal) => {
        const startMinRaw = this.parseTimeToMinutes(goal.startTime);
        if (startMinRaw === null) return null;

        const endMinRaw = this.parseTimeToMinutes(goal.endTime);
        const startMin = Math.min(
          Math.max(startMinRaw, this.plotStartMin),
          this.plotEndMin - 15
        );

        let endMin =
          endMinRaw !== null && endMinRaw > startMinRaw
            ? endMinRaw
            : startMinRaw + 60;

        // Ensure minimum duration of 15 minutes
        endMin = Math.min(Math.max(endMin, startMin + 15), this.plotEndMin);

        return { goal, startMin, endMin };
      })
      .filter((v): v is TimedGoal => Boolean(v))
      .sort((a, b) => a.startMin - b.startMin);
  }

  /**
   * Assign lanes using interval partitioning algorithm
   * Prevents overlapping goals by placing them in different lanes
   */
  assignLanes(timedGoals: TimedGoal[]): PositionedGoal[] {
    const laneEndTimes: number[] = [];

    return timedGoals.map((item) => {
      // Find first lane where this goal can fit
      let lane = laneEndTimes.findIndex((end) => item.startMin >= end);

      if (lane === -1) {
        // No available lane, create a new one
        lane = laneEndTimes.length;
        laneEndTimes.push(item.endMin);
      } else {
        // Update the lane's end time
        laneEndTimes[lane] = item.endMin;
      }

      // Clamp to max lanes (goals will overlap if we exceed capacity)
      const laneClamped = Math.min(lane, this.maxLanes - 1);

      // Calculate percentage positions
      const startPct = this.minutesToPercent(item.startMin);
      const durPct = ((item.endMin - item.startMin) / this.plotRangeMin) * 100;

      return {
        ...item,
        lane: laneClamped,
        startPct,
        durPct,
      };
    });
  }

  /**
   * Get the number of lanes currently in use
   */
  getLaneCount(positionedGoals: PositionedGoal[]): number {
    if (positionedGoals.length === 0) return 1;
    const maxLane = Math.max(...positionedGoals.map((g) => g.lane));
    return Math.max(1, Math.min(this.maxLanes, maxLane + 1));
  }

  /**
   * Generate time slots for the grid (hourly)
   * Hours are evenly distributed across the timeline for consistent spacing
   */
  generateTimeSlots(): TimeSlot[] {
    const slots: TimeSlot[] = [];
    const startHour = Math.floor(this.plotStartMin / 60);
    const endHour = Math.ceil(this.plotEndMin / 60);
    const hourCount = endHour - startHour + 1;

    for (let i = 0; i < hourCount; i++) {
      const hour = startHour + i;
      const totalMinutes = hour * 60;
      
      // Calculate evenly spaced position (0% to 100%)
      // For n hours, we have n-1 intervals, so position = (i / (hourCount - 1)) * 100
      const position = hourCount > 1 ? (i / (hourCount - 1)) * 100 : 0;

      slots.push({
        hour,
        minute: 0,
        totalMinutes,
        label12h: this.format12h(totalMinutes),
        label24h: `${String(hour).padStart(2, "0")}:00`,
        position,
      });
    }

    return slots;
  }

  /**
   * Check if a goal overlaps with another goal in the same lane
   */
  hasOverlap(goal1: TimedGoal, goal2: TimedGoal): boolean {
    return goal1.startMin < goal2.endMin && goal2.startMin < goal1.endMin;
  }

  /**
   * Find available time slots for a given duration
   */
  findAvailableSlots(
    goals: TimedGoal[],
    durationMin: number
  ): { startMin: number; endMin: number }[] {
    const slots: { startMin: number; endMin: number }[] = [];
    const sortedGoals = [...goals].sort((a, b) => a.startMin - b.startMin);

    let currentMin = this.plotStartMin;

    for (const goal of sortedGoals) {
      if (currentMin + durationMin <= goal.startMin) {
        // Found a gap before this goal
        slots.push({
          startMin: currentMin,
          endMin: currentMin + durationMin,
        });
      }
      currentMin = Math.max(currentMin, goal.endMin);
    }

    // Check for slot at the end
    if (currentMin + durationMin <= this.plotEndMin) {
      slots.push({
        startMin: currentMin,
        endMin: currentMin + durationMin,
      });
    }

    return slots;
  }

  /**
   * Calculate the total scheduled time for the day
   */
  calculateTotalScheduledMinutes(goals: TimedGoal[]): number {
    return goals.reduce((total, goal) => {
      return total + (goal.endMin - goal.startMin);
    }, 0);
  }

  /**
   * Calculate capacity percentage (0-100)
   * Based on number of active goals vs ideal range (3-5)
   */
  calculateCapacity(activeGoalCount: number): number {
    const ideal = 5;
    return (activeGoalCount / ideal) * 100;
  }

  /**
   * Get current time as minutes from midnight
   */
  getCurrentTimeMinutes(): number {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  }

  /**
   * Check if current time is within the viewing window
   */
  isCurrentTimeVisible(): boolean {
    const now = this.getCurrentTimeMinutes();
    return now >= this.plotStartMin && now <= this.plotEndMin;
  }

  /**
   * Get current time position as percentage
   */
  getCurrentTimePosition(): number {
    return this.minutesToPercent(this.getCurrentTimeMinutes());
  }
}
