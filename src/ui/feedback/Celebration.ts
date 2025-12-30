// ===================================
// Celebration Modal Module
// ===================================
import type { UIElements } from '../../types';

export const Celebration = {
  show(elements: UIElements, emoji: string, title: string, text: string) {
    // Pop-up messages are disabled.
    void emoji;
    void title;
    void text;
    elements.celebrationModal?.classList.remove("active");
    elements.confettiContainer?.replaceChildren();
  },

  close(elements: UIElements) {
    elements.celebrationModal?.classList.remove("active");
  },

  spawnConfetti(elements: UIElements) {
    // Pop-up messages are disabled.
    void elements;
  },
};
