// ===================================
// Toast Notification Module
// ===================================
import type { UIElements } from '../../types';

export const Toast = {
  show(elements: UIElements, iconOrMessage: string, messageOrType: string = "") {
    // Pop-up messages are disabled.
    void iconOrMessage;
    void messageOrType;
    elements.toast?.classList.remove("active");
  },
};
