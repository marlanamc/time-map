#!/usr/bin/env node
/**
 * Syncs CSS link tags in index.html with concat-css.js
 * Run: node scripts/sync-css-links.js
 * 
 * This ensures index.html and the build process always use the same CSS files in the same order.
 */

const fs = require('fs/promises');
const path = require('path');

// Import the authoritative CSS file list
const CSS_FILES = [
  'styles/core/variables.css',
  'styles/core/reset.css',
  'styles/background/pollen.css',
  'styles/background/fireflies.css',
  'styles/background/garden.css',
  'styles/layout/app.css',
  'styles/layout/header.css',
  'styles/components/interactive.css',
  'styles/components/buttons.css',
  'styles/components/sidebar.css',
  'styles/components/modals.css',
  'styles/views/main-content.css',
  'styles/views/canvas.css',
  'styles/views/month.css',
  'styles/views/month-context.css',
  'styles/views/year.css',
  'styles/views/week.css',
  'styles/views/day.css',
  'styles/dayView/layout.css',
  'styles/dayView/cards.css',
  'styles/dayView/drag.css',
  'styles/dayView/responsive.css',
  'styles/dayView/simple.css',
  'styles/dayView/planner.css',
  'styles/features/celebration.css',
  'styles/features/confetti.css',
  'styles/features/toast.css',
  'styles/features/review-prompt.css',
  'styles/features/month-detail.css',
  'styles/features/focus-mode.css',
  'styles/features/quick-add.css',
  'styles/features/support-panel.css',
  'styles/features/keyboard-modal.css',
  'styles/features/auth-modal.css',
  'styles/features/time-viz.css',
  'styles/themes/accents.css',
  'styles/themes/picker.css',
  'styles/themes/seasonal.css',
  'styles/accessibility/wcag.css',
  'styles/accessibility/dyslexia.css',
  'styles/accessibility/colorblind.css',
  'styles/accessibility/simplified.css',
  'styles/accessibility/high-contrast.css',
  'styles/accessibility/reduced-motion.css',
  'styles/accessibility/minimal-feedback.css',
  'styles/accessibility/reduced-emoji.css',
  'styles/accessibility/sensory.css',
  'styles/accessibility/touch-targets.css',
  'styles/animations/keyframes.css',
  'styles/responsive/mobile.css',
  'styles/responsive/mobile-tabs.css',
  'styles/mobile/home.css',
  'styles/utilities/print.css',
  'styles/utilities/sound-controls.css',
  'styles/custom/garden-menu.css',
];

async function syncCssLinks() {
  const root = process.cwd();
  const htmlPath = path.join(root, 'index.html');
  
  let html = await fs.readFile(htmlPath, 'utf-8');
  
  // Generate link tags with cache-busting timestamp for dev
  const timestamp = Date.now();
  const linkTags = CSS_FILES.map(file => 
    `    <link rel="stylesheet" href="${file}?v=${timestamp}" />`
  ).join('\n');
  
  // Replace content between CSS_START and CSS_END markers
  const startMarker = '<!-- CSS_START -->';
  const endMarker = '<!-- CSS_END -->';
  
  const startIdx = html.indexOf(startMarker);
  const endIdx = html.indexOf(endMarker);
  
  if (startIdx === -1 || endIdx === -1) {
    console.error('❌ Could not find CSS_START/CSS_END markers in index.html');
    process.exit(1);
  }
  
  const before = html.substring(0, startIdx + startMarker.length);
  const after = html.substring(endIdx);
  
  html = before + '\n' + linkTags + '\n    ' + after;
  
  await fs.writeFile(htmlPath, html);
  
  console.log(`✅ Synced ${CSS_FILES.length} CSS links in index.html`);
  console.log(`   Cache-bust version: ${timestamp}`);
}

syncCssLinks().catch(err => {
  console.error('❌ Failed to sync CSS links:', err);
  process.exit(1);
});




