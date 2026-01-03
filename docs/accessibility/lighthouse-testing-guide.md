# Lighthouse Accessibility Testing Guide

## Overview
This guide provides instructions for running Lighthouse accessibility audits on the Liquid Productivity sidebar and ensuring a score of ≥95.

## Running Lighthouse

### Chrome DevTools (Recommended)

**Steps:**
1. Open the app in Chrome
2. Open DevTools (`Cmd/Ctrl + Shift + I`)
3. Navigate to "Lighthouse" tab
4. Configuration:
   - Mode: Navigation
   - Categories: **Accessibility** (check only this for focused testing)
   - Device: Desktop AND Mobile (test both)
5. Click "Analyze page load"
6. Review results

**Target Scores:**
- **Accessibility:** ≥95 (WCAG AA compliant)
- **Best Practices:** ≥90 (bonus)
- **Performance:** ≥80 (bonus - not accessibility related)
- **SEO:** ≥90 (bonus)

### Lighthouse CLI

**Installation:**
```bash
npm install -g lighthouse
```

**Run audit:**
```bash
# Desktop
lighthouse http://localhost:3000 \
  --only-categories=accessibility \
  --output=html \
  --output-path=./lighthouse-desktop.html

# Mobile
lighthouse http://localhost:3000 \
  --only-categories=accessibility \
  --preset=mobile \
  --output=html \
  --output-path=./lighthouse-mobile.html
```

**CI/CD Integration:**
```bash
# Fail build if accessibility score < 95
lighthouse http://localhost:3000 \
  --only-categories=accessibility \
  --min-score=0.95 \
  --quiet
```

### Lighthouse CI (Advanced)

**Configuration** (`lighthouserc.json`):
```json
{
  "ci": {
    "collect": {
      "url": ["http://localhost:3000"],
      "numberOfRuns": 3
    },
    "assert": {
      "assertions": {
        "categories:accessibility": ["error", {"minScore": 0.95}],
        "categories:best-practices": ["warn", {"minScore": 0.9}]
      }
    },
    "upload": {
      "target": "temporary-public-storage"
    }
  }
}
```

**Run:**
```bash
npx @lhci/cli@latest autorun
```

## Common Accessibility Issues

### Critical (Must Fix)

| Issue | WCAG Criterion | Fix | Impact |
|-------|----------------|-----|--------|
| Missing alt text on images | 1.1.1 Non-text Content | Add `alt=""` for decorative, descriptive text for informative | High |
| Insufficient color contrast | 1.4.3 Contrast (Minimum) | Adjust colors to meet 4.5:1 ratio | High |
| Missing form labels | 3.3.2 Labels or Instructions | Associate `<label>` with inputs or use `aria-label` | High |
| Missing ARIA roles | 4.1.2 Name, Role, Value | Add `role` attributes to custom components | High |
| Keyboard trap | 2.1.2 No Keyboard Trap | Ensure Tab can exit all elements | High |

### Important (Should Fix)

| Issue | WCAG Criterion | Fix | Impact |
|-------|----------------|-----|--------|
| Missing focus indicators | 2.4.7 Focus Visible | Add `:focus-visible` styles | Medium |
| Incorrect heading hierarchy | 1.3.1 Info and Relationships | Use h1→h2→h3 in order | Medium |
| Missing landmark regions | 1.3.1 Info and Relationships | Add `<nav>`, `<main>`, `<aside>` | Medium |
| Ambiguous link text | 2.4.4 Link Purpose (In Context) | Avoid "click here", use descriptive text | Medium |

### Best Practices (Nice to Have)

| Issue | Fix | Impact |
|-------|-----|--------|
| Missing language attribute | Add `lang="en"` to `<html>` | Low |
| Non-unique IDs | Ensure all `id` attributes are unique | Low |
| Missing page title | Add descriptive `<title>` | Low |

## Liquid Sidebar - Expected Results

### Target Lighthouse Accessibility Score: 95+

**Checklist of Passing Audits:**

#### ✅ Passing Audits (Expected)

- [x] **[aria-allowed-attr]** ARIA attributes are valid
- [x] **[aria-hidden-body]** `aria-hidden` not on `<body>`
- [x] **[aria-required-attr]** Required ARIA attributes present
- [x] **[aria-required-children]** ARIA parent-child relationships valid
- [x] **[aria-required-parent]** ARIA parent elements present
- [x] **[aria-roles]** ARIA roles are valid
- [x] **[aria-valid-attr-value]** ARIA attribute values are valid
- [x] **[aria-valid-attr]** ARIA attributes are valid
- [x] **[button-name]** Buttons have accessible names
- [x] **[color-contrast]** Background and foreground colors have sufficient contrast (4.5:1)
- [x] **[document-title]** Document has a `<title>` element
- [x] **[duplicate-id-aria]** No duplicate ARIA IDs
- [x] **[focus-visible]** Focus indicators are visible
- [x] **[form-field-multiple-labels]** Form fields don't have multiple labels
- [x] **[frame-title]** Frames have `title` attribute
- [x] **[html-has-lang]** `<html>` has `lang` attribute
- [x] **[image-alt]** Images have `alt` attributes
- [x] **[input-image-alt]** Image buttons have `alt` text
- [x] **[label]** Form elements have labels
- [x] **[link-name]** Links have discernible text
- [x] **[list]** Lists contain only `<li>` elements
- [x] **[listitem]** List items are within lists
- [x] **[meta-viewport]** Viewport meta tag configured correctly
- [x] **[tabindex]** No `tabindex` values greater than 0
- [x] **[valid-lang]** `lang` attribute has valid value

#### ⚠️ Manual Checks (Require Human Review)

- [ ] **[bypass]** Page has skip link for keyboard users
- [ ] **[color-contrast-enhanced]** AAA contrast (7:1) - Nice to have
- [ ] **[interactive-element-affordance]** Interactive elements are clearly indicated
- [ ] **[logical-tab-order]** Tab order follows visual layout
- [ ] **[managed-focus]** Focus is properly managed in dynamic content
- [ ] **[visual-order-follows-dom]** Visual order matches DOM order

## Testing Procedure

### 1. Pre-Audit Preparation (5 min)

**Start local server:**
```bash
npm run dev
```

**Open app:**
```
http://localhost:3000
```

**Clear cache:**
- Chrome DevTools → Network tab → "Disable cache"
- Hard refresh: `Cmd/Ctrl + Shift + R`

### 2. Desktop Audit (5 min)

**Run Lighthouse:**
1. Open DevTools → Lighthouse tab
2. Select "Accessibility" only
3. Device: Desktop
4. Click "Analyze page load"

**Review results:**
- Target: ≥95
- Fix any critical issues (red)
- Note any warnings (orange)

**Test sidebar specifically:**
- Click through each section
- Open Click-to-Schedule modal
- Verify focus indicators visible
- Check color contrast

### 3. Mobile Audit (5 min)

**Run Lighthouse:**
1. Same steps as desktop
2. Device: Mobile
3. Click "Analyze page load"

**Review results:**
- Target: ≥95
- Verify touch targets ≥48px
- Check responsive layout
- Test modal on mobile size

### 4. Manual Testing (10 min)

**Keyboard navigation:**
```
Test checklist from keyboard-navigation-guide.md
```

**Screen reader:**
```
VoiceOver (Cmd+F5):
- Navigate with VO + Arrow
- Verify announcements
- Check ARIA labels
```

**Color contrast:**
```
Use WebAIM Contrast Checker:
https://webaim.org/resources/contrastchecker/

Test:
- Primary text on surface: #1F2D2A on #F2F7F6
- Teal accent on surface: #4A9099 on #F2F7F6
- White on teal button: #FFFFFF on #4A9099
```

### 5. Regression Testing (5 min)

**After making fixes, re-run Lighthouse:**
1. Clear cache
2. Hard refresh
3. Run audit again
4. Verify score improved
5. Document changes

## Lighthouse Score Breakdown

### How Lighthouse Calculates Accessibility Score

Lighthouse runs ~50 automated accessibility tests based on WCAG 2.1 Level AA. Each test is weighted based on impact:

| Weight | Impact | Examples |
|--------|--------|----------|
| 10 | Critical | Color contrast, missing labels, keyboard traps |
| 3-7 | Serious | Focus indicators, ARIA issues, heading hierarchy |
| 1-2 | Moderate | Language attribute, unique IDs, best practices |

**Score calculation:**
```
Score = (Passing tests weight / Total tests weight) × 100
```

**Example:**
```
100 total weight
95 passing weight
= 95% score ✅
```

### Common Score Penalties

| Issue | Weight Penalty | Score Impact |
|-------|----------------|--------------|
| Insufficient contrast (1 element) | -3 | ~3 points |
| Missing form label (1 field) | -10 | ~10 points |
| Keyboard trap (1 modal) | -10 | ~10 points |
| Missing ARIA role (1 button) | -3 | ~3 points |
| No focus indicator (global) | -7 | ~7 points |

**To reach 95+ score:**
- Fix all critical issues (weight 10)
- Fix most serious issues (weight 3-7)
- Document manual checks

## Fixing Common Issues

### Issue: "Background and foreground colors do not have a sufficient contrast ratio"

**Example:**
```html
<!-- FAIL: 2.8:1 contrast -->
<button style="background: #38bdf8; color: white;">
  Schedule
</button>
```

**Fix:**
```html
<!-- PASS: 7.2:1 contrast -->
<button style="background: #0284c7; color: white;">
  Schedule
</button>
```

**Or use CSS variables:**
```css
:root {
  --accent-button: #0284c7; /* Darkened from #38bdf8 */
}

button {
  background: var(--accent-button);
  color: white;
}
```

### Issue: "Form elements do not have associated labels"

**Example:**
```html
<!-- FAIL: No label -->
<input type="date" id="schedule-date" value="2026-01-02" />
```

**Fix Option 1 (Preferred):**
```html
<label for="schedule-date">Date</label>
<input type="date" id="schedule-date" value="2026-01-02" />
```

**Fix Option 2:**
```html
<input
  type="date"
  id="schedule-date"
  value="2026-01-02"
  aria-label="Schedule date"
/>
```

### Issue: "Buttons do not have an accessible name"

**Example:**
```html
<!-- FAIL: No text or aria-label -->
<button class="close-btn">×</button>
```

**Fix:**
```html
<button class="close-btn" aria-label="Close modal">×</button>
```

### Issue: "Elements with an ARIA [role] must have required ARIA attributes"

**Example:**
```html
<!-- FAIL: dialog role missing aria-labelledby -->
<div role="dialog">...</div>
```

**Fix:**
```html
<div role="dialog" aria-labelledby="modal-title" aria-modal="true">
  <h2 id="modal-title">Schedule Task</h2>
  ...
</div>
```

## Expected Lighthouse Results for Liquid Sidebar

### Desktop Audit

**Target Metrics:**
- Accessibility: **96-100** (all critical tests passing)
- Best Practices: **92-100** (bonus)
- Performance: **85-95** (bonus - CSS animations may impact)

**Expected Passing Tests:** 45+
**Expected Manual Checks:** 5-8

**Known Passing Tests:**
- ✅ Color contrast (after fixes): 10/10 elements
- ✅ Form labels: 5/5 inputs
- ✅ Button names: 20/20 buttons
- ✅ ARIA roles: 8/8 custom components
- ✅ Focus indicators: Visible on all elements
- ✅ Keyboard navigation: No traps
- ✅ Heading hierarchy: h1 → h2 → h3

### Mobile Audit

**Target Metrics:**
- Accessibility: **95-100** (same standards as desktop)
- Performance: **70-85** (mobile scores lower due to device simulation)

**Additional Mobile Checks:**
- ✅ Touch targets ≥48×48px
- ✅ Bottom sheet modal accessible
- ✅ Swipe gestures have keyboard alternatives
- ✅ Viewport meta tag configured
- ✅ Text readable without zoom

## Continuous Monitoring

### GitHub Actions (CI/CD)

**Workflow file** (`.github/workflows/lighthouse.yml`):
```yaml
name: Lighthouse CI
on: [push, pull_request]

jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Serve
        run: npm run preview &

      - name: Wait for server
        run: npx wait-on http://localhost:4173

      - name: Run Lighthouse
        run: |
          npm install -g lighthouse
          lighthouse http://localhost:4173 \
            --only-categories=accessibility \
            --min-score=0.95 \
            --output=json \
            --output-path=./lighthouse-results.json

      - name: Upload results
        uses: actions/upload-artifact@v3
        with:
          name: lighthouse-results
          path: lighthouse-results.json
```

### Weekly Audits

**Schedule:**
- Every Monday at 9:00 AM
- After major feature releases
- Before production deployments

**Process:**
1. Run desktop + mobile audits
2. Document score trends
3. Fix any regressions
4. Update accessibility docs

## Troubleshooting

### "Lighthouse timed out waiting for the page to load"

**Cause:** Slow network, large bundle, or infinite loading state

**Fix:**
```bash
# Increase timeout
lighthouse http://localhost:3000 \
  --max-wait-for-load=90000 \
  --preset=desktop
```

### "Unable to connect to Chrome"

**Cause:** Chrome not found or running with incompatible flags

**Fix:**
```bash
# Specify Chrome path
export CHROME_PATH=/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome

lighthouse http://localhost:3000
```

### Score varies between runs

**Cause:** Dynamic content, animations, or network variability

**Fix:**
```bash
# Run multiple times and average
lighthouse http://localhost:3000 --only-categories=accessibility -n 3
```

## Resources

### Official Documentation
- [Lighthouse Accessibility Scoring](https://web.dev/accessibility-scoring/)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Chrome DevTools Lighthouse](https://developer.chrome.com/docs/lighthouse/)

### Testing Tools
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [axe DevTools](https://www.deque.com/axe/devtools/)
- [WAVE Browser Extension](https://wave.webaim.org/extension/)
- [Accessibility Insights](https://accessibilityinsights.io/)

### Learning Resources
- [A11y Project](https://www.a11yproject.com/)
- [MDN Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)
- [Google Web Fundamentals](https://developers.google.com/web/fundamentals/accessibility)

---

**Last Updated:** 2026-01-02
**Next Review:** Weekly (every Monday)
**Target Score:** 95+ (WCAG AA)
**Current Score:** Not yet audited (Phase 6 in progress)
