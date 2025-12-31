/**
 * Garden Engine - Central coordinator for all garden systems
 * Manages time, weather, seasons, and garden state
 */

import {
  getCurrentTimeState,
  getCurrentSeasonState,
  getLightingForTimeOfDay,
  getShadowAngle,
  type TimeState,
  type SeasonState,
  type LightingValues
} from './timeSystem';

import {
  getWeatherForTime,
  getWeatherEffects,
  type WeatherState
} from './weatherSystem';

import { CelestialBodies } from './celestialBodies';
import { TimeVisualizations } from './timeVisualizations';
import { ParticleSystem, FallingPetal } from './particleSystem';
import { BloomInteractions, addBloomAnimationsToCSS } from './butterflies';
import { BackgroundRenderer } from './backgroundRenderer';
import { SoundManager } from './soundManager';
import { PerformanceMonitor, DeviceCapabilities } from './performanceMonitor';

export interface GardenState {
  time: TimeState;
  season: SeasonState;
  weather: WeatherState;
  lighting: LightingValues;
  shadowAngle: number;
  effects: {
    animationsEnabled: boolean;
    soundEnabled: boolean;
    particlesEnabled: boolean;
    qualityLevel: 'low' | 'medium' | 'high';
  };
}

export interface GardenPreferences {
  soundEnabled?: boolean;
  soundVolume?: number;
  particleCount?: number;
  reduceMotion?: boolean;
  qualityLevel?: 'low' | 'medium' | 'high';
}

type GardenEventType = 'timeChanged' | 'seasonChanged' | 'weatherChanged' | 'lightingChanged';
type GardenEventListener = (state: GardenState) => void;

export class GardenEngine {
  private state: GardenState;
  private listeners: Map<GardenEventType, Set<GardenEventListener>>;
  private updateInterval?: number;
  private preferences: GardenPreferences;
  private lastWeatherChange: number;
  private celestialBodies: CelestialBodies;
  private lastTimeOfDay?: string;
  private particleSystem?: ParticleSystem;
  private butterflies?: ButterfliesManager;
  private backgroundRenderer?: BackgroundRenderer;
  private soundManager: SoundManager;
  private performanceMonitor?: PerformanceMonitor;

  constructor(preferences: GardenPreferences = {}) {
    this.preferences = {
      soundEnabled: false, // Default off, user must enable
      soundVolume: 0.5,
      particleCount: 5,
      reduceMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      qualityLevel: 'high',
      ...preferences
    };

    this.listeners = new Map();
    this.lastWeatherChange = Date.now();
    this.celestialBodies = new CelestialBodies();

    // Initialize sound manager
    const soundPrefs = SoundManager.loadPreferences();
    this.soundManager = new SoundManager({
      ...soundPrefs,
      enabled: soundPrefs.enabled ?? false
    });

    // Initialize state
    const time = getCurrentTimeState();
    const season = getCurrentSeasonState();
    const weather = getWeatherForTime(time.timeOfDay, season.season);
    const lighting = getLightingForTimeOfDay(time.timeOfDay, time.sunPosition);
    const shadowAngle = getShadowAngle(time.hour, time.sunPosition);

    this.state = {
      time,
      season,
      weather,
      lighting,
      shadowAngle,
      effects: {
        animationsEnabled: !this.preferences.reduceMotion,
        soundEnabled: this.preferences.soundEnabled ?? false,
        particlesEnabled: !this.preferences.reduceMotion,
        qualityLevel: this.preferences.qualityLevel ?? 'high'
      }
    };
  }

  /**
   * Initialize the garden engine
   */
  public initialize(): void {
    // Apply initial state to DOM
    this.applyStateToDOM();

    // Initialize celestial bodies position
    this.celestialBodies.update();

    // Initialize time visualizations
    this.initializeTimeVisualizations();

    // Initialize time range controls
    this.initializeTimeRangeControls();

    // Initialize interactive elements
    this.initializeInteractiveElements();

    // Initialize sound controls (disabled - feature removed)
    // this.initializeSoundControls();

    // Start performance monitoring
    this.initializePerformanceMonitoring();

    // Start ambient sound if enabled
    if (this.soundManager.getPreferences().enabled) {
      this.soundManager.playAmbienceForTime(this.state.time.timeOfDay, this.state.season.season);
    }

    // Start update loop (every minute)
    this.startUpdateLoop();

    // Listen for visibility changes (pause when hidden)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.stopUpdateLoop();
      } else {
        this.update(); // Update immediately when visible again
        this.startUpdateLoop();
      }
    });

    // Listen for reduced motion preference changes
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    motionQuery.addEventListener('change', (e) => {
      this.preferences.reduceMotion = e.matches;
      this.state.effects.animationsEnabled = !e.matches;
      this.state.effects.particlesEnabled = !e.matches;
      this.emit('lightingChanged');
    });

    console.log('🌱 Garden Engine initialized', this.state);
  }

  /**
   * Initialize time visualizations
   */
  private initializeTimeVisualizations(): void {
    // Create hour blocks
    const hourBlocksContainer = document.getElementById('hourBlocks');
    if (hourBlocksContainer) {
      const hourBlocks = TimeVisualizations.createHourBlocks();
      hourBlocksContainer.appendChild(hourBlocks);
    }

    // Initialize now beam
    TimeVisualizations.updateNowBeam();
  }

  /**
   * Initialize interactive garden elements
   */
  private initializeInteractiveElements(): void {
    // Only initialize if animations are enabled
    if (!this.state.effects.animationsEnabled || !this.state.effects.particlesEnabled) {
      return;
    }

    // Initialize particle system
    const maxParticles = this.preferences.qualityLevel === 'high' ? 50 :
      this.preferences.qualityLevel === 'medium' ? 30 : 10;
    this.particleSystem = new ParticleSystem('gardenEffects', maxParticles);
    this.particleSystem.start();

    // Butterflies disabled - removed per user request
    // Initialize butterflies
    // const maxButterflies = this.preferences.qualityLevel === 'high' ? 5 :
    //   this.preferences.qualityLevel === 'medium' ? 3 : 2;
    // this.butterflies = new ButterfliesManager(this.particleSystem, maxButterflies);
    // this.butterflies.start();

    // Initialize bloom interactions
    addBloomAnimationsToCSS();
    BloomInteractions.initialize();

    // Initialize background renderer
    this.backgroundRenderer = new BackgroundRenderer();

    // Listen for task drag events to spawn petals
    this.initializePetalSpawning();
  }

  /**
   * Initialize petal spawning on task drag
   */
  private initializePetalSpawning(): void {
    // Listen for dragstart events on goal cards
    document.addEventListener('dragstart', (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('goal-card') || target.classList.contains('day-planter')) {
        this.spawnPetals(e.clientX, e.clientY);
      }
    });

    // Long-press detection for touch to prevent accidental spawns during scrolling
    let touchStartTime = 0;
    let touchStartX = 0;
    let touchStartY = 0;
    const LONG_PRESS_DURATION = 500; // ms
    const MOVE_THRESHOLD = 10; // px

    document.addEventListener('touchstart', (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('goal-card') || target.classList.contains('day-planter')) {
        const touch = e.touches[0];
        touchStartTime = Date.now();
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
      }
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('goal-card') || target.classList.contains('day-planter')) {
        const touchDuration = Date.now() - touchStartTime;
        const touch = e.changedTouches[0];
        const moveDistance = Math.hypot(
          touch.clientX - touchStartX,
          touch.clientY - touchStartY
        );

        // Only spawn if long-press and minimal movement (not scrolling)
        if (touchDuration >= LONG_PRESS_DURATION && moveDistance < MOVE_THRESHOLD) {
          this.spawnPetals(touch.clientX, touch.clientY);
        }
      }
    }, { passive: true });
  }

  /**
   * Spawn falling petals at position
   */
  private spawnPetals(x: number, y: number): void {
    if (!this.particleSystem || !this.state.effects.particlesEnabled) return;

    const petalCount = this.preferences.qualityLevel === 'high' ? 5 :
      this.preferences.qualityLevel === 'medium' ? 3 : 2;

    for (let i = 0; i < petalCount; i++) {
      const petal = new FallingPetal(x + (Math.random() - 0.5) * 20, y);
      this.particleSystem.add(petal);
    }
  }

  /**
   * Update garden state
   */
  public update(): void {
    // const previousState = { ...this.state };

    // Update time
    const newTime = getCurrentTimeState();
    const timeChanged = newTime.timeOfDay !== this.state.time.timeOfDay;

    this.state.time = newTime;

    // Update season
    const newSeason = getCurrentSeasonState();
    const seasonChanged = newSeason.season !== this.state.season.season;

    this.state.season = newSeason;

    // Update weather (occasionally)
    const now = Date.now();
    if (now - this.lastWeatherChange > 2 * 60 * 60 * 1000) { // 2 hours
      if (Math.random() > 0.7) { // 30% chance to change
        this.state.weather = getWeatherForTime(newTime.timeOfDay, newSeason.season);
        this.lastWeatherChange = now;
        this.emit('weatherChanged');
      }
    }

    // Update lighting
    const newLighting = getLightingForTimeOfDay(newTime.timeOfDay, newTime.sunPosition);
    this.state.lighting = newLighting;

    // Update shadow angle
    this.state.shadowAngle = getShadowAngle(newTime.hour, newTime.sunPosition);

    // Apply changes to DOM
    this.applyStateToDOM();

    // Update celestial bodies position
    this.celestialBodies.update();

    // Update time visualizations
    const hourBlocksContainer = document.getElementById('hourBlocks');
    if (hourBlocksContainer && hourBlocksContainer.firstChild) {
      TimeVisualizations.updateHourBlocks(hourBlocksContainer.firstChild as HTMLElement);
    }
    TimeVisualizations.updateNowBeam();

    // Show time transition if time of day changed
    if (timeChanged && this.lastTimeOfDay) {
      TimeVisualizations.createTimeTransition(this.lastTimeOfDay, newTime.timeOfDay);

      // Update ambient sound
      this.soundManager.playAmbienceForTime(newTime.timeOfDay, newSeason.season);
    }
    this.lastTimeOfDay = newTime.timeOfDay;

    // Emit events
    if (timeChanged) {
      this.emit('timeChanged');
    }

    if (seasonChanged) {
      this.emit('seasonChanged');
    }

    this.emit('lightingChanged');
  }

  /**
   * Apply current state to DOM
   */
  private applyStateToDOM(): void {
    const { time, season, weather, lighting, shadowAngle } = this.state;

    // Update body classes - only change if different to prevent flash
    const root = document.documentElement;
    const currentSeasonClass = Array.from(root.classList).find(c => c.startsWith('season-'));
    const currentTimeClass = Array.from(root.classList).find(c => c.startsWith('time-'));
    const targetSeasonClass = `season-${season.season}`;
    const targetTimeClass = `time-${time.timeOfDay}`;

    if (currentSeasonClass !== targetSeasonClass) {
      root.classList.remove('season-spring', 'season-summer', 'season-fall', 'season-winter');
      root.classList.add(targetSeasonClass);
    }

    if (currentTimeClass !== targetTimeClass) {
      root.classList.remove('time-dawn', 'time-morning', 'time-afternoon', 'time-evening', 'time-night');
      root.classList.add(targetTimeClass);
    }

    // Add quality level as data attribute for CSS targeting (mobile optimization)
    root.dataset.gardenQuality = this.state.effects.qualityLevel;

    // Update CSS custom properties
    // root is already defined above from document.documentElement

    // Lighting
    root.style.setProperty('--time-brightness', lighting.brightness.toString());
    root.style.setProperty('--time-saturation', lighting.saturation.toString());
    root.style.setProperty('--time-hue-shift', `${lighting.hueShift}deg`);

    // Shadows
    root.style.setProperty('--shadow-opacity', lighting.shadowOpacity.toString());
    root.style.setProperty('--shadow-length', `${lighting.shadowLength}px`);
    root.style.setProperty('--shadow-angle', `${shadowAngle}deg`);

    // Seasonal colors
    root.style.setProperty('--seasonal-accent', season.colors.accent);
    root.style.setProperty('--seasonal-bg', season.colors.bg);
    root.style.setProperty('--seasonal-flower', season.colors.flower);
    root.style.setProperty('--seasonal-secondary', season.colors.secondary);

    // Weather effects
    const weatherClasses = getWeatherEffects(weather.current);
    document.body.classList.remove('weather-dim-light', 'weather-soft-shadows', 'weather-rain-particles', 'weather-wet-surface', 'weather-very-dim', 'weather-blur-distance', 'weather-soft-edges', 'weather-bright-light', 'weather-snow-particles', 'weather-muted-colors');

    weatherClasses.forEach(cls => {
      document.body.classList.add(`weather-${cls}`);
    });
  }

  /**
   * Start update loop (runs every minute)
   */
  private startUpdateLoop(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    // Update every minute
    this.updateInterval = window.setInterval(() => {
      this.update();
    }, 60 * 1000); // 60 seconds
  }

  /**
   * Stop update loop
   */
  private stopUpdateLoop(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = undefined;
    }
  }

  /**
   * Event listener management
   */
  public on(event: GardenEventType, listener: GardenEventListener): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
  }

  public off(event: GardenEventType, listener: GardenEventListener): void {
    if (this.listeners.has(event)) {
      this.listeners.get(event)!.delete(listener);
    }
  }

  private emit(event: GardenEventType): void {
    if (this.listeners.has(event)) {
      this.listeners.get(event)!.forEach(listener => {
        listener(this.state);
      });
    }
  }

  /**
   * Get current state
   */
  public getState(): GardenState {
    return { ...this.state };
  }

  /**
   * Update preferences
   */
  public updatePreferences(preferences: Partial<GardenPreferences>): void {
    this.preferences = { ...this.preferences, ...preferences };

    if (preferences.reduceMotion !== undefined) {
      this.state.effects.animationsEnabled = !preferences.reduceMotion;
      this.state.effects.particlesEnabled = !preferences.reduceMotion;
    }

    if (preferences.soundEnabled !== undefined) {
      this.state.effects.soundEnabled = preferences.soundEnabled;
    }

    if (preferences.qualityLevel !== undefined) {
      this.state.effects.qualityLevel = preferences.qualityLevel;
    }

    // Save to localStorage
    this.savePreferences();
  }

  /**
   * Disable animations (performance optimization)
   */
  public disableAnimations(): void {
    this.state.effects.animationsEnabled = false;
    this.state.effects.particlesEnabled = false;
    document.body.classList.add('reduce-motion');
  }

  /**
   * Enable animations
   */
  public enableAnimations(): void {
    if (!this.preferences.reduceMotion) {
      this.state.effects.animationsEnabled = true;
      this.state.effects.particlesEnabled = true;
      document.body.classList.remove('reduce-motion');
    }
  }

  /**
   * Save preferences to localStorage
   */
  private savePreferences(): void {
    try {
      localStorage.setItem('garden-preferences', JSON.stringify(this.preferences));
    } catch (e) {
      console.warn('Failed to save garden preferences', e);
    }
  }

  /**
   * Load preferences from localStorage
   */
  public static loadPreferences(): GardenPreferences {
    try {
      const saved = localStorage.getItem('garden-preferences');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Failed to load garden preferences', e);
    }
    return {};
  }

  /**
   * Initialize performance monitoring
   */
  private initializePerformanceMonitoring(): void {
    // Only monitor if animations are enabled
    if (!this.state.effects.animationsEnabled) return;

    this.performanceMonitor = new PerformanceMonitor();
    this.performanceMonitor.start((quality) => {
      // Auto-adjust quality if performance drops
      if (quality !== this.preferences.qualityLevel) {
        console.log(`🌱 Auto-adjusting quality to ${quality}`);
        this.updatePreferences({ qualityLevel: quality });

        // Adjust particle system
        if (this.particleSystem) {
          const limits = DeviceCapabilities.getRecommendedQuality();
          this.particleSystem.setMaxParticles(limits.maxParticles);
        }

        // Butterflies disabled - removed per user request
        // Adjust butterflies
        // if (this.butterflies) {
        //   const limits = DeviceCapabilities.getRecommendedQuality();
        //   this.butterflies.setMaxButterflies(limits.maxButterflies);
        // }

        // Disable parallax if needed
        if (this.backgroundRenderer && quality === 'low') {
          this.backgroundRenderer.disableParallax();
        }
      }
    });
  }

  /**
   * Initialize time range controls UI
   */
  private initializeTimeRangeControls(): void {
    const startSelect = document.getElementById('timeRangeStart') as HTMLSelectElement;
    const endSelect = document.getElementById('timeRangeEnd') as HTMLSelectElement;

    if (!startSelect || !endSelect) return;

    // Load saved preferences
    const prefs = TimeVisualizations['getTimeRangePreferences']();
    startSelect.value = prefs.startHour.toString();
    endSelect.value = prefs.endHour.toString();

    // Handle changes
    const handleChange = () => {
      const startHour = parseInt(startSelect.value);
      const endHour = parseInt(endSelect.value);

      // Validate that end is after start
      if (endHour <= startHour) {
        alert('End time must be after start time');
        startSelect.value = prefs.startHour.toString();
        endSelect.value = prefs.endHour.toString();
        return;
      }

      // Save preferences
      TimeVisualizations.saveTimeRangePreferences(startHour, endHour);

      // Re-render hour blocks
      const hourBlocksContainer = document.getElementById('hourBlocks');
      if (hourBlocksContainer) {
        hourBlocksContainer.innerHTML = '';
        const hourBlocks = TimeVisualizations.createHourBlocks();
        hourBlocksContainer.appendChild(hourBlocks);
      }
    };

    startSelect.addEventListener('change', handleChange);
    endSelect.addEventListener('change', handleChange);
  }

  /**
   * Get sound manager (for external use)
   */
  public getSoundManager(): SoundManager {
    return this.soundManager;
  }

  /**
   * Get performance info (for debugging)
   */
  public getPerformanceInfo(): {
    fps: number;
    averageFPS: number;
    particleCount: number;
    qualityLevel: string;
  } {
    return {
      fps: this.performanceMonitor?.getFPS() ?? 60,
      averageFPS: this.performanceMonitor?.getAverageFPS() ?? 60,
      particleCount: this.particleSystem?.getParticleCount() ?? 0,
      qualityLevel: this.preferences.qualityLevel ?? 'high'
    };
  }

  /**
   * Cleanup
   */
  public destroy(): void {
    this.stopUpdateLoop();
    this.listeners.clear();
    this.soundManager.stopAllSounds();

    if (this.particleSystem) {
      this.particleSystem.stop();
    }

    if (this.butterflies) {
      this.butterflies.stop();
    }

    if (this.performanceMonitor) {
      this.performanceMonitor.stop();
    }
  }
}
