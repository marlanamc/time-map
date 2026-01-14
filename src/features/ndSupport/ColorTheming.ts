// Color Theming for accent colors
import { State } from '../../core/State';
import type { AccentTheme, NDSupportCallbacks } from './types';

export class ColorTheming {
  setCallbacks(_callbacks: NDSupportCallbacks): void {
    // Callbacks stored for potential future use
  }

  apply(preference?: AccentTheme): void {
    if (!State.data) return;
    const accentTheme = preference || State.data.preferences.nd.accentTheme;
    
    if (!accentTheme) return;

    const themeClasses = [
      "theme-rose",
      "theme-coral",
      "theme-amber",
      "theme-mint",
      "theme-sage",
      "theme-sky",
      "theme-teal",
      "theme-indigo",
      "theme-violet",
      "theme-rainbow",
      "theme-dawn",
      "theme-morning",
      "theme-afternoon",
      "theme-evening",
      "theme-night",
    ] as const;

    // Remove all theme classes first
    document.body.classList.remove(...themeClasses);
    document.documentElement.classList.remove(...themeClasses);

    const themeClass = `theme-${accentTheme}`;
    document.body.classList.add(themeClass);
    document.documentElement.classList.add(themeClass);
  }
}
