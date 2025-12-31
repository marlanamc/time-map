// ===================================
// Time Breakdown Utility
// ===================================
import type { TimeBreakdownResult, GoalLevel } from '../types';
import { CONFIG } from '../config';

export const TimeBreakdown = {
  // Calculate all time metrics between now and a target date
  calculate(targetMonth: number, targetYear: number): TimeBreakdownResult {
    const now = new Date();
    const isCurrentMonth = targetMonth === now.getMonth() && targetYear === now.getFullYear();

    // For current month, calculate to end of month. For future months, calculate to start of month.
    const target = isCurrentMonth
      ? new Date(targetYear, targetMonth + 1, 0, 23, 59, 59, 999) // End of current month (inclusive)
      : new Date(targetYear, targetMonth, 1); // Start of future month

    const msPerDay = 1000 * 60 * 60 * 24;

    const diffMs = target.getTime() - now.getTime();
    const diffDays = Math.max(0, Math.ceil(diffMs / msPerDay));
    const diffWeeks = Math.max(0, Math.floor(diffDays / 7));

    // Calculate weekends
    let weekends = 0;
    const tempDate = new Date(now);
    while (tempDate <= target) {
      if (tempDate.getDay() === 0 || tempDate.getDay() === 6) {
        weekends++;
      }
      tempDate.setDate(tempDate.getDate() + 1);
    }
    weekends = Math.floor(weekends / 2); // Count weekend pairs

    // Calculate work sessions (assuming 3x per week)
    const workSessions3x = diffWeeks * 3;
    const workSessions5x = diffWeeks * 5;

    // Calculate whole months remaining (don't count partial months).
    // Example: Dec 31 → Jan 1 = 0 months (but 1 day).
    const nowY = now.getFullYear();
    const nowM = now.getMonth();
    const nowD = now.getDate();
    const targetD = target.getDate();
    let months = (targetYear - nowY) * 12 + (targetMonth - nowM);
    if (targetD < nowD) months -= 1;
    months = Math.max(0, months);

    // Hours available (rough estimates)
    const focusHours1hDay = diffDays; // 1 hour per day
    const focusHours2hDay = diffDays * 2; // 2 hours per day

    return {
      days: diffDays,
      weeks: diffWeeks,
      months: months,
      weekends: weekends,
      workSessions3x: workSessions3x,
      workSessions5x: workSessions5x,
      focusHours1hDay: focusHours1hDay,
      focusHours2hDay: focusHours2hDay,
      isPast: diffMs < 0,
      isCurrentMonth:
        targetMonth === now.getMonth() && targetYear === now.getFullYear(),
    };
  },

  // Generate human-readable breakdown HTML
  generateHTML(targetMonth: number, targetYear: number, compact: boolean = false, level?: GoalLevel): string {
    let breakdown: TimeBreakdownResult;

    // Use appropriate calculation based on level
    if (level === "intention") {
      breakdown = this.calculateForDay();
    } else if (level === "focus") {
      breakdown = this.calculateForWeek();
    } else if (level === "vision") {
      breakdown = this.calculateForYear(targetYear);
    } else {
      // Default to month calculation (milestone)
      breakdown = this.calculate(targetMonth, targetYear);
    }

    // Handle day (intention) level
    if (level === "intention") {
      const hoursLeft = breakdown.hoursLeftInDay ?? 0;
      return `<div class="time-breakdown current">
          <div class="time-breakdown-header">🔥 This is NOW - ${hoursLeft.toFixed(1)} hours left today!</div>
          <div class="time-breakdown-grid">
            <div class="time-unit">
              <span class="time-value">${hoursLeft.toFixed(1)}</span>
              <span class="time-label">hours</span>
            </div>
          </div>
        </div>`;
    }

    // Handle week (focus) level
    if (level === "focus") {
      const daysLeft = breakdown.daysLeftInWeek ?? 0;
      const weekends = breakdown.weekendsInWeek ?? 0;
      return `<div class="time-breakdown current">
          <div class="time-breakdown-header">🔥 This is NOW - ${daysLeft} days left this week!</div>
          <div class="time-breakdown-grid">
            <div class="time-unit">
              <span class="time-value">${daysLeft}</span>
              <span class="time-label">days</span>
            </div>
            <div class="time-unit">
              <span class="time-value">${weekends}</span>
              <span class="time-label">weekends</span>
            </div>
            <div class="time-unit">
              <span class="time-value">${breakdown.workSessions3x}</span>
              <span class="time-label">sessions @3x/wk</span>
            </div>
          </div>
        </div>`;
    }

    // Handle year (vision) level
    if (level === "vision") {
      const monthsLeft = breakdown.months ?? 0;
      const quartersLeft = breakdown.quartersLeft ?? 0;
      const weeksLeft = breakdown.weeks ?? 0;
      const daysLeft = breakdown.days ?? 0;
      const useDays = daysLeft > 0 && daysLeft < 31;
      const headlineValue = useDays ? daysLeft : monthsLeft;
      const headlineUnit = useDays ? "days" : "months";
      const primaryLabel = useDays ? "days" : "months";
      const primaryValue = useDays ? daysLeft : monthsLeft;
      return `<div class="time-breakdown current">
          <div class="time-breakdown-header">🔥 This is NOW - ${headlineValue} ${headlineUnit} left this year!</div>
          <div class="time-breakdown-grid">
            <div class="time-unit">
              <span class="time-value">${primaryValue}</span>
              <span class="time-label">${primaryLabel}</span>
            </div>
            <div class="time-unit">
              <span class="time-value">${quartersLeft}</span>
              <span class="time-label">quarters</span>
            </div>
            <div class="time-unit">
              <span class="time-value">${weeksLeft}</span>
              <span class="time-label">weeks</span>
            </div>
          </div>
          <div class="time-breakdown-details">
            <div class="time-detail">
              <span class="time-detail-icon">💪</span>
              <span class="time-detail-text"><strong>${breakdown.workSessions3x}</strong> sessions if you work 3x/week</span>
            </div>
            <div class="time-detail">
              <span class="time-detail-icon">🚀</span>
              <span class="time-detail-text"><strong>${breakdown.workSessions5x}</strong> sessions if you work 5x/week</span>
            </div>
          </div>
        </div>`;
    }

    // Handle month (milestone) level - existing logic
    const monthName = CONFIG.MONTHS[targetMonth];

    if (breakdown.isPast) {
      return `<div class="time-breakdown past">
          <div class="time-breakdown-header">⏰ This milestone is in the past</div>
        </div>`;
    }

    if (breakdown.isCurrentMonth) {
      return `<div class="time-breakdown current">
          <div class="time-breakdown-header">🔥 This is NOW - ${breakdown.days} days left this month!</div>
          <div class="time-breakdown-grid">
            <div class="time-unit">
              <span class="time-value">${breakdown.days}</span>
              <span class="time-label">days</span>
            </div>
            <div class="time-unit">
              <span class="time-value">${breakdown.weekends}</span>
              <span class="time-label">weekends</span>
            </div>
            <div class="time-unit">
              <span class="time-value">${breakdown.workSessions3x}</span>
              <span class="time-label">sessions @3x/wk</span>
            </div>
          </div>
        </div>`;
    }

    if (compact) {
      return `<div class="time-breakdown compact">
          <span class="time-compact-item">📅 ${breakdown.days} days</span>
          <span class="time-compact-item">📆 ${breakdown.weeks} weeks</span>
          <span class="time-compact-item">🗓️ ${breakdown.months} months</span>
        </div>`;
    }

    return `<div class="time-breakdown">
        <div class="time-breakdown-header">
          ⏰ Time until ${monthName} ${targetYear}
        </div>
        <div class="time-breakdown-grid">
          <div class="time-unit highlight">
            <span class="time-value">${breakdown.days}</span>
            <span class="time-label">days</span>
          </div>
          <div class="time-unit">
            <span class="time-value">${breakdown.weeks}</span>
            <span class="time-label">weeks</span>
          </div>
          <div class="time-unit">
            <span class="time-value">${breakdown.months}</span>
            <span class="time-label">months</span>
          </div>
        </div>
        <div class="time-breakdown-details">
          <div class="time-detail">
            <span class="time-detail-icon">🌴</span>
            <span class="time-detail-text"><strong>${breakdown.weekends}</strong> weekends to work on this</span>
          </div>
          <div class="time-detail">
            <span class="time-detail-icon">💪</span>
            <span class="time-detail-text"><strong>${breakdown.workSessions3x}</strong> sessions if you work 3x/week</span>
          </div>
          <div class="time-detail">
            <span class="time-detail-icon">🚀</span>
            <span class="time-detail-text"><strong>${breakdown.workSessions5x}</strong> sessions if you work 5x/week</span>
          </div>
          <div class="time-detail">
            <span class="time-detail-icon">⏱️</span>
            <span class="time-detail-text"><strong>${breakdown.focusHours1hDay}h</strong> total if 1h/day, <strong>${breakdown.focusHours2hDay}h</strong> if 2h/day</span>
          </div>
        </div>
        <div class="time-breakdown-tip">
          💡 <em>Break this milestone into ${Math.max(1, Math.ceil(breakdown.weeks / 2))} small steps — one every ~2 weeks</em>
        </div>
      </div>`;
  },

  // Get a simple "time left" string
  getSimpleTimeLeft(targetMonth: number, targetYear: number): string {
    const breakdown = this.calculate(targetMonth, targetYear);

    if (breakdown.isPast) return "In the past";
    if (breakdown.isCurrentMonth) return `${breakdown.days} days left`;
    if (breakdown.days <= 7) return `${breakdown.days} days`;
    if (breakdown.weeks <= 4) return `${breakdown.weeks} weeks`;
    if (breakdown.months <= 2) return `${breakdown.weeks} weeks`;
    return `${breakdown.months} months`;
  },

  // Calculate hours left in the current day
  calculateForDay(): TimeBreakdownResult {
    const now = new Date();
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const diffMs = endOfDay.getTime() - now.getTime();
    const hoursLeft = Math.max(0, diffMs / (1000 * 60 * 60));

    return {
      days: 0,
      weeks: 0,
      months: 0,
      weekends: 0,
      workSessions3x: 0,
      workSessions5x: 0,
      focusHours1hDay: 0,
      focusHours2hDay: 0,
      isPast: false,
      isCurrentMonth: false,
      hoursLeftInDay: Math.round(hoursLeft * 10) / 10, // Round to 1 decimal place
      isCurrentDay: true,
    };
  },

  // Calculate week-specific metrics
  calculateForWeek(): TimeBreakdownResult {
    const now = new Date();
    const currentDay = now.getDay(); // 0 = Sunday, 6 = Saturday
    const endOfWeek = new Date(now);

    // Calculate days until end of week (Saturday)
    const daysUntilSaturday = 6 - currentDay;
    endOfWeek.setDate(now.getDate() + daysUntilSaturday);
    endOfWeek.setHours(23, 59, 59, 999);

    const diffMs = endOfWeek.getTime() - now.getTime();
    const msPerDay = 1000 * 60 * 60 * 24;
    const daysLeft = Math.max(0, Math.ceil(diffMs / msPerDay));

    // Count weekends (Saturday/Sunday) in remaining days
    let weekendsInWeek = 0;
    const tempDate = new Date(now);
    while (tempDate <= endOfWeek) {
      const dayOfWeek = tempDate.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        weekendsInWeek++;
      }
      tempDate.setDate(tempDate.getDate() + 1);
    }
    weekendsInWeek = Math.floor(weekendsInWeek / 2); // Count weekend pairs

    // Calculate work sessions for remaining week
    const weeksRemaining = daysLeft / 7;
    const workSessions3x = Math.floor(weeksRemaining * 3);
    const workSessions5x = Math.floor(weeksRemaining * 5);

    return {
      days: daysLeft,
      weeks: Math.floor(weeksRemaining),
      months: 0,
      weekends: weekendsInWeek,
      workSessions3x: workSessions3x,
      workSessions5x: workSessions5x,
      focusHours1hDay: daysLeft,
      focusHours2hDay: daysLeft * 2,
      isPast: false,
      isCurrentMonth: false,
      daysLeftInWeek: daysLeft,
      weekendsInWeek: weekendsInWeek,
      isCurrentWeek: true,
    };
  },

  // Calculate year-specific metrics
  calculateForYear(targetYear?: number): TimeBreakdownResult {
    const now = new Date();
    const year = targetYear ?? now.getFullYear();
    const nowYear = now.getFullYear();
    const currentMonth = now.getMonth();

    // If planning a different year, treat that year's "remaining time" within its own calendar.
    // - past year: 0 remaining
    // - future year: full year remaining
    const isFutureYear = year > nowYear;
    const isPastYear = year < nowYear;

    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startAnchor = isFutureYear
      ? new Date(year, 0, 1)
      : startOfToday;

    const endOfYear = new Date(year, 11, 31);

    const msPerDay = 1000 * 60 * 60 * 24;
    const diffDays = isPastYear
      ? 0
      : Math.max(
          0,
          Math.round(
            (endOfYear.getTime() - startAnchor.getTime()) / msPerDay,
          ),
        );
    const diffWeeks = Math.max(0, Math.floor(diffDays / 7));

    // Calculate full months left in the year (excluding the current month).
    // Example: Dec -> 0, Jan -> 11.
    const monthsLeft = isPastYear
      ? 0
      : isFutureYear
        ? 12
        : Math.max(0, 11 - currentMonth);

    // Calculate quarters left (Q1=Jan-Mar, Q2=Apr-Jun, Q3=Jul-Sep, Q4=Oct-Dec)
    const currentQuarter = Math.floor(currentMonth / 3) + 1;
    const quartersLeft = isPastYear
      ? 0
      : isFutureYear
        ? 4
        : Math.max(0, 4 - currentQuarter);

    // Calculate weekends
    let weekends = 0;
    const tempDate = new Date(startAnchor);
    while (tempDate <= endOfYear) {
      if (tempDate.getDay() === 0 || tempDate.getDay() === 6) {
        weekends++;
      }
      tempDate.setDate(tempDate.getDate() + 1);
    }
    weekends = Math.floor(weekends / 2); // Count weekend pairs

    // Calculate work sessions for remaining year
    const workSessions3x = diffWeeks * 3;
    const workSessions5x = diffWeeks * 5;

    return {
      days: diffDays,
      weeks: diffWeeks,
      months: monthsLeft,
      weekends: weekends,
      workSessions3x: workSessions3x,
      workSessions5x: workSessions5x,
      focusHours1hDay: diffDays,
      focusHours2hDay: diffDays * 2,
      isPast: isPastYear,
      isCurrentMonth: false,
      quartersLeft: quartersLeft,
      isCurrentYear: year === nowYear,
    };
  },
};
