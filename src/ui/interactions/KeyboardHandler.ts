import { State } from "../../core/State";
import { VIEWS } from "../../config";

type KeyboardHandlerCallbacks = {
  closeModals: () => void;
  syncViewButtons: () => void;
  showToast: (iconOrMessage: string, message?: string) => void;
  render: () => void;
  openNewItem: () => void;
  toggleFocusMode: () => void;
  showBrainDumpModal: () => void | Promise<void>;
  showQuickAdd: () => void | Promise<void>;
  showKeyboardShortcuts: () => void;
};

export const KeyboardHandler = {
  handleKeyDown(e: KeyboardEvent, callbacks: KeyboardHandlerCallbacks) {
    // Don't trigger shortcuts when typing in inputs
    const target = e.target as HTMLElement | null;
    if (
      target?.tagName === "INPUT" ||
      target?.tagName === "TEXTAREA" ||
      !!target?.isContentEditable
    ) {
      // Only allow Escape in inputs
      if (e.key !== "Escape") return;
    }

    // Escape to close modals
    if (e.key === "Escape") {
      callbacks.closeModals();
    }

    // View switching: 1=Garden, 2=Day, 3=Week, 4=Month, 5=Year
    if (e.key === "1" && !e.ctrlKey && !e.metaKey) {
      State.setView(VIEWS.GARDEN);
      callbacks.syncViewButtons();
      callbacks.showToast("🌿", "Garden view");
    }
    if (e.key === "2" && !e.ctrlKey && !e.metaKey) {
      State.setView(VIEWS.DAY);
      callbacks.syncViewButtons();
      callbacks.showToast("", "Day view");
    }
    if (e.key === "3" && !e.ctrlKey && !e.metaKey) {
      State.setView(VIEWS.WEEK);
      callbacks.syncViewButtons();
      callbacks.showToast("", "Week view");
    }
    if (e.key === "4" && !e.ctrlKey && !e.metaKey) {
      State.setView(VIEWS.MONTH);
      callbacks.syncViewButtons();
      callbacks.showToast("", "Month view");
    }
    if (e.key === "5" && !e.ctrlKey && !e.metaKey) {
      State.setView(VIEWS.YEAR);
      callbacks.syncViewButtons();
      callbacks.showToast("", "Year view");
    }

    // Arrow key navigation
    if (e.key === "ArrowLeft" && !e.ctrlKey && !e.metaKey) {
      State.navigate(-1);
    }
    if (e.key === "ArrowRight" && !e.ctrlKey && !e.metaKey) {
      State.navigate(1);
    }

    // T for Today
    if (e.key === "t" && !e.ctrlKey && !e.metaKey) {
      State.goToDate(new Date());
      callbacks.render();
      callbacks.showToast("", "Jumped to today");
    }

    // Ctrl/Cmd + N for new item (based on view)
    if ((e.ctrlKey || e.metaKey) && e.key === "n") {
      e.preventDefault();
      callbacks.openNewItem();
    }

    // Ctrl/Cmd + F for focus mode
    if ((e.ctrlKey || e.metaKey) && e.key === "f" && !e.shiftKey) {
      e.preventDefault();
      callbacks.toggleFocusMode();
    }

    // B for brain dump
    if (e.key === "b" && !e.ctrlKey && !e.metaKey) {
      void callbacks.showBrainDumpModal();
    }

    // I for Quick-Add Intention
    if (e.key === "i" && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      void callbacks.showQuickAdd();
    }

    // ? for keyboard shortcuts help
    if (e.key === "?" || (e.shiftKey && e.key === "/")) {
      callbacks.showKeyboardShortcuts();
    }
  },
};
