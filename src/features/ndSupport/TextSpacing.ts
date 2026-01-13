// Text Spacing Preferences
import { State } from '../../core/State';
import { ND_CONFIG } from '../../config';
import type { TextSpacing, NDSupportCallbacks } from './types';

export class TextSpacingManager {
  setCallbacks(_callbacks: NDSupportCallbacks): void {
    // Callbacks stored for potential future use
  }

  apply(preference?: TextSpacing): void {
    if (!State.data) return;
    const textSpacing = preference || State.data.preferences.nd.textSpacing;
    const spacingOptions = ND_CONFIG.TEXT_SPACING as Record<TextSpacing, { lineHeight: string; letterSpacing: string; wordSpacing: string }>;
    
    if (textSpacing && spacingOptions[textSpacing]) {
      const spacing = spacingOptions[textSpacing];
      const root = document.documentElement;
      root.style.setProperty("--line-height-base", spacing.lineHeight);
      root.style.setProperty("--letter-spacing", spacing.letterSpacing);
      root.style.setProperty("--word-spacing", spacing.wordSpacing);
    }
  }
}
