// Brain Dump - Parking lot for intrusive thoughts
import { State } from '../../core/State';
import DB, { DB_STORES } from '../../db';
import { dirtyTracker } from '../../services/DirtyTracker';
import { debouncedBrainDumpSync } from '../../services/sync/syncHelpers';
import { syncQueue } from '../../services/SyncQueue';
import { SupabaseService } from '../../services/supabase';
import type { BrainDumpEntry, NDSupportCallbacks } from './types';

function persistBrainDumpEntryToIndexedDb(entry: BrainDumpEntry): void {
  void DB.update(DB_STORES.BRAIN_DUMP, entry).catch((err: unknown) => {
    console.warn('[BrainDump] Failed to persist brain dump entry to IndexedDB:', err);
  });
}

function deleteBrainDumpEntryFromIndexedDb(id: string): void {
  void DB.delete(DB_STORES.BRAIN_DUMP, id).catch((err: unknown) => {
    console.warn('[BrainDump] Failed to delete brain dump entry from IndexedDB:', err);
  });
}

export class BrainDump {
  private callbacks: NDSupportCallbacks = {};

  setCallbacks(callbacks: NDSupportCallbacks): void {
    this.callbacks = callbacks;
  }

  addEntry(thought: string): BrainDumpEntry {
    if (!State.data) {
      State.init();
      if (!State.data) throw new Error("State not initialized");
    }
    const entry: BrainDumpEntry = {
      id: crypto.randomUUID(),
      text: thought,
      createdAt: new Date().toISOString(),
      processed: false,
    };
    State.data.brainDump.unshift(entry);
    State.save();
    persistBrainDumpEntryToIndexedDb(entry);
    dirtyTracker.markDirty('brainDump', entry.id);
    debouncedBrainDumpSync(entry);
    return entry;
  }

  getEntries(): BrainDumpEntry[] {
    if (!State.data) return [];
    return State.data.brainDump || [];
  }

  processItem(id: string, action: string): void {
    if (!State.data) return;
    const item = State.data.brainDump.find((i) => i.id === id);
    if (item) {
      item.processed = true;
      item.processedAction = action;
      item.processedAt = new Date().toISOString();
      State.save();
      persistBrainDumpEntryToIndexedDb(item);
      dirtyTracker.markDirty('brainDump', item.id);
      debouncedBrainDumpSync(item);
    }
  }

  clearProcessed(): void {
    if (!State.data) return;
    const removed = State.data.brainDump.filter((i) => i.processed);
    State.data.brainDump = State.data.brainDump.filter((i) => !i.processed);
    State.save();

    removed.forEach((item) => {
      deleteBrainDumpEntryFromIndexedDb(item.id);
      SupabaseService.deleteBrainDump(item.id).catch((error) => {
        try {
          syncQueue.enqueue({ type: 'delete', entity: 'brainDump', data: { id: item.id } });
        } catch (queueError) {
          console.warn('[BrainDump] Failed to queue brain dump delete:', { error, queueError });
        }
      });
    });
  }

  showModal(): void {
    const existingModal = document.querySelector(".brain-dump-modal");
    if (existingModal) existingModal.remove();

    const brainDump = this.getEntries();
    const unprocessed = brainDump.filter((i) => !i.processed);

    const modal = document.createElement("div");
    modal.className = "modal-overlay active brain-dump-modal";
    modal.innerHTML = `
        <div class="modal modal-lg">
          <div class="modal-header">
            <h2 class="modal-title">Brain Dump</h2>
            <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
          </div>
          <div class="modal-body">
            <div class="add-thought">
              <textarea id="brainDumpInput" rows="3"></textarea>
              <button class="btn btn-primary" id="addThoughtBtn">Dump it</button>
            </div>
            <div class="brain-dump-list">
              <h3>Parked thoughts (${unprocessed.length})</h3>
              ${unprocessed.length === 0 ? '<p class="empty-state">Your mind is clear!</p>' : ""}
              ${unprocessed
        .map(
          (item) => `
                <div class="brain-dump-item" data-id="${item.id}">
                  <p class="thought-text">${(this.callbacks.onEscapeHtml ?? ((x: string) => x))(item.text)}</p>
                  <div class="thought-actions">
                      <button class="btn btn-sm btn-ghost" data-action="convert">Make milestone</button>
                    <button class="btn btn-sm btn-ghost" data-action="dismiss">Dismiss</button>
                  </div>
                </div>
              `,
        )
        .join("")}
            </div>
          </div>
        </div>
      `;

    document.body.appendChild(modal);

    // Event listeners
    const addBtn = document.getElementById("addThoughtBtn");
    if (addBtn) {
      addBtn.addEventListener("click", () => {
        const input = document.getElementById("brainDumpInput") as HTMLInputElement | null;
        if (input) {
          const text = input.value.trim();
          if (text) {
            this.addEntry(text);
            input.value = "";
            this.showModal(); // Refresh
            this.callbacks.onShowToast?.("Thought parked!", "success");
          }
        }
      });
    }

    modal.querySelectorAll(".thought-actions button").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const target = e.target as HTMLElement;
        const item = target.closest(".brain-dump-item") as HTMLElement | null;
        if (!item) return;
        const id = item.dataset.id;
        const action = target.dataset.action;

        if (action === "convert" && id) {
          const thought = brainDump.find((i) => i.id === id);
          if (thought) {
            this.processItem(id, "converted");
            this.callbacks.onOpenGoalModal?.("milestone", State.viewingMonth, State.viewingYear);
            setTimeout(() => {
              const titleInput = document.getElementById("goalTitle") as HTMLInputElement | null;
              if (titleInput) {
                titleInput.value = thought.text;
              }
            }, 100);
          }
        } else if (action === "dismiss" && id) {
          this.processItem(id, "dismissed");
          this.showModal(); // Refresh
        }

        modal.remove();
      });
    });

    // Close on backdrop click
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.remove();
    });
  }
}
