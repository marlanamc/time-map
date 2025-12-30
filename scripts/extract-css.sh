#!/bin/bash

echo "🔨 Extracting CSS files from styles.css..."
echo ""

# Core (Foundation)
echo "📁 Extracting core files..."
sed -n '1,170p' styles.css > styles/core/variables.css
echo "  ✓ styles/core/variables.css (170 lines)"

sed -n '172,238p' styles.css > styles/core/reset.css
echo "  ✓ styles/core/reset.css (67 lines)"

# Background
echo ""
echo "📁 Extracting background files..."
sed -n '239,288p' styles.css > styles/background/pollen.css
echo "  ✓ styles/background/pollen.css (50 lines)"

sed -n '289,522p' styles.css > styles/background/fireflies.css
echo "  ✓ styles/background/fireflies.css (234 lines)"

sed -n '523,712p' styles.css > styles/background/garden.css
echo "  ✓ styles/background/garden.css (190 lines)"

# Layout
echo ""
echo "📁 Extracting layout files..."
sed -n '713,730p' styles.css > styles/layout/app.css
echo "  ✓ styles/layout/app.css (18 lines)"

sed -n '731,1171p' styles.css > styles/layout/header.css
echo "  ✓ styles/layout/header.css (441 lines)"

# Components
echo ""
echo "📁 Extracting component files..."
sed -n '1172,1403p' styles.css > styles/components/interactive.css
echo "  ✓ styles/components/interactive.css (232 lines)"

sed -n '1404,1530p' styles.css > styles/components/buttons.css
echo "  ✓ styles/components/buttons.css (127 lines)"

sed -n '1531,1998p' styles.css > styles/components/sidebar.css
echo "  ✓ styles/components/sidebar.css (468 lines)"

# Modals - CORRECTED RANGE (was 4227-7306, now 4227-4976)
sed -n '4227,4976p' styles.css > styles/components/modals.css
echo "  ✓ styles/components/modals.css (750 lines)"

# Views
echo ""
echo "📁 Extracting view files..."
sed -n '1999,2610p' styles.css > styles/views/main-content.css
echo "  ✓ styles/views/main-content.css (612 lines)"

sed -n '2611,2877p' styles.css > styles/views/canvas.css
echo "  ✓ styles/views/canvas.css (267 lines)"

sed -n '2878,3004p' styles.css > styles/views/month.css
echo "  ✓ styles/views/month.css (127 lines)"

sed -n '3005,3146p' styles.css > styles/views/week.css
echo "  ✓ styles/views/week.css (142 lines)"

sed -n '3147,4226p' styles.css > styles/views/day.css
echo "  ✓ styles/views/day.css (1,080 lines)"

# Animations
echo ""
echo "📁 Extracting animation files..."
sed -n '4977,5134p' styles.css > styles/animations/keyframes.css
echo "  ✓ styles/animations/keyframes.css (158 lines)"

# Features
echo ""
echo "📁 Extracting feature files..."
sed -n '5135,5234p' styles.css > styles/features/celebration.css
echo "  ✓ styles/features/celebration.css (100 lines)"

sed -n '5235,5265p' styles.css > styles/features/confetti.css
echo "  ✓ styles/features/confetti.css (31 lines)"

sed -n '5266,5308p' styles.css > styles/features/toast.css
echo "  ✓ styles/features/toast.css (43 lines)"

sed -n '5309,5425p' styles.css > styles/features/review-prompt.css
echo "  ✓ styles/features/review-prompt.css (117 lines)"

sed -n '5426,5514p' styles.css > styles/features/month-detail.css
echo "  ✓ styles/features/month-detail.css (89 lines)"

sed -n '5515,5522p' styles.css > styles/features/focus-mode.css
echo "  ✓ styles/features/focus-mode.css (8 lines)"

sed -n '5523,5964p' styles.css > styles/features/quick-add.css
echo "  ✓ styles/features/quick-add.css (442 lines)"

sed -n '7790,8440p' styles.css > styles/features/support-panel.css
echo "  ✓ styles/features/support-panel.css (651 lines)"

sed -n '8726,8810p' styles.css > styles/features/keyboard-modal.css
echo "  ✓ styles/features/keyboard-modal.css (85 lines)"

sed -n '9010,9076p' styles.css > styles/features/auth-modal.css
echo "  ✓ styles/features/auth-modal.css (67 lines)"

sed -n '9208,9517p' styles.css > styles/features/time-viz.css
echo "  ✓ styles/features/time-viz.css (310 lines)"

# Responsive
echo ""
echo "📁 Extracting responsive files..."
sed -n '5965,6762p' styles.css > styles/responsive/mobile.css
echo "  ✓ styles/responsive/mobile.css (798 lines)"

sed -n '6763,6862p' styles.css > styles/responsive/mobile-tabs.css
echo "  ✓ styles/responsive/mobile-tabs.css (100 lines)"

# Themes
echo ""
echo "📁 Extracting theme files..."
sed -n '6863,6931p' styles.css > styles/themes/accents.css
echo "  ✓ styles/themes/accents.css (69 lines)"

sed -n '6932,6984p' styles.css > styles/themes/picker.css
echo "  ✓ styles/themes/picker.css (53 lines)"

sed -n '9077,9207p' styles.css > styles/themes/seasonal.css
echo "  ✓ styles/themes/seasonal.css (131 lines)"

# Accessibility
echo ""
echo "📁 Extracting accessibility files..."
sed -n '6985,7789p' styles.css > styles/accessibility/wcag.css
echo "  ✓ styles/accessibility/wcag.css (805 lines)"

sed -n '8441,8485p' styles.css > styles/accessibility/dyslexia.css
echo "  ✓ styles/accessibility/dyslexia.css (45 lines)"

sed -n '8486,8533p' styles.css > styles/accessibility/colorblind.css
echo "  ✓ styles/accessibility/colorblind.css (48 lines)"

sed -n '8534,8559p' styles.css > styles/accessibility/simplified.css
echo "  ✓ styles/accessibility/simplified.css (26 lines)"

sed -n '8560,8578p' styles.css > styles/accessibility/high-contrast.css
echo "  ✓ styles/accessibility/high-contrast.css (19 lines)"

sed -n '8579,8599p' styles.css > styles/accessibility/reduced-motion.css
echo "  ✓ styles/accessibility/reduced-motion.css (21 lines)"

sed -n '8600,8612p' styles.css > styles/accessibility/minimal-feedback.css
echo "  ✓ styles/accessibility/minimal-feedback.css (13 lines)"

sed -n '8613,8699p' styles.css > styles/accessibility/reduced-emoji.css
echo "  ✓ styles/accessibility/reduced-emoji.css (87 lines)"

sed -n '8700,8710p' styles.css > styles/accessibility/sensory.css
echo "  ✓ styles/accessibility/sensory.css (11 lines)"

sed -n '8711,8725p' styles.css > styles/accessibility/touch-targets.css
echo "  ✓ styles/accessibility/touch-targets.css (15 lines)"

# Utilities
echo ""
echo "📁 Extracting utility files..."
sed -n '8811,9009p' styles.css > styles/utilities/print.css
echo "  ✓ styles/utilities/print.css (199 lines)"

sed -n '9518,9689p' styles.css > styles/utilities/sound-controls.css
echo "  ✓ styles/utilities/sound-controls.css (172 lines)"

# Custom
echo ""
echo "📁 Extracting custom files..."
sed -n '9690,10414p' styles.css > styles/custom/garden-menu.css
echo "  ✓ styles/custom/garden-menu.css (725 lines)"

echo ""
echo "✅ Extraction complete!"
echo ""

# Validation
TOTAL_LINES=$(cat styles/{core,background,layout,components,views,features,themes,accessibility,animations,responsive,utilities,custom}/*.css 2>/dev/null | wc -l | tr -d ' ')
echo "📊 Validation:"
echo "  Total lines extracted: $TOTAL_LINES"
echo "  Expected: 10,414 lines"

if [ "$TOTAL_LINES" -eq "10414" ]; then
    echo "  ✅ Line count matches!"
else
    echo "  ⚠️  Line count mismatch (difference: $((10414 - TOTAL_LINES)) lines)"
fi

echo ""
echo "📁 Files created: $(find styles/{core,background,layout,components,views,features,themes,accessibility,animations,responsive,utilities,custom} -name "*.css" -type f 2>/dev/null | wc -l | tr -d ' ')"
echo ""
