const fs = require('fs/promises');
const path = require('path');

// CRITICAL: This order must match HTML link tags exactly
const CSS_FILES = [
  // 1. Core Foundation (MUST load first)
  'styles/core/variables.css',
  'styles/core/reset.css',

  // 2. Background Layer
  'styles/background/pollen.css',
  'styles/background/fireflies.css',
  'styles/background/garden.css',

  // 3. Layout Foundation
  'styles/layout/app.css',
  'styles/layout/header.css',

  // 4. Components
  'styles/components/interactive.css',
  'styles/components/buttons.css',
  'styles/components/sidebar.css',
  'styles/components/modals.css',

  // 5. Views
  'styles/views/main-content.css',
  'styles/views/canvas.css',
  'styles/views/month.css',
  'styles/views/month-context.css',
  'styles/views/year.css',
  'styles/views/week.css',
  'styles/views/day.css',

  // 6. Day View Modules (existing)
  'styles/dayView/layout.css',
  'styles/dayView/cards.css',
  'styles/dayView/drag.css',
  'styles/dayView/responsive.css',
  'styles/dayView/simple.css',
  'styles/dayView/planner.css',

  // 7. Features
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

  // 8. Themes
  'styles/themes/accents.css',
  'styles/themes/picker.css',
  'styles/themes/seasonal.css',

  // 9. Accessibility (loads after base styles to override)
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

  // 10. Animations
  'styles/animations/keyframes.css',

  // 11. Responsive (loads late to override base styles)
  'styles/responsive/mobile.css',
  'styles/responsive/mobile-tabs.css',

  // 12. Mobile (existing)
  'styles/mobile/home.css',

  // 13. Utilities (loads last)
  'styles/utilities/print.css',
  'styles/utilities/sound-controls.css',

  // 14. Custom (loads very last)
  'styles/custom/garden-menu.css',
];

async function concat() {
  const root = process.cwd();
  let bundle = '';
  let hasGoogleFonts = false;

  console.log('🔨 Concatenating CSS files...\n');

  // Validate all files exist first
  for (const file of CSS_FILES) {
    const filePath = path.join(root, file);
    try {
      await fs.access(filePath);
    } catch (err) {
      console.error(`❌ Missing CSS file: ${file}`);
      process.exit(1);
    }
  }

  // Concatenate files
  for (const file of CSS_FILES) {
    const filePath = path.join(root, file);

    try {
      const content = await fs.readFile(filePath, 'utf-8');

      // Skip duplicate Google Fonts imports (keep only first occurrence)
      if (content.includes('@import url("https://fonts.googleapis.com')) {
        if (hasGoogleFonts) {
          console.log(`  ⏭️  Skipping duplicate font import in ${file}`);
          // Remove the @import line but keep the rest
          const lines = content.split('\n');
          const filtered = lines.filter(line => !line.includes('@import url("https://fonts.googleapis.com'));
          bundle += `\n/* ============================================================================= */\n`;
          bundle += `/* Source: ${file} */\n`;
          bundle += `/* ============================================================================= */\n\n`;
          bundle += filtered.join('\n');
          bundle += '\n';
          continue;
        }
        hasGoogleFonts = true;
      }

      bundle += `\n/* ============================================================================= */\n`;
      bundle += `/* Source: ${file} */\n`;
      bundle += `/* ============================================================================= */\n\n`;
      bundle += content;
      bundle += '\n';

      console.log(`  ✓ ${file}`);
    } catch (err) {
      console.error(`  ❌ Error reading ${file}:`, err.message);
      process.exit(1);
    }
  }

  const outputPath = path.join(root, 'styles.bundle.css');
  await fs.writeFile(outputPath, bundle);

  console.log(`\n✅ Concatenation complete: ${outputPath}`);
  console.log(`   Total files: ${CSS_FILES.length}`);
  console.log(`   Bundle size: ${(bundle.length / 1024).toFixed(2)} KB`);
  console.log(`   Ready for minification with cleancss\n`);
}

concat().catch((err) => {
  console.error('❌ CSS concatenation failed:', err);
  process.exit(1);
});
