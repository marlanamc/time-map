/**
 * Particle System - Manages animated garden particles (butterflies, petals, leaves)
 * Uses Canvas API for smooth animations
 */

/**
 * Get viewport width (mobile-aware)
 */
function getViewportWidth(): number {
  if (window.visualViewport) {
    return window.visualViewport.width;
  }
  return document.documentElement.clientWidth || window.innerWidth;
}

/**
 * Get viewport height (mobile-aware)
 */
function getViewportHeight(): number {
  if (window.visualViewport) {
    return window.visualViewport.height;
  }
  return document.documentElement.clientHeight || window.innerHeight;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  update(): void;
  draw(ctx: CanvasRenderingContext2D): void;
  isDead(): boolean;
}

export class ParticleSystem {
  private canvas: HTMLCanvasElement | null;
  private ctx: CanvasRenderingContext2D | null;
  private particles: Particle[] = [];
  private animationFrame?: number;
  private isRunning: boolean = false;
  private maxParticles: number;

  constructor(canvasId: string = 'gardenEffects', maxParticles: number = 50) {
    this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    this.ctx = this.canvas?.getContext('2d') ?? null;
    this.maxParticles = maxParticles;

    if (this.canvas) {
      this.resizeCanvas();
      window.addEventListener('resize', () => this.resizeCanvas());

      // Listen to visual viewport changes (mobile URL bar show/hide)
      if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', () => this.resizeCanvas());
      }
    }
  }

  private resizeCanvas(): void {
    if (!this.canvas) return;

    // Use visualViewport if available (better mobile support)
    if (window.visualViewport) {
      this.canvas.width = window.visualViewport.width;
      this.canvas.height = window.visualViewport.height;
    } else {
      // Fallback for older browsers
      this.canvas.width = document.documentElement.clientWidth;
      this.canvas.height = document.documentElement.clientHeight;
    }
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.animate();
  }

  public stop(): void {
    this.isRunning = false;
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
  }

  public add(particle: Particle): void {
    if (this.particles.length < this.maxParticles) {
      this.particles.push(particle);
    }
  }

  public clear(): void {
    this.particles = [];
  }

  private animate = (): void => {
    if (!this.isRunning || !this.ctx || !this.canvas) return;

    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Update and draw particles - in-place filtering to reduce GC pressure
    let writeIndex = 0;
    for (let i = 0; i < this.particles.length; i++) {
      const particle = this.particles[i];
      particle.update();

      if (!particle.isDead()) {
        particle.draw(this.ctx!);
        this.particles[writeIndex++] = particle; // Keep alive particles
      }
    }

    // Truncate dead particles
    this.particles.length = writeIndex;

    this.animationFrame = requestAnimationFrame(this.animate);
  };

  public getParticleCount(): number {
    return this.particles.length;
  }

  public setMaxParticles(max: number): void {
    this.maxParticles = max;

    // Remove excess particles if needed
    if (this.particles.length > max) {
      this.particles = this.particles.slice(0, max);
    }
  }
}

/**
 * Butterfly Particle
 */
export class Butterfly implements Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  wingPhase: number = 0;
  size: number;
  color: string;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * 0.5;
    this.vy = (Math.random() - 0.5) * 0.5;
    this.life = 0;
    this.maxLife = Infinity; // Butterflies live forever until manually removed
    this.size = 8 + Math.random() * 4;

    // Random butterfly colors
    const colors = ['#FFB7D5', '#FFC940', '#87CEEB', '#E87461', '#C9E4EC'];
    this.color = colors[Math.floor(Math.random() * colors.length)];
  }

  update(): void {
    this.life++;

    // Gentle floating movement with sine wave
    this.wingPhase = (this.wingPhase + 0.1) % (Math.PI * 2);

    // Add some drift
    this.vx += (Math.random() - 0.5) * 0.1;
    this.vy += (Math.random() - 0.5) * 0.1 - 0.02; // Slight upward bias

    // Clamp velocity
    this.vx = Math.max(-2, Math.min(2, this.vx));
    this.vy = Math.max(-2, Math.min(2, this.vy));

    // Apply velocity
    this.x += this.vx + Math.sin(this.wingPhase) * 0.3;
    this.y += this.vy + Math.cos(this.wingPhase) * 0.2;

    // Wrap around edges (use mobile-aware viewport)
    const viewportWidth = getViewportWidth();
    const viewportHeight = getViewportHeight();
    if (this.x < -20) this.x = viewportWidth + 20;
    if (this.x > viewportWidth + 20) this.x = -20;
    if (this.y < -20) this.y = viewportHeight + 20;
    if (this.y > viewportHeight + 20) this.y = -20;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const wingAngle = Math.sin(this.wingPhase) * 0.3;

    ctx.save();
    ctx.translate(this.x, this.y);

    // Body
    ctx.fillStyle = '#2C1810';
    ctx.beginPath();
    ctx.ellipse(0, 0, this.size * 0.2, this.size * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Left wing
    ctx.fillStyle = this.color;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.ellipse(
      -this.size * 0.3,
      0,
      this.size * 0.8,
      this.size * 0.5,
      -wingAngle,
      0,
      Math.PI * 2
    );
    ctx.fill();

    // Right wing
    ctx.beginPath();
    ctx.ellipse(
      this.size * 0.3,
      0,
      this.size * 0.8,
      this.size * 0.5,
      wingAngle,
      0,
      Math.PI * 2
    );
    ctx.fill();

    ctx.restore();
  }

  isDead(): boolean {
    return false; // Butterflies don't die
  }
}

/**
 * Falling Petal Particle
 */
export class FallingPetal implements Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  rotation: number;
  rotationSpeed: number;
  size: number;
  color: string;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * 2;
    this.vy = -3 - Math.random() * 2; // Initial upward velocity
    this.life = 0;
    this.maxLife = 120; // 2 seconds at 60fps
    this.rotation = Math.random() * Math.PI * 2;
    this.rotationSpeed = (Math.random() - 0.5) * 0.1;
    this.size = 8 + Math.random() * 4;

    // Petal colors
    const colors = ['#FFB7D5', '#FFC940', '#E87461'];
    this.color = colors[Math.floor(Math.random() * colors.length)];
  }

  update(): void {
    this.life++;

    // Gravity
    this.vy += 0.15;

    // Air resistance
    this.vx *= 0.98;
    this.vy *= 0.98;

    // Gentle swaying
    this.vx += Math.sin(this.life * 0.1) * 0.05;

    // Apply velocity
    this.x += this.vx;
    this.y += this.vy;

    // Rotation
    this.rotation += this.rotationSpeed;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const opacity = 1 - this.life / this.maxLife;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    ctx.globalAlpha = opacity;

    // Draw petal shape
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, this.size, this.size * 1.5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  isDead(): boolean {
    return this.life >= this.maxLife || this.y > getViewportHeight() + 50;
  }
}
