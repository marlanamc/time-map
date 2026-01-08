// ===================================
// Toast Notification Module
// ===================================
import type { UIElements } from '../../types';

export const Toast = {
  show(elements: UIElements, iconOrMessage: string, messageOrType: string = "") {
    const toast = elements.toast;
    const toastIcon = elements.toastIcon;
    const toastMessage = elements.toastMessage;
    if (!toast || !toastMessage || !toastIcon) return;

    const body = document.body;
    const isReduced = body.classList.contains("feedback-minimal") || body.classList.contains("reduced-motion");

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
    };

    toast.onclick = hide;

    const timeout = isReduced ? 1600 : 2800;
    window.setTimeout(hide, timeout);
  },
};
