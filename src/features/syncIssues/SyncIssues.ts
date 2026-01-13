import { syncQueue }  from "../../services/SyncQueue";
import { isSupabaseConfigured }  from "../../supabaseClient";

export type SyncIssuesContext = {
  showToast: (iconOrMessage: string, messageOrType?: string) => void;
  updateSyncStatus?: (status: "syncing" | "synced" | "error" | "local" | "offline") => void;
};

function escapeHtml(text: string) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function formatAge(ms: number) {
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function getFailureCount() {
  return syncQueue.getFailures().length;
}

export function showSyncIssuesModal(ctx: SyncIssuesContext) {
  const failures = syncQueue.getFailures();

  const modal = document.createElement("div");
  modal.className = "modal-overlay active";
  modal.innerHTML = `
    <div class="modal modal-lg">
      <div class="modal-header">
        <h2 class="modal-title">Sync issues</h2>
        <button class="modal-close" id="closeSyncIssues">×</button>
      </div>
      <div class="modal-body">
        <p class="muted" style="margin-top:0">
          These changes couldn’t sync after multiple retries. You can retry or discard them.
        </p>

        <div class="sync-issues-actions" style="display:flex; gap:8px; flex-wrap:wrap; margin: 12px 0 16px;">
          <button type="button" class="btn btn-primary" id="retryAllSyncIssues" ${
            failures.length === 0 ? "disabled" : ""
          }>Retry all</button>
          <button type="button" class="btn btn-ghost" id="exportSyncIssues" ${
            failures.length === 0 ? "disabled" : ""
          }>Export</button>
          <button type="button" class="btn btn-ghost" id="clearSyncIssues" ${
            failures.length === 0 ? "disabled" : ""
          }>Discard all</button>
        </div>

        ${
          failures.length === 0
            ? `<div class="empty-state">No sync issues.</div>`
            : `<div class="sync-issues-list" id="syncIssuesList">
              ${failures
                .slice()
                .sort((a, b) => b.timestamp - a.timestamp)
                .map((f) => {
                  const age = formatAge(Date.now() - f.timestamp);
                  const title =
                    typeof f.data?.title === "string"
                      ? f.data.title
                      : typeof f.data?.id === "string"
                        ? f.data.id
                        : f.id;
                  return `
                    <div class="sync-issue-row" data-failure-id="${escapeHtml(
                      f.id,
                    )}">
                      <div class="sync-issue-main">
                        <div class="sync-issue-title">${escapeHtml(title)}</div>
                        <div class="sync-issue-meta">
                          <span class="pill">${escapeHtml(f.entity)}</span>
                          <span class="pill">${escapeHtml(f.type)}</span>
                          <span class="pill">age: ${escapeHtml(age)}</span>
                        </div>
                      </div>
                      <div class="sync-issue-actions">
                        <button type="button" class="btn btn-sm btn-primary" data-action="retry">Retry</button>
                        <button type="button" class="btn btn-sm btn-ghost" data-action="discard">Discard</button>
                      </div>
                    </div>
                  `;
                })
                .join("")}
            </div>`
        }
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const close = () => modal.remove();
  modal.querySelector("#closeSyncIssues")?.addEventListener("click", close);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) close();
  });

  modal.querySelector("#exportSyncIssues")?.addEventListener("click", () => {
    downloadJson(`sync-issues-${new Date().toISOString()}.json`, {
      exportedAt: new Date().toISOString(),
      online: navigator.onLine,
      supabaseConfigured: isSupabaseConfigured,
      failures: syncQueue.getFailures(),
    });
    ctx.showToast("⬇️", "Exported");
  });

  modal.querySelector("#clearSyncIssues")?.addEventListener("click", () => {
    if (!confirm("Discard all failed changes?")) return;
    syncQueue.clearFailures();
    ctx.showToast("🧹", "Cleared");
    close();
  });

  modal.querySelector("#retryAllSyncIssues")?.addEventListener("click", async () => {
    const current = syncQueue.getFailures();
    current.forEach((f) => syncQueue.retryFailure(f.id));
    ctx.updateSyncStatus?.(navigator.onLine ? "syncing" : "offline");
    if (navigator.onLine) {
      await syncQueue.forceSync();
      ctx.showToast("🔄", "Retry started");
    } else {
      ctx.showToast("📴", "Offline — will retry later");
    }
    close();
  });

  modal.querySelector("#syncIssuesList")?.addEventListener("click", async (e) => {
    const target = e.target as Element | null;
    const btn = target?.closest("[data-action]") as HTMLElement | null;
    const row = target?.closest("[data-failure-id]") as HTMLElement | null;
    const action = btn?.dataset.action;
    const id = row?.dataset.failureId;
    if (!action || !id) return;

    if (action === "discard") {
      if (!confirm("Discard this change?")) return;
      syncQueue.discardFailure(id);
      row.remove();
      ctx.showToast("🗑️", "Discarded");
      return;
    }

    if (action === "retry") {
      syncQueue.retryFailure(id);
      ctx.updateSyncStatus?.(navigator.onLine ? "syncing" : "offline");
      if (navigator.onLine) await syncQueue.forceSync();
      row.remove();
      ctx.showToast("🔄", "Retry started");
    }
  });
}

