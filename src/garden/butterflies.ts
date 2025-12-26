/**
 * Butterflies - Manages butterfly spawning and behavior
 * Butterflies gently float around and can land on cards
 */

import { ParticleSystem, Butterfly } from './particleSystem';

export class ButterfliesManager {
  private particleSystem: ParticleSystem;
  private butterflyCount: number;
  private spawnInterval?: number;
  private maxButterflies: number;

  constructor(particleSystem: ParticleSystem, maxButterflies: number = 5) {
    this.particleSystem = particleSystem;
    this.butterflyCount = 0;
    this.maxButterflies = maxButterflies;
  }

  /**
   * Start spawning butterflies
   */
  public start(): void {
    // Spawn initial butterflies
    this.spawnButterflies(Math.min(3, this.maxButterflies));

    // Periodically check and respawn if needed
    this.spawnInterval = window.setInterval(() => {
      this.maintainButterflyPopulation();
    }, 10000); // Check every 10 seconds
  }

  /**
   * Stop spawning butterflies
   */
  public stop(): void {
    if (this.spawnInterval) {
      clearInterval(this.spawnInterval);
      this.spawnInterval = undefined;
    }
  }

  /**
   * Spawn butterflies at random positions
   */
  private spawnButterflies(count: number): void {
    for (let i = 0; i < count; i++) {
      if (this.butterflyCount >= this.maxButterflies) break;

      const x = Math.random() * window.innerWidth;
      const y = Math.random() * window.innerHeight;

      const butterfly = new Butterfly(x, y);
      this.particleSystem.add(butterfly);
      this.butterflyCount++;
    }
  }

  /**
   * Maintain butterfly population
   */
  private maintainButterflyPopulation(): void {
    const currentCount = this.particleSystem.getParticleCount();

    if (currentCount < this.maxButterflies) {
      const toSpawn = Math.min(1, this.maxButterflies - currentCount);
      this.spawnButterflies(toSpawn);
    }
  }

  /**
   * Set max butterflies (for performance adjustment)
   */
  public setMaxButterflies(max: number): void {
    this.maxButterflies = max;
  }
}

/**
 * Bloom Interactions - Makes flowers bloom when clicked
 */
export class BloomInteractions {
  /**
   * Initialize bloom click handlers
   */
  public static initialize(): void {
    // Garden bloom in sidebar
    const gardenBloom = document.getElementById('gardenBloom');
    if (gardenBloom) {
      gardenBloom.addEventListener('click', () => {
        this.triggerBloom(gardenBloom);
        this.showEncouragement();
      });

      // Make it keyboard accessible
      gardenBloom.setAttribute('tabindex', '0');
      gardenBloom.setAttribute('role', 'button');
      gardenBloom.setAttribute('aria-label', 'Click to bloom the flower');

      gardenBloom.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.triggerBloom(gardenBloom);
          this.showEncouragement();
        }
      });
    }

    // Add bloom effect to any element with .bloomable class
    document.querySelectorAll('.bloomable').forEach(element => {
      element.addEventListener('click', () => {
        this.triggerBloom(element as HTMLElement);
      });
    });
  }

  /**
   * Trigger bloom animation on an element
   */
  private static triggerBloom(element: HTMLElement): void {
    const petals = element.querySelectorAll('.petal');

    petals.forEach((petal, index) => {
      const htmlPetal = petal as HTMLElement;
      const delay = index * 100;

      setTimeout(() => {
        // Add bloom animation
        htmlPetal.style.animation = 'none';
        // Force reflow
        void htmlPetal.offsetWidth;
        htmlPetal.style.animation = `bloom 0.6s ease-out`;
      }, delay);
    });

    // Add a glow effect to the center
    const center = element.querySelector('.flower-center') as HTMLElement;
    if (center) {
      center.style.animation = 'none';
      void center.offsetWidth;
      center.style.animation = 'center-glow 0.6s ease-out';
    }
  }

  /**
   * Show encouragement message
   */
  private static showEncouragement(): void {
    const messages = [
      'Keep blooming! 🌸',
      'You\'re growing! 🌱',
      'Beautiful progress! 🌺',
      'Nurturing your goals! 🌻',
      'Blossoming beautifully! 🌼'
    ];

    const message = messages[Math.floor(Math.random() * messages.length)];

    // Show toast if available
    const toastEvent = new CustomEvent('showToast', {
      detail: { icon: '🌸', message }
    });
    window.dispatchEvent(toastEvent);
  }
}

/**
 * Add bloom and glow animations to CSS
 */
export function addBloomAnimationsToCSS(): void {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes bloom {
      0% { transform: scale(1); opacity: 1; }
      30% { transform: scale(1.3); opacity: 0.9; }
      60% { transform: scale(1.4); opacity: 0.8; filter: brightness(1.3); }
      100% { transform: scale(1); opacity: 1; filter: brightness(1); }
    }

    @keyframes center-glow {
      0% { filter: brightness(1); }
      50% { filter: brightness(1.8) drop-shadow(0 0 8px var(--seasonal-flower)); }
      100% { filter: brightness(1); }
    }

    .bloomable {
      cursor: pointer;
      transition: transform 0.2s ease-out;
    }

    .bloomable:hover {
      transform: scale(1.05);
    }

    .bloomable:focus {
      outline: 2px solid var(--seasonal-accent);
      outline-offset: 4px;
    }
  `;
  document.head.appendChild(style);
}
