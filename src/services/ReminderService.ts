import { State } from "../core/State";
import { WeekReflections } from "../core/WeekReflections";
import { eventBus } from "../core/EventBus";

let checkInterval: number | null = null;
let lastCheckTime: number = 0;

export const ReminderService = {
  start() {
    if (checkInterval) return;

    // Check every minute
    checkInterval = window.setInterval(() => {
      this.checkReminders();
    }, 60000);

    // Immediate check
    this.checkReminders();
  },

  stop() {
    if (checkInterval) {
      clearInterval(checkInterval);
      checkInterval = null;
    }
  },

  async checkReminders() {
    if (!State.data) return;

    const now = new Date();
    const currentTime = now.getTime();

    // Only check once per minute
    if (currentTime - lastCheckTime < 50000) return;
    lastCheckTime = currentTime;

    const { nd } = State.data.preferences;
    if (nd.checkInDay === undefined || nd.checkInTime === undefined) return;

    const currentDay = now.getDay(); // 0-6
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();

    const [targetHours, targetMinutes] = nd.checkInTime.split(":").map(Number);

    // Is it the right day and time (or after)?
    // We want to trigger it once when the time hits, or if they haven't done it yet this week
    if (currentDay === nd.checkInDay) {
      // Check if it's the right time
      if (
        currentHours > targetHours ||
        (currentHours === targetHours && currentMinutes >= targetMinutes)
      ) {
        const weekNum = State.getWeekNumber(now);
        const weekYear = State.getWeekYear(now);

        // Check if reflection already exists
        const reflection = await WeekReflections.get(weekYear, weekNum);

        if (!reflection) {
          // Emit event to show reminder
          eventBus.emit("ui:checkin-due", {
            weekNum,
            weekYear,
            message: "Time for your weekly garden check-in! 🌱",
          });
        }
      }
    }
  },
};
