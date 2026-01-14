import { State } from "../../core/State";
import { Events } from "../../core/Events";
import { eventBus } from "../../core/EventBus";
import { renderAccordionSection, setupAccordionSectionToggles } from "./shared/AccordionSection";
import { setupModalA11y, type ModalA11yCleanup } from "./shared/modalA11y";
import type { CalendarEvent, EventRecurrence } from "../../types";

type ShowOptions = {
  date: Date;
  eventId?: string;
};

function ymdLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseYmdLocal(ymd: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || !Number.isFinite(day)) return null;
  const d = new Date(year, monthIndex, day);
  return Number.isNaN(d.getTime()) ? null : d;
}

function buildDateTimeIso(dateYmd: string, time: string | null): string {
  const d = parseYmdLocal(dateYmd) ?? new Date();
  if (!time) {
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }
  const [h, m] = time.split(":").map((n) => Number(n));
  d.setHours(Number.isFinite(h) ? h : 0, Number.isFinite(m) ? m : 0, 0, 0);
  return d.toISOString();
}

function endOfDayIso(dateYmd: string): string {
  const d = parseYmdLocal(dateYmd) ?? new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

function ensureModal(): HTMLElement {
  let overlay = document.getElementById("eventModal") as HTMLElement | null;
  if (overlay) return overlay;

  overlay = document.createElement("div");
  overlay.id = "eventModal";
  overlay.className = "modal-overlay";
  const repeatSectionHtml = renderAccordionSection({
    id: "eventRepeatDisclosure",
    title: "Repeat (optional)",
    subtitle: "For recurring appointments or routines.",
    bodyId: "eventRepeatBody",
    bodyHtml: `
            <div class="form-group">
              <label for="eventFreq">Frequency</label>
              <select id="eventFreq" class="modal-select">
                <option value="">None</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
            <div class="form-row" id="eventRepeatDetailsRow" hidden>
              <div class="form-group">
                <label for="eventInterval">Every</label>
                <input id="eventInterval" type="number" min="1" value="1" />
              </div>
              <div class="form-group">
                <label for="eventEnds">Ends</label>
                <select id="eventEnds" class="modal-select">
                  <option value="never">Never</option>
                  <option value="until">On date</option>
                  <option value="count">After N times</option>
                </select>
              </div>
            </div>
            <div class="form-row" id="eventEndsRow" hidden>
              <div class="form-group" id="eventUntilGroup" hidden>
                <label for="eventUntil">Until</label>
                <input id="eventUntil" type="date" />
              </div>
              <div class="form-group" id="eventCountGroup" hidden>
                <label for="eventCount">Count</label>
                <input id="eventCount" type="number" min="1" value="10" />
              </div>
            </div>
            <div class="form-group" id="eventWeekdaysGroup" hidden>
              <div class="event-weekdays-label">Select the weekdays you want this event to repeat on (e.g., Tue + Thu).</div>
              <label>Days of week</label>
              <div class="modal-pill-row event-weekdays">
                ${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
                  .map((label, idx) => `<button type="button" class="modal-pill" data-action="toggle-weekday" data-weekday="${idx}">${label}</button>`)
                  .join("")}
              </div>
            </div>
            <div class="time-context-safety">This is here to help you orient, not to rush you.</div>
    `,
    toggleAttributes: { "data-action": "toggle-event-repeat" },
  });
  overlay.innerHTML = `
    <div class="modal modal-lg event-modal" role="dialog" aria-modal="true" aria-label="Event">
      <div class="modal-header">
        <div class="modal-title" id="eventModalTitle">Add Event</div>
        <button class="modal-close" type="button" data-action="close-event-modal">×</button>
      </div>
      <form class="modal-body" id="eventModalForm">
        <div class="form-group">
          <label for="eventTitle">What’s happening?</label>
          <input id="eventTitle" type="text" autocomplete="off" required />
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="eventDate">Date</label>
            <input id="eventDate" type="date" required />
          </div>
          <div class="form-group event-modal-toggle">
            <label class="toggle-label">
              <input type="checkbox" id="eventAllDay" />
              All-day
            </label>
          </div>
        </div>

        <div class="form-row event-time-row" id="eventTimeRow" hidden>
          <div class="form-group">
            <label for="eventStartTime">Start time (optional)</label>
            <input id="eventStartTime" type="time" />
          </div>
          <div class="form-group">
            <label for="eventEndTime">End time (optional)</label>
            <input id="eventEndTime" type="time" />
          </div>
        </div>

        <div class="form-row event-enddate-row" id="eventEndDateRow">
          <div class="form-group">
            <label for="eventEndDate">End date (optional)</label>
            <input id="eventEndDate" type="date" />
          </div>
        </div>

        ${repeatSectionHtml}

        <div class="form-group">
          <label for="eventNotes">Notes (optional)</label>
          <textarea id="eventNotes" rows="3"></textarea>
        </div>

        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" data-action="cancel-event-modal">Not right now</button>
          <button type="submit" class="btn btn-primary" id="eventSaveBtn">Save event</button>
          <button type="button" class="btn btn-ghost event-delete-btn" id="eventDeleteBtn" hidden>Delete</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(overlay);
  setupAccordionSectionToggles(overlay);
  return overlay;
}

function getEventById(id: string): CalendarEvent | null {
  return (State.data?.events ?? []).find((e) => e.id === id) ?? null;
}

class EventModalManager {
  private currentId: string | null = null;
  private weekdays = new Set<number>();
  private a11yCleanup: ModalA11yCleanup | null = null;

  show(opts: ShowOptions): void {
    const overlay = ensureModal();
    overlay.classList.add("active");
    this.currentId = opts.eventId ?? null;

    const titleEl = overlay.querySelector("#eventModalTitle") as HTMLElement | null;
    const saveBtn = overlay.querySelector("#eventSaveBtn") as HTMLButtonElement | null;
    const deleteBtn = overlay.querySelector("#eventDeleteBtn") as HTMLButtonElement | null;

    const titleInput = overlay.querySelector("#eventTitle") as HTMLInputElement | null;
    const dateInput = overlay.querySelector("#eventDate") as HTMLInputElement | null;
    const allDayInput = overlay.querySelector("#eventAllDay") as HTMLInputElement | null;
    const startTimeInput = overlay.querySelector("#eventStartTime") as HTMLInputElement | null;
    const endTimeInput = overlay.querySelector("#eventEndTime") as HTMLInputElement | null;
    const endDateInput = overlay.querySelector("#eventEndDate") as HTMLInputElement | null;
    const notesInput = overlay.querySelector("#eventNotes") as HTMLTextAreaElement | null;

    const freqSelect = overlay.querySelector("#eventFreq") as HTMLSelectElement | null;
    const intervalInput = overlay.querySelector("#eventInterval") as HTMLInputElement | null;
    const endsSelect = overlay.querySelector("#eventEnds") as HTMLSelectElement | null;
    const untilInput = overlay.querySelector("#eventUntil") as HTMLInputElement | null;
    const countInput = overlay.querySelector("#eventCount") as HTMLInputElement | null;

    const timeRow = overlay.querySelector("#eventTimeRow") as HTMLElement | null;
    const endDateRow = overlay.querySelector("#eventEndDateRow") as HTMLElement | null;
    const repeatDetailsRow = overlay.querySelector("#eventRepeatDetailsRow") as HTMLElement | null;
    const endsRow = overlay.querySelector("#eventEndsRow") as HTMLElement | null;
    const untilGroup = overlay.querySelector("#eventUntilGroup") as HTMLElement | null;
    const countGroup = overlay.querySelector("#eventCountGroup") as HTMLElement | null;
    const weekdaysGroup = overlay.querySelector("#eventWeekdaysGroup") as HTMLElement | null;

    const updateAllDay = () => {
      const allDay = !!allDayInput?.checked;
      if (timeRow) timeRow.toggleAttribute("hidden", allDay);
      if (endDateRow) endDateRow.toggleAttribute("hidden", !allDay);
    };

    const updateRepeatVisibility = () => {
      const freq = (freqSelect?.value ?? "") as EventRecurrence["freq"] | "";
      const enabled = Boolean(freq);
      repeatDetailsRow?.toggleAttribute("hidden", !enabled);

      const endsMode = endsSelect?.value ?? "never";
      const showEndsRow = enabled && (endsMode === "until" || endsMode === "count");
      endsRow?.toggleAttribute("hidden", !showEndsRow);
      untilGroup?.toggleAttribute("hidden", !(enabled && endsMode === "until"));
      countGroup?.toggleAttribute("hidden", !(enabled && endsMode === "count"));

      const showWeekdays = enabled && freq === "weekly";
      weekdaysGroup?.toggleAttribute("hidden", !showWeekdays);
    };

    const applyWeekdayButtons = () => {
      overlay.querySelectorAll<HTMLElement>('[data-action="toggle-weekday"]').forEach((btn) => {
        const idx = Number(btn.dataset.weekday);
        btn.classList.toggle("is-selected", this.weekdays.has(idx));
      });
    };

    const resetRepeat = () => {
      this.weekdays.clear();
      const dayIdx = opts.date.getDay();
      this.weekdays.add(dayIdx);
      applyWeekdayButtons();
      if (freqSelect) freqSelect.value = "";
      if (intervalInput) intervalInput.value = "1";
      if (endsSelect) endsSelect.value = "never";
      if (untilInput) untilInput.value = "";
      if (countInput) countInput.value = "10";
      updateRepeatVisibility();
    };

    // Fill fields
    const existing = this.currentId ? getEventById(this.currentId) : null;
    if (existing) {
      if (titleEl) titleEl.textContent = "Edit Event";
      if (saveBtn) saveBtn.textContent = "Save changes";
      if (deleteBtn) deleteBtn.hidden = false;

      const start = new Date(existing.startAt);
      const end = existing.endAt ? new Date(existing.endAt) : null;

      if (titleInput) titleInput.value = existing.title;
      if (dateInput) dateInput.value = ymdLocal(start);
      if (notesInput) notesInput.value = existing.description ?? "";
      if (allDayInput) allDayInput.checked = !!existing.allDay;

      if (existing.allDay) {
        if (endDateInput && end) {
          const startYmd = ymdLocal(start);
          const endYmd = ymdLocal(end);
          endDateInput.value = startYmd === endYmd ? "" : endYmd;
        }
      } else {
        if (startTimeInput) startTimeInput.value = start.toTimeString().slice(0, 5);
        if (endTimeInput && end) endTimeInput.value = end.toTimeString().slice(0, 5);
      }

      resetRepeat();
      if (existing.recurrence && freqSelect) {
        const rec = existing.recurrence;
        freqSelect.value = rec.freq;
        if (intervalInput) intervalInput.value = String(rec.interval ?? 1);
        if (rec.freq === "weekly") {
          this.weekdays.clear();
          (rec.byWeekday ?? [start.getDay()]).forEach((d) => this.weekdays.add(d));
          applyWeekdayButtons();
        }
        if (rec.until && untilInput) {
          if (endsSelect) endsSelect.value = "until";
          const until = new Date(rec.until);
          untilInput.value = ymdLocal(until);
        } else if (rec.count && countInput) {
          if (endsSelect) endsSelect.value = "count";
          countInput.value = String(rec.count);
        }
        updateRepeatVisibility();
      }
    } else {
      if (titleEl) titleEl.textContent = "Add Event";
      if (saveBtn) saveBtn.textContent = "Save event";
      if (deleteBtn) deleteBtn.hidden = true;

      if (titleInput) titleInput.value = "";
      if (dateInput) dateInput.value = ymdLocal(opts.date);
      if (notesInput) notesInput.value = "";
      if (allDayInput) allDayInput.checked = false;
      if (startTimeInput) startTimeInput.value = "";
      if (endTimeInput) endTimeInput.value = "";
      if (endDateInput) endDateInput.value = "";
      resetRepeat();
    }

    updateAllDay();

    // Bind events
    const close = () => this.hide();

    overlay.querySelectorAll<HTMLElement>('[data-action="close-event-modal"], [data-action="cancel-event-modal"]').forEach((btn) => {
      btn.onclick = (e) => {
        e.preventDefault();
        close();
      };
    });

    overlay.onclick = (e) => {
      if (e.target === overlay) close();
    };

    const allDayHandler = () => updateAllDay();
    allDayInput?.addEventListener("change", allDayHandler, { once: true });
    allDayInput?.addEventListener("change", updateAllDay);

    freqSelect?.addEventListener("change", updateRepeatVisibility);
    endsSelect?.addEventListener("change", updateRepeatVisibility);

    overlay.querySelectorAll<HTMLElement>('[data-action="toggle-weekday"]').forEach((btn) => {
      btn.onclick = (e) => {
        e.preventDefault();
        const idx = Number(btn.dataset.weekday);
        if (!Number.isFinite(idx)) return;
        if (this.weekdays.has(idx)) this.weekdays.delete(idx);
        else this.weekdays.add(idx);
        applyWeekdayButtons();
      };
    });

    const form = overlay.querySelector("#eventModalForm") as HTMLFormElement | null;
    if (form) {
      form.onsubmit = (ev) => {
        ev.preventDefault();

        const title = titleInput?.value.trim() ?? "";
        const dateYmd = dateInput?.value.trim() ?? "";
        if (!title || !dateYmd) return;

        const allDay = !!allDayInput?.checked;
        const startTime = allDay ? null : (startTimeInput?.value || null);
        const endTime = allDay ? null : (endTimeInput?.value || null);

        const startAt = buildDateTimeIso(dateYmd, startTime);
        const endAt = (() => {
          if (allDay) {
            const endDate = (endDateInput?.value || "").trim();
            return endOfDayIso(endDate || dateYmd);
          }
          if (!endTime) return null;
          return buildDateTimeIso(dateYmd, endTime);
        })();

        const freq = (freqSelect?.value ?? "") as EventRecurrence["freq"] | "";
        const recurrence = (() => {
          if (!freq) return null;
          const interval = Math.max(1, Math.floor(Number(intervalInput?.value ?? 1)));
          const endsMode = endsSelect?.value ?? "never";
          const rec: EventRecurrence = { freq, interval };
          if (freq === "weekly") {
            const byWeekday = Array.from(this.weekdays.values()).sort();
            rec.byWeekday = byWeekday.length > 0 ? byWeekday : [parseYmdLocal(dateYmd)?.getDay() ?? 1];
          }
          if (endsMode === "until") {
            const untilYmd = (untilInput?.value || "").trim();
            if (untilYmd) rec.until = endOfDayIso(untilYmd);
          }
          if (endsMode === "count") {
            const count = Math.max(1, Math.floor(Number(countInput?.value ?? 1)));
            rec.count = count;
          }
          return rec;
        })();

        const description = (notesInput?.value ?? "").trim();

        if (this.currentId) {
          Events.update(this.currentId, {
            title,
            description,
            startAt,
            endAt,
            allDay,
            recurrence,
          });
        } else {
          Events.create({
            title,
            description,
            startAt,
            endAt,
            allDay,
            recurrence,
          });
        }

        this.hide();
        eventBus.emit("view:changed", { transition: false });
      };
    }

    if (deleteBtn) {
      deleteBtn.onclick = (ev) => {
        ev.preventDefault();
        if (!this.currentId) return;
        Events.delete(this.currentId);
        this.hide();
        eventBus.emit("view:changed", { transition: false });
      };
    }

    // Setup accessibility: ESC to close, focus trap, initial focus
    const modalContainer = overlay.querySelector(".modal") as HTMLElement | null;
    if (modalContainer) {
      // Clean up previous setup if showing again
      if (this.a11yCleanup) {
        this.a11yCleanup();
        this.a11yCleanup = null;
      }
      this.a11yCleanup = setupModalA11y({
        overlay,
        modal: modalContainer,
        onClose: () => this.hide(),
        initialFocusSelector: "#eventTitle",
      });
    }
  }

  hide(): void {
    // Clean up accessibility handlers and restore focus
    if (this.a11yCleanup) {
      this.a11yCleanup();
      this.a11yCleanup = null;
    }
    const overlay = document.getElementById("eventModal") as HTMLElement | null;
    overlay?.classList.remove("active");
    this.currentId = null;
  }
}

export const eventModal = new EventModalManager();
