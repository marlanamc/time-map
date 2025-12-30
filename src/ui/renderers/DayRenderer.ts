// ===================================
// Day View Renderer
// ===================================
// NOTE: This renderer is deprecated. Day view is now handled by UIManager's dayViewController.
// This file is kept for backwards compatibility but should not be used.

import type { UIElements } from '../../types';

export const DayRenderer = {
  render(_elements: UIElements) {
    console.warn('DayRenderer is deprecated. Day view is handled by UIManager.');
    // Day view is now managed directly in UIManager with proper callbacks and config
  },

  destroy() {
    // No-op - dayViewController is managed by UIManager
  }
};
