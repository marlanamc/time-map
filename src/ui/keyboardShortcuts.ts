export function showKeyboardShortcuts() {
  const modal = document.createElement("div");
  modal.className = "modal-overlay active";
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h2 class="modal-title">⌨️ Keyboard Shortcuts</h2>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
      </div>
      <div class="modal-body">
        <div class="shortcuts-grid">
          <div class="shortcut-section">
            <h3>Views</h3>
            <div class="shortcut-item"><kbd>1</kbd> Garden view</div>
            <div class="shortcut-item"><kbd>2</kbd> Day view</div>
            <div class="shortcut-item"><kbd>3</kbd> Week view</div>
            <div class="shortcut-item"><kbd>4</kbd> Month view</div>
            <div class="shortcut-item"><kbd>5</kbd> Year view</div>
          </div>
          <div class="shortcut-section">
            <h3>Navigation</h3>
            <div class="shortcut-item"><kbd>←</kbd> Previous</div>
            <div class="shortcut-item"><kbd>→</kbd> Next</div>
            <div class="shortcut-item"><kbd>T</kbd> Go to today</div>
          </div>
          <div class="shortcut-section">
            <h3>Actions</h3>
            <div class="shortcut-item"><kbd>⌘/Ctrl</kbd> + <kbd>N</kbd> New intention/focus/milestone/vision</div>
            <div class="shortcut-item"><kbd>⌘/Ctrl</kbd> + <kbd>F</kbd> Focus (calmer view)</div>
            <div class="shortcut-item"><kbd>B</kbd> Brain dump</div>
            <div class="shortcut-item"><kbd>Esc</kbd> Close modal</div>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.remove();
  });
}
