/**
 * Weather System - Simple weather variations based on time
 * No external API calls - deterministic based on time and random events
 */

import type { TimeOfDay, Season } from './timeSystem';

export type Weather = 'clear' | 'cloudy' | 'rain' | 'fog' | 'snow';

export interface WeatherState {
  current: Weather;
  intensity: number; // 0-1
  description: string;
}

/**
 * Get weather based on time of day and season
 * Adds subtle variation without requiring API calls
 */
export function getWeatherForTime(timeOfDay: TimeOfDay, season: Season, randomSeed?: number): WeatherState {
  // Use random seed or generate one (deterministic for testing)
  const seed = randomSeed ?? Math.random();

  // Base weather on time of day
  let weather: Weather = 'clear';
  let intensity = 0.5;
  let description = 'Clear sky';

  // Morning tends to have mist/fog
  if (timeOfDay === 'dawn') {
    if (seed > 0.6) {
      weather = 'fog';
      intensity = 0.3;
      description = 'Morning mist';
    }
  }

  // Afternoon in summer might have chance of rain
  if (timeOfDay === 'afternoon' && season === 'summer') {
    if (seed > 0.95) {
      weather = 'rain';
      intensity = 0.4;
      description = 'Afternoon shower';
    } else if (seed > 0.85) {
      weather = 'cloudy';
      intensity = 0.3;
      description = 'Partly cloudy';
    }
  }

  // Winter weather
  if (season === 'winter') {
    if (seed > 0.92) {
      weather = 'snow';
      intensity = 0.5;
      description = 'Light snow';
    } else if (seed > 0.7) {
      weather = 'cloudy';
      intensity = 0.4;
      description = 'Overcast';
    }
  }

  // Spring rain
  if (season === 'spring' && seed > 0.88) {
    weather = 'rain';
    intensity = 0.6;
    description = 'Spring rain';
  }

  // Fall tends to be cloudy
  if (season === 'fall' && seed > 0.75) {
    weather = 'cloudy';
    intensity = 0.5;
    description = 'Autumn clouds';
  }

  return {
    current: weather,
    intensity,
    description
  };
}

/**
 * Get weather effects (CSS class modifiers)
 */
export function getWeatherEffects(weather: Weather): string[] {
  const effects: Record<Weather, string[]> = {
    clear: [],
    cloudy: ['dim-light', 'soft-shadows'],
    rain: ['dim-light', 'rain-particles', 'wet-surface'],
    fog: ['very-dim', 'blur-distance', 'soft-edges'],
    snow: ['bright-light', 'snow-particles', 'muted-colors']
  };

  return effects[weather];
}

/**
 * Determine if weather should change
 * Call this periodically (e.g., every hour) to introduce variety
 */
export function shouldWeatherChange(lastChangeTime: number, currentTime: number): boolean {
  const hoursSinceChange = (currentTime - lastChangeTime) / (1000 * 60 * 60);

  // Change weather every 2-4 hours randomly
  if (hoursSinceChange > 2) {
    return Math.random() > 0.5;
  }

  return false;
}

/**
 * Get seasonal weather tendencies (for generating realistic weather)
 */
export function getSeasonalWeatherTendencies(season: Season): {
  clear: number;
  cloudy: number;
  rain: number;
  fog: number;
  snow: number;
} {
  const tendencies = {
    spring: { clear: 0.4, cloudy: 0.3, rain: 0.2, fog: 0.1, snow: 0 },
    summer: { clear: 0.6, cloudy: 0.2, rain: 0.15, fog: 0.05, snow: 0 },
    fall: { clear: 0.3, cloudy: 0.4, rain: 0.2, fog: 0.1, snow: 0 },
    winter: { clear: 0.3, cloudy: 0.4, rain: 0.05, fog: 0.1, snow: 0.15 }
  };

  return tendencies[season];
}
