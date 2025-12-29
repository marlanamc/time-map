/**
 * Sound Manager - Manages ambient garden sounds and interactive audio
 * Respects user preferences and accessibility
 */

import type { TimeOfDay, Season } from './timeSystem';

export interface SoundPreferences {
  enabled: boolean;
  volume: number; // 0-1
  ambientEnabled: boolean;
  interactiveEnabled: boolean;
}

export class SoundManager {
  private sounds: Map<string, HTMLAudioElement> = new Map();
  private currentAmbience?: HTMLAudioElement;
  private preferences: SoundPreferences;
  private loadedSounds: Set<string> = new Set();
  private crossfading: boolean = false;

  constructor(preferences: Partial<SoundPreferences> = {}) {
    this.preferences = {
      enabled: false, // User must explicitly enable
      volume: 0.5,
      ambientEnabled: true,
      interactiveEnabled: true,
      ...preferences
    };

    // Respect prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      this.preferences.enabled = false;
    }
  }

  /**
   * Load a sound file (lazy loading)
   */
  public async loadSound(name: string, url: string): Promise<void> {
    if (this.loadedSounds.has(name)) return;

    try {
      const audio = new Audio(url);
      audio.volume = this.preferences.volume;
      await audio.load();

      this.sounds.set(name, audio);
      this.loadedSounds.add(name);
    } catch (error) {
      console.warn(`Failed to load sound: ${name}`, error);
    }
  }

  /**
   * Play a sound
   */
  public play(name: string, loop: boolean = false): void {
    if (!this.preferences.enabled) return;
    if (!this.preferences.interactiveEnabled && !loop) return;

    const sound = this.sounds.get(name);
    if (!sound) {
      console.warn(`Sound not loaded: ${name}`);
      return;
    }

    sound.loop = loop;
    sound.volume = this.preferences.volume;
    sound.currentTime = 0;

    const playPromise = sound.play();
    if (playPromise) {
      playPromise.catch(error => {
        console.warn(`Failed to play sound: ${name}`, error);
      });
    }
  }

  /**
   * Stop a sound
   */
  public stop(name: string): void {
    const sound = this.sounds.get(name);
    if (sound) {
      sound.pause();
      sound.currentTime = 0;
    }
  }

  /**
   * Set volume (0-1)
   */
  public setVolume(level: number): void {
    this.preferences.volume = Math.max(0, Math.min(1, level));

    // Update all sounds
    this.sounds.forEach(sound => {
      sound.volume = this.preferences.volume;
    });

    // Save to localStorage
    this.savePreferences();
  }

  /**
   * Enable or disable sound
   */
  public setEnabled(enabled: boolean): void {
    this.preferences.enabled = enabled;

    if (!enabled) {
      this.stopAllSounds();
    }

    this.savePreferences();
  }

  /**
   * Crossfade between ambiences
   */
  public async crossfade(fromName: string | undefined, toName: string, duration: number = 5000): Promise<void> {
    if (this.crossfading) return;
    if (!this.preferences.enabled || !this.preferences.ambientEnabled) return;

    this.crossfading = true;

    const fromSound = fromName ? this.sounds.get(fromName) : undefined;
    const toSound = this.sounds.get(toName);

    if (!toSound) {
      console.warn(`Target sound not loaded: ${toName}`);
      this.crossfading = false;
      return;
    }

    // Start new sound at 0 volume
    toSound.volume = 0;
    toSound.loop = true;
    await toSound.play().catch(() => { });

    // Crossfade
    const steps = 50;
    const stepDuration = duration / steps;
    const fromVolume = fromSound ? fromSound.volume : 0;
    const toVolume = this.preferences.volume;

    for (let i = 0; i <= steps; i++) {
      const progress = i / steps;

      // Fade out old sound
      if (fromSound) {
        fromSound.volume = fromVolume * (1 - progress);
      }

      // Fade in new sound
      toSound.volume = toVolume * progress;

      await new Promise(resolve => setTimeout(resolve, stepDuration));
    }

    // Stop old sound
    if (fromSound) {
      fromSound.pause();
      fromSound.currentTime = 0;
    }

    this.currentAmbience = toSound;
    this.crossfading = false;
  }

  /**
   * Play ambience for time of day and season
   */
  public async playAmbienceForTime(timeOfDay: TimeOfDay, season: Season): Promise<void> {
    if (!this.preferences.enabled || !this.preferences.ambientEnabled) return;

    const ambienceName = this.getAmbienceName(timeOfDay, season);
    const currentName = this.getCurrentAmbienceName();

    // Don't restart same ambience
    if (ambienceName === currentName) return;

    // Ensure sound is loaded
    await this.ensureAmbienceLoaded(ambienceName, timeOfDay, season);

    // Crossfade
    await this.crossfade(currentName, ambienceName);
  }

  /**
   * Get ambience name for time and season
   */
  private getAmbienceName(timeOfDay: TimeOfDay, season: Season): string {
    // Simplified mapping - in production you'd have actual sound files
    const timeMap: Record<TimeOfDay, string> = {
      'dawn': 'morning-birds',
      'morning': 'morning-birds',
      'afternoon': 'afternoon-breeze',
      'evening': 'evening-crickets',
      'night': 'night-wind'
    };

    return `${timeMap[timeOfDay]}-${season}`;
  }

  /**
   * Ensure ambience is loaded
   */
  private async ensureAmbienceLoaded(name: string, _timeOfDay: TimeOfDay, _season: Season): Promise<void> {
    if (this.loadedSounds.has(name)) return;

    // In production, load actual files from /public/assets/garden/sounds/
    // For now, we'll create placeholder audio
    const url = `/assets/garden/sounds/ambient/${name}.mp3`;

    // Try to load, but don't fail if file doesn't exist yet
    try {
      await this.loadSound(name, url);
    } catch (error) {
      console.warn(`Ambience not available: ${name} (placeholder mode)`);

      // Create a silent audio element as fallback
      const silentAudio = new Audio();
      silentAudio.volume = 0;
      this.sounds.set(name, silentAudio);
      this.loadedSounds.add(name);
    }
  }

  /**
   * Get current ambience name
   */
  private getCurrentAmbienceName(): string | undefined {
    if (!this.currentAmbience) return undefined;

    for (const [name, audio] of this.sounds.entries()) {
      if (audio === this.currentAmbience) {
        return name;
      }
    }

    return undefined;
  }

  /**
   * Stop all sounds
   */
  public stopAllSounds(): void {
    this.sounds.forEach((_, name) => {
      this.stop(name);
    });
    this.currentAmbience = undefined;
  }

  /**
   * Play interactive sound (bloom, petal fall, etc.)
   */
  public playInteractive(type: 'bloom' | 'petal' | 'complete' | 'create'): void {
    if (!this.preferences.enabled || !this.preferences.interactiveEnabled) return;

    const soundMap = {
      'bloom': 'bloom',
      'petal': 'petal-fall',
      'complete': 'wind-chime',
      'create': 'seed-plant'
    };

    const soundName = soundMap[type];
    this.play(soundName, false);
  }

  /**
   * Save preferences to localStorage
   */
  private savePreferences(): void {
    try {
      localStorage.setItem('garden-sound-preferences', JSON.stringify(this.preferences));
    } catch (error) {
      console.warn('Failed to save sound preferences', error);
    }
  }

  /**
   * Load preferences from localStorage
   */
  public static loadPreferences(): Partial<SoundPreferences> {
    try {
      const saved = localStorage.getItem('garden-sound-preferences');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.warn('Failed to load sound preferences', error);
    }
    return {};
  }

  /**
   * Get current preferences
   */
  public getPreferences(): SoundPreferences {
    return { ...this.preferences };
  }
}
