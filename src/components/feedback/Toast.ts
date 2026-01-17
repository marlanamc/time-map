// ===================================
// Toast Notification Module
// ===================================
import type { UIElements } from "../../types";

let toastTimeout: number | null = null;
let isPaused = false;

export const Toast = {
  show(
    elements: UIElements,
    iconOrMessage: string,
    messageOrType: string = "",
    options?: any,
  ) {
    const toast = elements.toast;
    const toastIcon = elements.toastIcon;
    const toastMessage = elements.toastMessage;
    const toastClose = document.getElementById("toastClose");

    if (!toast || !toastMessage || !toastIcon) return;

    // Clear existing timeout
    if (toastTimeout) {
      window.clearTimeout(toastTimeout);
      toastTimeout = null;
    }

    const body = document.body;
    const isReduced =
      body.classList.contains("feedback-minimal") ||
      body.classList.contains("reduced-motion");

    let icon = iconOrMessage;
    let message = messageOrType;
    if (!messageOrType) {
      icon = "";
      message = iconOrMessage;
    }

    toastIcon.textContent = icon || "";
    toastMessage.textContent = message || "";

    toast.classList.add("active");

    const hide = () => {
      toast.classList.remove("active");
      toastTimeout = null;
      isPaused = false;
    };

    toast.onclick = (e) => {
      if ((e.target as HTMLElement).id === "toastClose") return;
      if (options?.onClick) options.onClick();
      hide();
    };

    if (toastClose) {
      toastClose.onclick = (e) => {
        e.stopPropagation();
        hide();
      };
    }

    const duration = options?.timeoutMs || (isReduced ? 2500 : 5000);

    const startTimeout = () => {
      if (toastTimeout) window.clearTimeout(toastTimeout);
      toastTimeout = window.setTimeout(() => {
        if (!isPaused) hide();
      }, duration);
    };

    toast.onmouseenter = () => {
      isPaused = true;
      if (toastTimeout) {
        window.clearTimeout(toastTimeout);
        toastTimeout = null;
      }
    };

    toast.onmouseleave = () => {
      isPaused = false;
      startTimeout();
    };

    startTimeout();
  },
};
