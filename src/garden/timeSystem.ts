/**
 * Time System - Calculates time of day, sun/moon positions, and seasons
 * For ADHD time blindness support
 */

export type TimeOfDay = 'dawn' | 'morning' | 'afternoon' | 'evening' | 'night';
export type Season = 'spring' | 'summer' | 'fall' | 'winter';

export interface TimeState {
  hour: number;
  minute: number;
  timeOfDay: TimeOfDay;
  sunPosition: number; // 0-100 (horizon to zenith to horizon)
  moonPosition: number; // 0-100
  isNightTime: boolean;
}

export interface SeasonState {
  season: Season;
  month: number;
  dayOfYear: number;
  colors: SeasonalColors;
}

export interface SeasonalColors {
  accent: string;
  bg: string;
  flower: string;
  secondary: string;
}

/**
 * Get current time of day based on hour
 */
export function getCurrentTimeOfDay(hour: number): TimeOfDay {
  if (hour >= 5 && hour < 7) return 'dawn';
  if (hour >= 7 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 20) return 'evening';
  return 'night';
}

/**
 * Calculate sun position along arc based on time
 * 6 AM = 0 (eastern horizon)
 * 12 PM = 100 (zenith)
 * 6 PM = 0 (western horizon)
 * Returns 0-100
 */
export function getSunPosition(hour: number, minute: number): number {
  // Sun visible from 6 AM to 6 PM (12 hours)
  const sunriseHour = 6;
  const sunsetHour = 18;

  if (hour < sunriseHour || hour >= sunsetHour) {
    return 0; // Sun is below horizon
  }

  // Calculate total minutes since sunrise
  const totalMinutes = (hour - sunriseHour) * 60 + minute;
  const dayLengthMinutes = (sunsetHour - sunriseHour) * 60; // 720 minutes

  // Position along arc (0-1)
  const progress = totalMinutes / dayLengthMinutes;

  // Convert to arc: 0 -> 100 -> 0 (parabolic)
  // Using sine wave for smooth arc
  const position = Math.sin(progress * Math.PI) * 100;

  return Math.max(0, Math.min(100, position));
}

/**
 * Calculate moon position (opposite of sun)
 */
export function getMoonPosition(hour: number, minute: number): number {
  // Moon visible from 6 PM to 6 AM
  const moonriseHour = 18;
  const moonsetHour = 6;

  let adjustedHour = hour;

  // Handle midnight rollover
  if (hour < moonsetHour) {
    adjustedHour = hour + 24;
  }

  if (adjustedHour < moonriseHour || adjustedHour >= moonsetHour + 24) {
    return 0;
  }

  // Calculate position similar to sun
  const totalMinutes = (adjustedHour - moonriseHour) * 60 + minute;
  const nightLengthMinutes = 12 * 60; // 720 minutes

  const progress = totalMinutes / nightLengthMinutes;
  const position = Math.sin(progress * Math.PI) * 100;

  return Math.max(0, Math.min(100, position));
}

/**
 * Get season based on month (Northern hemisphere)
 */
export function getSeason(month: number): Season {
  // month is 0-indexed (0 = January)
  if (month >= 2 && month <= 4) return 'spring'; // Mar, Apr, May
  if (month >= 5 && month <= 7) return 'summer'; // Jun, Jul, Aug
  if (month >= 8 && month <= 10) return 'fall'; // Sep, Oct, Nov
  return 'winter'; // Dec, Jan, Feb
}

/**
 * Get day of year (1-365/366)
 */
export function getDayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
}

/**
 * Get seasonal color palette
 */
export function getSeasonalColors(season: Season): SeasonalColors {
  const palettes: Record<Season, SeasonalColors> = {
    spring: {
      accent: '#7EC8A3', // fresh green
      bg: '#F0F9F4', // light spring green
      flower: '#FFB7D5', // cherry blossom pink
      secondary: '#A8D5BA' // soft mint
    },
    summer: {
      accent: '#4A9B8D', // deep garden green
      bg: '#E8F8F0', // lush green tint
      flower: '#FFC940', // sunflower yellow
      secondary: '#68B5A0' // seafoam
    },
    fall: {
      accent: '#D4A574', // golden brown
      bg: '#F5EDE0', // warm cream
      flower: '#E87461', // autumn orange
      secondary: '#C4915F' // harvest gold
    },
    winter: {
      accent: '#8BA8B8', // cool blue-gray
      bg: '#EDF4F7', // frosty white
      flower: '#C9E4EC', // ice blue
      secondary: '#A1B5C1' // winter sky
    }
  };

  return palettes[season];
}

/**
 * Get current time state
 */
export function getCurrentTimeState(): TimeState {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();

  return {
    hour,
    minute,
    timeOfDay: getCurrentTimeOfDay(hour),
    sunPosition: getSunPosition(hour, minute),
    moonPosition: getMoonPosition(hour, minute),
    isNightTime: hour < 6 || hour >= 18
  };
}

/**
 * Get current season state
 */
export function getCurrentSeasonState(): SeasonState {
  const now = new Date();
  const month = now.getMonth();
  const season = getSeason(month);

  return {
    season,
    month,
    dayOfYear: getDayOfYear(now),
    colors: getSeasonalColors(season)
  };
}

/**
 * Get lighting values for time of day
 */
export interface LightingValues {
  brightness: number;
  saturation: number;
  hueShift: number;
  shadowOpacity: number;
  shadowLength: number;
}

export function getLightingForTimeOfDay(timeOfDay: TimeOfDay, _sunPosition: number): LightingValues {
  const lighting: Record<TimeOfDay, LightingValues> = {
    dawn: {
      brightness: 0.7,
      saturation: 0.9,
      hueShift: -10, // cool, bluish
      shadowOpacity: 0.15,
      shadowLength: 8
    },
    morning: {
      brightness: 1.1,
      saturation: 1.1,
      hueShift: 0,
      shadowOpacity: 0.25,
      shadowLength: 6
    },
    afternoon: {
      brightness: 1.2,
      saturation: 1.2,
      hueShift: 5, // warm, golden
      shadowOpacity: 0.3,
      shadowLength: 3
    },
    evening: {
      brightness: 0.9,
      saturation: 0.9,
      hueShift: 0, // preserve theme colors during golden hour (was: 15)
      shadowOpacity: 0.35,
      shadowLength: 10
    },
    night: {
      brightness: 0.75, // Increased from 0.4 to make it visible
      saturation: 0.8, // Increased from 0.6 to maintain color
      hueShift: -15, // Moonlit blue (less extreme)
      shadowOpacity: 0.3, // Lighter shadows
      shadowLength: 6
    }
  };

  return lighting[timeOfDay];
}

/**
 * Calculate shadow angle based on sun position
 * Returns angle in degrees (0-360)
 */
export function getShadowAngle(hour: number, _sunPosition: number): number {
  // Morning: shadows point west (270°)
  // Noon: shadows point north (0°)
  // Evening: shadows point east (90°)

  if (hour < 6 || hour >= 18) {
    return 0; // No strong shadow at night
  }

  if (hour < 12) {
    // Morning: transition from 270° to 0°
    const progress = (hour - 6) / 6;
    return 270 - (progress * 270);
  } else {
    // Afternoon: transition from 0° to 90°
    const progress = (hour - 12) / 6;
    return progress * 90;
  }
}
