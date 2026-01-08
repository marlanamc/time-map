// ===================================
// Celebration Modal Module
// ===================================
import type { UIElements } from '../../types';

export const Celebration = {
  show(elements: UIElements, emoji: string, title: string, text: string) {
    const { celebrationModal, celebrationEmoji, celebrationTitle, celebrationText } = elements;

    if (!celebrationModal || !celebrationEmoji || !celebrationTitle || !celebrationText) return;

    // Set content
    celebrationEmoji.textContent = emoji;
    celebrationTitle.textContent = title;
    celebrationText.textContent = text;

    // Show modal
    celebrationModal.classList.add("active");

    // Spawn confetti
    this.spawnConfetti(elements);

    // Auto-dismiss after 2.5 seconds
    setTimeout(() => {
      this.close(elements);
    }, 2500);
  },

  close(elements: UIElements) {
    elements.celebrationModal?.classList.remove("active");

    // Clear confetti after fade-out animation
    setTimeout(() => {
      elements.confettiContainer?.replaceChildren();
    }, 300);
  },

  spawnConfetti(elements: UIElements) {
    try {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    } catch {
      // ignore
    }

    const { confettiContainer } = elements;
    if (!confettiContainer) return;

    // Clear existing confetti
    confettiContainer.replaceChildren();

    // Create 30 confetti pieces
    const colors = ['#4A90E2', '#5A9B8D', '#F0B429', '#E59AA0', '#9F7AEA', '#C06C52'];
    const shapes = ['circle', 'square'];

    for (let i = 0; i < 30; i++) {
      const confetti = document.createElement('div');
      confetti.className = 'confetti';

      // Random properties
      const color = colors[Math.floor(Math.random() * colors.length)];
      const shape = shapes[Math.floor(Math.random() * shapes.length)];
      const left = Math.random() * 100;
      const animationDelay = Math.random() * 0.5;
      const animationDuration = 2 + Math.random() * 1;

      confetti.style.cssText = `
        left: ${left}%;
        background-color: ${color};
        animation-delay: ${animationDelay}s;
        animation-duration: ${animationDuration}s;
        ${shape === 'circle' ? 'border-radius: 50%;' : ''}
      `;

      confettiContainer.appendChild(confetti);
    }
  },
};
